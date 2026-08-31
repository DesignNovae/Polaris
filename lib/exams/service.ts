import { GridFSBucket, ObjectId } from "mongodb";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "@/lib/api/respond";
import { getDb } from "@/lib/db/mongodb";
import { assembleFreshForm, getBankCoverage, recordStageExposure } from "@/lib/exams/bank";
import { isCorrect, scoreExamSession } from "@/lib/exams/scoring";
import { SAT_MATH_BLUEPRINT, SAT_MATH_SEED_ITEMS } from "@/lib/exams/seed";
import {
  EXAM_BLUEPRINTS_V2,
  EXAM_ITEMS_V2,
} from "@/lib/exams/seed-v2";
import { canTransitionExamSession } from "@/lib/exams/state-machine";
import type {
  DbExamBlueprint,
  DbExamForm,
  DbExamItem,
  DbExamResult,
  DbExamSession,
  DbExamStimulus,
  ExamCatalogAttempt,
  ExamCatalogEntry,
  ExamMode,
  ExamStartPolicy,
  ExamStageResult,
  FormItemSnapshot,
  FormStageSnapshot,
  PublicExamItem,
  PublicExamResult,
  PublicExamSession,
  ExamCoachFeedback,
} from "@/lib/exams/types";

const ITEMS = "exam_items";
const BLUEPRINTS = "exam_blueprints";
const FORMS = "exam_forms";
const SESSIONS = "exam_sessions";
const RESPONSES = "exam_responses";
const RESULTS = "exam_results";
const EVENTS = "exam_session_events";
const STIMULI = "exam_stimuli";
let seedPromise: Promise<void> | null = null;

function requireObjectId(id: string): ObjectId {
  if (!ObjectId.isValid(id)) throw new HttpError(400, "Invalid exam session id");
  return new ObjectId(id);
}

function publicItem(item: FormItemSnapshot): PublicExamItem {
  const {
    correctAnswer: _correctAnswer,
    explanation: _explanation,
    status: _status,
    ...safe
  } = item;
  return safe;
}

function stageFromLegacy(session: DbExamSession, form: DbExamForm): FormStageSnapshot {
  return {
    id: session.stageId,
    title: session.stageTitle,
    section: session.exam === "SAT" ? "Math" : session.exam,
    kind: "questions",
    durationSeconds: Math.max(1, Math.round((session.expiresAt.getTime() - session.startedAt.getTime()) / 1000)),
    questionCount: form.items?.length ?? 0,
    items: form.items ?? [],
  };
}

function currentStage(session: DbExamSession, form: DbExamForm): FormStageSnapshot {
  if (!form.stages?.length) return stageFromLegacy(session, form);
  const found = form.stages.find((stage) => stage.id === session.stageId);
  if (!found) throw new HttpError(500, "The current exam stage is missing");
  return found;
}

async function recordEvent(
  sessionId: ObjectId,
  userId: string,
  type: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const db = await getDb();
    await db.collection(EVENTS).insertOne({ sessionId, userId, type, metadata, createdAt: new Date() });
  } catch (error) {
    console.warn("[exams] event recording failed", error);
  }
}

