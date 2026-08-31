import type { Db, ObjectId } from "mongodb";
import { HttpError } from "@/lib/api/respond";
import type {
  DbExamBlueprint,
  DbExamExposure,
  DbExamForm,
  DbExamItem,
  DbExamStimulus,
  ExamBankCoverage,
  ExamBlueprintStage,
  ExamMode,
  FormItemSnapshot,
  FormStageSnapshot,
} from "@/lib/exams/types";

const ITEMS = "exam_items";
const STIMULI = "exam_stimuli";
const BLUEPRINTS = "exam_blueprints";
const EXPOSURES = "exam_exposures";

function shuffled<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function snapshot(item: DbExamItem, stimulus?: DbExamStimulus): FormItemSnapshot {
  const {
    _id,
    createdAt,
    updatedAt,
    eligibleStageIds,
    stimulusGroupId,
    stimulusId,
    ...safe
  } = item;
  void _id;
  void createdAt;
  void updatedAt;
  void eligibleStageIds;
  void stimulusGroupId;
  void stimulusId;
  return {
    ...safe,
    stimulus: stimulus
      ? {
          kind: stimulus.kind,
          content: stimulus.content,
          title: stimulus.title,
          alt: stimulus.alt,
          mediaUrl: stimulus.mediaUrl,
        }
      : safe.stimulus,
  };
}

function selectGrouped(items: DbExamItem[], required: number): DbExamItem[] | null {
  const groups = new Map<string, DbExamItem[]>();
  for (const item of items) {
    const group = groups.get(item.stimulusGroupId) ?? [];
    group.push(item);
    groups.set(item.stimulusGroupId, group);
  }
  const candidates = shuffled([...groups.values()]);

  const search = (index: number, remaining: number, chosen: DbExamItem[][]): DbExamItem[][] | null => {
    if (remaining === 0) return chosen;
    if (remaining < 0 || index >= candidates.length) return null;
    const withGroup = search(index + 1, remaining - candidates[index].length, [...chosen, candidates[index]]);
    return withGroup ?? search(index + 1, remaining, chosen);
  };

  return search(0, required, [])?.flat() ?? null;
}

function selectForStage(items: DbExamItem[], stage: ExamBlueprintStage): DbExamItem[] {
  if (stage.questionCount === 0) return [];
  if (stage.domainCounts) {
    const selected = Object.entries(stage.domainCounts).flatMap(([domain, required]) => {
      const candidates = shuffled(items.filter((item) => item.domain === domain));
      if (candidates.length < required) return [];
      return candidates.slice(0, required);
    });
    if (selected.length !== stage.questionCount) {
      throw new HttpError(409, `No completely fresh form is available for ${stage.title}.`);
    }
    return shuffled(selected);
  }

  const selected = selectGrouped(items, stage.questionCount);
  if (!selected) throw new HttpError(409, `No completely fresh form is available for ${stage.title}.`);
  return selected.sort((left, right) => left.id.localeCompare(right.id, undefined, { numeric: true }));
}

export async function activeBlueprint(db: Db, mode: ExamMode): Promise<DbExamBlueprint> {
  const blueprint = await db.collection<DbExamBlueprint>(BLUEPRINTS)
    .find({ mode, status: "active" })
    .sort({ version: -1 })
    .limit(1)
    .next();
  if (!blueprint) throw new HttpError(503, "The exam blueprint is unavailable");
  return blueprint;
}

async function unseenQuestionIds(db: Db, userId: string): Promise<Set<string>> {
  const seen = await db.collection<DbExamExposure>(EXPOSURES)
    .find({ userId }, { projection: { questionId: 1 } })
    .toArray();
  return new Set(seen.map((entry) => entry.questionId));
}

