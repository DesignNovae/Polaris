"use client";

/**
 * Settings → "AI usage" panel.
 *
 * Shows the student's LLM usage for the last N days: totals, per-model
 * breakdown, and the 25 most recent calls. Lets them switch the window
 * between 7/30/90 days. Backed by /api/usage.
 */

import { useCallback, useEffect, useState } from "react";
import { Tag } from "./ui";
import { cn } from "@/lib/cn";

type Tier = "free" | "paid" | "local";
type Mode = "general" | "research" | "study" | "coding";

type ByProviderRow = {
  providerId: string;
  modelId: string;
  tier: Tier;
  calls: number;
  tokensIn: number;
  tokensOut: number;
  avgLatencyMs: number;
  errors: number;
};

type RecentRow = {
  providerId: string;
  modelId: string;
  mode: Mode;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  outcome: "ok" | "error";
  fallback: boolean;
  createdAt: string;
};

type Summary = {
  days: number;
  totalCalls: number;
  totalTokensIn: number;
  totalTokensOut: number;
  byProvider: ByProviderRow[];
  recent: RecentRow[];
};

const WINDOWS = [7, 30, 90];

function displayModel(modelId: string): string {
  return modelId.includes("31b") ? "Polaris AI Advanced" : "Polaris AI";
}

export function SettingsUsage() {
  const [days, setDays] = useState(30);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/usage?days=${days}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load usage");
      setSummary((await res.json()) as Summary);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="space-y-4">
      {/* Window switcher */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">Window</span>
        {WINDOWS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={cn(
              "text-[11.5px] font-medium px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors",
              days === d
                ? "bg-polaris-100 ring-polaris-300 text-ink"
                : "bg-paper-card ring-polaris-200 text-ink-dim hover:text-ink hover:ring-polaris-300 dark:ring-white/[0.12]",
            )}
          >
            {d}d
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load()}
          className="ml-auto text-[11.5px] text-polaris-500 hover:text-polaris-600 font-medium"
        >
          Refresh
        </button>
      </div>

      {err && <div className="text-[12px] text-rose-600">{err}</div>}

      {loading ? (
        <div className="text-[13px] text-ink-muted">Loading usage…</div>
      ) : !summary || summary.totalCalls === 0 ? (
        <div className="text-[13px] text-ink-muted italic">
          No Strategist calls in the last {days} days yet.
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Total calls" value={summary.totalCalls.toLocaleString()} />
            <Stat label="Tokens in" value={summary.totalTokensIn.toLocaleString()} />
            <Stat label="Tokens out" value={summary.totalTokensOut.toLocaleString()} />
          </div>

          {/* By provider */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-1.5">
              By model
            </div>
            <div className="rounded-xl ring-1 ring-inset ring-polaris-500/10 overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-paper-soft text-ink-muted">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Model</th>
                    <th className="text-right px-3 py-2 font-medium">Calls</th>
                    <th className="text-right px-3 py-2 font-medium">Tokens</th>
                    <th className="text-right px-3 py-2 font-medium">Avg ms</th>
                    <th className="text-right px-3 py-2 font-medium">Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byProvider.map((r) => (
                    <tr key={`${r.providerId}::${r.modelId}`} className="border-t border-polaris-500/10 bg-paper-card dark:border-white/[0.08]">
                      <td className="px-3 py-2">
                        <div className="font-medium text-ink truncate max-w-[220px]">{displayModel(r.modelId)}</div>
                        <div className="text-[10.5px] text-ink-muted font-mono">
                          Polaris · <TierBadge tier={r.tier} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-ink">{r.calls}</td>
                      <td className="px-3 py-2 text-right text-ink">{(r.tokensIn + r.tokensOut).toLocaleString()}</td>
                      <td className="px-3 py-2 text-right text-ink">{r.avgLatencyMs}</td>
                      <td className="px-3 py-2 text-right">
                        {r.errors > 0 ? (
                          <Tag tone="nova">{r.errors}</Tag>
                        ) : <span className="text-ink-muted">0</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-1.5">
              Recent calls
            </div>
            <ul className="rounded-xl ring-1 ring-inset ring-polaris-500/10 overflow-hidden divide-y divide-polaris-500/10">
              {summary.recent.map((r, i) => (
                <li key={i} className="px-3 py-2 bg-paper-card flex items-center gap-3 text-[12px]">
                  <span className="text-ink-muted font-mono text-[10.5px] w-24 shrink-0">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  <span className="text-ink truncate flex-1">{displayModel(r.modelId)}</span>
                  <Tag tone={r.mode === "research" ? "polaris" : r.mode === "study" ? "aurora" : r.mode === "coding" ? "nova" : "ink"}>
                    {r.mode}
                  </Tag>
                  <span className="text-ink-muted font-mono text-[10.5px]">{r.latencyMs} ms</span>
                  <span className={cn(
                    "font-mono text-[10.5px]",
                    r.outcome === "ok" ? "text-aurora-600 dark:text-aurora-300" : "text-rose-600 dark:text-rose-300",
                  )}>
                    {r.outcome}
                    {r.fallback && " · fb"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-soft p-3 ring-1 ring-inset ring-polaris-500/10">
      <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">{label}</div>
      <div className="font-serif text-[20px] font-bold text-ink mt-1">{value}</div>
    </div>
  );
}

function TierBadge({ tier }: { tier: Tier }) {
  const tone = tier === "local" ? "aurora" : tier === "free" ? "polaris" : "nova";
  return <Tag tone={tone}>{tier}</Tag>;
}
