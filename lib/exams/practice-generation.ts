import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api/respond";
import type { PracticeQuestion, PublicPracticeQuestion } from "@/lib/action-lab/types";
import { getDb } from "@/lib/db/mongodb";
import type { ExamMode } from "@/lib/exams/types";

const GENERATIONS = "exam_ai_generations";
const ATTEMPTS = "exam_practice_attempts";
const RESULTS = "exam_results";
const ITEMS = "exam_items";
let indexPromise: Promise<void> | null = null;

export type PracticeDifficulty = "Foundation" | "Medium" | "Advanced";
export type PracticeGenerationSource = "gemma4" | "hybrid" | "deterministic-fallback";

export type PracticeGenerationInput = {
  exam: "IELTS" | "SAT";
  section: string;
  difficulty: PracticeDifficulty;
  targetCount: number;
  targetSkill?: string;
  sourceSessionId?: string;
};

export type PracticeBatchPlan = {
  index: number;
  count: number;
  focus: string;
  status: "pending" | "generating" | "complete" | "error";
  attempts: number;
  source?: PracticeGenerationSource;
  questionIds?: string[];
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
};

export type PracticeMasterPlan = {
  title: string;
  coverageSummary: string;
  batchSize: number;
  batches: PracticeBatchPlan[];
};

type DbPracticeGeneration = {
  _id: ObjectId;
  userId: string;
  kind: "objective-practice";
  input: PracticeGenerationInput;
  promptVersion: "practice-v2.1" | "practice-v2.2" | "practice-v2.3" | "practice-v2.4";
  model: string;
  status: "planning" | "generating" | "complete" | "error";
  plan?: PracticeMasterPlan;
  source?: PracticeGenerationSource;
  questions?: PracticeQuestion[];
  validation?: { attempts: number; rejectedReasons: string[]; avoidedPromptCount: number };
  latencyMs?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

function objectId(value: string, label: string): ObjectId {
  if (!ObjectId.isValid(value)) throw new HttpError(400, `Invalid ${label}`);
  return new ObjectId(value);
}

async function ensurePracticeIndexes(): Promise<void> {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection(GENERATIONS).createIndex({ userId: 1, createdAt: -1 }),
      db.collection(GENERATIONS).createIndex({ userId: 1, status: 1, "input.exam": 1, "input.section": 1, createdAt: -1 }),
      db.collection(ATTEMPTS).createIndex({ userId: 1, generationId: 1, createdAt: -1 }),
    ]);
  })().catch((error) => {
    indexPromise = null;
    throw error;
  });
  return indexPromise;
}

export async function beginPracticeGeneration(
  userId: string,
  input: PracticeGenerationInput,
  model: string,
): Promise<string> {
  await ensurePracticeIndexes();
  const db = await getDb();
  const _id = new ObjectId();
  const now = new Date();
  const record: DbPracticeGeneration = {
    _id,
    userId,
    kind: "objective-practice",
    input: {
      exam: input.exam,
      section: input.section,
      difficulty: input.difficulty,
      targetCount: input.targetCount,
      ...(input.targetSkill ? { targetSkill: input.targetSkill } : {}),
      ...(input.sourceSessionId ? { sourceSessionId: input.sourceSessionId } : {}),
    },
    promptVersion: "practice-v2.4",
    model,
    status: "planning",
    createdAt: now,
    updatedAt: now,
  };
  await db.collection<DbPracticeGeneration>(GENERATIONS).insertOne(record);
  return _id.toHexString();
}

export async function savePracticeMasterPlan(
  generationId: string,
  userId: string,
  plan: PracticeMasterPlan,
): Promise<void> {
  const db = await getDb();
  const result = await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    { _id: objectId(generationId, "generation id"), userId, status: "planning" },
    { $set: { plan, status: "generating", questions: [], updatedAt: new Date() } },
  );
  if (result.modifiedCount !== 1) throw new HttpError(409, "Practice generation planning state changed");
}

