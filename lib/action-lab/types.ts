export type ActionLabTab = "decision" | "evidence" | "exam" | "routine" | "learn" | "notes" | "essay";

export type DecisionInput = {
  event: string;
  currentScore: number;
  targetScore: number;
  weeklyHours: number;
  budgetBdt: number;
  targetCountry: string;
};

export type DecisionChange = {
  area: string;
  before: string;
  after: string;
  reason: string;
};

export type DecisionResult = {
  summary: string;
  probabilityBefore: number;
  probabilityAfter: number;
  risk: "lower" | "steady" | "higher";
  changes: DecisionChange[];
  nextAction: string;
  evidenceToCollect: string;
  source: "gemma4" | "deterministic-fallback";
  model: string;
};

export type EvidenceResult = {
  claim: string;
  proof: string;
  verifiedSignal: string;
  gap: string;
  nextAction: string;
  verification: string;
  source: "gemma4" | "deterministic-fallback";
  model: string;
};

export type RoutineCategory = "study" | "exam" | "project" | "wellbeing" | "application";

export type RoutineBlock = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  category: RoutineCategory;
  rationale?: string;
};

export type RoutineSuggestion = Omit<RoutineBlock, "id"> & {
  source: "gemma4" | "deterministic-fallback";
  model: string;
};

export type PracticeQuestion = {
  id: string;
  exam: "IELTS" | "SAT";
  section: string;
  skill: string;
  passage?: string;
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
  difficulty: "Foundation" | "Medium" | "Advanced";
};

export type WritingTask = {
  id: string;
  title: string;
  prompt: string;
  requirements: string[];
  timeLimitMinutes: number;
  minimumWords: number;
  difficulty: "Foundation" | "Medium" | "Advanced";
};

export type LearningVideo = {
  id: string;
  title: string;
  exam: "IELTS" | "SAT";
  topic: string;
  source: string;
  duration: string;
  youtubeId: string;
  officialUrl: string;
};
