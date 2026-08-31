"use client";

/**
 * Connections - the Integration Hub.
 *
 *   Status dashboard  - animated rings: connected / available / coming soon
 *   Integration Orbit - Polaris hub center; connected apps orbit close and
 *                       bright, available apps farther + dimmer, coming-soon
 *                       frosted on the outer ring
 *   Filter + search   - status & category chips, free-text search
 *   3D card grid      - tilt hover, status ring, real brand marks
 *   Connect modal     - honest privacy contract (will / won't), then the
 *                       REAL flow: Codeforces handle, GitHub username
 *                       (+ optional transient PAT), OAuth redirect when the
 *                       server has credentials, "requires setup" otherwise
 *   Manage modal      - account, imported data, insights, Sync now, Revoke
 *   Coming soon       - honest reason + notify-me (event-tracked)
 *
 * Every state change emits shared-store events the Strategist sees.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { roadmapStore } from "@/lib/roadmap/store";
import type { IntegrationDef, IntegrationStatus, IntegrationCategory } from "@/lib/integrations/registry";
import { CATEGORY_LABEL } from "@/lib/integrations/registry";
import { BrandLogo, type BrandKey } from "./BrandLogos";
import { Icon } from "./ui";
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

const BRAND_KEYS = new Set(["notion", "obsidian", "gcal", "github", "khan", "codeforces", "gdrive", "linkedin"]);

const STATUS_META: Record<string, { label: string; chip: string; dot: string }> = {
  connected:      { label: "Connected",      chip: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30", dot: "bg-aurora-500" },
  available:      { label: "Available",      chip: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100 dark:ring-polaris-400/30", dot: "bg-polaris-500" },
  requires_setup: { label: "Requires setup", chip: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100 dark:ring-nova-400/30", dot: "bg-nova-500" },
  coming_soon:    { label: "Coming soon",    chip: "bg-paper-deep text-ink-muted ring-ink-faint/30 dark:bg-white/[0.06] dark:ring-white/[0.1]", dot: "bg-ink-faint" },
  error:          { label: "Error",          chip: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30", dot: "bg-rose-500" },
  syncing:        { label: "Syncing",        chip: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100", dot: "bg-polaris-500 animate-pulse" },
  revoked:        { label: "Revoked",        chip: "bg-paper-deep text-ink-muted ring-ink-faint/30", dot: "bg-ink-faint" },
};

type Filter = "all" | "connected" | "available" | "coming_soon" | IntegrationCategory;

export function ConnectionsClient({ initial, demo = false }: { initial: HubEntryDto[]; demo?: boolean }) {
  const [entries, setEntries] = useState<HubEntryDto[]>(initial);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // OAuth callback flag from /connections?oauth=connected|failed
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const flag = p.get("oauth");
    if (flag === "connected") { setToast("OAuth connection established"); void refresh(); }
    if (flag === "failed") setToast("OAuth flow didn't complete - try again");
    if (flag) window.history.replaceState(null, "", "/connections");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    if (demo) return;
    const r = await fetch("/api/integrations", { cache: "no-store" });
    if (r.ok) {
      const d = await r.json();
      setEntries(d.entries as HubEntryDto[]);
    }
  }

  const counts = useMemo(() => ({
    connected: entries.filter((e) => e.status === "connected").length,
    available: entries.filter((e) => e.status === "available" || e.status === "requires_setup").length,
    coming: entries.filter((e) => e.status === "coming_soon").length,
    imported: entries.reduce((s, e) => s + e.imported.length, 0),
    errors: entries.filter((e) => e.status === "error").length,
  }), [entries]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (filter === "connected" && e.status !== "connected") return false;
      if (filter === "available" && !(e.status === "available" || e.status === "requires_setup")) return false;
      if (filter === "coming_soon" && e.status !== "coming_soon") return false;
      if (["calendar", "storage", "notes", "coding", "learning", "social"].includes(filter) && e.def.category !== filter) return false;
      if (!q) return true;
      return (
        e.def.name.toLowerCase().includes(q) ||
        e.def.category.includes(q) ||
        e.def.features.some((f) => f.toLowerCase().includes(q)) ||
        e.def.description.toLowerCase().includes(q)
      );
    });
  }, [entries, filter, query]);

  const open = entries.find((e) => e.def.id === openId) ?? null;
  const insights = entries.filter((e) => e.status === "connected" && e.insights.length > 0);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1240px] mx-auto">
      {/* ─── Header + dashboard ─── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Integration hub</div>
        <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
          Plug your real work <span className="grad-text">into the Strategist</span>
        </h1>
        <p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
          Explicit scopes only · read-only by default · revoke in one click. Connected data sharpens your roadmap, deadlines, and fit analysis.
        </p>

        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <DashStat label="Connected" value={counts.connected} tone="aurora" pct={Math.min(100, (counts.connected / Math.max(1, entries.length)) * 100)} />
          <DashStat label="Available" value={counts.available} tone="polaris" pct={Math.min(100, (counts.available / Math.max(1, entries.length)) * 100)} />
          <DashStat label="Coming soon" value={counts.coming} tone="ink" pct={Math.min(100, (counts.coming / Math.max(1, entries.length)) * 100)} />
          <DashStat label="Data imported" value={counts.imported} tone="nova" pct={counts.imported ? 100 : 6} suffix=" items" healthy={counts.errors === 0} />
        </div>
      </motion.div>

      {/* ─── Orbit ─── */}
      <Orbit entries={entries} onOpen={setOpenId} />

      {/* ─── Insights from connected tools ─── */}
      {insights.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {insights.slice(0, 4).flatMap((e) =>
            e.insights.slice(0, 2).map((ins, i) => (
              <motion.div
                key={`${e.def.id}-${i}`}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="app-glass rounded-2xl px-4 py-3 flex items-start gap-3"
              >
                <ProviderMark def={e.def} size={28} />
                <p className="text-[12px] text-ink leading-relaxed flex-1">{ins}</p>
              </motion.div>
            )),
          )}
        </div>
      )}

      {/* ─── Filters + search ─── */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-paper-card hairline focus-within:ring-1 focus-within:ring-polaris-400 flex-1 min-w-[200px] max-w-sm">
          <span className="text-ink-muted shrink-0"><Icon.search size={14} /></span>
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tools, features, data types…"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted/70 outline-none min-w-0"
          />
        </label>
        {(["all", "connected", "available", "coming_soon", "calendar", "coding", "storage", "notes", "learning", "social"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "h-9 text-[11.5px] font-medium px-3 rounded-xl ring-1 ring-inset transition-colors capitalize",
              filter === f
                ? "bg-ink text-paper ring-ink"
                : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
            )}
          >
            {f === "all" ? "All" : f === "coming_soon" ? "Coming soon" : CATEGORY_LABEL[f as IntegrationCategory] ?? f}
          </button>
        ))}
      </div>

      {/* ─── Card grid ─── */}
      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"
      >
        {visible.map((e) => (
          <IntegrationCard key={e.def.id} e={e} onOpen={() => setOpenId(e.def.id)} />
        ))}
      </motion.div>

      {/* ─── Privacy panel ─── */}
      <div className="mt-8 app-glass rounded-2xl p-5 flex flex-col sm:flex-row items-start gap-4">
        <span className="shrink-0 h-10 w-10 rounded-xl bg-gradient-to-br from-aurora-500/20 to-aurora-500/5 ring-1 ring-inset ring-aurora-400/30 flex items-center justify-center text-aurora-600 dark:text-aurora-200">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4"/></svg>
        </span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2 text-[12px] text-ink-dim leading-relaxed flex-1">
          <div><span className="font-semibold text-ink block">Explicit scopes only.</span> Every connection lists exactly what&apos;s read - nothing more is touched.</div>
          <div><span className="font-semibold text-ink block">Read-only by default.</span> Write access (like calendar events) is separate, optional, and always confirmed.</div>
          <div><span className="font-semibold text-ink block">Revoke anytime.</span> One click deletes the connection and its imported summaries.</div>
        </div>
      </div>

      {/* ─── Modals + toast ─── */}
      <AnimatePresence>
        {open && (
          <IntegrationModal
            key={open.def.id}
            e={open}
            onClose={() => setOpenId(null)}
            onChanged={async (msg) => {
              if (demo) setEntries((items) => items.map((item) => item.def.id === open.def.id ? { ...item, status: item.status === "connected" ? item.def.baseStatus : "connected", account: item.status === "connected" ? null : { displayName: "Demo connection" }, lastSyncAt: new Date().toISOString() } : item));
              else await refresh();
              if (msg) setToast(msg);
            }}
            demo={demo}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop max-w-[90vw] truncate"
          >
            ✦ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── provider mark (real vector when available, monogram otherwise) ─── */

function ProviderMark({ def, size = 40 }: { def: IntegrationDef; size?: number }) {
  const inner = BRAND_KEYS.has(def.brand ?? "")
    ? <BrandLogo brand={def.brand as BrandKey} width={size * 0.5} height={size * 0.5} />
    : <span className="font-serif font-bold" style={{ fontSize: size * 0.4 }}>{def.name[0]}</span>;
  return (
    <span
      className="inline-flex items-center justify-center rounded-xl text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_5px_14px_-6px_rgba(0,0,0,0.4)]"
      style={{ background: def.color, height: size, width: size }}
      aria-label={def.name}
    >
      {inner}
    </span>
  );
}

/* ─── dashboard stat with ring ─── */

function DashStat({
  label, value, tone, pct, suffix = "", healthy,
}: {
  label: string; value: number; tone: "aurora" | "polaris" | "nova" | "ink"; pct: number; suffix?: string; healthy?: boolean;
}) {
  const r = 15, c = 2 * Math.PI * r;
  const stroke = { aurora: "stroke-aurora-500", polaris: "stroke-polaris-500", nova: "stroke-nova-500", ink: "stroke-ink-faint" }[tone];
  return (
    <div className="app-glass rounded-2xl p-3.5 flex items-center gap-3">
      <span className="relative h-10 w-10 shrink-0">
        <svg viewBox="0 0 40 40" className="h-full w-full -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" className="stroke-paper-deep" />
          <motion.circle
            cx="20" cy="20" r={r} fill="none" strokeWidth="3.5" strokeLinecap="round"
            initial={{ strokeDasharray: c, strokeDashoffset: c }}
            animate={{ strokeDashoffset: c - (c * pct) / 100 }}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className={stroke}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center font-serif text-[13px] font-bold text-ink tabular-nums">{value}</span>
      </span>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</div>
        <div className="text-[11px] text-ink-dim mt-0.5">
          {healthy === undefined ? `${value}${suffix}` : healthy ? "Sync healthy" : "Check errors"}
        </div>
      </div>
    </div>
  );
}

/* ─── Integration Orbit ─── */

function Orbit({ entries, onOpen }: { entries: HubEntryDto[]; onOpen: (id: string) => void }) {
  const connected = entries.filter((e) => e.status === "connected");
  const available = entries.filter((e) => e.status === "available" || e.status === "requires_setup");
  const coming = entries.filter((e) => e.status === "coming_soon");

  const rings: Array<{ items: HubEntryDto[]; radius: number; duration: string; cls: string }> = [
    { items: connected, radius: 21, duration: "32s", cls: "" },
    { items: available, radius: 34, duration: "52s", cls: "opacity-80" },
    { items: coming, radius: 46, duration: "80s", cls: "opacity-45" },
  ];

  return (
    <div className="relative mb-6 rounded-3xl app-glass-dark overflow-hidden h-[300px] sm:h-[340px] hidden sm:block">
      {/* nebula */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-64 w-64 rounded-full bg-polaris-500/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} aria-hidden />

      {/* ring guides */}
      {rings.map((ring) => (
        <span
          key={ring.radius}
          aria-hidden
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]"
          style={{ height: `${ring.radius * 2}%`, aspectRatio: "1" }}
        />
      ))}

      {/* hub */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center">
        <span className="relative h-14 w-14 rounded-full bg-paper text-ink flex items-center justify-center shadow-pop">
          <span className="absolute -inset-2 rounded-full bg-polaris-400/30 blur-md animate-pulse" aria-hidden />
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" className="relative"><path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z"/></svg>
        </span>
        <span className="mt-2 text-[10px] uppercase tracking-[0.25em] font-bold text-paper/50">Polaris</span>
      </div>

      {/* orbiting items - rotating wrapper + counter-rotating icon keeps logos upright */}
      <OrbitItems rings={rings} onOpen={onOpen} />

      <div className="absolute bottom-3 left-5 right-5 flex items-center justify-between text-[9.5px] text-paper/40 pointer-events-none">
        <span>Inner ring: connected · middle: available · outer: coming soon</span>
        <span>Tap any app</span>
      </div>
    </div>
  );
}

/** Orbit items via rotating wrapper + counter-rotating icon (keeps logos upright). */
function OrbitItems({
  rings, onOpen,
}: {
  rings: Array<{ items: HubEntryDto[]; radius: number; duration: string; cls: string }>;
  onOpen: (id: string) => void;
}) {
  return (
    <>
      {rings.map((ring) =>
        ring.items.map((e, i) => {
          const startAngle = (360 / Math.max(1, ring.items.length)) * i;
          return (
            <div
              key={e.def.id}
              className={cn("orbit-ring absolute inset-0 pointer-events-none", ring.cls)}
              style={{ "--orbit-duration": ring.duration, rotate: `${startAngle}deg` } as React.CSSProperties}
            >
              <div className="absolute left-1/2 -translate-x-1/2" style={{ top: `${50 - ring.radius}%` }}>
                <div className="orbit-item pointer-events-auto" style={{ "--orbit-duration": ring.duration, rotate: `${-startAngle}deg` } as React.CSSProperties}>
                  <button
                    onClick={() => onOpen(e.def.id)}
                    title={`${e.def.name} - ${STATUS_META[e.status]?.label}`}
                    className={cn(
                      "relative block rounded-xl transition-transform hover:scale-125",
                      e.status === "coming_soon" && "grayscale-[0.4]",
                    )}
                  >
                    {e.status === "connected" && (
                      <span className="absolute -inset-1.5 rounded-xl bg-aurora-400/40 blur-md animate-pulse" aria-hidden />
                    )}
                    <span className="relative"><ProviderMark def={e.def} size={34} /></span>
                    <span className={cn("absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-ink", STATUS_META[e.status]?.dot)} aria-hidden />
                  </button>
                </div>
              </div>
            </div>
          );
        }),
      )}
    </>
  );
}

/* ─── 3D card ─── */

function IntegrationCard({ e, onOpen }: { e: HubEntryDto; onOpen: () => void }) {
  const sm = STATUS_META[e.status] ?? STATUS_META.available;
  return (
    <motion.button
      variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
      whileHover={{ y: -5, rotateX: 1.5, rotateY: -1.5, transition: { duration: 0.25 } }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      onClick={onOpen}
      className={cn(
        "app-glass rounded-2xl p-4 text-left relative overflow-hidden group",
        e.status === "coming_soon" && "opacity-75",
      )}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-polaris-200/15 via-transparent to-aurora-200/10" />
      <div className="relative flex items-start gap-3">
        <span className="group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-300">
          <ProviderMark def={e.def} size={42} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-serif text-[15px] font-bold text-ink">{e.def.name}</span>
            <span className={cn("text-[9px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[2px] ring-1 ring-inset inline-flex items-center gap-1", sm.chip)}>
              <span className={cn("h-1 w-1 rounded-full", sm.dot)} /> {sm.label}
            </span>
          </div>
          <div className="text-[10px] uppercase tracking-wider font-bold text-ink-muted mt-0.5">
            {CATEGORY_LABEL[e.def.category]} · {e.def.syncDirection === "two_way" ? "two-way" : e.def.syncDirection}
          </div>
        </div>
      </div>
      <p className="relative text-[11.5px] text-ink-dim leading-relaxed mt-2.5 line-clamp-2">{e.def.description}</p>
      <div className="relative mt-3 flex items-center gap-2 text-[10.5px]">
        {e.status === "connected" ? (
          <>
            <span className="font-mono text-ink-muted truncate">@{e.account?.username}</span>
            {e.lastSyncAt && <span className="ml-auto font-mono text-ink-muted shrink-0">synced {timeAgo(e.lastSyncAt)}</span>}
          </>
        ) : (
          <span className="text-ink-muted truncate">{e.def.features.slice(0, 2).join(" · ")}</span>
        )}
      </div>
    </motion.button>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 90) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/* ─── unified modal (connect / manage / coming soon) ─── */

function IntegrationModal({
  e, onClose, onChanged, demo = false,
}: {
  e: HubEntryDto;
  onClose: () => void;
  onChanged: (toast?: string) => Promise<void>;
  demo?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [handle, setHandle] = useState("");
  const [token, setToken] = useState("");
  const def = e.def;
  const sm = STATUS_META[e.status] ?? STATUS_META.available;

  async function connect() {
    setErr(null);
    if (demo) { await onChanged(`${def.name} connected in demo mode`); onClose(); return; }
    if (def.connectionMethod === "oauth") {
      window.location.href = `/api/integrations/oauth/${def.id}`;
      return;
    }
    if (!handle.trim()) { setErr(def.id === "github" ? "Enter your GitHub username." : "Enter your handle."); return; }
    setBusy("connect");
    try {
      const body = def.id === "github"
        ? { username: handle, ...(token.trim() ? { token } : {}) }
        : { handle };
      const r = await fetch(`/api/integrations/${def.id}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d?.error ?? "Connection failed"); return; }
      roadmapStore.emit("INTEGRATION_CONNECTED", `Connected ${def.name} (@${handle.trim()})`);
      await onChanged(`${def.name} connected - data imported`);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  async function sync() {
    if (demo) { await onChanged(`${def.name} synced in demo mode`); return; }
    setBusy("sync");
    setErr(null);
    try {
      const r = await fetch(`/api/integrations/${def.id}`, { method: "PUT" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErr(d?.error ?? "Sync failed"); return; }
      roadmapStore.emit("INTEGRATION_SYNCED", `Re-synced ${def.name}`);
      await onChanged(`${def.name} synced`);
    } finally {
      setBusy(null);
    }
  }

  async function revoke() {
    if (demo) { await onChanged(`${def.name} disconnected`); onClose(); return; }
    if (!confirm(`Disconnect ${def.name} and delete its imported data?`)) return;
    setBusy("revoke");
    try {
      await fetch(`/api/integrations/${def.id}`, { method: "DELETE" });
      roadmapStore.emit("INTEGRATION_REVOKED", `Revoked ${def.name}`);
      await onChanged(`${def.name} disconnected`);
      onClose();
    } finally {
      setBusy(null);
    }
  }

  function notifyMe() {
    roadmapStore.emit("INTEGRATION_COMING_SOON_REQUESTED", `Requested ${def.name} integration`);
    void onChanged(`Noted - we'll prioritize ${def.name}`);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(ev) => ev.stopPropagation()}
        className="w-full max-w-[520px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08] flex items-start gap-3.5">
          <ProviderMark def={def} size={46} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-serif text-[19px] font-bold tracking-tight text-ink">{def.name}</h2>
              <span className={cn("text-[9px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[2px] ring-1 ring-inset", sm.chip)}>{sm.label}</span>
            </div>
            <a href={def.officialUrl} target="_blank" rel="noopener noreferrer" className="text-[10.5px] font-mono text-ink-muted hover:text-ink">
              {def.officialUrl.replace(/^https?:\/\//, "")} ↗
            </a>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><Icon.close /></button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-[12.5px] text-ink leading-relaxed">{def.description}</p>

          {/* ── CONNECTED: manage ── */}
          {e.status === "connected" && (
            <>
              <section>
                <ModalLabel>Connected account</ModalLabel>
                <div className="flex items-center gap-2.5 rounded-xl bg-paper-soft px-3 py-2.5">
                  {e.account?.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.account.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="h-8 w-8 rounded-full bg-polaris-500 text-white flex items-center justify-center font-serif text-[12px] font-bold">{(e.account?.displayName ?? "?")[0]}</span>
                  )}
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-semibold text-ink truncate">{e.account?.displayName}</div>
                    <div className="text-[10.5px] font-mono text-ink-muted">@{e.account?.username}{e.lastSyncAt ? ` · synced ${timeAgo(e.lastSyncAt)}` : ""}</div>
                  </div>
                </div>
              </section>
              {e.imported.length > 0 && (
                <section>
                  <ModalLabel>Imported</ModalLabel>
                  <ul className="space-y-1">
                    {e.imported.map((line) => (
                      <li key={line} className="flex items-start gap-2 text-[12px] text-ink leading-relaxed">
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-aurora-500 shrink-0" /> {line}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {e.insights.length > 0 && (
                <section className="relative rounded-xl p-[1.5px] overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-polaris-400/60 via-nova-400/50 to-aurora-400/60" />
                  <div className="relative rounded-[10.5px] bg-paper-card px-4 py-3 space-y-1.5">
                    <div className="text-[10.5px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300">Strategist insights</div>
                    {e.insights.map((ins) => <p key={ins} className="text-[12px] text-ink leading-relaxed">{ins}</p>)}
                  </div>
                </section>
              )}
            </>
          )}

          {/* ── AVAILABLE: privacy contract + connect flow ── */}
          {(e.status === "available" || e.status === "requires_setup") && (
            <>
              <section>
                <ModalLabel>Polaris will access</ModalLabel>
                <ul className="space-y-1.5">
                  {def.scopes.map((s) => (
                    <li key={s.id} className="flex items-start gap-2.5 rounded-xl bg-paper-soft px-3 py-2">
                      <span className={cn("mt-0.5 h-[15px] w-[15px] shrink-0 rounded flex items-center justify-center", s.required ? "bg-polaris-500 text-white" : "ring-1 ring-inset ring-ink-faint text-ink-muted")}>
                        {s.required ? <Icon.check size={9} /> : <span className="text-[8px] font-bold">?</span>}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-[12px] font-semibold text-ink">{s.label}{!s.required && <span className="text-ink-muted font-normal"> · optional</span>}</span>
                        <span className="block text-[11px] text-ink-muted leading-snug">{s.description}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <ModalLabel>Polaris will not</ModalLabel>
                <ul className="space-y-1">
                  {def.wontDo.map((w) => (
                    <li key={w} className="flex items-start gap-2 text-[12px] text-ink-dim leading-relaxed">
                      <span className="mt-1 text-rose-500"><Icon.close size={9} /></span> {w}
                    </li>
                  ))}
                </ul>
              </section>

              {e.status === "requires_setup" ? (
                <div className="rounded-xl bg-nova-100/60 dark:bg-nova-400/10 ring-1 ring-inset ring-nova-400/40 px-4 py-3 text-[12px] text-ink leading-relaxed">
                  <span className="font-bold text-nova-600 dark:text-nova-200">Requires server setup:</span>{" "}
                  the OAuth flow is built, but {(def.envVars ?? []).join(" + ")} must be configured before connecting. No fake connect button - it&apos;ll light up the moment credentials exist.
                </div>
              ) : def.connectionMethod === "public_handle" ? (
                <section className="space-y-2">
                  <input
                    value={handle}
                    onChange={(ev) => setHandle(ev.target.value)}
                    placeholder={def.id === "github" ? "GitHub username (e.g. torvalds)" : "Codeforces handle (e.g. tourist)"}
                    maxLength={40}
                    className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
                  />
                  {def.id === "github" && (
                    <input
                      value={token}
                      onChange={(ev) => setToken(ev.target.value)}
                      placeholder="Personal access token (optional - used once, never stored)"
                      type="password"
                      maxLength={200}
                      className="w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2.5 text-[12px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
                    />
                  )}
                </section>
              ) : null}
            </>
          )}

          {/* ── COMING SOON ── */}
          {e.status === "coming_soon" && (
            <>
              <section>
                <ModalLabel>Planned features</ModalLabel>
                <div className="flex flex-wrap gap-1.5">
                  {def.features.map((f) => (
                    <span key={f} className="text-[11px] font-medium text-ink-dim bg-paper-soft rounded-full px-2.5 py-1 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10">{f}</span>
                  ))}
                </div>
              </section>
              <div className="rounded-xl bg-paper-soft px-4 py-3 text-[12px] text-ink-dim leading-relaxed">
                <span className="font-semibold text-ink">Why it&apos;s not live yet:</span> {def.comingSoonReason}
              </div>
            </>
          )}

          {err && <div className="text-[12px] text-rose-600 dark:text-rose-300">{err}</div>}
        </div>

        {/* footer actions */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-3.5 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
          {e.status === "connected" && (
            <>
              <button onClick={() => void sync()} disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50">
                {busy === "sync" ? "Syncing…" : "Sync now"}
              </button>
              <button onClick={() => void revoke()} disabled={busy !== null} className="ml-auto text-[12px] text-rose-600 dark:text-rose-300 hover:underline">
                {busy === "revoke" ? "…" : "Disconnect"}
              </button>
            </>
          )}
          {e.status === "available" && (
            <button onClick={() => void connect()} disabled={busy !== null}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50">
              {busy === "connect" ? (
                <><span className="h-3.5 w-3.5 rounded-full border-2 border-paper/30 border-t-paper animate-spin" /> Importing…</>
              ) : (
                <>Continue with {def.name}</>
              )}
            </button>
          )}
          {e.status === "requires_setup" && (
            <span className="text-[11.5px] text-ink-muted">Connect activates automatically once credentials are configured.</span>
          )}
          {e.status === "coming_soon" && (
            <button onClick={notifyMe}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors">
              Notify me · request priority
            </button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{children}</div>;
}