/**
 * A failed batch returns to `error` and may be retried, so without a ceiling a
 * client loop could re-claim the same batch forever and drive unbounded model
 * spend. Four attempts is well past what a transient provider failure needs.
 */
export const MAX_BATCH_ATTEMPTS = 4;

export async function claimPracticeBatch(userId: string, generationId: string, batchIndex: number) {
  const db = await getDb();
  const id = objectId(generationId, "generation id");
  const result = await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    {
      _id: id,
      userId,
      status: "generating",
      plan: { $exists: true },
      "plan.batches": { $elemMatch: {
        index: batchIndex,
        status: { $in: ["pending", "error"] },
        attempts: { $lt: MAX_BATCH_ATTEMPTS },
      } },
    } as never,
    {
      $set: {
        "plan.batches.$[batch].status": "generating",
        "plan.batches.$[batch].startedAt": new Date(),
        "plan.batches.$[batch].error": "",
        updatedAt: new Date(),
      },
      $inc: { "plan.batches.$[batch].attempts": 1 },
    },
    { arrayFilters: [{
      "batch.index": batchIndex,
      "batch.status": { $in: ["pending", "error"] },
      "batch.attempts": { $lt: MAX_BATCH_ATTEMPTS },
    }] },
  );
  if (result.modifiedCount !== 1) {
    const existing = await db.collection<DbPracticeGeneration>(GENERATIONS).findOne({ _id: id, userId });
    const batch = existing?.plan?.batches.find((value) => value.index === batchIndex);
    if (batch?.status === "complete") return { generation: existing!, batch, alreadyComplete: true };
    if (batch && batch.attempts >= MAX_BATCH_ATTEMPTS) {
      throw new HttpError(429, "This batch has failed too many times. Start a new practice set.");
    }
    throw new HttpError(409, batch?.status === "generating" ? "This batch is already being generated" : "This batch is unavailable");
  }
  const generation = await db.collection<DbPracticeGeneration>(GENERATIONS).findOne({ _id: id, userId });
  const batch = generation?.plan?.batches.find((value) => value.index === batchIndex);
  if (!generation || !batch) throw new HttpError(404, "Practice generation batch not found");
  return { generation, batch, alreadyComplete: false };
}

export async function completePracticeBatch(input: {
  userId: string;
  generationId: string;
  batchIndex: number;
  questions: PracticeQuestion[];
  source: PracticeGenerationSource;
}): Promise<void> {
  const db = await getDb();
  const id = objectId(input.generationId, "generation id");
  const now = new Date();
  const promptKeys = input.questions.map((question) => question.prompt.toLocaleLowerCase().replace(/\s+/g, " ").trim());
  if (new Set(promptKeys).size !== promptKeys.length) {
    throw new HttpError(409, "Generated batch contains duplicate questions; retrying the batch");
  }
  const result = await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    {
      _id: id,
      userId: input.userId,
      status: "generating",
      "plan.batches": { $elemMatch: { index: input.batchIndex, status: "generating" } },
      // Protect against two concurrent workers returning the same prompt.
      // A failed match is surfaced as a retryable batch error to the client.
      "questions.prompt": { $nin: input.questions.map((question) => question.prompt) },
    },
    {
      $push: { questions: { $each: input.questions } },
      $set: {
        "plan.batches.$[batch].status": "complete",
        "plan.batches.$[batch].source": input.source,
        "plan.batches.$[batch].questionIds": input.questions.map((question) => question.id),
        "plan.batches.$[batch].completedAt": now,
        updatedAt: now,
      },
    },
    { arrayFilters: [{ "batch.index": input.batchIndex, "batch.status": "generating" }] },
  );
  if (result.modifiedCount !== 1) throw new HttpError(409, "Practice batch state changed before it could be saved");
  const generation = await db.collection<DbPracticeGeneration>(GENERATIONS).findOne({ _id: id, userId: input.userId });
  if (!generation?.plan) return;
  if (generation.plan.batches.every((batch) => batch.status === "complete")) {
    const sources = new Set(generation.plan.batches.map((batch) => batch.source));
    const source: PracticeGenerationSource = sources.size === 1 && sources.has("gemma4") ? "gemma4" : sources.has("gemma4") ? "hybrid" : "deterministic-fallback";
    await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
      { _id: id, userId: input.userId, status: "generating" },
      { $set: { status: "complete", source, latencyMs: now.getTime() - generation.createdAt.getTime(), updatedAt: now } },
    );
  }
}

