import type { ObjectId } from "mongodb";

export type ExamCode = "SAT" | "IELTS";
export type ExamMode =
  | "sat-math-module"
  | "sat-full"
  | "ielts-reading"
  | "ielts-writing"
  | "ielts-listening"
  | "ielts-speaking";
export type ExamItemType =
  | "multiple-choice"
  | "student-produced-response"
  | "true-false-not-given"
  | "short-answer"
  | "long-response"
  | "speaking-response";
export type ExamItemStatus = "draft" | "review" | "approved" | "retired";
export type ExamSessionStatus = "in_progress" | "completed" | "abandoned";
export type ExamStageKind = "questions" | "writing" | "speaking" | "break";
export type ExamScoreKind = "objective" | "writing" | "speaking" | "mixed";
export type ExamStartPolicy = "fresh" | "resume" | "same-form";

export type SatMathDomain =
  | "Algebra"
  | "Advanced Math"
  | "Problem-Solving and Data Analysis"
  | "Geometry and Trigonometry";

export type ExamOption = { id: string; label: string };

export type ExamStimulus = {
  kind: "text" | "table" | "chart" | "audio";
  content: string;
  title?: string;
  alt?: string;
  mediaUrl?: string;
};

export type ChoiceAnswer = { kind: "choice"; value: string };
export type NumericAnswer = { kind: "numeric"; accepted: string[] };
export type TextAnswer = { kind: "text"; accepted: string[] };
export type ExamAnswerKey = ChoiceAnswer | NumericAnswer | TextAnswer;