export async function ensureExamSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    const db = await getDb();
    const now = new Date();
    const legacyMathItems = SAT_MATH_SEED_ITEMS.map((item) => ({
      ...item,
      eligibleStageIds: [SAT_MATH_BLUEPRINT.stages[0].id],
      stimulusGroupId: item.id,
      stimulusId: undefined,
    }));
    const items = [...legacyMathItems, ...EXAM_ITEMS_V2];
    const stimuli = [...new Map(items
      .filter((item) => item.stimulusId && item.stimulus)
      .map((item) => [item.stimulusId!, {
        id: item.stimulusId!,
        version: item.version,
        exam: item.exam,
        kind: item.stimulus!.kind,
        title: item.stimulus!.title,
        content: item.stimulus!.content,
        alt: item.stimulus!.alt,
        mediaUrl: item.stimulus!.mediaUrl,
        status: "approved" as const,
        provenance: item.provenance,
      }])).values()];
    const blueprints = [SAT_MATH_BLUEPRINT, ...EXAM_BLUEPRINTS_V2];
    await Promise.all([
      db.collection<DbExamItem>(ITEMS).bulkWrite(items.map((seed) => ({
        updateOne: {
          filter: { id: seed.id, version: seed.version },
          update: { $set: { ...seed, updatedAt: now }, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      })), { ordered: false }),
      db.collection<DbExamBlueprint>(BLUEPRINTS).bulkWrite(blueprints.map((blueprint) => ({
        updateOne: {
          filter: { id: blueprint.id, version: blueprint.version },
          update: { $set: { ...blueprint, updatedAt: now }, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      })), { ordered: false }),
      db.collection<DbExamStimulus>(STIMULI).bulkWrite(stimuli.map((stimulus) => ({
        updateOne: {
          filter: { id: stimulus.id, version: stimulus.version },
          update: { $set: { ...stimulus, updatedAt: now }, $setOnInsert: { createdAt: now } },
          upsert: true,
        },
      })), { ordered: false }),
    ]);
  })().catch((error) => {
    seedPromise = null;
    throw error;
  });
  return seedPromise;
}

const CATALOG: Array<{
  mode: ExamMode;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  sections: string;
}> = [
  {
    mode: "sat-math-module", title: SAT_MATH_BLUEPRINT.title,
    description: SAT_MATH_BLUEPRINT.description, durationMinutes: 35, questionCount: 22, sections: "1 Math module",
  },
  {
    mode: "sat-full", title: "Full Adaptive SAT-Style Mock",
    description: "Two adaptive Reading and Writing modules, a timed break, and two adaptive Math modules.",
    durationMinutes: 144, questionCount: 98, sections: "4 modules + break",
  },
  {
    mode: "ielts-reading", title: "IELTS Academic Reading",
    description: "Three original passages with 40 questions in a side-by-side reading workspace.",
    durationMinutes: 60, questionCount: 40, sections: "3 passages",
  },
  {
    mode: "ielts-listening", title: "IELTS Listening",
    description: "Four original audio parts with controlled playback and 40 questions.",
    durationMinutes: 40, questionCount: 40, sections: "4 audio parts",
  },
  {
    mode: "ielts-writing", title: "IELTS Academic Writing",
    description: "Task 1 and Task 2 with autosaved drafts, word counts, and optional coaching.",
    durationMinutes: 60, questionCount: 2, sections: "2 writing tasks",
  },
  {
    mode: "ielts-speaking", title: "IELTS Speaking",
    description: "Three recorded speaking parts with preparation timing and transcript notes.",
    durationMinutes: 14, questionCount: 3, sections: "3 speaking parts",
  },
];

export async function getExamCatalog(userId: string) {
  await ensureExamSeeded();
  const db = await getDb();
  // Wide enough that every one of the six modes can still resolve its active,
  // completed, and restartable attempt; the response itself is trimmed below.
  const recent = await db.collection<DbExamSession>(SESSIONS)
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(60)
    .toArray();
  const attempt = (session: DbExamSession): ExamCatalogAttempt => ({
    id: session._id!.toHexString(),
    mode: session.mode,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
    resultId: session.resultId?.toHexString(),
  });
  const available: ExamCatalogEntry[] = await Promise.all(CATALOG.map(async (entry) => {
    const coverage = await getBankCoverage(db, userId, entry.mode);
    const active = recent.find((session) => session.mode === entry.mode && session.status === "in_progress");
    const completed = recent.find((session) => session.mode === entry.mode && session.status === "completed");
    // An abandoned attempt has already consumed its questions from the fresh
    // bank, so it must stay replayable or the mode becomes a dead end.
    const restartable = recent.find((session) => session.mode === entry.mode
      && (session.status === "completed" || session.status === "abandoned"));
    return {
      ...entry,
      status: coverage.estimatedFreshForms > 0 ? "available" as const : "insufficient" as const,
      coverage,
      activeAttempt: active ? attempt(active) : undefined,
      latestCompletedAttempt: completed ? attempt(completed) : undefined,
      latestRestartableAttempt: restartable ? attempt(restartable) : undefined,
    };
  }));
  return {
    available,
    upcoming: [],
    recent: recent.filter((session) => session.status !== "abandoned").slice(0, 8).map(attempt),
  };
}

type CreateExamInput = { policy?: ExamStartPolicy; sourceSessionId?: string };

export async function createExamSession(
  userId: string,
  mode: ExamMode,
  input: CreateExamInput = {},
): Promise<{ id: string; resumed: boolean; policy: ExamStartPolicy }> {
  await ensureExamSeeded();
  const db = await getDb();
  const policy = input.policy ?? "fresh";
  const active = await db.collection<DbExamSession>(SESSIONS)
    .find({ userId, mode, status: "in_progress" })
    .sort({ updatedAt: -1 })
    .limit(1)
    .next();
  if (policy === "resume") {
    if (!active) throw new HttpError(404, "There is no active attempt to resume.");
    return { id: active._id!.toHexString(), resumed: true, policy };
  }
  if (active) throw new HttpError(409, "An active attempt already exists. Resume it or explicitly abandon it before starting over.");

  let form: DbExamForm;
  let formId: ObjectId;
  let sourceSessionId: ObjectId | undefined;
  if (policy === "same-form") {
    if (!input.sourceSessionId) throw new HttpError(400, "Choose a completed or abandoned attempt to restart.");
    sourceSessionId = requireObjectId(input.sourceSessionId);
    const source = await db.collection<DbExamSession>(SESSIONS).findOne({
      _id: sourceSessionId,
      userId,
      mode,
      status: { $in: ["completed", "abandoned"] },
    });
    if (!source) throw new HttpError(404, "The source attempt is unavailable.");
    const sourceForm = await db.collection<DbExamForm>(FORMS).findOne({ _id: source.formId });
    if (!sourceForm) throw new HttpError(500, "The original exam form is missing.");
    form = sourceForm;
    formId = source.formId;
  } else {
    form = await assembleFreshForm(db, userId, mode);
    const formInsert = await db.collection<DbExamForm>(FORMS).insertOne(form);
    formId = formInsert.insertedId;
  }

  const firstStage = form.stages?.[0];
  if (!firstStage) throw new HttpError(503, "The exam has no available stages");
  const now = new Date();
  const session: DbExamSession = {
    userId,
    exam: form.exam,
    mode,
    blueprintId: form.blueprintId,
    formId,
    status: "in_progress",
    stageId: firstStage.id,
    stageTitle: firstStage.title,
    stagePath: [firstStage.id],
    currentStageIndex: 0,
    stageResults: [],
    startedAt: now,
    stageStartedAt: now,
    expiresAt: new Date(now.getTime() + firstStage.durationSeconds * 1000),
    revision: 0,
    responses: {},
    playedAudioParts: [],
    sourceSessionId,
    createdAt: now,
    updatedAt: now,
  };
  const insert = await db.collection<DbExamSession>(SESSIONS).insertOne(session);
  await recordStageExposure(db, userId, insert.insertedId, formId, firstStage);
  await recordEvent(insert.insertedId, userId, "session_started", {
    mode,
    policy,
    formId: formId.toHexString(),
    stageId: firstStage.id,
  });
  return { id: insert.insertedId.toHexString(), resumed: false, policy };
}

export async function abandonExamSession(userId: string, sessionId: string): Promise<{ id: string; status: "abandoned" }> {
  const db = await getDb();
  const id = requireObjectId(sessionId);
  const now = new Date();
  const result = await db.collection<DbExamSession>(SESSIONS).findOneAndUpdate(
    { _id: id, userId, status: "in_progress" },
    { $set: { status: "abandoned", abandonedAt: now, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!result) {
    const existing = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: id, userId });
    if (!existing) throw new HttpError(404, "Exam session not found");
    throw new HttpError(409, "Only an active exam can be abandoned.");
  }
  await recordEvent(id, userId, "session_abandoned", { mode: result.mode, stageId: result.stageId });
  return { id: sessionId, status: "abandoned" };
}

async function sessionAndForm(userId: string, sessionId: string) {
  const db = await getDb();
  const objectId = requireObjectId(sessionId);
  const session = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: objectId, userId });
  if (!session) throw new HttpError(404, "Exam session not found");
  const form = await db.collection<DbExamForm>(FORMS).findOne({ _id: session.formId });
  if (!form) throw new HttpError(500, "Exam form is missing");
  return { db, session, form };
}

