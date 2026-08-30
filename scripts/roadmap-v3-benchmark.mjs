import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const [universities, scholarships, caseStudies] = await Promise.all([
  readFile(new URL("../data/universities.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/scholarships.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/case-studies.json", import.meta.url), "utf8").then(JSON.parse),
]);

const docs = [
  ...universities.map((item) => ({ source: "university", title: item.name, text: JSON.stringify(item) })),
  ...scholarships.map((item) => ({ source: "scholarship", title: item.name, text: JSON.stringify(item) })),
  ...caseStudies.map((item) => ({ source: "case-study", title: item.title, text: JSON.stringify(item) })),
];

const tokenize = (value) => new Set((value.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((token) => token.length > 1));
const queries = ["MIT computer science", "SAT IELTS admissions", "Chevening scholarship", "research project leadership", "top US university GPA"];
const timings = [];

for (const query of queries) {
  const terms = tokenize(query);
  const started = performance.now();
  const hits = docs.map((doc) => {
    const haystack = tokenize(`${doc.title} ${doc.text}`);
    return { doc, score: [...terms].filter((term) => haystack.has(term)).length };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 8);
  const durationMs = performance.now() - started;
  timings.push(durationMs);
  console.log(`${query}: ${hits.length} hits in ${durationMs.toFixed(2)}ms`);
}

const average = timings.reduce((sum, value) => sum + value, 0) / timings.length;
console.log(`documents=${docs.length}; average deterministic retrieval=${average.toFixed(2)}ms`);
console.log("AI benchmark: unavailable unless run through the authenticated roadmap API with Gemma credentials; no synthetic AI result is reported.");
