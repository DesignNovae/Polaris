import type { ExamSessionStatus } from "@/lib/exams/types";

const ALLOWED_TRANSITIONS: Record<ExamSessionStatus, ExamSessionStatus[]> = {
  in_progress: ["completed", "abandoned"],
  completed: [],
  abandoned: [],
};

export function canTransitionExamSession(from: ExamSessionStatus, to: ExamSessionStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}
