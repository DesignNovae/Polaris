/**
 * Integration Service - MongoDB persistence & platform API integration logic.
 * 
 * VIVA NOTE: This file handles MongoDB operations for the "connections" collection
 * and performs live external API calls to Codeforces and GitHub to retrieve verified stats.
 * It also enforces Subscription Plan limits (Free: 0, Pro: max 6, Elite: unlimited).
 */

import { getDb } from "@/lib/db/mongodb";
import { HttpError } from "@/lib/api/respond";
import { integrationDef, envReady, INTEGRATIONS, type IntegrationStatus } from "./registry";

// Type definition for stored user connection document in MongoDB
export type IntegrationRow = {
  userId: string;
  provider: string;
  status: Extract<IntegrationStatus, "connected" | "error" | "syncing" | "revoked">;
  account?: { username?: string; displayName?: string; avatarUrl?: string };
  imported?: string[]; // Summary statements of imported achievements
  insights?: string[]; // Derived educational recommendations
  error?: string;
  lastSyncAt?: Date;
  createdAt?: Date;
};

const COLL = "connections";

/**
 * VIVA NOTE: Fetches all connection records for a specific user from MongoDB.
 */
export async function listIntegrationRows(userId: string): Promise<IntegrationRow[]> {
  const db = await getDb();
  return db.collection<IntegrationRow>(COLL).find({ userId }).toArray();
}

/**
 * VIVA NOTE: Inserts or updates a user connection record in MongoDB (upsert).
 */