export type DbExamItem = {
  _id?: ObjectId;
  id: string;
  exam: ExamCode;
  section: string;
  itemType: ExamItemType;
  domain: string;
  skill: string;
  difficulty: number;
  stimulus?: ExamStimulus;
  stimulusId?: string;
  stimulusGroupId: string;
  eligibleStageIds: string[];
  prompt: string;
  options?: ExamOption[];
  correctAnswer?: ExamAnswerKey;
  explanation: string;
  estimatedTimeSeconds: number;
  tags: string[];
  status: ExamItemStatus;
  version: number;
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DbExamStimulus = {
  _id?: ObjectId;
  id: string;
  version: number;
  exam: ExamCode;
  kind: ExamStimulus["kind"];
  title?: string;
  content: string;
  alt?: string;
  mediaUrl?: string;
  status: "approved" | "retired";
  provenance: string;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicExamItem = Omit<
  DbExamItem,
  | "_id"
  | "correctAnswer"
  | "explanation"
  | "status"
  | "createdAt"
  | "updatedAt"
  | "eligibleStageIds"
  | "stimulusGroupId"
  | "stimulusId"
>;

export type ExamBlueprintStage = {
  id: string;
  title: string;
  section: string;
  kind: ExamStageKind;
  durationSeconds: number;
  questionCount: number;
  domainCounts?: Record<string, number>;
  instructions?: string;
  route?: "core" | "standard" | "advanced";
};

export type DbExamBlueprint = {
  _id?: ObjectId;
  id: string;
  exam: ExamCode;
  mode: ExamMode;
  title: string;
  description: string;
  version: number;
  status: "active" | "retired";
  stages: ExamBlueprintStage[];
  createdAt: Date;
  updatedAt: Date;
};

export type FormItemSnapshot = Omit<
  DbExamItem,
  "_id" | "createdAt" | "updatedAt" | "eligibleStageIds" | "stimulusGroupId" | "stimulusId"
>;
export type FormStageSnapshot = ExamBlueprintStage & { items: FormItemSnapshot[] };

export type DbExamForm = {
  _id?: ObjectId;
  blueprintId: string;
  blueprintVersion: number;
  formVersion: number;
  exam: ExamCode;
  mode: ExamMode;
  engineVersion?: 2 | 3;
  assemblyPolicy?: "fresh" | "same-form" | "legacy";
  sourceFormId?: ObjectId;
  questionIds?: string[];
  /** Kept for previously-created one-module forms. */
  items?: FormItemSnapshot[];
  stages?: FormStageSnapshot[];
  createdAt: Date;
};

export type ExamResponseState = {
  answer: string | null;
  flagged: boolean;
  viewedAt?: Date;
  answeredAt?: Date;
  updatedAt: Date;
  recordingId?: ObjectId;
  recordingMimeType?: string;
};

export type ExamStageResult = {
  stageId: string;
  correct: number;
  total: number;
  accuracy: number;
  completedAt: Date;
  routeSelected?: "standard" | "advanced";
};

export type DbExamSession = {
  _id?: ObjectId;
  userId: string;
  exam: ExamCode;
  mode: ExamMode;
  blueprintId: string;
  formId: ObjectId;
  status: ExamSessionStatus;
  stageId: string;
  stageTitle: string;
  stagePath?: string[];
  currentStageIndex?: number;
  stageResults?: ExamStageResult[];
  startedAt: Date;
  stageStartedAt?: Date;
  expiresAt: Date;
  completedAt?: Date;
  abandonedAt?: Date;
  revision: number;
  responses: Record<string, ExamResponseState>;
  playedAudioParts?: string[];
  resultId?: ObjectId;
  sourceSessionId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export type DbExamExposure = {
  _id?: ObjectId;
  userId: string;
  questionId: string;
  questionVersion: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  viewCount: number;
  sessionIds: ObjectId[];
  formIds: ObjectId[];
  stageIds: string[];
};

export type ExamBankCoverage = {
  status: "fresh" | "low" | "insufficient";
  totalApproved: number;
  unseenApproved: number;
  estimatedFreshForms: number;
  stageCoverage: Array<{
    stageId: string;
    required: number;
    approved: number;
    unseen: number;
    ready: boolean;
  }>;
};

export type ExamCatalogAttempt = {
  id: string;
  mode: ExamMode;
  status: ExamSessionStatus;
  reviewLater: boolean;
  startedAt: string;
  completedAt?: string;
  resultId?: string;
};

export type ExamCatalogEntry = {
  mode: ExamMode;
  title: string;
  description: string;
  durationMinutes: number;
  questionCount: number;
  sections: string;
  status: "available" | "insufficient";
  coverage: ExamBankCoverage;
  activeAttempt?: ExamCatalogAttempt;
  latestCompletedAttempt?: ExamCatalogAttempt;
  /**
   * Most recent attempt whose immutable form can be replayed. Includes
   * abandoned attempts: their questions are already burned from the fresh-form
   * bank, so without this the mode would become permanently unavailable.
   */
  latestRestartableAttempt?: ExamCatalogAttempt;
};

export type DomainResult = { domain: string; correct: number; total: number; accuracy: number };

export type ReviewItem = {
  itemId: string;
  number: number;
  section: string;
  domain: string;
  skill: string;
  prompt: string;
  options?: ExamOption[];
  submittedAnswer: string | null;
  correctAnswer?: string;
  correct?: boolean;
  explanation: string;
  wordCount?: number;
  hasRecording?: boolean;
};

export type WrittenMetric = {
  itemId: string;
  label: string;
  wordCount: number;
  minimumWords: number;
  metMinimum: boolean;
};

export type ExamCoachFeedback = {
  summary: string;
  strengths: string[];
  priorities: string[];
  nextPractice: string;
  source: "gemma-4" | "deterministic-fallback";
  model: string;
};

export type DbExamResult = {
  _id?: ObjectId;
  sessionId: ObjectId;
  userId: string;
  exam: ExamCode;
  mode: ExamMode;
  scoreKind: ExamScoreKind;
  correct: number;
  total: number;
  accuracy: number;
  unanswered: number;
  flagged: number;
  durationSeconds: number;
  averageSecondsPerQuestion: number;
  domains: DomainResult[];
  review: ReviewItem[];
  writtenMetrics?: WrittenMetric[];
  routes?: Array<{ section: string; route: "standard" | "advanced" }>;
  coachFeedback?: ExamCoachFeedback;
  label: "Polaris Practice Performance";
  createdAt: Date;
};

export type PublicExamSession = {
  id: string;
  exam: ExamCode;
  mode: ExamMode;
  title: string;
  section: string;
  stageKind: ExamStageKind;
  instructions?: string;
  status: ExamSessionStatus;
  startedAt: string;
  stageStartedAt: string;
  expiresAt: string;
  completedAt?: string;
  revision: number;
  stageNumber: number;
  totalStages: number;
  items: PublicExamItem[];
  responses: Record<string, { answer: string | null; flagged: boolean; hasRecording?: boolean }>;
  playedAudioParts: string[];
  answeredCount: number;
  flaggedCount: number;
};

export type PublicExamResult = Omit<DbExamResult, "_id" | "sessionId" | "userId" | "createdAt"> & {
  id: string;
  sessionId: string;
  createdAt: string;
  previousAttempt?: {
    sessionId: string;
    createdAt: string;
    scoreKind: ExamScoreKind;
    correct: number;
    total: number;
    accuracy: number;
    unanswered: number;
    durationSeconds: number;
  };
};
