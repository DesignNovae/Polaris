/**
 * Calibration for the groundedness judge.
 *
 * The judge is a model grading a model, which is worth exactly as much as its
 * error rate - and an uncalibrated judge is a number with no units. A judge
 * that never flags anything scores every pipeline at 1.000; a paranoid one
 * flags correct personalization and makes a good pipeline look broken. We saw
 * the second failure for real: the harness once scored "your GPA is 3.7" as a
 * hallucination because the judge was not shown the profile.
 *
 * So the judge is tested against answers whose correct grade is known in
 * advance. Half are faithful to their context; half carry exactly one planted
 * fabrication of the kind that actually shows up - an invented amount, an
 * invented cutoff, an invented rule, an invented institution.
 *
 * Two numbers come out:
 *   • detection rate - of the answers we know are unfaithful, how many did it
 *     catch? A low number means groundedness scores are meaningless.
 *   • false-alarm rate - of the answers we know are faithful, how many did it
 *     flag anyway? A high number means the metric punishes correct work.
 *
 * Measured (npm run rag:calibrate):
 *
 *     detection rate    0.800
 *     false-alarm rate  0.000
 *     accuracy          0.900
 *     mean groundedness faithful 1.000 vs unfaithful 0.633
 *
 * Read that as: when the judge says an answer is ungrounded, believe it - it
 * has never yet flagged a faithful answer. When it says an answer is clean,
 * that is worth about 80%.
 *
 * The one miss is the whole reason figures.ts exists. Fixture u2 plants an
 * invented withdrawal limit and semester fee into an otherwise accurate answer
 * about the German blocked account, and the judge scored it 1.00 - invented
 * numbers sit in exactly the judge's blind spot, because a fabricated amount
 * reads as fluently as a real one. The deterministic figure check catches that
 * fixture (see the "invented amounts are flagged" case in rag:test). The two
 * layers are complementary by design, not redundant.
 */

import { judgeAnswer } from "./faithfulness";
import { createLimiter, FREE_TIER_GENERATE_RPM } from "./limiter";

type Fixture = {
  id: string;
  question: string;
  context: string;
  answer: string;
  /** True when every factual claim in the answer is supported by the context. */
  faithful: boolean;
  /** What was planted, for the report. Empty for faithful fixtures. */
  planted: string;
};

const MIT_CONTEXT =
  "[adm:mit] MIT - admissions, deadlines and cost. How to apply to MIT (USA). Application systems: MIT Application Portal. Application deadlines: Early Action on November 1; Regular Action on January 6. Standardized test policy: SAT or ACT required. Indicative international tuition: approximately $62k per year before aid. Financial aid: need-blind for all applicants including international; meets 100% of demonstrated need.";

const GERMANY_CONTEXT =
  "[cost:germany] Cost of living for students in Germany. Living costs for an international student in Germany: EUR 11,904 per year blocked account. Official blocked-account (Sperrkonto) requirement for the German student visa. Source: Federal Foreign Office.";

const CHEVENING_CONTEXT =
  "[sch:chevening] Chevening Scholarship hosted at UK universities. Level: master's. Value: full tuition, living stipend, and return flights. Eligibility: at least two years of work experience and an unconditional offer from an eligible UK university.";

const WATERLOO_CONTEXT =
  "[uni:uwaterloo] University of Waterloo (Canada, Waterloo). Tier: top50. Acceptance rate: 53.0%. Top programs: Computer Science, Software Engineering, Mathematics. Differentiators: co-op program alternating study terms with paid work placements; Euclid and CCC contest results materially help CS and Math applicants.";

const FIXTURES: Fixture[] = [
  {
    id: "f1",
    question: "When does MIT's Early Action close?",
    context: MIT_CONTEXT,
    answer:
      "MIT's Early Action deadline is November 1, with Regular Action closing on January 6. Applications go through the MIT Application Portal, and the SAT or ACT is required.",
    faithful: true,
    planted: "",
  },
  {
    id: "f2",
    question: "How much does MIT cost an international student?",
    context: MIT_CONTEXT,
    answer:
      "Indicative international tuition at MIT is around $62k per year before aid. MIT is need-blind for all applicants including international students, and meets 100% of demonstrated need.",
    faithful: true,
    planted: "",
  },
  {
    id: "f3",
    question: "What do I need for a German student visa?",
    context: GERMANY_CONTEXT,
    answer:
      "Germany requires a blocked account (Sperrkonto) of EUR 11,904 per year for the student visa. That figure comes from the Federal Foreign Office.",
    faithful: true,
    planted: "",
  },
  {
    id: "f4",
    question: "Am I eligible for Chevening?",
    context: CHEVENING_CONTEXT,
    answer:
      "Chevening funds a master's in the UK and covers full tuition, a living stipend and return flights. You need at least two years of work experience and an unconditional offer from an eligible UK university.",
    faithful: true,
    planted: "",
  },
  {
    id: "f5",
    question: "Why is Waterloo good for computer science?",
    context: WATERLOO_CONTEXT,
    answer:
      "Waterloo's co-op program alternates study terms with paid work placements, and strong Euclid or CCC contest results materially help CS and Math applicants. Its acceptance rate is 53%.",
    faithful: true,
    planted: "",
  },
  {
    id: "u1",
    question: "When does MIT's Early Action close?",
    context: MIT_CONTEXT,
    answer:
      "MIT's Early Action deadline is November 1. You will also want an SAT of at least 1540, which is the median for admitted international students.",
    faithful: false,
    planted: "an invented score cutoff (1540) and an invented median claim",
  },
  {
    id: "u2",
    question: "What do I need for a German student visa?",
    context: GERMANY_CONTEXT,
    answer:
      "Germany requires a blocked account of EUR 11,904 per year, from which you may withdraw about EUR 992 per month. Public universities also charge a semester fee of roughly EUR 85.",
    faithful: false,
    planted: "an invented withdrawal limit and an invented semester fee",
  },
  {
    id: "u3",
    question: "Am I eligible for Chevening?",
    context: CHEVENING_CONTEXT,
    answer:
      "Chevening covers full tuition and a stipend, and requires two years of work experience. Applications close on 5 November each year and you must submit three references at the point of application.",
    faithful: false,
    planted: "an invented deadline and an invented reference requirement",
  },
  {
    id: "u4",
    question: "How much does MIT cost an international student?",
    context: MIT_CONTEXT,
    answer:
      "MIT's international tuition is about $62k before aid. MIT also guarantees a merit scholarship of at least $10,000 to every admitted international student.",
    faithful: false,
    planted: "an invented merit award - the source says aid is need-based only",
  },
  {
    id: "u5",
    question: "Why is Waterloo good for computer science?",
    context: WATERLOO_CONTEXT,
    answer:
      "Waterloo's co-op program alternates study with paid placements. It is ranked first in Canada for computer science by QS, and its CS acceptance rate is under 5%.",
    faithful: false,
    planted: "an invented ranking and an invented programme-level acceptance rate",
  },
];

