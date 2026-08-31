import assert from "node:assert/strict";
import { test } from "node:test";
import { isCorrect, scoreExamSession } from "@/lib/exams/scoring";
import { EXAM_ITEMS_V2 } from "@/lib/exams/seed-v2";
import type {
  DbExamForm,
  DbExamSession,
  ExamAnswerKey,
  FormItemSnapshot,
} from "@/lib/exams/types";

function item(id: string, correctAnswer: ExamAnswerKey, overrides: Partial<FormItemSnapshot> = {}): FormItemSnapshot {
  return {
    id,
    exam: "IELTS",
    section: "Listening Part 2",
    itemType: "short-answer",
    domain: "Everyday communication",
    skill: "Listening for specific information",
    difficulty: 3,
    prompt: "Prompt",
    explanation: "Explanation",
    estimatedTimeSeconds: 45,
    tags: [],
    status: "approved",
    version: 1,
    provenance: "test",
    correctAnswer,
    ...overrides,
  };
}

/** Only the fields `scoreExamSession` reads; ids are irrelevant to scoring. */
function session(responses: Record<string, string | null>, overrides: Partial<DbExamSession> = {}): DbExamSession {
  const startedAt = new Date("2026-01-01T10:00:00.000Z");
  return {
    userId: "user-1",
    exam: "IELTS",
    mode: "ielts-listening",
    blueprintId: "test-blueprint",
    status: "completed",
    stageId: "stage-1",
    stageTitle: "Stage 1",
    stagePath: ["stage-1"],
    startedAt,
    expiresAt: new Date(startedAt.getTime() + 60_000),
    revision: 0,
    responses: Object.fromEntries(Object.entries(responses).map(([id, answer]) => [id, {
      answer,
      flagged: false,
      updatedAt: startedAt,
    }])),
    createdAt: startedAt,
    updatedAt: startedAt,
    ...overrides,
  } as DbExamSession;
}

function form(items: FormItemSnapshot[]): DbExamForm {
  return {
    blueprintId: "test-blueprint",
    blueprintVersion: 1,
    formVersion: 3,
    exam: "IELTS",
    mode: "ielts-listening",
    stages: [{
      id: "stage-1",
      title: "Stage 1",
      section: "Listening",
      kind: "questions",
      durationSeconds: 60,
      questionCount: items.length,
      items,
    }],
    createdAt: new Date(),
  } as DbExamForm;
}

const textKey = (...accepted: string[]): ExamAnswerKey => ({ kind: "text", accepted });

test("a short answer key is matched on whole words, not as a substring", () => {
  // Regression: the seeded listening bank contains one-character keys. A
  // substring test scored any answer merely containing that character.
  const block = item("q-block", textKey("C"));
  assert.equal(isCorrect(block, "C"), true);
  assert.equal(isCorrect(block, "block c"), true);
  assert.equal(isCorrect(block, "Block C."), true);
  assert.equal(isCorrect(block, "reception"), false);
  assert.equal(isCorrect(block, "the front desk"), false);
});

test("a numeric short answer key does not match a larger number containing it", () => {
  const breakfast = item("q-breakfast", textKey("7"));
  assert.equal(isCorrect(breakfast, "7"), true);
  assert.equal(isCorrect(breakfast, "7 am"), true);
  assert.equal(isCorrect(breakfast, "17"), false);
  assert.equal(isCorrect(breakfast, "27"), false);

  const materials = item("q-materials", textKey("3"));
  assert.equal(isCorrect(materials, "3"), true);
  assert.equal(isCorrect(materials, "13"), false);
  assert.equal(isCorrect(materials, "31"), false);
});

test("a negated answer does not satisfy the key it negates", () => {
  const conservation = item("q-conservation", textKey("immediately"));
  assert.equal(isCorrect(conservation, "immediately"), true);
  assert.equal(isCorrect(conservation, "not immediately"), false);
  assert.equal(isCorrect(conservation, "never"), false);
});

test("multi-word keys tolerate surrounding words, casing, and spacing", () => {
  const included = item("q-included", textKey("printed materials"));
  assert.equal(isCorrect(included, "Printed  Materials"), true);
  assert.equal(isCorrect(included, "the printed materials are included"), true);
  assert.equal(isCorrect(included, "printed"), false);
  assert.equal(isCorrect(included, "materials printed"), false);
});