export async function getPublicExamSession(userId: string, sessionId: string): Promise<PublicExamSession> {
  let loaded = await sessionAndForm(userId, sessionId);
  if (loaded.session.status === "in_progress" && loaded.session.expiresAt.getTime() <= Date.now()) {
    await advanceExamStage(userId, sessionId, "timer_expired");
    loaded = await sessionAndForm(userId, sessionId);
  }
  const { session, form } = loaded;
  const stage = currentStage(session, form);
  const stageItemIds = new Set(stage.items.map((item) => item.id));
  const responses = Object.fromEntries(Object.entries(session.responses)
    .filter(([itemId]) => stageItemIds.has(itemId))
    .map(([itemId, response]) => [itemId, {
      answer: response.answer,
      flagged: response.flagged,
      hasRecording: Boolean(response.recordingId),
    }]));
  const activeResponses = Object.values(responses);
  return {
    id: session._id!.toHexString(),
    exam: session.exam,
    mode: session.mode,
    title: stage.title,
    section: stage.section,
    stageKind: stage.kind,
    instructions: stage.instructions,
    status: session.status,
    startedAt: session.startedAt.toISOString(),
    stageStartedAt: (session.stageStartedAt ?? session.startedAt).toISOString(),
    expiresAt: session.expiresAt.toISOString(),
    completedAt: session.completedAt?.toISOString(),
    revision: session.revision,
    stageNumber: (session.currentStageIndex ?? 0) + 1,
    totalStages: session.mode === "sat-full" ? 5 : 1,
    items: stage.items.map(publicItem),
    responses,
    playedAudioParts: session.playedAudioParts ?? [],
    answeredCount: activeResponses.filter((response) => Boolean(response.answer?.trim()) || response.hasRecording).length,
    flaggedCount: activeResponses.filter((response) => response.flagged).length,
  };
}

