/**
 * GET /api/integrations/oauth/[provider]
 *
 * Real OAuth entry point for gcal / gdrive / facebook. When the operator
 * has configured client credentials (env vars), this redirects to the
 * provider's consent screen with the exact scopes the registry declares.
 * Without credentials it returns the honest requires_setup error - the UI
 * never shows a fake Connect for these.
 *
 * Callback: /api/integrations/oauth/[provider]/callback (same directory).
 */

import { NextResponse } from "next/server";
import { fail, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { integrationDef, envReady } from "@/lib/integrations/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOOGLE_SCOPES: Record<string, string> = {
  gcal: "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly",
  gdrive: "https://www.googleapis.com/auth/drive.file",
};

export const GET = withErrorHandling(async (req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  const def = integrationDef(provider);
  if (!def || def.connectionMethod !== "oauth") return fail(404, "Not an OAuth integration");
  if (!envReady(def)) {
    return fail(409, `${def.name} OAuth isn't configured yet. Set ${(def.envVars ?? []).join(" + ")} and restart.`);
  }

  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/integrations/oauth/${provider}/callback`;
  const state = `${session.id}:${Math.random().toString(36).slice(2, 10)}`;

  if (provider === "gcal" || provider === "gdrive") {
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GOOGLE_SCOPES[provider]);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("state", state);
    return NextResponse.redirect(url);
  }
  if (provider === "facebook") {
    const url = new URL("https://www.facebook.com/v19.0/dialog/oauth");
    url.searchParams.set("client_id", process.env.FACEBOOK_CLIENT_ID!);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("scope", "public_profile,user_events");
    url.searchParams.set("state", state);
    return NextResponse.redirect(url);
  }
  return fail(404, "Unsupported OAuth provider");
});