test("an empty or missing answer is never correct", () => {
  const any = item("q-any", textKey("camera"));
  assert.equal(isCorrect(any, null), false);
  assert.equal(isCorrect(any, ""), false);
  assert.equal(isCorrect(any, "   "), false);
});

test("choice answers compare case-insensitively against the option id", () => {
  const choice = item("q-choice", { kind: "choice", value: "B" }, {
    itemType: "multiple-choice",
    options: [{ id: "A", label: "TRUE" }, { id: "B", label: "FALSE" }, { id: "C", label: "NOT GIVEN" }],
  });
  assert.equal(isCorrect(choice, "B"), true);
  assert.equal(isCorrect(choice, "b"), true);
  assert.equal(isCorrect(choice, "A"), false);
});

test("numeric answers accept equivalent forms but not rounded neighbours", () => {
  const numeric = item("q-numeric", { kind: "numeric", accepted: ["166.75"] }, {
    itemType: "student-produced-response",
  });
  assert.equal(isCorrect(numeric, "166.75"), true);
  assert.equal(isCorrect(numeric, "166.750"), true);
  assert.equal(isCorrect(numeric, "166.8"), false);
  assert.equal(isCorrect(numeric, "167"), false);

  const fraction = item("q-fraction", { kind: "numeric", accepted: ["0.75"] }, {
    itemType: "student-produced-response",
  });
  assert.equal(isCorrect(fraction, "3/4"), true);
  assert.equal(isCorrect(fraction, "0.75"), true);
  assert.equal(isCorrect(fraction, "4/3"), false);
  assert.equal(isCorrect(fraction, "not a number"), false);
});

test("every seeded numeric answer key lists only exact equivalents", () => {
  // Regression: percent-change items emitted `next.toFixed(1)` unconditionally,
  // so 166.8 was accepted, and shown back to the student, for an answer of
  // 166.75.
  const numericItems = EXAM_ITEMS_V2.filter((seed) => seed.correctAnswer?.kind === "numeric");
  assert.ok(numericItems.length > 0, "the seed bank should contain numeric items");
  for (const seed of numericItems) {
    const key = seed.correctAnswer;
    const accepted = key?.kind === "numeric" ? key.accepted : [];
    const values = accepted.map(Number);
    assert.ok(values.every(Number.isFinite), `${seed.id} has a non-numeric accepted value`);
    assert.ok(
      values.every((value) => Math.abs(value - values[0]) < 0.00001),
      `${seed.id} accepts values that are not equal: ${accepted.join(", ")}`,
    );
  }
});

test("the seeded listening bank rejects a plausible wrong answer for its shortest key", () => {
  const bikes = EXAM_ITEMS_V2.find((seed) => seed.prompt === "Behind which block are bicycles stored?");
  assert.ok(bikes, "the listening bank should contain the bicycle-storage item");
  const snapshot = bikes as unknown as FormItemSnapshot;
  assert.equal(isCorrect(snapshot, "C"), true);
  assert.equal(isCorrect(snapshot, "reception"), false);
});

test("scoreExamSession counts only whole-word matches and reports the exact key", () => {
  const items = [
    item("q-1", textKey("C")),
    item("q-2", textKey("7")),
    item("q-3", textKey("camera")),
  ];
  const result = scoreExamSession(
    session({ "q-1": "reception", "q-2": "7", "q-3": null }),
    form(items),
    new Date("2026-01-01T10:05:00.000Z"),
  );

  assert.equal(result.total, 3);
  assert.equal(result.correct, 1);
  assert.equal(result.accuracy, 33);
  assert.equal(result.unanswered, 1);
  assert.equal(result.durationSeconds, 300);
  assert.deepEqual(result.review.map((entry) => entry.correct), [false, true, false]);
  assert.equal(result.review[0].correctAnswer, "C");
});

test("scoreExamSession scores only the stages the student actually took", () => {
  const taken = { ...form([item("q-1", textKey("camera"))]).stages![0], id: "stage-1" };
  const skipped = { ...taken, id: "stage-2", items: [item("q-2", textKey("grid"))] };
  const branching = { ...form([]), stages: [taken, skipped] } as DbExamForm;

  const result = scoreExamSession(
    session({ "q-1": "a camera", "q-2": "grid" }, { stagePath: ["stage-1"] }),
    branching,
    new Date("2026-01-01T10:01:00.000Z"),
  );

  assert.equal(result.total, 1);
  assert.equal(result.correct, 1);
  assert.equal(result.review.length, 1);
});