export async function failPracticeBatch(userId: string, generationId: string, batchIndex: number, error: unknown): Promise<void> {
  const db = await getDb();
  await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    { _id: objectId(generationId, "generation id"), userId, status: "generating" },
    {
      $set: {
        "plan.batches.$[batch].status": "error",
        "plan.batches.$[batch].error": error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300),
        updatedAt: new Date(),
      },
    },
    { arrayFilters: [{ "batch.index": batchIndex }] },
  );
}

export async function completePracticeGeneration(
  generationId: string,
  userId: string,
  result: {
    questions: PracticeQuestion[];
    source: PracticeGenerationSource;
    attempts: number;
    rejectedReasons: string[];
    avoidedPromptCount: number;
    latencyMs: number;
  },
): Promise<void> {
  const db = await getDb();
  await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    { _id: objectId(generationId, "generation id"), userId, status: { $in: ["planning", "generating"] } },
    {
      $set: {
        status: "complete",
        questions: result.questions,
        source: result.source,
        validation: {
          attempts: result.attempts,
          rejectedReasons: result.rejectedReasons,
          avoidedPromptCount: result.avoidedPromptCount,
        },
        latencyMs: result.latencyMs,
        updatedAt: new Date(),
      },
    },
  );
}

export async function failPracticeGeneration(generationId: string, userId: string, error: unknown): Promise<void> {
  const db = await getDb();
  await db.collection<DbPracticeGeneration>(GENERATIONS).updateOne(
    { _id: objectId(generationId, "generation id"), userId },
    {
      $set: {
        status: "error",
        error: error instanceof Error ? error.message.slice(0, 600) : String(error).slice(0, 600),
        updatedAt: new Date(),
      },
    },
  );
}

export async function recentPracticePrompts(
  userId: string,
  exam: "IELTS" | "SAT",
  section: string,
  limit = 30,
): Promise<string[]> {
  const db = await getDb();
  const [generated, approved] = await Promise.all([
    db.collection<DbPracticeGeneration>(GENERATIONS)
      .find(
        { userId, status: "complete", "input.exam": exam, "input.section": section },
        { projection: { questions: 1 } },
      )
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray(),
    db.collection(ITEMS)
      .find({ exam, section: { $regex: `^${section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\s)` }, status: "approved" }, { projection: { prompt: 1 } })
      .limit(limit)
      .toArray(),
  ]);
  return [...generated.flatMap((record) => record.questions?.map((question) => question.prompt) ?? []), ...approved.map((item) => String(item.prompt))]
    .filter(Boolean)
    .slice(0, limit);
}

export async function derivePracticeTarget(
  userId: string,
  sourceSessionId?: string,
): Promise<{ targetSkill?: string; mode?: ExamMode; exam?: "IELTS" | "SAT" }> {
  if (!sourceSessionId) return {};
  const db = await getDb();
  const result = await db.collection(RESULTS).findOne({ userId, sessionId: objectId(sourceSessionId, "source session id") });
  if (!result) throw new HttpError(404, "The source exam result is unavailable");
  const domains = Array.isArray(result.domains) ? result.domains as Array<{ domain?: string; accuracy?: number }> : [];
  const weakest = domains.reduce<{ domain?: string; accuracy: number } | undefined>((current, domain) => {
    const accuracy = Number(domain.accuracy ?? 0);
    return !current || accuracy < current.accuracy ? { domain: domain.domain, accuracy } : current;
  }, undefined);
  return { targetSkill: weakest?.domain, mode: result.mode as ExamMode, exam: result.exam as "IELTS" | "SAT" };
}

