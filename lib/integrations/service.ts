/**
 * Integration service - per-user connection rows + the REAL importers.
 *
 *   Codeforces: official public API (user.info / user.status / user.rating)
 *   GitHub:     public REST API by username; optional PAT is used for the
 *               single request only and never persisted.
 *
 * Imported summaries + derived insights are stored on the row; the
 * Strategist reads them through integrationContextLines().
 */

import { getDb } from "@/lib/db/mongodb";
import { HttpError } from "@/lib/api/respond";
import { planDef, type PlanId } from "@/lib/billing/plans";
import { integrationDef, envReady, INTEGRATIONS, type IntegrationStatus } from "./registry";

export type IntegrationRow = {
  userId: string;
  provider: string;
  status: Extract<IntegrationStatus, "connected" | "error" | "syncing" | "revoked">;
  account?: { username?: string; displayName?: string; avatarUrl?: string };
  /** Human-readable imported-data summary lines ("12 repositories", …). */
  imported?: string[];
  /** Derived insights the UI + Strategist surface. */
  insights?: string[];
  error?: string;
  lastSyncAt?: Date;
  createdAt?: Date;
};

const COLL = "connections";

export async function listIntegrationRows(userId: string): Promise<IntegrationRow[]> {
  const db = await getDb();
  return db.collection<IntegrationRow>(COLL).find({ userId }).toArray();
}