export async function assembleFreshForm(db: Db, userId: string, mode: ExamMode): Promise<DbExamForm> {
  const blueprint = await activeBlueprint(db, mode);
  const seen = await unseenQuestionIds(db, userId);
  // Items may be eligible for several stages (an approved bank candidate is
  // eligible for every module of its section). Excluding what earlier stages
  // already took keeps Module 1 and Module 2 of one form disjoint.
  const excluded = new Set(seen);
  const stages: FormStageSnapshot[] = [];
  const questionIds: string[] = [];

  for (const stage of blueprint.stages) {
    if (stage.kind === "break") {
      stages.push({ ...stage, items: [] });
      continue;
    }
    const candidates = await db.collection<DbExamItem>(ITEMS)
      .find({ eligibleStageIds: stage.id, status: "approved", id: { $nin: [...excluded] } })
      .toArray();
    const selected = selectForStage(candidates, stage);
    for (const item of selected) excluded.add(item.id);
    const stimulusIds = [...new Set(selected.map((item) => item.stimulusId).filter((id): id is string => Boolean(id)))];
    const stimuli = stimulusIds.length
      ? await db.collection<DbExamStimulus>(STIMULI).find({ id: { $in: stimulusIds }, status: "approved" }).toArray()
      : [];
    const stimulusById = new Map(stimuli.map((stimulus) => [stimulus.id, stimulus]));
    for (const item of selected) {
      if (item.stimulusId && !stimulusById.has(item.stimulusId)) {
        throw new HttpError(503, `Approved stimulus ${item.stimulusId} is unavailable.`);
      }
    }
    questionIds.push(...selected.map((item) => item.id));
    stages.push({
      ...stage,
      items: selected.map((item) => snapshot(item, item.stimulusId ? stimulusById.get(item.stimulusId) : undefined)),
    });
  }

  return {
    blueprintId: blueprint.id,
    blueprintVersion: blueprint.version,
    formVersion: 3,
    engineVersion: 3,
    assemblyPolicy: "fresh",
    exam: blueprint.exam,
    mode,
    questionIds: [...new Set(questionIds)],
    stages,
    createdAt: new Date(),
  };
}

export async function getBankCoverage(db: Db, userId: string, mode: ExamMode): Promise<ExamBankCoverage> {
  const blueprint = await activeBlueprint(db, mode);
  const seen = await unseenQuestionIds(db, userId);
  const scoredStages = blueprint.stages.filter((stage) => stage.questionCount > 0);
  const stageItems = await Promise.all(scoredStages.map(async (stage) => ({
    stage,
    ids: (await db.collection<DbExamItem>(ITEMS)
      .find({ eligibleStageIds: stage.id, status: "approved" }, { projection: { id: 1 } })
      .toArray()).map((item) => item.id),
  })));
  // Mirrors assembleFreshForm: stages are filled in blueprint order and an item
  // eligible for several stages can only be spent once per form.
  const claimed = new Set<string>();
  const stageCoverage = stageItems.map(({ stage, ids }) => {
    const unseenIds = ids.filter((id) => !seen.has(id));
    const available = unseenIds.filter((id) => !claimed.has(id));
    available.slice(0, stage.questionCount).forEach((id) => claimed.add(id));
    return {
      stageId: stage.id,
      required: stage.questionCount,
      approved: ids.length,
      unseen: unseenIds.length,
      ready: available.length >= stage.questionCount,
    };
  });
  const allApproved = await db.collection<DbExamItem>(ITEMS)
    .distinct("id", { eligibleStageIds: { $in: blueprint.stages.map((stage) => stage.id) }, status: "approved" });
  const estimatedFreshForms = stageCoverage.length && stageCoverage.every((stage) => stage.ready)
    ? Math.min(...stageCoverage.map((stage) => Math.floor(stage.unseen / stage.required)))
    : 0;
  return {
    status: estimatedFreshForms === 0 ? "insufficient" : estimatedFreshForms === 1 ? "low" : "fresh",
    totalApproved: allApproved.length,
    unseenApproved: allApproved.filter((id) => !seen.has(id)).length,
    estimatedFreshForms,
    stageCoverage,
  };
}

export async function recordStageExposure(
  db: Db,
  userId: string,
  sessionId: ObjectId,
  formId: ObjectId,
  stage: FormStageSnapshot,
): Promise<void> {
  if (!stage.items.length) return;
  const now = new Date();
  await db.collection<DbExamExposure>(EXPOSURES).bulkWrite(stage.items.map((item) => ({
    updateOne: {
      filter: { userId, questionId: item.id },
      update: {
        $set: { lastSeenAt: now, questionVersion: item.version },
        $setOnInsert: { firstSeenAt: now },
        $inc: { viewCount: 1 },
        $addToSet: { sessionIds: sessionId, formIds: formId, stageIds: stage.id },
      },
      upsert: true,
    },
  })), { ordered: false });
}
