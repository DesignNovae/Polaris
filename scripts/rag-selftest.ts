/**
 * Deterministic self-test for the retrieval layer:  npm run rag:test
 *
 * No API key, no database, no network - so it runs in CI and on a laptop with
 * an empty .env. It covers the pure functions the pipeline leans on, with a
 * bias toward the ones production has never exercised: chunking has not split
 * a single document in the live corpus, which means it has shipped untested.
 *
 * Plain assertions rather than a test framework, matching the repo's existing
 * script-based tooling. Exits non-zero on the first suite with a failure.
 */

import { loadEnv } from "./load-env";

let passed = 0;
const failures: string[] = [];
let suite = "";

function group(name: string) {
  suite = name;
  console.log(`\n${name}`);
}

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(`${suite} > ${label}${detail ? ` - ${detail}` : ""}`);
    console.log(`  FAIL ${label}${detail ? ` - ${detail}` : ""}`);
  }
}

function eq<T>(label: string, actual: T, expected: T) {
  check(label, Object.is(actual, expected), `expected ${String(expected)}, got ${String(actual)}`);
}

async function main() {
  loadEnv();
  const { splitText, hashText, MAX_CHUNK_CHARS } = await import("../lib/rag/chunk");
  const { extractFigures, findUnsupportedFigures } = await import("../lib/rag/figures");
  const { auditCitations } = await import("../lib/rag/faithfulness");
  const { mergeHits } = await import("../lib/rag/iterate");

  /* ── Chunking ─────────────────────────────────────────────────────────── */

  group("chunking");

  eq("empty input yields no chunks", splitText("").length, 0);
  eq("whitespace-only yields no chunks", splitText("   \n  ").length, 0);

  const short = "MIT requires the SAT or ACT. Early Action closes on November 1.";
  eq("short text stays one chunk", splitText(short).length, 1);
  eq("short text is preserved", splitText(short)[0], short);

  // A document long enough to actually split - the case the live corpus has
  // never produced.
  const sentence = "The scholarship covers tuition, a monthly stipend, and one return flight. ";
  const long = sentence.repeat(40);
  const chunks = splitText(long);
  check("long text splits into several chunks", chunks.length > 1, `got ${chunks.length}`);
  check(
    "every chunk respects the window",
    chunks.every((c) => c.length <= MAX_CHUNK_CHARS),
    `longest was ${Math.max(...chunks.map((c) => c.length))} of ${MAX_CHUNK_CHARS}`,
  );
  // Every token in every chunk must be a whole token from the source, which
  // is the property that matters: a chunk ending in "schola" is unretrievable.
  const sourceTokens = new Set(long.split(/\s+/).filter(Boolean));
  check(
    "no chunk starts or ends mid-word",
    chunks.every((c) => c === c.trim() && c.split(/\s+/).every((t) => sourceTokens.has(t))),
  );
  check(
    "consecutive chunks overlap",
    chunks.length > 1 &&
      chunks.slice(1).every((chunk, i) => {
        const previousTail = chunks[i].slice(-120);
        const firstSentence = chunk.split(". ")[0];
        return previousTail.includes(firstSentence.slice(0, 40));
      }),
    "overlap is what keeps a fact that straddles a boundary retrievable",
  );

  // A single sentence longer than the window has no boundary to split on.
  const runOn = `${"word ".repeat(400)}end.`;
  const runOnChunks = splitText(runOn);
  check("oversized single sentence is hard-split", runOnChunks.length > 1);
  check(
    "hard-split chunks respect the window",
    runOnChunks.every((c) => c.length <= MAX_CHUNK_CHARS),
  );

  check(
    "chunking is deterministic",
    JSON.stringify(splitText(long)) === JSON.stringify(splitText(long)),
  );
  check("identical text hashes identically", hashText(short) === hashText(short));
  check("different text hashes differently", hashText(short) !== hashText(`${short} `.trim() + "!"));

  /* ── Figure extraction ────────────────────────────────────────────────── */

  group("figure extraction");

  const money = extractFigures("Tuition is about $62,000 per year, plus £1,136/mo in London.");
  check(
    "finds dollar and pound amounts",
    money.some((f) => f.value === 62000) && money.some((f) => f.value === 1136),
    JSON.stringify(money.map((f) => f.text)),
  );

  const scaled = extractFigures("Budget roughly $62k for the year.");
  check("expands k into thousands", scaled.some((f) => f.value === 62000), JSON.stringify(scaled));

  const desi = extractFigures("Hostel and mess run to about ₹2 lakh per year.");
  check("expands lakh", desi.some((f) => f.value === 200000), JSON.stringify(desi));

  const percent = extractFigures("The acceptance rate is 4.8%.");
  check("finds percentages", percent.some((f) => f.kind === "percentage" && f.value === 4.8));

  const score = extractFigures("You will want an SAT around 1550 to be competitive.");
  check("finds exam scores", score.some((f) => f.kind === "score" && f.value === 1550));

  const counts = extractFigures("Apply to 3 universities and pick 2 safeties.");
  eq("ignores plain counts", counts.length, 0);

  const cited = extractFigures("See <cite>MIT costs|kb://adm:mit</cite> for details.");
  eq("ignores digits inside citations", cited.length, 0);

  // A multiplier must be a whole word: "€11,904 must be deposited" once read
  // as 11,904 million and flagged a correct figure as invented.
  const followedByWord = extractFigures("You must deposit €11,904 minimum before arrival.");
  check(
    "a following m-word is not read as a multiplier",
    followedByWord.some((f) => f.value === 11904),
    JSON.stringify(followedByWord),
  );
  eq(
    "a correct figure followed by an m-word is not flagged",
    findUnsupportedFigures(
      "You must deposit €11,904 minimum before arrival.",
      "Germany requires a blocked account of €11,904 per year.",
    ).length,
    0,
  );

  /* ── Figure verification ──────────────────────────────────────────────── */

  group("figure verification");

  const context =
    "MIT tuition is approximately $62k per year before aid. The UKVI maintenance requirement is £1,136/mo outside London. Germany requires a blocked account of €11,904 per year.";

  eq(
    "a figure present in context passes",
    findUnsupportedFigures("Expect around $62,000 a year.", context).length,
    0,
  );
  eq(
    "rounding money within tolerance passes",
    findUnsupportedFigures("You need roughly €11,900 in a blocked account.", context).length,
    0,
  );

  const invented = findUnsupportedFigures(
    "There is a monthly withdrawal limit of about €992, and semester fees near €85.",
    context,
  );
  check(
    "invented amounts are flagged",
    invented.length === 2,
    `flagged ${JSON.stringify(invented.map((f) => f.text))}`,
  );

  const inventedScore = findUnsupportedFigures(
    "Aim for an SAT of 1550 or higher to be competitive.",
    context,
  );
  check("invented scores are flagged", inventedScore.length === 1);

  eq(
    "an empty answer flags nothing",
    findUnsupportedFigures("", context).length,
    0,
  );

  /* ── Citation audit ───────────────────────────────────────────────────── */

  group("citation audit");

  const retrieved = ["adm:mit", "cost:germany"];

  const clean = auditCitations(
    "MIT closes Early Action on 1 November <cite>MIT deadline|kb://adm:mit</cite>.",
    retrieved,
  );
  check("a real citation is valid", clean.total === 1 && clean.valid === 1);

  const bracketed = auditCitations(
    "See <cite>MIT deadline|kb://[adm:mit]</cite>.",
    retrieved,
  );
  check(
    "bracketed ids count as valid but are reported malformed",
    bracketed.valid === 1 && bracketed.malformed.length === 1,
    JSON.stringify(bracketed),
  );

  const fake = auditCitations("<cite>Oxford fees|kb://adm:oxford</cite>", retrieved);
  check(
    "a citation to an unretrieved passage is fabricated",
    fake.invalid.length === 1 && fake.valid === 0,
  );

  const noSlashes = auditCitations("<cite>Germany costs|kb:cost:germany</cite>", retrieved);
  check(
    "slash-less kb: ids resolve and are reported malformed",
    noSlashes.valid === 1 && noSlashes.malformed.length === 1,
    JSON.stringify(noSlashes),
  );

  const noSlashesFake = auditCitations("<cite>Oxford|kb:adm:oxford</cite>", retrieved);
  check(
    "a slash-less citation to an unretrieved passage is still fabricated",
    noSlashesFake.invalid.length === 1,
    JSON.stringify(noSlashesFake),
  );

  const web = auditCitations("<cite>Gov UK|https://gov.uk/student-visa</cite>", retrieved);
  check("http citations are tracked separately", web.external.length === 1);

  const profile = auditCitations("<cite>Your GPA|profile://you</cite>", retrieved);
  check("profile citations are structurally valid", profile.valid === 1);

  /* ── Hit merging ──────────────────────────────────────────────────────── */

  group("second-pass merging");

  const hit = (id: string) => ({
    id,
    title: id,
    snippet: id,
    source: "university" as const,
    score: 1,
    similarity: 0.5,
  });

  const merged = mergeHits([hit("a"), hit("b")], [hit("b"), hit("c")], 6);
  eq("duplicates are dropped", merged.length, 3);
  eq("first-round order is preserved", merged[0].id, "a");
  eq("new results append", merged[2].id, "c");
  eq("the cap is honoured", mergeHits([hit("a")], [hit("b"), hit("c")], 2).length, 2);

  /* ── Result ───────────────────────────────────────────────────────────── */

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[rag:test] crashed:", err);
  process.exit(1);
});
