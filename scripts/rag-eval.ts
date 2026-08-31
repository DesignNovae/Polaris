/**
 * CLI retrieval eval:  npm run rag:eval  [-- --k 5]
 *
 * Runs without a server. With no MONGODB_URI it falls back to the bundled
 * JSON and scores BM25 only; with an API key and an ingested index it also
 * scores the dense and hybrid retrievers.
 */

import { loadEnv } from "./load-env";

async function main() {
  loadEnv();
  const { formatEval, runEval } = await import("../lib/rag/eval");
  const flag = process.argv.indexOf("--k");
  const k = flag > -1 ? Number(process.argv[flag + 1]) || 5 : 5;
  // --rerank costs one model call per query; opt in.
  const withRerank = process.argv.includes("--rerank");
  console.log(formatEval(await runEval(k, { rerank: withRerank })));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[rag:eval] failed:", err);
    process.exit(1);
  });
