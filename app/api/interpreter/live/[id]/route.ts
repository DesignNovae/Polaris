import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { ownedSigningJob, signingWorker } from "@/lib/interpreter/model/worker";
import { liveJobSchema } from "@/lib/interpreter/model/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
type Context = { params: Promise<{ id: string }> };
const identity = z.string().regex(/^[a-f0-9]{32}$/);

export const GET = withErrorHandling(async (req: NextRequest, ctx: Context) => {
  const user = await requireSession();
  const id = identity.parse((await ctx.params).id);
  const asset = req.nextUrl.searchParams.get("asset");
  const job = await ownedSigningJob(user.id, id, Boolean(asset));
  if (!asset) return Response.json(job, { headers });
  z.string().regex(/^(topology|\d{1,3})$/).parse(asset);
  const result = await signingWorker(user.id, `/jobs/${id}/assets/${asset}`, { signal: req.signal });
  return new Response(result.body, { headers: { ...headers, "Content-Type": "application/octet-stream" } });
});

export const PATCH = withErrorHandling(async (req: NextRequest, ctx: Context) => {
  const user = await requireSession();
  const id = identity.parse((await ctx.params).id);
  await ownedSigningJob(user.id, id);
  const body = z.object({ seconds: z.number().finite().min(0).max(7200) }).strict().parse(await parseJson(req));
  const result = await signingWorker(user.id, `/jobs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return Response.json(liveJobSchema.parse(await result.json()), { headers });
});

export const DELETE = withErrorHandling(async (_req: NextRequest, ctx: Context) => {
  const user = await requireSession();
  const id = identity.parse((await ctx.params).id);
  // Ownership is checked by the worker even if an exam has just expired.
  await signingWorker(user.id, `/jobs/${id}`, { method: "DELETE" });
  return Response.json({ cancelled: true }, { headers });
});
