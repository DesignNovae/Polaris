/**
 * CLI generation-side eval:  npm run rag:faith  [-- --n 8]
 *
 * Generates real answers over real retrieved context, then audits citations
 * deterministically and judges groundedness with Gemma. Costs roughly two
 * model calls per sampled question, so keep --n small on the free tier.
 */

import { loadEnv } from "./load-env";

async function main() {
  loadEnv();
  const { formatFaithfulness, runFaithfulnessEval } = await import("../lib/rag/faithfulness");
  const flag = process.argv.indexOf("--n");
  const sample = flag > -1 ? Number(process.argv[flag + 1]) || 8 : 8;
  console.log(formatFaithfulness(await runFaithfulnessEval({ sample })));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[rag:faith] failed:", err);
    process.exit(1);
  });
