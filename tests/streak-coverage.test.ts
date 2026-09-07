import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * The streak is only as honest as the set of routes that feed it.
 *
 * It shipped wired to two routes while its own documentation claimed five, so
 * a student could sit a three-hour practice exam and be told they had done
 * nothing that day, while nudging a deadline by one day kept the run alive.
 * That inverts the incentive the feature exists to create.
 *
 * This test pins the set. Adding a surface that represents real student work
 * without recording activity fails here, and so does removing a call that is
 * currently in place.
 */

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Routes where a successful mutation is real student progress. */
const MUST_RECORD = [
  "app/api/deadlines/route.ts",
  "app/api/tasks/weekly/[id]/route.ts",
  "app/api/roadmap/v2/node/[id]/route.ts",
  "app/api/roadmap/v2/adapt/route.ts",
  "app/api/exams/sessions/[id]/submit/route.ts",
  "app/api/exams/sessions/[id]/replan/route.ts",
  "app/api/tasks/[id]/route.ts",
  "app/api/passport/route.ts",
];

/**
 * Routes that deliberately do NOT earn a day, with the reason. These are the
 * ones someone will eventually be tempted to wire up; the reason is the answer.
 */
const DELIBERATELY_SILENT: Record<string, string> = {
  "app/api/benchmark/route.ts":
    "pure computation - persists nothing, so rewarding it would reward a page view",
  "app/api/streak/route.ts":
    "reads the streak; a GET must never be able to change it",
  "app/api/session/route.ts":
    "identity, not work",
  "app/api/profile/route.ts":
    "settings; editing a target tier is not a day of study",
};

function source(rel: string): string {
  const path = join(repoRoot, rel);
  assert.ok(existsSync(path), `${rel} does not exist - update this test's list`);
  return readFileSync(path, "utf8");
}

/**
 * Source with comments stripped. Several of these files discuss
 * `recordStreakActivity` in their header without calling it, and a naive
 * substring match reads those mentions as call sites.
 */
function code(rel: string): string {
  return source(rel)
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

/** True when the file actually invokes the recorder, rather than naming it. */
function records(rel: string): boolean {
  return /recordStreakActivity\s*\(/.test(code(rel));
}

test("every meaningful-progress route records streak activity", () => {
  const silent = MUST_RECORD.filter((rel) => !records(rel));
  assert.deepEqual(
    silent,
    [],
    `These routes represent real student work but do not record it, so it earns ` +
      `no streak day: ${silent.join(", ")}. Call recordStreakActivity after the ` +
      `mutation succeeds, or move the route to DELIBERATELY_SILENT with a reason.`,
  );
});

test("the routes that deliberately do not count still do not count", () => {
  for (const [rel, reason] of Object.entries(DELIBERATELY_SILENT)) {
    assert.ok(
      !records(rel),
      `${rel} now records a streak day, but it is listed as deliberately ` +
        `silent because it is ${reason}. Either remove it from that list with ` +
        `a deliberate decision, or drop the call.`,
    );
  }
});

test("the streak cannot be earned from a GET or from the client", () => {
  const route = source("app/api/streak/route.ts");
  for (const verb of ["POST", "PATCH", "PUT", "DELETE"]) {
    assert.ok(
      !route.includes(`export const ${verb}`),
      `/api/streak exposes ${verb} - the streak must only ever be written ` +
        `server-side by the action that earned it, or it can be farmed.`,
    );
  }
});

test("recording never blocks the action that earned it", () => {
  // A streak write that throws must not fail a student's exam submission, so
  // the whole body stays inside a catch.
  const service = code("lib/streak/service.ts");
  const body = service.slice(service.indexOf("export async function recordStreakActivity"));
  assert.ok(body.includes("try {"), "recordStreakActivity should guard its own writes");
  assert.ok(body.includes("catch"), "and swallow failures rather than propagating them");
});

test("the exam route rewards sitting the paper, never the score", () => {
  // Rewarding outcomes would penalise exactly the students who most need to
  // keep showing up, so the call must not be conditional on a result value.
  const submit = code("app/api/exams/sessions/[id]/submit/route.ts");
  const call = submit.slice(submit.indexOf("recordStreakActivity"));
  assert.ok(
    !/score|result\.\w*(score|band|percent)/i.test(call.split("\n")[0]),
    "the streak call should not branch on the exam result",
  );
});
