"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Knowledge documents + retrieval index health.
 *
 * The seed corpus is short structured records; this is where long-form source
 * material goes - a scholarship's eligibility page, a visa funding rule, a
 * university's essay guidance. Every document requires a source URL and a
 * verification date, because the pipeline's whole value is that a student can
 * check a claim at its origin.
 */

type DocumentRow = {
  _id: string;
  slug: string;
  title: string;
  body: string;
  sourceUrl: string;
  tags: string[];
  verifiedAt: string;
  updatedAt: string;
};

type IndexStatus = {
  embeddings: { enabled: boolean; model: string; dimensions: number };
  source: { chunks: number; documents: number };
  index: {
    total: number;
    usable: number;
    lastIndexedAt: string | null;
    bySource: Record<string, number>;
  };
  pendingChunks: number;
};

const EMPTY = { title: "", body: "", sourceUrl: "", tags: "", verifiedAt: "" };

export default function AdminKnowledgePage() {
  const [items, setItems] = useState<DocumentRow[]>([]);
  const [status, setStatus] = useState<IndexStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [reindexNote, setReindexNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try {
      const [docsRes, statusRes] = await Promise.all([
        fetch("/api/admin/rag/documents"),
        fetch("/api/admin/rag"),
      ]);
      if (docsRes.ok) setItems((await docsRes.json()).items ?? []);
      if (statusRes.ok) setStatus(await statusRes.json());
    } catch {
      setErr("Could not load knowledge documents.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const startNew = () => {
    setEditingId("new");
    setDraft(EMPTY);
    setErr("");
  };

  const startEdit = (item: DocumentRow) => {
    setEditingId(item._id);
    setDraft({
      title: item.title,
      body: item.body,
      sourceUrl: item.sourceUrl,
      tags: (item.tags ?? []).join(", "),
      verifiedAt: item.verifiedAt,
    });
    setErr("");
  };

  const save = async () => {
    setBusy(true);
    setErr("");
    const item = {
      title: draft.title,
      body: draft.body,
      sourceUrl: draft.sourceUrl,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean),
      verifiedAt: draft.verifiedAt || undefined,
    };
    try {
      const res =
        editingId === "new"
          ? await fetch("/api/admin/rag/documents", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ item }),
            })
          : await fetch("/api/admin/rag/documents", {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id: editingId, item }),
            });
      if (!res.ok) {
        setErr((await res.json().catch(() => ({})))?.error ?? "Save failed.");
        return;
      }
      setEditingId(null);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await fetch("/api/admin/rag/documents", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const reindex = async () => {
    setBusy(true);
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
      await load();
    } catch {
      setReindexNote("Re-embedding failed.");
    } finally {
      setBusy(false);
    }
  };

  const bodyLength = draft.body.trim().length;

  return (
    <div>
      {/* ── Index health ── */}
      <div className="glass-strong rounded-2xl p-4 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Retrieval index</h2>
            {status ? (
              <p className="mt-1 text-xs text-ink-muted">
                {status.index.usable} of {status.source.chunks} chunks embedded
                {status.pendingChunks > 0 && (
                  <span className="text-nova-500">
                    {" "}
                    · {status.pendingChunks} awaiting re-embed
                  </span>
                )}
                {" · "}
                {status.embeddings.enabled
                  ? `${status.embeddings.model} @ ${status.embeddings.dimensions}d`
                  : "embeddings disabled - keyword search only"}
                {status.index.lastIndexedAt && (
                  <> · last indexed {new Date(status.index.lastIndexedAt).toLocaleString()}</>
                )}
              </p>
            ) : (
              <p className="mt-1 text-xs text-ink-muted">Loading index status…</p>
            )}
            {status && (
              <p className="mt-1 text-xs text-ink-muted">
                {Object.entries(status.index.bySource)
                  .map(([source, count]) => `${source} ${count}`)
                  .join(" · ")}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            {reindexNote && <span className="text-xs text-ink-muted">{reindexNote}</span>}
            <button
              onClick={reindex}
              disabled={busy}
              className="rounded-full border border-polaris-300 bg-white px-4 py-1.5 text-sm text-ink hover:bg-polaris-50 transition-colors disabled:opacity-50"
            >
              {busy ? "Working…" : "Re-embed"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <p className="text-sm text-ink-dim">
          Long-form source material for AI retrieval. Short structured facts belong in{" "}
          <span className="text-ink">Content</span>.
        </p>
        <button
          onClick={startNew}
          className="rounded-full bg-polaris-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-polaris-600 transition-colors"
        >
          Add document
        </button>
      </div>

      {err && (
        <div className="mb-4 rounded-xl border border-nova-500/40 bg-nova-500/10 px-4 py-2 text-sm text-nova-500">
          {err}
        </div>
      )}

      {/* ── Editor ── */}
      {editingId && (
        <div className="glass-strong rounded-2xl p-4 mb-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-ink-dim">
              Title
              <input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="Chevening eligibility criteria"
                className="mt-1 w-full rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-ink-dim">
              Source URL (required)
              <input
                value={draft.sourceUrl}
                onChange={(e) => setDraft({ ...draft, sourceUrl: e.target.value })}
                placeholder="https://www.chevening.org/scholarships/eligibility/"
                className="mt-1 w-full rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-ink-dim">
              Tags (comma separated)
              <input
                value={draft.tags}
                onChange={(e) => setDraft({ ...draft, tags: e.target.value })}
                placeholder="uk, scholarship, masters"
                className="mt-1 w-full rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none"
              />
            </label>
            <label className="text-xs text-ink-dim">
              Verified on (YYYY-MM-DD, defaults to today)
              <input
                value={draft.verifiedAt}
                onChange={(e) => setDraft({ ...draft, verifiedAt: e.target.value })}
                placeholder="2026-08-31"
                className="mt-1 w-full rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none"
              />
            </label>
          </div>

          <label className="mt-3 block text-xs text-ink-dim">
            Body - paste the source text. Only include what the page actually says.
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              className="mt-1 w-full h-64 rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm text-ink focus:border-polaris-400 focus:outline-none"
            />
          </label>
          <p
            className={cn(
              "mt-1 text-xs",
              bodyLength > 0 && bodyLength < 120 ? "text-nova-500" : "text-ink-muted",
            )}
          >
            {bodyLength} characters
            {bodyLength > 0 && bodyLength < 120 && " - needs at least 120"}
            {bodyLength >= 900 && ` · will split into roughly ${Math.ceil(bodyLength / 750)} chunks`}
          </p>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setEditingId(null)}
              className="rounded-full border border-polaris-300 bg-white px-4 py-2 text-sm text-ink hover:bg-polaris-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="rounded-full bg-polaris-500 px-5 py-2 text-sm font-semibold text-white hover:bg-polaris-600 transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {/* ── List ── */}
      {loading ? (
        <div className="px-4 py-6 text-sm text-ink-muted">Loading…</div>
      ) : (
        <div className="glass rounded-2xl divide-y divide-polaris-500/10">
          {items.map((item) => (
            <div key={item._id} className="flex items-start justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="text-sm text-ink">{item.title}</div>
                <div className="mt-0.5 truncate text-xs text-ink-muted">
                  <code>kb://doc:{item.slug}</code> · {item.body.length} chars · verified{" "}
                  {item.verifiedAt}
                </div>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-0.5 block truncate text-xs text-polaris-500 hover:underline"
                >
                  {item.sourceUrl}
                </a>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => startEdit(item)}
                  className="text-xs rounded-full border border-polaris-300 px-3 py-1 text-ink-dim hover:bg-polaris-50 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(item._id)}
                  disabled={busy}
                  className="text-xs rounded-full border border-nova-500/40 text-nova-500 px-3 py-1 hover:bg-nova-500/10 transition-colors disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="px-4 py-6 text-sm text-ink-muted">
              No documents yet. The seed corpus is short structured records - none long enough
              to split. Adding real source pages here is what grows retrieval coverage.
            </div>
          )}
        </div>
      )}

      <p className="mt-3 text-xs text-ink-muted">
        Keyword search picks up edits within minutes. Semantic search needs the re-embed above,
        which only re-embeds chunks whose text actually changed.
      </p>
    </div>
  );
}
