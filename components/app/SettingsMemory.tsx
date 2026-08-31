"use client";

/**
 * Settings → "Strategist memory" panel.
 *
 * Shows everything the Strategist has learned about the student, grouped by
 * category. Lets the student forget individual facts, add their own, or wipe
 * the entire store. Wires through /api/memory.
 */

import { useEffect, useState } from "react";
import { Tag } from "./ui";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

type Category = "goal" | "preference" | "constraint" | "background" | "interest";

type Fact = {
  id: string;
  text: string;
  category: Category;
  confidence: number;
  source: "explicit" | "inferred";
  createdAt: string;
};

const CATEGORY_LABEL: Record<Category, string> = {
  goal:        "Goals",
  preference:  "Preferences",
  constraint:  "Constraints",
  background:  "Background",
  interest:    "Interests",
};

const CATEGORY_TONE: Record<Category, "polaris" | "aurora" | "nova" | "ink"> = {
  goal:        "polaris",
  preference:  "aurora",
  constraint:  "nova",
  background:  "ink",
  interest:    "polaris",
};

export function SettingsMemory() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const [loading, setLoading] = useState(true);
  const [addText, setAddText] = useState("");
  const [addCat, setAddCat] = useState<Category>("background");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/memory", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load memory");
      const data = (await res.json()) as { facts: Fact[] };
      setFacts(data.facts ?? []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to load memory");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function add() {
    const text = addText.trim();
    if (text.length < 3 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text, category: addCat }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save");
      }
      setAddText("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  }

  async function forget(id: string) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/memory?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
      setFacts((f) => f.filter((x) => x.id !== id));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (!confirm("Forget everything Polaris has learned about you? This can't be undone.")) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/memory?clear=1", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear");
      setFacts([]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to clear");
    } finally {
      setBusy(false);
    }
  }

  const grouped = groupByCategory(facts);

  return (
    <div className="space-y-4">
      {/* ─── Add a fact ─── */}
      <div className="rounded-xl bg-paper-soft p-3 ring-1 ring-inset ring-polaris-500/10">
        <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-2">
          Tell Polaris something
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={addText}
            onChange={(e) => setAddText(e.target.value)}
            placeholder="e.g. I'm aiming for Cornell EA, deadline Nov 1"
            className="flex-1 rounded-lg border border-polaris-200 bg-paper-card px-3 py-2 text-[13px] text-ink focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] dark:bg-paper-deep"
            maxLength={240}
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          />
          <PremiumSelect
            value={addCat}
            onChange={(v) => setAddCat(v as Category)}
            variant="input"
            className="sm:w-[170px] shrink-0"
            options={(Object.keys(CATEGORY_LABEL) as Category[]).map((c) => ({
              value: c,
              label: CATEGORY_LABEL[c],
            }))}
          />
          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || addText.trim().length < 3}
            className="rounded-lg bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
          >
            Remember
          </button>
        </div>
        {err && <div className="mt-2 text-[12px] text-rose-600">{err}</div>}
      </div>

      {/* ─── Facts ─── */}
      {loading ? (
        <div className="text-[13px] text-ink-muted">Loading memory…</div>
      ) : facts.length === 0 ? (
        <div className="text-[13px] text-ink-muted italic">
          Polaris hasn&apos;t learned anything specific about you yet. Chat with the Strategist and it&apos;ll start remembering goals, constraints, and preferences you mention.
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(grouped) as Category[]).map((cat) => (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-1.5">
                <Tag tone={CATEGORY_TONE[cat]}>{CATEGORY_LABEL[cat]}</Tag>
                <span className="text-[11px] text-ink-muted">{grouped[cat].length}</span>
              </div>
              <ul className="divide-y divide-polaris-500/10 rounded-xl ring-1 ring-inset ring-polaris-500/10 overflow-hidden">
                {grouped[cat].map((f) => (
                  <li key={f.id} className="px-3 py-2.5 flex items-start gap-3 bg-white">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-ink">{f.text}</div>
                      <div className="text-[10.5px] font-mono text-ink-muted mt-0.5">
                        {f.source === "explicit" ? "you told us" : "inferred"}
                        {" · "}
                        {Math.round(f.confidence * 100)}% confidence
                        {" · "}
                        {new Date(f.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => void forget(f.id)}
                      disabled={busy}
                      className="text-[11.5px] text-ink-muted hover:text-rose-600 transition-colors px-2 py-1"
                      aria-label="Forget this fact"
                    >
                      Forget
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ─── Danger ─── */}
      {facts.length > 0 && (
        <div className="pt-2 border-t border-polaris-500/10 flex items-center justify-between">
          <span className="text-[11.5px] text-ink-muted">
            {facts.length} fact{facts.length === 1 ? "" : "s"} on file.
          </span>
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={busy}
            className="text-[12px] text-rose-600 hover:text-rose-700 font-medium transition-colors disabled:opacity-50"
          >
            Forget everything
          </button>
        </div>
      )}
    </div>
  );
}

function groupByCategory(facts: Fact[]): Record<Category, Fact[]> {
  const out: Record<Category, Fact[]> = {
    goal: [], preference: [], constraint: [], background: [], interest: [],
  };
  for (const f of facts) (out[f.category] ?? out.background).push(f);
  // Drop empty buckets when consumed (Object.keys preserves insertion).
  for (const k of Object.keys(out) as Category[]) {
    if (out[k].length === 0) delete (out as Record<string, Fact[]>)[k];
  }
  return out;
}