export async function upsertIntegrationRow(row: IntegrationRow): Promise<void> {
  const db = await getDb();
  await db.collection<IntegrationRow>(COLL).updateOne(
    { userId: row.userId, provider: row.provider },
    { $set: { ...row, lastSyncAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true },
  );
}

export async function removeIntegrationRow(userId: string, provider: string): Promise<void> {
  const db = await getDb();
  await db.collection<IntegrationRow>(COLL).deleteOne({ userId, provider });
}

export async function assertCanConnect(userId: string, plan: PlanId): Promise<void> {
  const limit = planDef(plan).limits.maxConnections;
  if (limit < 1) {
    throw new HttpError(403, "Connections are available on Polaris Pro and Elite.");
  }

  const rows = await listIntegrationRows(userId);
  const connectedCount = rows.filter((row) => row.status === "connected").length;
  if (connectedCount >= limit) {
    throw new HttpError(403, `Your ${planDef(plan).name} plan supports up to ${limit} connected tools.`);
  }
}

/* ─── Codeforces (official public API) ─── */

export async function importCodeforces(userId: string, handle: string, plan?: PlanId): Promise<IntegrationRow> {
  if (plan) await assertCanConnect(userId, plan);
  const clean = handle.trim();
  if (!/^[\w.-]{2,30}$/.test(clean)) throw new Error("That doesn't look like a valid Codeforces handle.");

  const [infoRes, statusRes, ratingRes] = await Promise.all([
    fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(clean)}`, { cache: "no-store" }),
    fetch(`https://codeforces.com/api/user.status?handle=${encodeURIComponent(clean)}&from=1&count=200`, { cache: "no-store" }),
    fetch(`https://codeforces.com/api/user.rating?handle=${encodeURIComponent(clean)}`, { cache: "no-store" }),
  ]);

  const info = await infoRes.json().catch(() => null);
  if (!infoRes.ok || info?.status !== "OK") {
    throw new Error(info?.comment?.includes("not found") ? `Handle "${clean}" not found on Codeforces.` : "Codeforces API is unreachable right now - try again shortly.");
  }
  const user = info.result[0] as {
    handle: string; rating?: number; maxRating?: number; rank?: string; maxRank?: string; avatar?: string;
  };

  const subs = await statusRes.json().catch(() => null);
  const submissions: Array<{ verdict?: string; problem?: { tags?: string[]; name?: string } }> =
    subs?.status === "OK" ? subs.result : [];
  const solvedNames = new Set<string>();
  const failTags: Record<string, number> = {};
  for (const s of submissions) {
    if (s.verdict === "OK" && s.problem?.name) solvedNames.add(s.problem.name);
    else if (s.verdict && s.verdict !== "OK") {
      for (const t of s.problem?.tags ?? []) failTags[t] = (failTags[t] ?? 0) + 1;
    }
  }
  const weakTags = Object.entries(failTags).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t);

  const ratings = await ratingRes.json().catch(() => null);
  const contests: number = ratings?.status === "OK" ? ratings.result.length : 0;

  const imported = [
    user.rating ? `Rating ${user.rating} (${user.rank ?? "unrated"})` : "Unrated",
    user.maxRating ? `Peak ${user.maxRating} (${user.maxRank ?? ""})`.trim() : "",
    `${solvedNames.size} solved in last ${submissions.length} submissions`,
    contests ? `${contests} rated contests` : "",
  ].filter(Boolean);

  const insights = [
    user.rating && user.maxRating && user.rating < user.maxRating - 100
      ? `Rating is ${user.maxRating - user.rating} below your peak - consistency practice would help.`
      : user.rating
        ? `Solid standing at ${user.rating}; next band is within reach with targeted practice.`
        : "No rating yet - enter a rated contest to establish a baseline.",
    weakTags.length ? `Weakest topics by failed attempts: ${weakTags.join(", ")}. Worth a focused block on your Olympiad branch.` : "",
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

/* ─── GitHub (public REST; optional transient PAT) ─── */

export async function importGitHub(userId: string, username: string, token?: string, plan?: PlanId): Promise<IntegrationRow> {
  if (plan) await assertCanConnect(userId, plan);
  const clean = username.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9-]{1,39}$/.test(clean)) throw new Error("That doesn't look like a valid GitHub username.");

  const headers: Record<string, string> = {
    "Accept": "application/vnd.github+json",
    "User-Agent": "polaris-app",
  };
  if (token?.trim()) headers["Authorization"] = `Bearer ${token.trim()}`; // transient - never persisted

  const [userRes, repoRes] = await Promise.all([
    fetch(`https://api.github.com/users/${encodeURIComponent(clean)}`, { headers, cache: "no-store" }),
    fetch(`https://api.github.com/users/${encodeURIComponent(clean)}/repos?sort=updated&per_page=60`, { headers, cache: "no-store" }),
  ]);

  if (userRes.status === 404) throw new Error(`GitHub user "${clean}" not found.`);
  if (userRes.status === 403) throw new Error("GitHub rate limit hit - add a personal access token or retry in an hour.");
  if (!userRes.ok) throw new Error("GitHub API is unreachable right now - try again shortly.");

  const profile = await userRes.json() as { login: string; name?: string; avatar_url?: string; public_repos?: number; followers?: number };
  const repos = (await repoRes.json().catch(() => [])) as Array<{
    name: string; description?: string | null; language?: string | null;
    stargazers_count?: number; fork?: boolean; private?: boolean;
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

  const imported = [
    `${own.length} original repositories (${profile.public_repos ?? own.length} public total)`,
    topLangs.length ? `Top languages: ${topLangs.join(", ")}` : "",
    stars ? `${stars} stars across repos` : "",
    portfolio.length ? `${portfolio.length} portfolio candidates: ${portfolio.slice(0, 3).join(", ")}${portfolio.length > 3 ? "…" : ""}` : "",
  ].filter(Boolean);

  const insights = [
    undocumented > 0
      ? `${undocumented} repositor${undocumented === 1 ? "y has" : "ies have"} no description - documentation polish is the cheapest portfolio upgrade.`
      : "All repositories are documented - strong portfolio hygiene.",
    portfolio.length
      ? `"${portfolio[0]}" is your strongest public signal - worth a README pass and a pinned spot.`
      : "No standout public project yet - shipping one documented project would strengthen your profile fast.",
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

/* ─── re-sync (public data only) ─── */

export async function syncIntegration(userId: string, provider: string): Promise<IntegrationRow> {
  const rows = await listIntegrationRows(userId);
  const row = rows.find((r) => r.provider === provider);
  if (!row?.account?.username) throw new Error("Nothing to sync - connect first.");
  if (provider === "codeforces") return importCodeforces(userId, row.account.username);
  if (provider === "github") return importGitHub(userId, row.account.username);
  throw new Error("Sync isn't supported for this provider yet.");
}

/* ─── Strategist context ─── */

export async function integrationContextLines(userId: string, maxLines = 6): Promise<string[]> {
  try {
    const rows = await listIntegrationRows(userId);
    const connected = rows.filter((r) => r.status === "connected");
    if (!connected.length) return [];
    const lines: string[] = [
      `CONNECTED INTEGRATIONS: ${connected.map((r) => `${r.provider} (@${r.account?.username ?? "?"})`).join(", ")}`,
    ];
    for (const r of connected) {
      for (const ins of r.insights ?? []) {
        if (lines.length >= maxLines) return lines;
        lines.push(`[${r.provider}] ${ins}`);
      }
    }
    return lines;
  } catch {
    return [];
  }
}

/* ─── full hub state for the page ─── */

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

export type HubEntry = Awaited<ReturnType<typeof hubState>>[number];

export { integrationDef };

