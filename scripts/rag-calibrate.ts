/**
 * CLI judge calibration:  npm run rag:calibrate
 *
 * Grades the groundedness judge against answers whose correct verdict is known
 * in advance, so the groundedness number in the faithfulness report has a
 * known error rate attached to it.
 */

import { loadEnv } from "./load-env";

async function main() {
  loadEnv();
  const { calibrateJudge, formatCalibration } = await import("../lib/rag/judge-calibration");
  console.log(formatCalibration(await calibrateJudge()));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[rag:calibrate] failed:", err);
    process.exit(1);
  });
