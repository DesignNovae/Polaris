import type { DbExamItem, ExamBlueprintStage, SatMathDomain } from "@/lib/exams/types";

function shuffled<T>(items: T[]): T[] {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [next[index], next[swap]] = [next[swap], next[index]];
  }
  return next;
}

/** Selects a form that satisfies the immutable blueprint instead of sampling arbitrary items. */
export function assembleStageItems(items: DbExamItem[], stage: ExamBlueprintStage): DbExamItem[] {
  const selected = (Object.entries(stage.domainCounts ?? {}) as Array<[SatMathDomain, number]>).flatMap(([domain, count]) => {
    const candidates = shuffled(items.filter((item) => item.domain === domain));
    if (candidates.length < count) {
      throw new Error(`Approved exam content is short for ${domain}: requires ${count}, found ${candidates.length}`);
    }
    return candidates.slice(0, count);
  });
  if (selected.length !== stage.questionCount) {
    throw new Error(`Blueprint count mismatch: selected ${selected.length}, expected ${stage.questionCount}`);
  }
  return shuffled(selected);
}
