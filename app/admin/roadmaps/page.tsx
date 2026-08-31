"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  userEmail: string;
  version: number;
  source: string;
  milestones: number;
  done: number;
  summary: string;
  createdAt: string;
};

export default function AdminRoadmapsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/roadmaps");
    if (res.ok) {
      const d = await res.json();
      setRows(d.roadmaps ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string, email: string) {
    if (!confirm(`Delete this roadmap for ${email}? This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch("/api/admin/roadmaps", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roadmapId: id }),
    });
    setBusyId(null);
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  }

  if (loading) return <p className="text-ink-dim">Loading roadmaps…</p>;
  if (rows.length === 0) return <p className="text-ink-dim">No roadmaps generated yet.</p>;

  return (
    <div>
      <div className="text-xs text-ink-muted mb-4">{rows.length} roadmaps (most recent 200)</div>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className={cn("glass rounded-2xl p-4", busyId === r.id && "opacity-50")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{r.userEmail}</div>
                <div className="text-xs text-ink-muted mt-0.5">
                  v{r.version} · {r.source} · {r.done}/{r.milestones} done ·{" "}
                  {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <div className="flex items-center gap-2 flex-none">
                <button
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="text-xs rounded-full border border-polaris-300 px-3 py-1 text-ink-dim hover:bg-polaris-50 transition-colors"
                >
                  {expanded === r.id ? "Hide" : "View"}
                </button>
                <button
                  onClick={() => remove(r.id, r.userEmail)}
                  className="text-xs rounded-full border border-nova-500/40 text-nova-500 px-3 py-1 hover:bg-nova-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
            {expanded === r.id && (
              <p className="mt-3 pt-3 border-t border-polaris-500/15 text-sm text-ink-dim leading-relaxed">
                {r.summary}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

