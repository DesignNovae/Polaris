/**
 * GET /api/integrations/oauth/[provider]/callback
 *
 * OAuth code exchange for gcal / gdrive / facebook. Stores a connected row
 * with the account identity; tokens are kept server-side on the row for
 * future sync calls. Redirects back to /connections with a status flag.
 */

import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { integrationDef, envReady } from "@/lib/integrations/registry";
import { upsertIntegrationRow } from "@/lib/integrations/service";
import { getDb } from "@/lib/db/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req, ctx: { params: Promise<{ provider: string }> }) => {
  const session = await requireSession();
  const { provider } = await ctx.params;
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const back = (flag: string) => NextResponse.redirect(`${url.origin}/connections?oauth=${flag}`);

  const def = integrationDef(provider);
  if (!def || !envReady(def) || !code) return back("failed");

  const redirectUri = `${url.origin}/api/integrations/oauth/${provider}/callback`;

  try {
    if (provider === "gcal" || provider === "gdrive") {
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) return back("failed");

      const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const me = await meRes.json().catch(() => ({}));

      await upsertIntegrationRow({
        userId: session.id,
        provider,
        status: "connected",
        account: { username: me.email, displayName: me.name ?? me.email, avatarUrl: me.picture },
        imported: ["OAuth connected - first sync pending"],
        insights: [],
      });
      // Tokens stored separately for sync jobs.
      const db = await getDb();
      await db.collection("integration_tokens").updateOne(
        { userId: session.id, provider },
        { $set: { accessToken: tokens.access_token, refreshToken: tokens.refresh_token ?? null, updatedAt: new Date() } },
        { upsert: true },
      );
      return back("connected");
    }

    if (provider === "facebook") {
      const tokenRes = await fetch(
        `https://graph.facebook.com/v19.0/oauth/access_token?client_id=${process.env.FACEBOOK_CLIENT_ID}&client_secret=${process.env.FACEBOOK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(redirectUri)}&code=${encodeURIComponent(code)}`,
      );
      const tokens = await tokenRes.json();
      if (!tokenRes.ok || !tokens.access_token) return back("failed");

      const meRes = await fetch(`https://graph.facebook.com/me?fields=id,name&access_token=${tokens.access_token}`);
      const me = await meRes.json().catch(() => ({}));

      await upsertIntegrationRow({
        userId: session.id,
        provider,
        status: "connected",
        account: { username: me.id, displayName: me.name ?? "Facebook account" },
        imported: ["OAuth connected - event import pending"],
        insights: [],
      });
      return back("connected");
    }
  } catch {
    return back("failed");
  }
  return back("failed");
});

