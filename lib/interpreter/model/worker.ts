import "server-only";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { HttpError } from "@/lib/api/respond";
import { liveJobSchema, type LiveSigningJob } from "./live";
import { canReadExamSigning } from "./manifest";

async function workerConfig() {
  let local: { token?: string } = {};
  try { local = JSON.parse(await readFile(path.join(process.cwd(), ".cache/signing/worker-config.json"), "utf8")); } catch { /* env configuration is also supported */ }
  const token = process.env.POLARIS_SIGNING_TOKEN || local.token;
  if (!token || token.length < 32) throw new HttpError(503, "The local signing worker is not configured. Start npm run signing:worker.");
  return token;
}

export async function signingWorker(userId: string, endpoint: string, init: RequestInit & { duplex?: "half" } = {}) {
  const token = await workerConfig();
  try {
    const response = await fetch(`http://127.0.0.1:8765${endpoint}`, {
      ...init, cache: "no-store", signal: init.signal ?? AbortSignal.timeout(120_000),
      headers: { ...Object.fromEntries(new Headers(init.headers)), Authorization: `Bearer ${token}`,
        "X-Signing-Owner": createHash("sha256").update(userId).digest("hex") },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { detail?: unknown };
      throw new HttpError(response.status, typeof body.detail === "string" ? body.detail : "The signing request could not be completed.");
    }
    return response;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(503, "The local signing worker is unavailable. Start npm run signing:worker, then retry.");
  }
}

export async function authorizeSigningExam(userId: string, sessionId: string, part: string, asset: boolean) {
  const { getPublicExamSession } = await import("@/lib/exams/service");
  const session = await getPublicExamSession(userId, sessionId);
  if (!canReadExamSigning(session, part, asset)) throw new HttpError(403, "Signing is available only with this active listening recording.");
}

export async function ownedSigningJob(userId: string, id: string, asset = false): Promise<LiveSigningJob> {
  const response = await signingWorker(userId, `/jobs/${id}`);
  const job = liveJobSchema.parse(await response.json());
  if (job.scope.kind === "exam") await authorizeSigningExam(userId, job.scope.sessionId, job.scope.part, asset);
  return job;
}
