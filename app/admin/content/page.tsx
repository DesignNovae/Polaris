"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/cn";

type ContentType = "universities" | "scholarships" | "case-studies";
type Item = Record<string, unknown> & { _id: string };

const TYPES: { v: ContentType; label: string }[] = [
  { v: "universities", label: "Universities" },
  { v: "scholarships", label: "Scholarships" },
  { v: "case-studies", label: "Case studies" },
];

function labelOf(item: Item): string {
  return (
    (item.name as string) ||
    (item.title as string) ||
    (item.id as string) ||
    item._id
  );
}

export default function AdminContentPage() {
  const [type, setType] = useState<ContentType>("universities");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [err, setErr] = useState("");
  const [adding, setAdding] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexNote, setReindexNote] = useState("");

  const reindex = useCallback(async () => {
    setReindexing(true);
    setReindexNote("");
    try {
      const res = await fetch("/api/admin/rag", { method: "POST" });
      const data = await res.json();
      const r = data?.report as
        | { chunks?: number; embedded?: number; skipped?: number; error?: string }
        | undefined;
      setReindexNote(
        r?.error
          ? `Failed: ${r.error}`
          : `${r?.embedded ?? 0} re-embedded, ${r?.skipped ?? 0} unchanged, ${r?.chunks ?? 0} chunks indexed.`,
      );
    } catch {
      setReindexNote("Re-embedding failed.");
    } finally {
      setReindexing(false);
    }
  }, []);

  const load = useCallback(async (t: ContentType) => {
    setLoading(true);
    setEditingId(null);
    setAdding(false);
    setErr("");
    const res = await fetch(`/api/admin/content/${t}`);
    if (res.ok) {
      const d = await res.json();
      setItems(d.items ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(type);
  }, [type, load]);

  function startEdit(item: Item) {
    setAdding(false);
    setErr("");
    setEditingId(item._id);
    const { _id, ...rest } = item;
    void _id;
    setDraft(JSON.stringify(rest, null, 2));
  }

  function startAdd() {
    setEditingId(null);
    setErr("");
    setAdding(true);
    const template =
      type === "universities"
        ? { id: "", name: "", country: "", city: "", tier: "top50", acceptanceRate: 0.1, topPrograms: [], requirements: { gpa: "", tests: "", essays: "", recs: "", differentiators: "" }, summary: "", tags: [] }
        : type === "case-studies"
          ? { id: "", title: "", profile: { country: "", school: "", gpa: "", tests: "", ecs: [], tier: "elite" }, whatWorked: "", tags: [] }
          : { id: "", name: "", provider: "", amount: "", summary: "", tags: [] };
    setDraft(JSON.stringify(template, null, 2));
  }

  async function save() {
    setErr("");
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setErr("Invalid JSON - check your syntax.");
      return;
    }
    const res = adding
      ? await fetch(`/api/admin/content/${type}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ item: parsed }),
        })
      : await fetch(`/api/admin/content/${type}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: editingId, item: parsed }),
        });
    if (res.ok) {
      await load(type);
    } else {
      const d = await res.json().catch(() => ({}));
      setErr(d.error || "Failed to save");
    }
  }

  async function remove(item: Item) {
    if (!confirm(`Delete "${labelOf(item)}"?`)) return;
    const res = await fetch(`/api/admin/content/${type}`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item._id }),
    });
    if (res.ok) setItems((prev) => prev.filter((i) => i._id !== item._id));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex gap-2">
          {TYPES.map((t) => (
            <button
              key={t.v}
              onClick={() => setType(t.v)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm border transition-colors duration-150",
                type === t.v
                  ? "bg-polaris-100 border-polaris-400 text-ink"
                  : "bg-white border-polaris-200 text-ink-dim hover:border-polaris-300",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={startAdd}
          className="rounded-full bg-polaris-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-polaris-600 transition-colors"
        >
          + Add
        </button>
      </div>

      {(adding || editingId) && (
        <div className="glass-strong rounded-2xl p-4 mb-4">
          <div className="text-sm font-semibold text-ink mb-2">
            {adding ? "New item" : "Edit item"} (JSON)
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            spellCheck={false}
            className="w-full h-72 rounded-xl border border-polaris-200 bg-white px-3 py-2 font-mono text-xs text-ink focus:border-polaris-400 focus:outline-none"
          />
          {err && <p className="mt-2 text-sm text-nova-500">{err}</p>}
          <div className="mt-3 flex gap-2 justify-end">
            <button
              onClick={() => { setEditingId(null); setAdding(false); setErr(""); }}
              className="rounded-full border border-polaris-300 bg-white px-4 py-2 text-sm text-ink hover:bg-polaris-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              className="rounded-full bg-polaris-500 px-5 py-2 text-sm font-semibold text-white hover:bg-polaris-600 transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-ink-dim">Loading…</p>
      ) : (
        <div className="glass rounded-2xl divide-y divide-polaris-500/10">
          {items.map((item) => (
            <div key={item._id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-ink truncate">{labelOf(item)}</div>
                <div className="text-xs text-ink-muted truncate">
                  {(item.country as string) || (item.provider as string) || ""}
                  {item.tier ? ` · ${item.tier}` : ""}
                </div>
              </div>
              <div className="flex gap-2 flex-none">
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs rounded-full border border-polaris-300 px-3 py-1 text-ink-dim hover:bg-polaris-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(item)}
                  className="text-xs rounded-full border border-nova-500/40 text-nova-500 px-3 py-1 hover:bg-nova-500/10 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="px-4 py-6 text-sm text-ink-muted">No items.</div>}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={reindex}
          disabled={reindexing}
          className="text-xs rounded-full border border-polaris-300 px-3 py-1 text-ink-dim hover:bg-polaris-50 transition-colors disabled:opacity-50"
        >
          {reindexing ? "Re-embedding…" : "Re-embed for AI retrieval"}
        </button>
        {reindexNote && <span className="text-xs text-ink-muted">{reindexNote}</span>}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        Edits go live immediately on the public directory &amp; benchmarking, and keyword retrieval
        picks them up within minutes. Semantic (vector) retrieval needs the re-embed above - it only
        re-embeds items whose text actually changed.
      </p>
    </div>
  );
}

