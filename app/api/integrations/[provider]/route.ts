/**
 * /api/integrations/[provider]
 *
 * POST   - connect / import.
 *            codeforces: { handle }
 *            github:     { username, token? }  (token used transiently, never stored)
 * PUT    - re-sync a connected provider (public data only).
 * DELETE - revoke: removes the stored row + imported summaries.
 *
 * OAuth providers (gcal/gdrive/facebook) don't connect here - see
 * /api/integrations/oauth/[provider]. POSTing them returns the honest
 * requires_setup error instead of faking success.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { integrationDef, envReady } from "@/lib/integrations/registry";
import {
  importCodeforces, importGitHub, syncIntegration, removeIntegrationRow,
} from "@/lib/integrations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const cfSchema = z.object({ handle: z.string().min(2).max(30) });
const ghSchema = z.object({ username: z.string().min(1).max(39), token: z.string().max(200).optional() });

export const POST = withErrorHandling(async (req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  const def = integrationDef(provider);
  if (!def) return fail(404, "Unknown integration");

  if (def.baseStatus === "coming_soon") {
    return fail(409, `${def.name} isn't available yet - ${def.comingSoonReason ?? "coming soon."}`);
  }
  if (def.connectionMethod === "oauth") {
    if (!envReady(def)) {
      return fail(409, `${def.name} needs OAuth credentials (${(def.envVars ?? []).join(", ")}) configured on the server first.`);
    }
    return fail(400, `Use /api/integrations/oauth/${provider} to start the OAuth flow.`);
  }

  try {
    if (provider === "codeforces") {
      const body = cfSchema.parse(await parseJson(req));
      const row = await importCodeforces(session.id, body.handle, session.plan);
      return ok({ row });
    }
    if (provider === "github") {
      const body = ghSchema.parse(await parseJson(req));
      const row = await importGitHub(session.id, body.username, body.token, session.plan);
      return ok({ row });
    }
  } catch (e) {
    if (e instanceof z.ZodError) throw e;
    return fail(422, e instanceof Error ? e.message : "Import failed");
  }
  return fail(400, "No connect flow for this provider");
});

export const PUT = withErrorHandling(async (_req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  try {
    const row = await syncIntegration(session.id, provider);
    return ok({ row });
  } catch (e) {
    return fail(422, e instanceof Error ? e.message : "Sync failed");
  }
});

export const DELETE = withErrorHandling(async (_req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  await removeIntegrationRow(session.id, provider);
  return ok({ revoked: true });
});

