import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".cache", "signing");
const configPath = path.join(cache, "worker-config.json");
mkdirSync(cache, { recursive: true });
const config = existsSync(configPath) ? JSON.parse(readFileSync(configPath, "utf8")) : {};
config.token ||= randomBytes(32).toString("hex");
const supplied = process.argv.indexOf("--smplx");
if (supplied !== -1) config.smplx = path.resolve(process.argv[supplied + 1] || "");
if (!config.smplx || !existsSync(config.smplx)) {
  console.error('Supply your licensed mesh: npm run signing:worker -- --smplx "path/to/SMPLX_NEUTRAL.npz"');
  process.exit(1);
}
writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
const python = path.join(cache, "venv", process.platform === "win32" ? "Scripts/python.exe" : "bin/python");
if (!existsSync(python)) {
  console.error("Install services/signing/requirements.txt in .cache/signing/venv first. See docs/SIGN_LANGUAGE_PRODUCTION.md.");
  process.exit(1);
}
const worker = spawn(python, ["-m", "uvicorn", "worker:app", "--host", "127.0.0.1", "--port", "8765", "--no-access-log"], {
  cwd: path.join(root, "services", "signing"), stdio: "inherit", windowsHide: true,
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => worker.kill());
worker.on("exit", (code) => process.exit(code ?? 1));