export async function claimListeningAudio(
  userId: string,
  sessionId: string,
  part: string,
): Promise<Uint8Array> {
  if (!/^part-[1-4]$/.test(part)) throw new HttpError(400, "Invalid listening part");
  const { db, session, form } = await sessionAndForm(userId, sessionId);
  if (session.status !== "in_progress") throw new HttpError(409, "This exam is already locked");
  if (session.expiresAt.getTime() <= Date.now()) throw new HttpError(409, "This section's time has ended");
  const stage = currentStage(session, form);
  const allowed = stage.items.some((item) => item.stimulus?.kind === "audio" && item.stimulus.mediaUrl === part);
  if (!allowed) throw new HttpError(400, "This recording does not belong to the active exam stage");
  if (session.playedAudioParts?.includes(part)) {
    throw new HttpError(409, "This recording has already been played");
  }
  const filePath = path.join(process.cwd(), "assets", "exams", "ielts-listening", `${part}.wav`);
  const audio = await readFile(filePath).catch(() => {
    throw new HttpError(503, "The listening recording is unavailable");
  });
  const claimed = await db.collection<DbExamSession>(SESSIONS).updateOne(
    { _id: session._id, userId, status: "in_progress", playedAudioParts: { $ne: part } },
    { $addToSet: { playedAudioParts: part }, $set: { updatedAt: new Date() } },
  );
  if (claimed.modifiedCount !== 1) throw new HttpError(409, "This recording has already been played");
  await recordEvent(session._id!, userId, "listening_audio_started", { part });
  return audio;
}

