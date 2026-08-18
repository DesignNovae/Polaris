"use client";

/**
 * ConnectionsClient - Integration Hub UI Component.
 * 
 * VIVA NOTE: Displays the integration dashboard, tool filter tabs, connection cards grid,
 * connect modals (Codeforces handle / GitHub username), disconnect/manage modals,
 * and Subscription Plan limit enforcement (Free Upgrade Screen, Pro 6-tool limit, Elite Unlimited).
 */

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { IntegrationDef, IntegrationStatus, IntegrationCategory } from "@/lib/integrations/registry";
import { CATEGORY_LABEL } from "@/lib/integrations/registry";
import { cn } from "@/lib/cn";

export type HubEntryDto = {
  def: IntegrationDef;
  status: IntegrationStatus;
  account: { username?: string; displayName?: string; avatarUrl?: string } | null;
  imported: string[];
  insights: string[];
  error: string | null;
  lastSyncAt: string | null;
};

// Status metadata for badge styling
const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  connected:      { label: "Connected",      chip: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30", dot: "bg-aurora-500" },
  available:      { label: "Available",      chip: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100 dark:ring-polaris-400/30", dot: "bg-polaris-500" },
  requires_setup: { label: "Requires setup", chip: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100 dark:ring-nova-400/30", dot: "bg-nova-500" },
  coming_soon:    { label: "Coming soon",    chip: "bg-paper-deep text-ink-muted ring-ink-faint/30 dark:bg-white/[0.06] dark:ring-white/[0.1]", dot: "bg-ink-faint" },
  error:          { label: "Error",          chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30", dot: "bg-rose-500" },
};

type Filter = "all" | "connected" | "available" | IntegrationCategory;

export function ConnectionsClient({ initial, userPlan }: { initial: HubEntryDto[]; userPlan: string }) {
  const [entries, setEntries] = useState<HubEntryDto[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState<string | null>(null);

  // VIVA NOTE (FEATURE 2): Active plan state (defaults to Pro if user upgrades)
  const [activePlan, setActivePlan] = useState<string>(userPlan === "free" ? "pro" : userPlan);

  // VIVA NOTE: Refreshes integration hub state from API backend
  async function refresh() {
    const r = await fetch("/api/integrations", { cache: "no-store" });
    if (r.ok) {
      const data = await r.json();
      setEntries(data.entries as HubEntryDto[]);
    }
  }

  // VIVA NOTE (FEATURE 2): Calculates statistics and connection limits based on activePlan
  const stats = useMemo(() => {
    const connected = entries.filter((e) => e.status === "connected").length;
    const maxAllowed = activePlan === "elite" ? Infinity : activePlan === "pro" ? 6 : 0;
    return {
      connected,
      maxAllowed,
      canConnectMore: connected < maxAllowed,
      importedCount: entries.reduce((s, e) => s + e.imported.length, 0),
    };
  }, [entries, activePlan]);

  // VIVA NOTE: Filters tool cards by search query and category tab
  const visibleEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "connected" && e.status !== "connected") return false;
      if (filter === "available" && !(e.status === "available" || e.status === "requires_setup")) return false;
      if (["calendar", "storage", "notes", "coding", "learning", "social"].includes(filter) && e.def.category !== filter) return false;
      if (!q) return true;
      return (
        e.def.name.toLowerCase().includes(q) ||
        e.def.category.toLowerCase().includes(q) ||
        e.def.description.toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const selectedEntry = entries.find((e) => e.def.id === openModalId) ?? null;

  // VIVA NOTE (FEATURE 2 - Free Plan Upgrade Screen): Free users are shown an upgrade banner
  if (activePlan === "free") {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-10 max-w-4xl mx-auto text-center">
        {/* Plan Switcher Bar */}
        <div className="flex justify-center items-center gap-2 mb-6">
          <span className="text-xs text-ink-muted font-medium">Test Plan View:</span>
          {(["free", "pro", "elite"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setActivePlan(p)}
              className={cn("px-3 py-1 rounded-full text-xs font-semibold uppercase", activePlan === p ? "bg-ink text-paper" : "glass text-ink-dim")}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="glass rounded-3xl p-10 relative overflow-hidden border border-polaris-400/30">
          <div className="text-xs uppercase tracking-[0.2em] font-bold text-polaris-500 mb-2">Integration Hub</div>
          <h1 className="font-serif text-3xl font-bold text-ink">Connect Your External Accounts</h1>
          <p className="mt-3 text-sm text-ink-dim max-w-xl mx-auto leading-relaxed">
            Integration Hub is available for **Pro** and **Elite** subscribers. Free users cannot access external integrations. Upgrade to Pro or Elite to unlock up to 6 connected tools.
          </p>
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={() => setActivePlan("pro")}
              className="rounded-full bg-polaris-500 text-white px-6 py-2.5 text-sm font-medium hover:bg-polaris-600 transition-colors shadow-sm"
            >
              Upgrade to Pro (Up to 6 tools) →
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1240px] mx-auto">
      {/* Header & Plan Status Dashboard */}
      <div className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-semibold mb-1">Integration Hub</div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-ink">
            External Connections <span className="grad-text">&amp; Achievement Sync</span>
          </h1>
          <p className="text-xs text-ink-dim mt-1">
            Connect external accounts to automatically pull verified coding stats, repositories, and achievements.
          </p>
        </div>

        {/* FEATURE 2: Plan Connection Counter Badge & Plan Switcher */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-1.5 glass rounded-full px-3 py-1">
            <span className="text-[10px] uppercase font-bold text-ink-muted">Plan View:</span>
            {(["free", "pro", "elite"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setActivePlan(p)}
                className={cn("px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-colors", activePlan === p ? "bg-ink text-paper" : "text-ink-dim hover:text-ink")}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl px-4 py-2.5 flex items-center gap-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-ink-muted font-bold">Connected Tools</div>
              <div className="text-sm font-bold text-ink">
                {stats.connected} / {stats.maxAllowed === Infinity ? "∞" : stats.maxAllowed}
                <span className="text-xs font-normal text-ink-muted ml-1">({activePlan.toUpperCase()} Plan)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["all", "connected", "available", "coding", "calendar", "storage", "notes"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                filter === f ? "bg-ink text-paper" : "glass text-ink-dim hover:text-ink",
              )}
            >
              {f === "all" ? "All Tools" : f === "connected" ? "Connected" : f === "available" ? "Available" : CATEGORY_LABEL[f as IntegrationCategory] ?? f}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools…"
          className="rounded-full border border-polaris-200 bg-paper-card px-4 py-1.5 text-xs text-ink placeholder:text-ink-muted/60 focus:outline-none focus:border-polaris-400 w-full sm:w-56"
        />
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleEntries.map((entry) => (
          <IntegrationCard
            key={entry.def.id}
            entry={entry}
            onOpen={() => {
              // FEATURE 2: Check plan limit before opening connect modal
              if (entry.status !== "connected" && !stats.canConnectMore && entry.def.baseStatus === "available") {
                setShowUpgradeModal(`Pro plan allows a maximum of 6 connected tools. Upgrade to Elite for unlimited tools.`);
              } else {
                setOpenModalId(entry.def.id);
              }
            }}
          />
        ))}
      </div>

      {/* Connect / Manage Modal */}
      <AnimatePresence>
        {selectedEntry && (
          <Modal
            entry={selectedEntry}
            userPlan={userPlan}
            onClose={() => setOpenModalId(null)}
            onChanged={refresh}
          />
        )}

        {/* Upgrade Prompt Modal */}
        {showUpgradeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4" onClick={() => setShowUpgradeModal(null)}>
            <div className="bg-paper-card rounded-2xl p-6 max-w-md w-full shadow-pop" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-serif text-lg font-bold text-ink">Plan Limit Reached</h3>
              <p className="text-xs text-ink-dim mt-2 leading-relaxed">{showUpgradeModal}</p>
              <div className="mt-5 flex justify-end gap-2">
                <button onClick={() => setShowUpgradeModal(null)} className="px-4 py-2 text-xs font-medium text-ink-dim hover:text-ink">Close</button>
                <button className="px-4 py-2 text-xs font-semibold rounded-full bg-polaris-500 text-white">Upgrade to Elite</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// VIVA NOTE: Helper to construct direct user profile URL (e.g. https://github.com/octocat)
function profileUrl(entry: HubEntryDto): string {
  const username = entry.account?.username;
  if (!username) return entry.def.officialUrl;
  if (entry.def.id === "github") return `https://github.com/${username}`;
  if (entry.def.id === "codeforces") return `https://codeforces.com/profile/${username}`;
  return entry.def.officialUrl;
}

/**
 * IntegrationCard - Individual tool card.
 * VIVA NOTE: Renders platform icon, status chip, capability list, and action buttons.
 */
function IntegrationCard({ entry, onOpen }: { entry: HubEntryDto; onOpen: () => void }) {
  const meta = STATUS_META[entry.status] ?? STATUS_META.available;
  const isConnected = entry.status === "connected";

  return (
    <div className={cn("glass rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-polaris-400/40", isConnected && "ring-1 ring-aurora-400/30")}>
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <h3 className="font-serif text-base font-bold text-ink">{entry.def.name}</h3>
            <span className="text-[10px] uppercase font-mono text-ink-muted">{entry.def.category}</span>
          </div>
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider rounded-full px-2.5 py-0.5 ring-1 ring-inset inline-flex items-center gap-1", meta.chip)}>
            <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
            {meta.label}
          </span>
        </div>

        <p className="text-xs text-ink-dim leading-relaxed line-clamp-2 mb-4">{entry.def.description}</p>

        {/* Display imported achievement snippets if connected */}
        {isConnected && entry.imported.length > 0 && (
          <div className="rounded-xl bg-paper-soft/80 p-3 mb-4 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-aurora-700">Verified Sync Data</div>
            {entry.imported.slice(0, 2).map((item, i) => (
              <div key={i} className="text-[11px] text-ink flex items-center gap-1.5">
                <span className="text-aurora-500">✓</span> {item}
              </div>
            ))}
          </div>
        )}
      </div>

      {isConnected ? (
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onOpen}
            className="flex-1 rounded-full py-2 text-xs font-semibold border border-polaris-300 text-ink hover:bg-paper-soft text-center transition-colors"
          >
            Manage &amp; Sync
          </button>
          <a
            href={profileUrl(entry)}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full px-3.5 py-2 text-xs font-semibold bg-paper-soft text-ink hover:bg-paper-deep transition-colors inline-flex items-center gap-1"
            title={`Open ${entry.def.name} profile in new tab`}
          >
            Open ↗
          </a>
        </div>
      ) : (
        <button
          onClick={onOpen}
          className={cn(
            "w-full mt-2 rounded-full py-2 text-xs font-semibold transition-colors text-center",
            entry.def.baseStatus === "coming_soon"
              ? "bg-paper-deep text-ink-muted cursor-not-allowed"
              : "bg-ink text-paper hover:bg-polaris-700",
          )}
        >
          {entry.def.baseStatus === "coming_soon" ? "Coming Soon" : "Connect Account"}
        </button>
      )}
    </div>
  );
}

/**
 * Modal - Connect or Disconnect Modal Dialog.
 * VIVA NOTE: Handles input submission (Codeforces handle / GitHub username) for Feature 1,
 * and handles Revoke/Disconnect requests.
 */
function Modal({ entry, userPlan, onClose, onChanged }: { entry: HubEntryDto; userPlan: string; onClose: () => void; onChanged: () => void }) {
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isConnected = entry.status === "connected";

  // VIVA NOTE (FEATURE 1): Calls POST API to establish connection & import stats
  async function handleConnect() {
    if (!handle.trim()) return;
    setLoading(true);
    setError("");

    try {
      const payload = entry.def.id === "codeforces" ? { handle: handle.trim() } : { username: handle.trim(), token: token.trim() || undefined };
      const res = await fetch(`/api/integrations/${entry.def.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Connection failed.");

      await onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  // VIVA NOTE (FEATURE 1): Calls DELETE API to disconnect integration
  async function handleDisconnect() {
    if (!confirm(`Disconnect ${entry.def.name}? Stored summary data will be removed.`)) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/integrations/${entry.def.id}`, { method: "DELETE" });
      if (res.ok) {
        await onChanged();
        onClose();
      }
    } finally {
      setLoading(false);
    }
  }

  // VIVA NOTE: Calls PUT API to re-sync public achievements
  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch(`/api/integrations/${entry.def.id}`, { method: "PUT" });
      if (res.ok) await onChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-paper-card rounded-3xl p-6 max-w-lg w-full shadow-pop ring-1 ring-polaris-500/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">{entry.def.name}</h2>
            <p className="text-xs text-ink-muted font-mono">{entry.def.category}</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink text-sm">✕</button>
        </div>

        {/* View Mode 1: Connected State (Manage / Sync / Disconnect) */}
        {isConnected ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-aurora-100/40 p-4 border border-aurora-400/30 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-aurora-800">Connected Account</div>
                <div className="text-sm font-semibold text-ink mt-0.5">@{entry.account?.username}</div>
              </div>
              <a
                href={profileUrl(entry)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-polaris-600 dark:text-polaris-300 hover:underline flex items-center gap-1"
              >
                View on {entry.def.name} ↗
              </a>
            </div>

            {/* Imported achievements list */}
            {entry.imported.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-muted font-bold mb-2">Imported Achievements</div>
                <ul className="space-y-1.5">
                  {entry.imported.map((item, i) => (
                    <li key={i} className="text-xs text-ink flex items-center gap-2">
                      <span className="text-aurora-500">✓</span> {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-4 border-t border-polaris-500/10 flex justify-between items-center">
              <button onClick={handleDisconnect} disabled={loading} className="text-xs text-rose-600 font-semibold hover:underline">
                {loading ? "Disconnecting…" : "Disconnect Account"}
              </button>
              <button onClick={handleSync} disabled={loading} className="rounded-full bg-ink text-paper px-4 py-2 text-xs font-semibold hover:bg-polaris-700">
                {loading ? "Syncing…" : "Sync Now"}
              </button>
            </div>
          </div>
        ) : (
          /* View Mode 2: Unconnected State (Form Input for Codeforces handle / GitHub username) */
          <div className="space-y-4">
            <p className="text-xs text-ink-dim leading-relaxed">{entry.def.description}</p>

            {/* Privacy contract breakdown */}
            <div className="rounded-xl bg-paper-soft p-3 text-xs space-y-1.5">
              <div className="font-bold text-ink">What Polaris WILL NOT do:</div>
              {entry.def.wontDo.map((w, i) => (
                <div key={i} className="text-ink-dim flex items-center gap-1.5">
                  <span className="text-rose-500">✕</span> {w}
                </div>
              ))}
            </div>

            {entry.def.connectionMethod === "public_handle" && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-bold text-ink block mb-1">
                    {entry.def.id === "codeforces" ? "Codeforces Handle or Email" : "GitHub Username or Email"}
                  </label>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder={entry.def.id === "codeforces" ? "e.g. tourist or user@codeforces.com" : "e.g. octocat or octocat@github.com"}
                    className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-xs text-ink focus:outline-none focus:border-polaris-400"
                  />
                </div>

                {entry.def.id === "github" && (
                  <div>
                    <label className="text-xs font-bold text-ink block mb-1">
                      Personal Access Token (Optional)
                    </label>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_... (used transiently to raise API limits)"
                      className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-xs text-ink focus:outline-none focus:border-polaris-400"
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-xs text-rose-600">{error}</p>}

            <div className="pt-3 flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-xs text-ink-dim hover:text-ink">Cancel</button>
              <button
                onClick={handleConnect}
                disabled={loading || !handle.trim()}
                className="rounded-full bg-ink text-paper px-5 py-2 text-xs font-semibold hover:bg-polaris-700 disabled:opacity-50"
              >
                {loading ? "Connecting…" : "Connect & Import"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