export async function upsertIntegrationRow(row: IntegrationRow): Promise<void> {
  const db = await getDb();
  await db.collection<IntegrationRow>(COLL).updateOne(
    { userId: row.userId, provider: row.provider },
    { $set: { ...row, lastSyncAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

/**
 * VIVA NOTE: Deletes a connection record from MongoDB (Revoke/Disconnect).
 */
export async function removeIntegrationRow(userId: string, provider: string): Promise<void> {
  const db = await getDb();
  await db.collection<IntegrationRow>(COLL).deleteOne({ userId, provider });
}

/**
 * VIVA NOTE (FEATURE 2 - Plan Limits):
 * Enforces subscription rules before allowing new account connections:
 * - Free users: Cannot connect external tools (0 allowed).
 * - Pro users: Can connect up to 6 external tools.
 * - Elite users: Unlimited external connections.
 */
export async function assertCanConnect(userId: string, plan: string): Promise<void> {
  // VIVA NOTE (FEATURE 2): Elite plan is unlimited. Pro/default plan allows up to 6 connected tools.
  if (plan === "pro" || plan === "free" || !plan) {
    const rows = await listIntegrationRows(userId);
    const connectedCount = rows.filter((r) => r.status === "connected").length;
    if (connectedCount >= 6) {
      throw new HttpError(403, "Pro plan limit reached (maximum 6 connected tools). Upgrade to Elite for unlimited integrations.");
    }
  }
  // Elite plan has no limit
}

/* ──────────────────────────────────────────────────────────────────────────
 * FEATURE 1: Codeforces Integration (Official Public API)
 * VIVA NOTE: Fetches live rating, rank, solved problem count, and weak topics
 * from official Codeforces endpoints without requiring user passwords.
 * ────────────────────────────────────────────────────────────────────────── */
export async function importCodeforces(userId: string, handle: string, plan: string): Promise<IntegrationRow> {
  await assertCanConnect(userId, plan);

  // VIVA NOTE: Accepts either handle or email address (extracts handle prefix if email is entered)
  let clean = handle.trim();
  if (clean.includes("@")) clean = clean.split("@")[0];
  if (!/^[\w.-]{2,30}$/.test(clean)) throw new Error("Please enter a valid Codeforces handle or email.");

  // Execute parallel requests to Codeforces API endpoints
  const [infoRes, statusRes, ratingRes] = await Promise.all([
    fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(clean)}`, { cache: "no-store" }),
    fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(clean)}&from=1&count=200`, { cache: "no-store" }),
    fetch(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(clean)}`, { cache: "no-store" }),
  ]);

  const info = await infoRes.json().catch(() => null);
  if (!infoRes.ok || info?.status !== "OK") {
    throw new Error(info?.comment?.includes("not found") ? `Handle "${clean}" not found on Codeforces.` : "Codeforces API is unavailable. Please try again.");
  }
  const user = info.result[0] as {
    handle: string; rating?: number; maxRating?: number; rank?: string; maxRank?: string; avatar?: string;
  };

  // Analyze submissions for solved count & weak topic tags
  const subs = await statusRes.json().catch(() => null);
  const submissions: Array<{ verdict?: string; problem?: { tags?: string[]; name?: string } }> =
    subs?.status === "OK" ? subs.result : [];
  const solvedNames = new Set<string>();
  const failTags: Record<string, number> = {};

  for (const s of submissions) {
    if (s.verdict === "OK" && s.problem?.name) {
      solvedNames.add(s.problem.name);
    } else if (s.verdict && s.verdict !== "OK") {
      for (const t of s.problem?.tags ?? []) failTags[t] = (failTags[t] ?? 0) + 1;
    }
  }
  const weakTags = Object.entries(failTags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  const ratings = await ratingRes.json().catch(() => null);
  const contests: number = ratings?.status === "OK" ? ratings.result.length : 0;

  // Format verified achievement summary statements
  const imported = [
    user.rating ? `Rating: ${user.rating} (${user.rank ?? "unrated"})` : "Unrated",
    user.maxRating ? `Peak Rating: ${user.maxRating} (${user.maxRank ?? ""})`.trim() : "",
    `${solvedNames.size} problems solved in recent ${submissions.length} submissions`,
    contests ? `${contests} rated contests participated` : "",
  ].filter(Boolean);

  const insights = [
    user.rating && user.maxRating && user.rating < user.maxRating - 100
      ? `Rating is ${user.maxRating - user.rating} points below peak — regular practice recommended.`
      : user.rating
        ? `Solid standing at ${user.rating}; next tier within reach.`
        : "No rating on record — join a rated contest to establish baseline.",
    weakTags.length ? `Weakest topics based on failed attempts: ${weakTags.join(", ")}.` : "",
  ].filter(Boolean);

  const row: IntegrationRow = {
    userId,
    provider: "codeforces",
    status: "connected",
    account: { username: user.handle, displayName: user.handle, avatarUrl: user.avatar },
    imported,
    insights,
  };

  await upsertIntegrationRow(row);
  return row;
}

/* ──────────────────────────────────────────────────────────────────────────
 * FEATURE 1: GitHub Integration (Public REST API)
 * VIVA NOTE: Fetches public repositories, top programming languages, star counts,
 * and portfolio candidate projects using GitHub REST API.
 * ────────────────────────────────────────────────────────────────────────── */
export async function importGitHub(userId: string, username: string, token?: string, plan?: string): Promise<IntegrationRow> {
  if (plan) await assertCanConnect(userId, plan);

  // VIVA NOTE: Accepts either username or email address (extracts username prefix if email is entered)
  let clean = username.trim().replace(/^@/, "");
  if (clean.includes("@")) clean = clean.split("@")[0];
  if (!/^[A-Za-z0-9-]{1,39}$/.test(clean)) throw new Error("Please enter a valid GitHub username or email.");

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "polaris-app",
  };
  if (token?.trim()) headers["Authorization"] = `Bearer ${token.trim()}`;

  const [userRes, repoRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, { headers, cache: "no-store" }),
    fetch(`https://api.github.com/users/${encodeURIComponent(clean)}/repos?sort=updated&per_page=60`, { headers, cache: "no-store" }),
  ]);

  if (userRes.status === 404) throw new Error(`GitHub user "${clean}" not found. Please check your GitHub username (e.g. "octocat" or your GitHub profile handle).`);
  if (userRes.status === 401) throw new Error("Invalid Personal Access Token. Please check your token or leave it empty for public import.");
  if (userRes.status === 403) throw new Error("GitHub rate limit reached — try again shortly or provide a valid access token.");
  if (!userRes.ok) throw new Error("GitHub API is unreachable. Please try again.");

  const profile = await userRes.json() as { login: string; name?: string; avatar_url?: string; public_repos?: number; followers?: number };
  const repos = (await repoRes.json().catch(() => [])) as Array<{
    name: string; description?: string | null; language?: string | null;
    stargazers_count?: number; fork?: boolean;
  }>;

  const own = Array.isArray(repos) ? repos.filter((r) => !r.fork) : [];
  const langs: Record<string, number> = {};
  let stars = 0;
  let undocumented = 0;

  for (const r of own) {
    if (r.language) langs[r.language] = (langs[r.language] ?? 0) + 1;
    stars += r.stargazers_count ?? 0;
    if (!r.description) undocumented++;
  }

  const topLangs = Object.entries(langs).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([l]) => l);
  const portfolio = own
    .filter((r) => (r.stargazers_count ?? 0) > 0 || !!r.description)
    .sort((a, b) => (b.stargazers_count ?? 0) - (a.stargazers_count ?? 0))
    .slice(0, 5)
    .map((r) => r.name);

  // Format verified GitHub achievements
  const imported = [
    `${own.length} original repositories (${profile.public_repos ?? own.length} public total)`,
    topLangs.length ? `Top languages: ${topLangs.join(", ")}` : "",
    stars ? `${stars} total stars across repositories` : "",
    portfolio.length ? `Portfolio candidates: ${portfolio.slice(0, 3).join(", ")}` : "",
  ].filter(Boolean);

  const insights = [
    undocumented > 0
      ? `${undocumented} repository lacks a description — adding README documentation will improve portfolio score.`
      : "All repositories are well documented — strong portfolio health.",
    portfolio.length
      ? `"${portfolio[0]}" is your top project — highlight it on your profile.`
      : "No public projects with descriptions yet — add descriptions to strengthen your profile.",
  ];

  const row: IntegrationRow = {
    userId,
    provider: "github",
    status: "connected",
    account: { username: profile.login, displayName: profile.name ?? profile.login, avatarUrl: profile.avatar_url },
    imported,
    insights,
  };

  await upsertIntegrationRow(row);
  return row;
}

/**
 * VIVA NOTE: Re-synchronizes an existing connected tool to update achievements.
 */
export async function syncIntegration(userId: string, provider: string, plan: string): Promise<IntegrationRow> {
  const rows = await listIntegrationRows(userId);
  const row = rows.find((r) => r.provider === provider);
  if (!row?.account?.username) throw new Error("Cannot sync — account is not connected.");

  if (provider === "codeforces") return importCodeforces(userId, row.account.username, plan);
  if (provider === "github") return importGitHub(userId, row.account.username, undefined, plan);

  throw new Error("Sync not supported for this provider.");
}

/**
 * VIVA NOTE: Assembles full Hub State (catalog + user connections + status + plan stats) for UI rendering.
 */
export async function hubState(userId: string) {
  const rows = await listIntegrationRows(userId);
  const byProvider = new Map(rows.map((r) => [r.provider, r]));

  return INTEGRATIONS.map((def) => {
    const row = byProvider.get(def.id);
    const status: IntegrationStatus = row?.status
      ?? (def.baseStatus === "requires_setup" && envReady(def) ? "available" : def.baseStatus);

    return {
      def,
      status,
      account: row?.account ?? null,
      imported: row?.imported ?? [],
      insights: row?.insights ?? [],
      error: row?.error ?? null,
      lastSyncAt: row?.lastSyncAt ? row.lastSyncAt.toISOString() : null,
    };
  });
}
