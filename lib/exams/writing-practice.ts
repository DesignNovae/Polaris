import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api/respond";
import type { WritingTask } from "@/lib/action-lab/types";
import { getDb } from "@/lib/db/mongodb";
import type { PracticeDifficulty, PracticeGenerationSource } from "@/lib/exams/practice-generation";

const WRITING_PRACTICES = "exam_writing_practices";
let indexPromise: Promise<void> | null = null;

type WritingPracticeStatus = "pending" | "ready" | "in_progress" | "submitted" | "error";

type DbWritingPractice = {
  _id: ObjectId;
  userId: string;
  kind: "ielts-writing-task-2";
  difficulty: PracticeDifficulty;
  promptVersion: "writing-v2.0";
  model: string;
  source?: PracticeGenerationSource;
  status: WritingPracticeStatus;
  task?: WritingTask;
  response: string;
  revision: number;
  startedAt?: Date;
  expiresAt?: Date;
  submittedAt?: Date;
  elapsedSeconds?: number;
  wordCount?: number;
  feedback?: string;
  feedbackSource?: PracticeGenerationSource;
  feedbackModel?: string;
  latencyMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

function objectId(value: string, label: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${label}`);
  return new ObjectId(value);
}

async function ensureIndexes(): Promise<void> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection(WRITING_PRACTICES).createIndex({ userId: 1, createdAt: -1 }),
      db.collection(WRITING_PRACTICES).createIndex({ userId: 1, status: 1, updatedAt: -1 }),
    ]);
  })().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

async function record(userId: string, practiceId: string): Promise<DbWritingPractice> {
  const db = await getDb();
  const found = await db.collection<DbWritingPractice>(WRITING_PRACTICES).findOne({
    _id: objectId(practiceId, "writing practice id"),
    userId,
  });
  if (!found) throw new HttpError(404, "Writing practice not found");
  return found;
}

function publicPractice(value: DbWritingPractice) {
  if (!value.task || value.status === "pending" || value.status === "error") {
    throw new HttpError(409, value.status === "error" ? "Writing task generation failed" : "Writing task is still being generated");
  }
  const remainingSeconds = value.expiresAt
    ? Math.max(0, Math.ceil((value.expiresAt.getTime() - Date.now()) / 1000))
    : value.task.timeLimitMinutes * 60;
  return {
    id: value._id.toHexString(),
    task: value.task,
    status: value.status,
    response: value.response,
    revision: value.revision,
    startedAt: value.startedAt?.toISOString(),
    expiresAt: value.expiresAt?.toISOString(),
    submittedAt: value.submittedAt?.toISOString(),
    elapsedSeconds: value.elapsedSeconds,
    remainingSeconds,
    wordCount: value.wordCount ?? 0,
    feedback: value.feedback,
    source: value.source ?? "deterministic-fallback",
    model: value.model,
    feedbackSource: value.feedbackSource,
    feedbackModel: value.feedbackModel,
    createdAt: value.createdAt.toISOString(),
  };
}

export async function beginWritingPractice(userId: string, difficulty: PracticeDifficulty, model: string): Promise<string> {
  await ensureIndexes();
  const db = await getDb();
  const _id = new ObjectId();
  const now = new Date();
  await db.collection<DbWritingPractice>(WRITING_PRACTICES).insertOne({
    _id,
    userId,
    kind: "ielts-writing-task-2",
    difficulty,
    promptVersion: "writing-v2.0",
    model,
    status: "pending",
    response: "",
    revision: 0,
    createdAt: now,
    updatedAt: now,
  });
  return _id.toHexString();
}

export async function completeWritingPractice(input: {
  userId: string;
  practiceId: string;
  task: WritingTask;
  source: PracticeGenerationSource;
  latencyMs: number;
}): Promise<void> {
  const db = await getDb();
  const updated = await db.collection<DbWritingPractice>(WRITING_PRACTICES).updateOne(
    { _id: objectId(input.practiceId, "writing practice id"), userId: input.userId, status: "pending" },
    { $set: { task: input.task, source: input.source, status: "ready", latencyMs: input.latencyMs, updatedAt: new Date() } },
  );
  if (updated.modifiedCount !== 1) throw new HttpError(409, "Writing practice generation state changed");
}

export async function failWritingPractice(userId: string, practiceId: string, error: unknown): Promise<void> {
  const db = await getDb();
  await db.collection<DbWritingPractice>(WRITING_PRACTICES).updateOne(
    { _id: objectId(practiceId, "writing practice id"), userId },
    { $set: { status: "error", error: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600), updatedAt: new Date() } },
  );
}

export async function getWritingPractice(userId: string, practiceId: string) {
  return publicPractice(await record(userId, practiceId));
}

export async function startWritingPractice(userId: string, practiceId: string) {
  const current = await record(userId, practiceId);
  if (current.status === "in_progress") return publicPractice(current);
  if (current.status !== "ready" || !current.task) throw new HttpError(409, "This writing practice cannot be started");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + current.task.timeLimitMinutes * 60_000);
  const db = await getDb();
  const updated = await db.collection<DbWritingPractice>(WRITING_PRACTICES).findOneAndUpdate(
    { _id: current._id, userId, status: "ready", revision: current.revision },
    { $set: { status: "in_progress", startedAt: now, expiresAt, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, "Writing practice changed while it was starting");
  return publicPractice(updated);
}

export async function saveWritingDraft(userId: string, practiceId: string, response: string, revision: number) {
  const db = await getDb();
  const updated = await db.collection<DbWritingPractice>(WRITING_PRACTICES).findOneAndUpdate(
    { _id: objectId(practiceId, "writing practice id"), userId, status: "in_progress", revision, expiresAt: { $gt: new Date() } },
    { $set: { response, updatedAt: new Date() }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, "A newer draft was saved or writing time has ended. Reload to continue.");
  return { revision: updated.revision, savedAt: updated.updatedAt.toISOString() };
}

export async function submitWritingPractice(userId: string, practiceId: string, response: string, revision: number) {
  const current = await record(userId, practiceId);
  if (current.status === "submitted") return publicPractice(current);
  if (current.status !== "in_progress" || !current.task || !current.startedAt) throw new HttpError(409, "Start this writing practice before submitting");
  const now = new Date();
  // Allow only enough transport time for the browser's automatic expiry
  // submission. A genuinely late request cannot replace the saved timed draft.
  const finalizationGraceMs = 10_000;
  const canAcceptRequestBody = !current.expiresAt || now.getTime() <= current.expiresAt.getTime() + finalizationGraceMs;
  const finalResponse = canAcceptRequestBody ? response : current.response;
  const wordCount = finalResponse.trim().split(/\s+/).filter(Boolean).length;
  const elapsedSeconds = Math.min(current.task.timeLimitMinutes * 60, Math.max(0, Math.round((now.getTime() - current.startedAt.getTime()) / 1000)));
  const db = await getDb();
  const updated = await db.collection<DbWritingPractice>(WRITING_PRACTICES).findOneAndUpdate(
    { _id: current._id, userId, status: "in_progress", revision },
    { $set: { status: "submitted", response: finalResponse, wordCount, elapsedSeconds, submittedAt: now, updatedAt: now }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  if (!updated) throw new HttpError(409, "A newer draft was saved. Reload before submitting.");
  return publicPractice(updated);
}

export async function writingPracticeForCoaching(userId: string, practiceId: string) {
  const current = await record(userId, practiceId);
  if (current.status !== "submitted" || !current.task) throw new HttpError(409, "Submit the writing response before requesting coaching");
  return { id: current._id.toHexString(), task: current.task, response: current.response, wordCount: current.wordCount ?? 0, elapsedSeconds: current.elapsedSeconds ?? 0 };
}

export async function updateWritingFeedback(input: {
  userId: string;
  practiceId: string;
  feedback: string;
  source: PracticeGenerationSource;
  model: string;
}): Promise<void> {
  const db = await getDb();
  const updated = await db.collection<DbWritingPractice>(WRITING_PRACTICES).updateOne(
    { _id: objectId(input.practiceId, "writing practice id"), userId: input.userId, status: "submitted" },
    { $set: { feedback: input.feedback, feedbackSource: input.source, feedbackModel: input.model, updatedAt: new Date() } },
  );
  if (updated.matchedCount !== 1) throw new HttpError(404, "Submitted writing practice not found");
}
