/**
 * /api/integrations/[provider] - REST endpoints for connecting, syncing, and disconnecting tools.
 * 
 * VIVA NOTE:
 * - POST   : Connects Codeforces or GitHub, enforcing subscription plan limits.
 * - PUT    : Re-syncs public achievements for a connected tool.
 * - DELETE : Revokes/disconnects a tool and deletes stored summary rows from MongoDB.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { integrationDef, envReady } from "@/lib/integrations/registry";
import {
  importCodeforces,
  importGitHub,
  syncIntegration,
  removeIntegrationRow,
} from "@/lib/integrations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zod schemas to validate client input before executing API calls
const cfSchema = z.object({ handle: z.string().min(2).max(30) });
const ghSchema = z.object({ username: z.string().min(1).max(39), token: z.string().max(200).optional() });

/**
 * VIVA NOTE: POST method connects Codeforces / GitHub while enforcing plan limits.
 */
export const POST = withErrorHandling(async (req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  const def = integrationDef(provider);

  if (!def) return fail(404, "Unknown integration provider.");

  if (def.baseStatus === "coming_soon") {
    return fail(409, `${def.name} is coming soon — ${def.comingSoonReason ?? "not available yet."}`);
  }
  if (def.connectionMethod === "oauth" && !envReady(def)) {
    return fail(409, `${def.name} requires server OAuth credentials configured.`);
  }

  const userPlan = session.plan || "pro";

  try {
    // FEATURE 1 & 2: Connect platform with plan checking
    if (provider === "codeforces") {
      const body = cfSchema.parse(await parseJson(req));
      const row = await importCodeforces(session.id, body.handle, userPlan);
      return ok({ row });
    }
    if (provider === "github") {
      const body = ghSchema.parse(await parseJson(req));
      const row = await importGitHub(session.id, body.username, body.token, userPlan);
      return ok({ row });
    }
  } catch (e) {
    if (e instanceof z.ZodError) throw e;
    return fail(422, e instanceof Error ? e.message : "Connection failed.");
  }

  return fail(400, "No connection handler configured for this provider.");
});

/**
 * VIVA NOTE: PUT method re-syncs external achievements for a connected tool.
 */
export const PUT = withErrorHandling(async (_req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  const userPlan = session.plan || "pro";

  try {
    const row = await syncIntegration(session.id, provider, userPlan);
    return ok({ row });
  } catch (e) {
    return fail(422, e instanceof Error ? e.message : "Sync failed.");
  }
});

/**
 * VIVA NOTE: DELETE method revokes connection and removes data from MongoDB.
 */
export const DELETE = withErrorHandling(async (_req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;

  await removeIntegrationRow(session.id, provider);
  return ok({ revoked: true });
});
