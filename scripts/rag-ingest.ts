/**
 * CLI KB ingestion:  npm run rag:ingest  [-- --force]
 *
 * Needs MONGODB_URI and GEMMA_API_KEY in .env.local. Incremental: only chunks
 * whose content hash changed are re-embedded.
 */

import { loadEnv } from "./load-env";

async function main(): Promise<number> {
  loadEnv();
  const { ingestKb } = await import("../lib/rag/ingest");
  const report = await ingestKb({ force: process.argv.includes("--force") });
  console.log(JSON.stringify(report, null, 2));
  return report.error ? 1 : 0;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error("[rag:ingest] failed:", err);
    process.exit(1);
  });