export async function saveExamResponse(
  userId: string,
  sessionId: string,
  input: { itemId: string; answer: string | null; flagged: boolean; revision: number },
): Promise<{ revision: number; savedAt: string }> {
  const { db, session, form } = await sessionAndForm(userId, sessionId);
  if (session.status !== "in_progress") throw new HttpError(409, "This exam is already locked");
  if (session.expiresAt.getTime() <= Date.now()) throw new HttpError(409, "This section's time has ended");
  const stage = currentStage(session, form);
  const item = stage.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new HttpError(400, "Question does not belong to the active exam stage");
  const limit = item.itemType === "long-response" || item.itemType === "speaking-response" ? 30_000 : 500;
  const answer = input.answer?.trim().slice(0, limit) || null;
  const now = new Date();
  const prior = session.responses[input.itemId];
  const state = {
    ...prior,
    answer,
    flagged: input.flagged,
    viewedAt: prior?.viewedAt ?? now,
    answeredAt: answer ? now : prior?.answeredAt,
    updatedAt: now,
  };
  const responsePath = `responses.${input.itemId}`;
  const update = await db.collection<DbExamSession>(SESSIONS).updateOne(
    { _id: session._id, userId, status: "in_progress", stageId: stage.id, revision: input.revision },
    { $set: { [responsePath]: state, updatedAt: now }, $inc: { revision: 1 } },
  );
  if (update.modifiedCount !== 1) throw new HttpError(409, "A newer answer was saved. Reload the exam to continue.");
  const nextRevision = input.revision + 1;
  const mirrorResponse = db.collection(RESPONSES).updateOne(
      { sessionId: session._id, userId, itemId: input.itemId },
      { $set: { ...state, revision: nextRevision, stageId: stage.id }, $setOnInsert: { createdAt: now } },
      { upsert: true },
    ).catch((error) => {
      console.warn("[exams] response mirror failed", error);
    });
  const auditEvent = recordEvent(session._id!, userId, input.flagged !== prior?.flagged ? "question_flagged" : "answer_saved", {
    itemId: input.itemId,
    answered: Boolean(state.answer),
    flagged: state.flagged,
    revision: nextRevision,
    stageId: stage.id,
  });
  await Promise.all([mirrorResponse, auditEvent]);
  return { revision: nextRevision, savedAt: now.toISOString() };
}

export async function saveSpeakingRecording(
  userId: string,
  sessionId: string,
  input: { itemId: string; transcript: string; revision: number; audio: Blob },
): Promise<{ revision: number; savedAt: string }> {
  if (input.audio.size === 0 || input.audio.size > 8 * 1024 * 1024) {
    throw new HttpError(400, "The recording must be between 1 byte and 8 MB");
  }
  const { db, session, form } = await sessionAndForm(userId, sessionId);
  if (session.status !== "in_progress") throw new HttpError(409, "This exam is already locked");
  if (session.expiresAt.getTime() <= Date.now()) throw new HttpError(409, "This section's time has ended");
  const stage = currentStage(session, form);
  const item = stage.items.find((candidate) => candidate.id === input.itemId);
  if (!item || item.itemType !== "speaking-response") {
    throw new HttpError(400, "This speaking prompt is not active");
  }

  const bucket = new GridFSBucket(db, { bucketName: "exam_speaking_audio" });
  const now = new Date();
  const upload = bucket.openUploadStream(`${sessionId}-${input.itemId}.webm`, {
    metadata: {
      userId,
      sessionId: session._id,
      itemId: input.itemId,
      createdAt: now,
      contentType: input.audio.type || "audio/webm",
    },
  });
  const buffer = Buffer.from(await input.audio.arrayBuffer());
  await new Promise<void>((resolve, reject) => {
    upload.once("error", reject);
    upload.once("finish", () => resolve());
    upload.end(buffer);
  });

  const prior = session.responses[input.itemId];
  const responsePath = `responses.${input.itemId}`;
  const state = {
    ...prior,
    answer: input.transcript.trim().slice(0, 30_000) || null,
    flagged: prior?.flagged ?? false,
    viewedAt: prior?.viewedAt ?? now,
    answeredAt: now,
    updatedAt: now,
    recordingId: upload.id,
    recordingMimeType: input.audio.type || "audio/webm",
  };
  const update = await db.collection<DbExamSession>(SESSIONS).updateOne(
    { _id: session._id, userId, status: "in_progress", stageId: stage.id, revision: input.revision },
    { $set: { [responsePath]: state, updatedAt: now }, $inc: { revision: 1 } },
  );
  if (update.modifiedCount !== 1) {
    await bucket.delete(upload.id).catch(() => undefined);
    throw new HttpError(409, "A newer speaking response was saved. Reload the exam to continue.");
  }
  if (prior?.recordingId) await bucket.delete(prior.recordingId).catch(() => undefined);
  await recordEvent(session._id!, userId, "speaking_recording_saved", {
    itemId: input.itemId,
    bytes: input.audio.size,
  });
  return { revision: input.revision + 1, savedAt: now.toISOString() };
}

