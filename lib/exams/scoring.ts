import type {
  DbExamForm,
  DbExamResult,
  DbExamSession,
  FormItemSnapshot,
} from "@/lib/exams/types";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function numericEquivalent(left: string, right: string): boolean {
  const fraction = (value: string) => {
    const parts = value.split("/");
    if (parts.length === 2) {
      const numerator = Number(parts[0]);
      const denominator = Number(parts[1]);
      if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
    }
    return Number(value);
  };
  const a = fraction(left);
  const b = fraction(right);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.00001;
}

const NEGATORS = new Set(["not", "no", "never", "none"]);

/**
 * Splits a short answer into comparable word tokens. Punctuation that carries
 * meaning inside a token (`6:30`, `3/4`, `twenty-eight`) is preserved; only
 * surrounding punctuation is trimmed.
 */
function tokens(value: string): string[] {
  return normalize(value)
    .split(" ")
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);
}

/**
 * True when `expected` appears in `submitted` as a run of whole words.
 *
 * A plain substring test cannot be used here: short answer keys such as `C`,
 * `7`, or `3` would then match any answer that merely contains that character
 * (`reception` for `C`, `17` for `7`), scoring wrong answers as correct.
 */
function containsAnswerPhrase(submitted: string[], expected: string[]): boolean {
  if (!expected.length || expected.length > submitted.length) return false;
  return submitted.some((_, start) =>
    expected.every((token, offset) => submitted[start + offset] === token));
}

export function isCorrect(item: FormItemSnapshot, answer: string | null): boolean {
  if (!answer || !item.correctAnswer) return false;
  if (item.correctAnswer.kind === "choice") {
    return normalize(answer).toUpperCase() === item.correctAnswer.value.toUpperCase();
  }
  if (item.correctAnswer.kind === "numeric") {
    return item.correctAnswer.accepted.some((accepted) => numericEquivalent(answer, accepted));
  }
  const submitted = tokens(answer);
  return item.correctAnswer.accepted.some((accepted) => {
    const expected = tokens(accepted);
    if (!containsAnswerPhrase(submitted, expected)) return false;
    // `not immediately` contains `immediately` but reverses its meaning.
    return !submitted.some((token) => NEGATORS.has(token) && !expected.includes(token));
  });
}

function answerLabel(item: FormItemSnapshot): string | undefined {
  if (!item.correctAnswer) return undefined;
  if (item.correctAnswer.kind === "choice") {
    const answer = item.correctAnswer;
    const option = item.options?.find((candidate) => candidate.id === answer.value);
    return option ? `${option.id}. ${option.label}` : answer.value;
  }
  return item.correctAnswer.accepted.join(" / ");
}

function selectedItems(session: DbExamSession, form: DbExamForm): FormItemSnapshot[] {
  if (form.stages?.length) {
    const selected = new Set(session.stagePath ?? form.stages.map((stage) => stage.id));
    return form.stages.filter((stage) => selected.has(stage.id)).flatMap((stage) => stage.items);
  }
  return form.items ?? [];
}

function countWords(value: string | null): number {
  return value?.trim() ? value.trim().split(/\s+/).length : 0;
}

export function scoreExamSession(
  session: DbExamSession,
  form: DbExamForm,
  completedAt: Date,
): Omit<DbExamResult, "_id" | "sessionId" | "userId" | "createdAt"> {
  const items = selectedItems(session, form);
  const objectiveItems = items.filter((item) => Boolean(item.correctAnswer));
  const writtenItems = items.filter((item) => item.itemType === "long-response" || item.itemType === "speaking-response");
  const correct = objectiveItems.filter((item) => isCorrect(item, session.responses[item.id]?.answer ?? null)).length;
  const total = objectiveItems.length;
  const unanswered = items.filter((item) => {
    const response = session.responses[item.id];
    return !response?.answer?.trim() && !response?.recordingId;
  }).length;
  const flagged = items.filter((item) => session.responses[item.id]?.flagged).length;
  const durationSeconds = Math.max(0, Math.round((completedAt.getTime() - session.startedAt.getTime()) / 1000));
  const domainMap = new Map<string, { correct: number; total: number }>();

  objectiveItems.forEach((item) => {
    const value = domainMap.get(item.domain) ?? { correct: 0, total: 0 };
    value.total += 1;
    if (isCorrect(item, session.responses[item.id]?.answer ?? null)) value.correct += 1;
    domainMap.set(item.domain, value);
  });

  const review = items.map((item, index) => {
    const submittedAnswer = session.responses[item.id]?.answer ?? null;
    const wordCount = writtenItems.includes(item) ? countWords(submittedAnswer) : undefined;
    return {
      itemId: item.id,
      number: index + 1,
      section: item.section,
      domain: item.domain,
      skill: item.skill,
      prompt: item.prompt,
      options: item.options,
      submittedAnswer,
      correctAnswer: answerLabel(item),
      correct: item.correctAnswer ? isCorrect(item, submittedAnswer) : undefined,
      explanation: item.explanation,
      wordCount,
      hasRecording: Boolean(session.responses[item.id]?.recordingId),
    };
  });

  const writtenMetrics = writtenItems.map((item) => {
    const minimumWords = item.id.includes("task-1") ? 150 : item.id.includes("task-2") ? 250 : 0;
    const wordCount = countWords(session.responses[item.id]?.answer ?? null);
    return {
      itemId: item.id,
      label: item.section,
      wordCount,
      minimumWords,
      metMinimum: minimumWords === 0
        ? wordCount > 0 || Boolean(session.responses[item.id]?.recordingId)
        : wordCount >= minimumWords,
    };
  });

  const hasWriting = items.some((item) => item.itemType === "long-response");
  const hasSpeaking = items.some((item) => item.itemType === "speaking-response");
  const scoreKind = hasWriting && total ? "mixed" : hasWriting ? "writing" : hasSpeaking ? "speaking" : "objective";

  return {
    exam: session.exam,
    mode: session.mode,
    scoreKind,
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    unanswered,
    flagged,
    durationSeconds,
    averageSecondsPerQuestion: items.length ? Math.round(durationSeconds / items.length) : 0,
    domains: [...domainMap.entries()].map(([domain, value]) => ({
      domain,
      ...value,
      accuracy: value.total ? Math.round((value.correct / value.total) * 100) : 0,
    })),
    review,
    writtenMetrics: writtenMetrics.length ? writtenMetrics : undefined,
    routes: (session.stageResults ?? [])
      .filter((result) => result.routeSelected)
      .map((result) => ({
        section: result.stageId.includes("rw") ? "Reading and Writing" : "Math",
        route: result.routeSelected!,
      })),
    label: "Polaris Practice Performance",
  };
}