async function storedPracticeGeneration(userId: string, generationId: string) {
  const db = await getDb();
  const record = await db.collection<DbPracticeGeneration>(GENERATIONS).findOne({
    _id: objectId(generationId, "generation id"),
    userId,
    status: "complete",
  });
  if (!record?.questions) throw new HttpError(404, "Practice set not found");
  return { ...record, questions: record.questions };
}

export async function getPracticeGeneration(userId: string, generationId: string) {
  const db = await getDb();
  const record = await db.collection<DbPracticeGeneration>(GENERATIONS).findOne({ _id: objectId(generationId, "generation id"), userId });
  if (!record) throw new HttpError(404, "Practice set not found");
  const storedQuestions = record.questions ?? [];
  const plannedOrder = record.plan?.batches.flatMap((batch) => batch.questionIds ?? []) ?? [];
  const order = new Map(plannedOrder.map((id, index) => [id, index]));
  const questions: PublicPracticeQuestion[] = [...storedQuestions]
    .sort((left, right) => (order.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (order.get(right.id) ?? Number.MAX_SAFE_INTEGER))
    .map(({ answer: _answer, explanation: _explanation, ...question }) => question);
  return {
    id: record._id.toHexString(),
    input: record.input,
    questions,
    status: record.status,
    plan: record.plan ? {
      title: record.plan.title,
      coverageSummary: record.plan.coverageSummary,
      batchSize: record.plan.batchSize,
      batches: record.plan.batches.map((batch) => ({ ...batch, startedAt: batch.startedAt?.toISOString(), completedAt: batch.completedAt?.toISOString() })),
    } : undefined,
    progress: { generated: questions.length, target: record.input.targetCount },
    source: record.source ?? "deterministic-fallback",
    model: record.model,
    validation: record.validation,
    error: record.error,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function gradePersistedPractice(
  userId: string,
  generationId: string,
  answers: Record<string, number>,
) {
  const record = await storedPracticeGeneration(userId, generationId);
  const questions = record.questions ?? [];
  const score = questions.filter((question) => answers[question.id] === question.answer).length;
  return {
    generation: {
      id: record._id.toHexString(),
      input: record.input,
      questions,
      source: record.source ?? "deterministic-fallback",
      model: record.model,
    },
    score,
  };
}

export async function savePracticeAttempt(input: {
  userId: string;
  generationId: string;
  answers: Record<string, number>;
  score: number;
  total: number;
  feedback: string;
  source: PracticeGenerationSource;
  model: string;
}): Promise<string> {
  const db = await getDb();
  const now = new Date();
  const result = await db.collection(ATTEMPTS).insertOne({
    userId: input.userId,
    generationId: objectId(input.generationId, "generation id"),
    answers: input.answers,
    score: input.score,
    total: input.total,
    feedback: input.feedback,
    source: input.source,
    model: input.model,
    createdAt: now,
  });
  return result.insertedId.toHexString();
}

export async function updatePracticeAttemptFeedback(input: {
  userId: string;
  attemptId: string;
  generationId: string;
  feedback: string;
  source: PracticeGenerationSource;
  model: string;
}): Promise<void> {
  const db = await getDb();
  const result = await db.collection(ATTEMPTS).updateOne(
    {
      _id: objectId(input.attemptId, "attempt id"),
      userId: input.userId,
      generationId: objectId(input.generationId, "generation id"),
    },
    {
      $set: {
        feedback: input.feedback,
        source: input.source,
        model: input.model,
        updatedAt: new Date(),
      },
    },
  );
  if (result.matchedCount !== 1) throw new HttpError(404, "Practice attempt not found");
}