export async function getSpeakingRecording(
  userId: string,
  sessionId: string,
  itemId: string,
): Promise<{ data: Uint8Array; contentType: string }> {
  const { db, session } = await sessionAndForm(userId, sessionId);
  const response = session.responses[itemId];
  if (!response?.recordingId) throw new HttpError(404, "Recording not found");
  const bucket = new GridFSBucket(db, { bucketName: "exam_speaking_audio" });
  const chunks: Buffer[] = [];
  const stream = bucket.openDownloadStream(response.recordingId);
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.once("error", reject);
    stream.once("end", resolve);
  });
  return {
    data: Buffer.concat(chunks),
    contentType: response.recordingMimeType || "audio/webm",
  };
}

/**
 * Scores one stage for adaptive routing. This must use the same answer
 * comparison as the final report: a module that routes on different rules than
 * it grades on can send a student down the wrong Module 2.
 */
function scoreStage(session: DbExamSession, stage: FormStageSnapshot): Omit<ExamStageResult, "completedAt"> {
  const objective = stage.items.filter((item) => item.correctAnswer);
  const correct = objective.filter((item) => isCorrect(item, session.responses[item.id]?.answer ?? null)).length;
  return {
    stageId: stage.id,
    correct,
    total: objective.length,
    accuracy: objective.length ? Math.round((correct / objective.length) * 100) : 0,
  };
}

async function finalizeLoadedSession(
  db: Awaited<ReturnType<typeof getDb>>,
  session: DbExamSession,
  form: DbExamForm,
  reason: "submitted" | "timer_expired",
): Promise<{ completed: true; resultId: string }> {
  if (session.status === "completed" && session.resultId) {
    return { completed: true, resultId: session.resultId.toHexString() };
  }
  if (!canTransitionExamSession(session.status, "completed")) throw new HttpError(409, "This exam cannot be submitted");
  const completedAt = new Date();
  const scored = scoreExamSession(session, form, completedAt);
  const resultInsert = await db.collection<DbExamResult>(RESULTS).insertOne({
    ...scored,
    sessionId: session._id!,
    userId: session.userId,
    createdAt: completedAt,
  });
  const locked = await db.collection<DbExamSession>(SESSIONS).updateOne(
    { _id: session._id, userId: session.userId, status: "in_progress", stageId: session.stageId },
    {
      $set: { status: "completed", completedAt, resultId: resultInsert.insertedId, updatedAt: completedAt },
      $inc: { revision: 1 },
    },
  );
  if (locked.modifiedCount !== 1) {
    await db.collection<DbExamResult>(RESULTS).deleteOne({ _id: resultInsert.insertedId });
    const raced = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: session._id, userId: session.userId });
    if (raced?.resultId) return { completed: true, resultId: raced.resultId.toHexString() };
    throw new HttpError(409, "The exam changed while it was being submitted");
  }
  await recordEvent(session._id!, session.userId, "exam_submitted", {
    reason,
    resultId: resultInsert.insertedId.toHexString(),
  });
  return { completed: true, resultId: resultInsert.insertedId.toHexString() };
}