export type CalibrationRow = {
  id: string;
  faithful: boolean;
  planted: string;
  groundedness: number;
  claims: number;
  flagged: boolean;
  /** True when the judge's verdict matched the known label. */
  correct: boolean;
  unsupported: string[];
  error?: string;
};

export type CalibrationResult = {
  cases: number;
  /** Of the known-unfaithful answers, the share the judge flagged. */
  detectionRate: number;
  /** Of the known-faithful answers, the share the judge flagged anyway. */
  falseAlarmRate: number;
  accuracy: number;
  /** Mean groundedness the judge assigned to each class - these should separate. */
  meanGroundedFaithful: number;
  meanGroundedUnfaithful: number;
  rows: CalibrationRow[];
  ms: number;
};

/**
 * An answer counts as "flagged" when the judge marked any claim unsupported.
 * Groundedness is continuous, but the decision it feeds is binary: does this
 * answer need a human to look at it?
 */
const FLAG_THRESHOLD = 1;

export async function calibrateJudge(options: { signal?: AbortSignal } = {}): Promise<CalibrationResult> {
  const startedAt = Date.now();
  const limiter = createLimiter({ requestsPerMinute: FREE_TIER_GENERATE_RPM });

  const rows: CalibrationRow[] = [];
  for (const fixture of FIXTURES) {
    const judgement = await limiter.run(() =>
      judgeAnswer({
        question: fixture.question,
        context: fixture.context,
        answer: fixture.answer,
        signal: options.signal,
      }),
    );
    const flagged = judgement.groundedness < FLAG_THRESHOLD;
    rows.push({
      id: fixture.id,
      faithful: fixture.faithful,
      planted: fixture.planted,
      groundedness: judgement.groundedness,
      claims: judgement.claims,
      flagged,
      correct: flagged === !fixture.faithful,
      unsupported: judgement.unsupported,
      error: judgement.error,
    });
  }

  const faithful = rows.filter((row) => row.faithful);
  const unfaithful = rows.filter((row) => !row.faithful);
  const share = (subset: CalibrationRow[], predicate: (row: CalibrationRow) => boolean) =>
    subset.length ? subset.filter(predicate).length / subset.length : 0;
  const mean = (subset: CalibrationRow[]) =>
    subset.length ? subset.reduce((sum, row) => sum + row.groundedness, 0) / subset.length : 0;
  const round = (value: number) => Math.round(value * 1000) / 1000;

  return {
    cases: rows.length,
    detectionRate: round(share(unfaithful, (row) => row.flagged)),
    falseAlarmRate: round(share(faithful, (row) => row.flagged)),
    accuracy: round(share(rows, (row) => row.correct)),
    meanGroundedFaithful: round(mean(faithful)),
    meanGroundedUnfaithful: round(mean(unfaithful)),
    rows,
    ms: Date.now() - startedAt,
  };
}

export function formatCalibration(result: CalibrationResult): string {
  const lines: string[] = [];
  lines.push(`Judge calibration - ${result.cases} labelled answers`);
  lines.push("");
  lines.push(`  detection rate    ${result.detectionRate.toFixed(3)}  (planted fabrications caught)`);
  lines.push(`  false-alarm rate  ${result.falseAlarmRate.toFixed(3)}  (faithful answers wrongly flagged)`);
  lines.push(`  accuracy          ${result.accuracy.toFixed(3)}`);
  lines.push("");
  lines.push(
    `  mean groundedness  faithful ${result.meanGroundedFaithful.toFixed(3)}  vs  unfaithful ${result.meanGroundedUnfaithful.toFixed(3)}`,
  );
  const separation = result.meanGroundedFaithful - result.meanGroundedUnfaithful;
  lines.push(
    `  separation         ${separation.toFixed(3)}${separation < 0.1 ? "  - too small to be a usable signal" : ""}`,
  );

  const wrong = result.rows.filter((row) => !row.correct);
  if (wrong.length) {
    lines.push("");
    lines.push("Judge disagreed with the label:");
    for (const row of wrong) {
      lines.push(
        `  ${row.id} (${row.faithful ? "faithful, flagged anyway" : "unfaithful, missed"}) groundedness ${row.groundedness.toFixed(2)}`,
      );
      if (row.planted) lines.push(`      planted: ${row.planted}`);
      for (const claim of row.unsupported) lines.push(`      judge flagged: ${claim}`);
    }
  }
  lines.push("");
  lines.push(`Completed in ${result.ms}ms.`);
  return lines.join("\n");
}
