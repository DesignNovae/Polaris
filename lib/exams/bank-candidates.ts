import { createHash } from "node:crypto";
import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api/respond";
import type { PracticeQuestion } from "@/lib/action-lab/types";
import { getDb } from "@/lib/db/mongodb";
import type { DbExamItem, DbExamStimulus, ExamCode } from "@/lib/exams/types";

const CANDIDATES = "exam_item_candidates";
const ITEMS = "exam_items";
const STIMULI = "exam_stimuli";
let indexPromise: Promise<void> | null = null;

type CandidateStatus = "review" | "approved" | "rejected";

type DbExamItemCandidate = {
  _id?: ObjectId;
  fingerprint: string;
  generationId: ObjectId;
  exam: ExamCode;
  section: string;
  difficulty: "Foundation" | "Medium" | "Advanced";
  question: PracticeQuestion;
  status: CandidateStatus;
  validation: { structural: true; semanticReviewer: true };
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
};

async function ensureIndexes() {
  if (indexPromise) return indexPromise;
  indexPromise = (async () => {
    const db = await getDb();
    await Promise.all([
      db.collection(CANDIDATES).createIndex({ fingerprint: 1 }, { unique: true }),
      db.collection(CANDIDATES).createIndex({ status: 1, createdAt: 1 }),
    ]);
  })().catch((error) => { indexPromise = null; throw error; });
  return indexPromise;
}

function fingerprint(question: PracticeQuestion) {
  return createHash("sha256").update(`${question.exam}|${question.section}|${question.prompt}`.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

export async function queueReviewedBankCandidates(input: {
  generationId: string;
  exam: ExamCode;
  section: string;
  difficulty: "Foundation" | "Medium" | "Advanced";
  questions: PracticeQuestion[];
}) {
  if (!ObjectId.isValid(input.generationId) || !input.questions.length) return;
  await ensureIndexes();
  const db = await getDb();
  const now = new Date();
  await Promise.all(input.questions.map((question) => db.collection<DbExamItemCandidate>(CANDIDATES).updateOne(
    { fingerprint: fingerprint(question) },
    { $setOnInsert: {
      fingerprint: fingerprint(question),
      generationId: new ObjectId(input.generationId),
      exam: input.exam,
      section: input.section,
      difficulty: input.difficulty,
      question,
      status: "review",
      validation: { structural: true, semanticReviewer: true },
      createdAt: now,
    } },
    { upsert: true },
  )));
}

export async function listBankCandidates(status: CandidateStatus = "review", limit = 50) {
  await ensureIndexes();
  const db = await getDb();
  const records = await db.collection<DbExamItemCandidate>(CANDIDATES).find({ status }).sort({ createdAt: 1 }).limit(limit).toArray();
  return records.map((record) => ({ ...record, id: record._id!.toHexString(), _id: undefined, generationId: record.generationId.toHexString() }));
}

function difficultyNumber(value: DbExamItemCandidate["difficulty"]) {
  return value === "Foundation" ? 2 : value === "Advanced" ? 5 : 3;
}

function satMathDomain(skill: string) {
  const value = skill.toLowerCase();
  if (/geometry|triangle|circle|trigon/.test(value)) return "Geometry and Trigonometry";
  if (/data|percent|ratio|probability|statistic/.test(value)) return "Problem-Solving and Data Analysis";
  if (/quadratic|polynomial|exponential|function|radical/.test(value)) return "Advanced Math";
  return "Algebra";
}

/**
 * Mock stages an approved candidate may be assembled into.
 *
 * IELTS Listening is deliberately excluded. A generated listening item carries
 * only a written script and no recording, so promoting it would render that
 * script as visible stimulus text and hand the student the answers. Listening
 * candidates can be approved once synthesized audio exists for them.
 */
function eligibleStages(exam: ExamCode, section: string) {
  if (exam === "SAT" && section === "Math") return ["math-module", "sat-math-m1", "sat-math-m2-standard", "sat-math-m2-advanced"];
  if (exam === "SAT") return ["sat-rw-m1", "sat-rw-m2-standard", "sat-rw-m2-advanced"];
  if (section === "Reading") return ["ielts-reading"];
  return [];
}

export async function reviewBankCandidate(userId: string, candidateId: string, decision: "approve" | "reject") {
  if (!ObjectId.isValid(candidateId)) throw new HttpError(400, "Invalid candidate id");
  await ensureIndexes();
  const db = await getDb();
  const id = new ObjectId(candidateId);
  const candidate = await db.collection<DbExamItemCandidate>(CANDIDATES).findOne({ _id: id, status: "review" });
  if (!candidate) throw new HttpError(404, "Review candidate not found");
  const now = new Date();
  if (decision === "reject") {
    await db.collection<DbExamItemCandidate>(CANDIDATES).updateOne({ _id: id, status: "review" }, { $set: { status: "rejected", reviewedAt: now, reviewedBy: userId } });
    return { id: candidateId, status: "rejected" as const };
  }
  const stages = eligibleStages(candidate.exam, candidate.section);
  if (!stages.length) {
    throw new HttpError(409, candidate.section === "Listening"
      ? "Listening candidates cannot enter the mock bank until a recording exists for them."
      : "This candidate does not map to an objective mock stage");
  }
  const bankId = `gemma-bank-${candidate.fingerprint.slice(0, 20)}`;
  const stimulusId = candidate.question.passage ? `${bankId}-stimulus` : undefined;
  const options = candidate.question.options.map((label, index) => ({ id: String.fromCharCode(65 + index), label }));
  const item: DbExamItem = {
    id: bankId,
    exam: candidate.exam,
    section: candidate.section,
    itemType: "multiple-choice",
    domain: candidate.exam === "SAT" && candidate.section === "Math" ? satMathDomain(candidate.question.skill) : candidate.question.skill,
    skill: candidate.question.skill,
    difficulty: difficultyNumber(candidate.difficulty),
    stimulusId,
    stimulusGroupId: stimulusId || bankId,
    eligibleStageIds: stages,
    prompt: candidate.question.prompt,
    options,
    correctAnswer: { kind: "choice", value: options[candidate.question.answer].id },
    explanation: candidate.question.explanation,
    estimatedTimeSeconds: candidate.exam === "IELTS" ? 90 : 75,
    tags: ["gemma-reviewed", candidate.difficulty.toLowerCase()],
    status: "approved",
    version: 1,
    provenance: "gemma4-candidate-human-approved-v1",
    createdAt: now,
    updatedAt: now,
  };
  if (stimulusId) {
    const stimulus: DbExamStimulus = { id: stimulusId, version: 1, exam: candidate.exam, kind: "text", content: candidate.question.passage!, status: "approved", provenance: item.provenance, createdAt: now, updatedAt: now };
    await db.collection<DbExamStimulus>(STIMULI).updateOne({ id: stimulusId }, { $setOnInsert: stimulus }, { upsert: true });
  }
  await db.collection<DbExamItem>(ITEMS).updateOne({ id: bankId }, { $setOnInsert: item }, { upsert: true });
  await db.collection<DbExamItemCandidate>(CANDIDATES).updateOne({ _id: id, status: "review" }, { $set: { status: "approved", reviewedAt: now, reviewedBy: userId } });
  return { id: candidateId, status: "approved" as const, bankItemId: bankId };
}