export async function advanceExamStage(
  userId: string,
  sessionId: string,
  reason: "submitted" | "timer_expired" = "submitted",
): Promise<{ completed: boolean; resultId?: string; stageId?: string }> {
  const { db, session, form } = await sessionAndForm(userId, sessionId);
  if (session.status === "completed" && session.resultId) {
    return { completed: true, resultId: session.resultId.toHexString() };
  }
  const stage = currentStage(session, form);
  const stageScore = scoreStage(session, stage);
  const completedAt = new Date();
  const result: ExamStageResult = { ...stageScore, completedAt };
  const path = [...(session.stagePath ?? [stage.id])];
  let nextIndex = (session.currentStageIndex ?? 0) + 1;

  if (session.mode === "sat-full" && stage.id === "sat-rw-m1") {
    const route = stageScore.accuracy >= 60 ? "advanced" : "standard";
    result.routeSelected = route;
    path.push(`sat-rw-m2-${route}`, "sat-break", "sat-math-m1");
  } else if (session.mode === "sat-full" && stage.id === "sat-math-m1") {
    const route = stageScore.accuracy >= 60 ? "advanced" : "standard";
    result.routeSelected = route;
    path.push(`sat-math-m2-${route}`);
  }

  if (nextIndex >= path.length) {
    const sessionWithStageResult = {
      ...session,
      stagePath: path,
      stageResults: [...(session.stageResults ?? []), result],
    };
    return finalizeLoadedSession(db, sessionWithStageResult, form, reason);
  }

  const nextStage = form.stages?.find((candidate) => candidate.id === path[nextIndex]);
  if (!nextStage) throw new HttpError(500, "The next exam stage is missing");
  const now = new Date();
  const update = await db.collection<DbExamSession>(SESSIONS).updateOne(
    { _id: session._id, userId, status: "in_progress", stageId: stage.id, revision: session.revision },
    {
      $set: {
        stagePath: path,
        currentStageIndex: nextIndex,
        stageId: nextStage.id,
        stageTitle: nextStage.title,
        stageStartedAt: now,
        expiresAt: new Date(now.getTime() + nextStage.durationSeconds * 1000),
        updatedAt: now,
      },
      $push: { stageResults: result },
      $inc: { revision: 1 },
    },
  );
  if (update.modifiedCount !== 1) {
    const raced = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: session._id, userId });
    if (raced?.status === "completed" && raced.resultId) {
      return { completed: true, resultId: raced.resultId.toHexString() };
    }
    if (raced?.stageId !== stage.id) return { completed: false, stageId: raced?.stageId };
    throw new HttpError(409, "The exam stage changed while it was being submitted");
  }
  await recordStageExposure(db, userId, session._id!, session.formId, nextStage);
  await recordEvent(session._id!, userId, "stage_completed", {
    reason,
    stageId: stage.id,
    nextStageId: nextStage.id,
    accuracy: stageScore.accuracy,
    routeSelected: result.routeSelected,
  });
  return { completed: false, stageId: nextStage.id };
}

/** Backward-compatible name used by the existing submit route. */
export async function finalizeExamSession(
  userId: string,
  sessionId: string,
  reason: "submitted" | "timer_expired" = "submitted",
): Promise<{ resultId?: string; completed: boolean; stageId?: string }> {
  return advanceExamStage(userId, sessionId, reason);
}

export async function getPublicExamResult(userId: string, sessionId: string): Promise<PublicExamResult> {
  const db = await getDb();
  const objectId = requireObjectId(sessionId);
  const session = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: objectId, userId });
  if (!session) throw new HttpError(404, "Exam session not found");
  if (session.status !== "completed" || !session.resultId) throw new HttpError(409, "The exam has not been submitted");
  const result = await db.collection<DbExamResult>(RESULTS).findOne({ _id: session.resultId, userId, sessionId: objectId });
  if (!result) throw new HttpError(404, "Exam result not found");
  const previous = await db.collection<DbExamResult>(RESULTS).findOne(
    { userId, mode: result.mode, createdAt: { $lt: result.createdAt } },
    {
      sort: { createdAt: -1 },
      projection: {
        sessionId: 1,
        createdAt: 1,
        scoreKind: 1,
        correct: 1,
        total: 1,
        accuracy: 1,
        unanswered: 1,
        durationSeconds: 1,
      },
    },
  );
  const { _id, userId: _userId, ...safe } = result;
  return {
    ...safe,
    id: _id!.toHexString(),
    sessionId: safe.sessionId.toHexString(),
    createdAt: safe.createdAt.toISOString(),
    previousAttempt: previous ? {
      sessionId: previous.sessionId.toHexString(),
      createdAt: previous.createdAt.toISOString(),
      scoreKind: previous.scoreKind,
      correct: previous.correct,
      total: previous.total,
      accuracy: previous.accuracy,
      unanswered: previous.unanswered,
      durationSeconds: previous.durationSeconds,
    } : undefined,
  };
}

export async function saveExamCoachFeedback(
  userId: string,
  sessionId: string,
  feedback: ExamCoachFeedback,
): Promise<ExamCoachFeedback> {
  const db = await getDb();
  const objectId = requireObjectId(sessionId);
  const session = await db.collection<DbExamSession>(SESSIONS).findOne({ _id: objectId, userId });
  if (!session?.resultId || session.status !== "completed") throw new HttpError(409, "Complete the exam before requesting coaching");
  await db.collection<DbExamResult>(RESULTS).updateOne(
    { _id: session.resultId, userId, sessionId: objectId },
    { $set: { coachFeedback: feedback } },
  );
  return feedback;
}
