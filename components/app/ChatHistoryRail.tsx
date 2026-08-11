"use client";

/**
 * ChatHistoryRail - sidebar of saved Strategist threads.
 *
 * Lives inside the /strategist canvas. Collapsible. Shows:
 *   • "New chat" button at the top
 *   • Search input
 *   • Today / Previous 7 days / Older bucketed thread list
 *   • Each row: title (editable on dblclick), last-msg timestamp,
 *     trash button on hover
 *
 * Persistence is REST: /api/chat/threads + /api/chat/threads/[id].
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import {
  createDemoStrategistThread,
  listDemoStrategistThreads,
  removeDemoStrategistThread,
  renameDemoStrategistThread,
  subscribeDemoStrategistHistory,
  type DemoStrategistMode,
  type DemoStrategistSurface,
} from "@/lib/demo/strategist-history";

export type ThreadSummary = {
  id: string;
  title: string;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  mode?: DemoStrategistMode;
  surfaces?: DemoStrategistSurface[];
};

type Props = {
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: (threadId?: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  /** Re-fetch trigger - increment when the parent appends a message. */
  reloadKey?: number;
  /** Pixel width applied via inline style (lets the parent resize this rail). */
  width: number;
  /** Called while the user drags the handle; receives the new width in pixels. */
  onResize: (px: number) => void;
  /** True while the user is currently dragging; suppresses width transitions. */
  resizing: boolean;
  /** Called when the user starts/finishes a drag - for transition control. */
  onResizeStart: () => void;
  onResizeEnd: () => void;
  demo?: boolean;
};

export function ChatHistoryRail({
  activeId, onSelect, onNew, collapsed, onToggleCollapse, reloadKey,
  width, onResize, resizing, onResizeStart, onResizeEnd, demo = false,
}: Props) {
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const load = useCallback(async () => {
    if (demo) {
      setThreads(toDemoSummaries());
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/chat/threads", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { threads: ThreadSummary[] };
        setThreads(data.threads ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [demo]);

  useEffect(() => { void load(); }, [load, reloadKey]);

  useEffect(() => {
    if (!demo) return;
    const sync = () => setThreads(toDemoSummaries());
    sync();
    return subscribeDemoStrategistHistory(sync);
  }, [demo]);

  async function rename(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) { setEditingId(null); return; }
    setThreads((prev) => prev.map((t) => t.id === id ? { ...t, title: trimmed } : t));
    setEditingId(null);
    if (demo) renameDemoStrategistThread(id, trimmed);
    else await fetch(`/api/chat/threads/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    }).catch(() => { /* swallow - UI already updated */ });
  }

  async function remove(id: string) {
    if (!confirm("Delete this conversation? This cannot be undone.")) return;
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (demo) removeDemoStrategistThread(id);
    else await fetch(`/api/chat/threads/${id}`, { method: "DELETE" }).catch(() => { /* ignore */ });
    if (activeId === id) {
      if (demo) {
        const next = listDemoStrategistThreads()[0] ?? createDemoStrategistThread("general", "main");
        onNew(next.id);
      } else onNew();
    }
  }

  function createNew() {
    if (!demo) {
      onNew();
      return;
    }
    const thread = createDemoStrategistThread("general", "main");
    onNew(thread.id);
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return threads;
    const q = search.trim().toLowerCase();
    return threads.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, search]);

  const bucketed = useMemo(() => bucketByDate(filtered), [filtered]);

  if (collapsed) {
    return (
      <aside className="w-12 shrink-0 bg-paper-soft border-r border-polaris-500/10 flex flex-col items-center py-3 gap-2 relative">
        <button
          onClick={onToggleCollapse}
          title="Expand history"
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center text-ink-dim hover:text-ink hover:bg-paper transition-colors"
        >
          <PanelGlyph />
        </button>
        <button
          onClick={createNew}
          title="New chat"
          className="h-9 w-9 rounded-lg inline-flex items-center justify-center bg-polaris-500 text-white hover:bg-polaris-600 transition-colors shadow-sm"
        >
          <PlusGlyph />
        </button>
      </aside>
    );
  }

  return (
    <aside
      style={{ width }}
      className={cn(
        "shrink-0 bg-paper-soft border-r border-polaris-500/10 flex flex-col h-full relative",
        // Smooth width animation when NOT dragging.
        !resizing && "transition-[width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
      )}
    >
      {/* Header */}
      <div className="px-3 py-3 flex items-center gap-2 border-b border-polaris-500/10">
        <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted font-medium flex-1">Conversations</div>
        <button
          onClick={onToggleCollapse}
          title="Collapse"
          className="text-ink-muted hover:text-ink transition-colors"
        >
          <PanelGlyph />
        </button>
      </div>

      <div className="px-3 pt-3 pb-2 space-y-2">
        <button
          onClick={createNew}
          className="w-full h-9 rounded-lg bg-polaris-500 text-white text-[12.5px] font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-polaris-600 transition-colors shadow-sm"
        >
          <PlusGlyph /> New chat
        </button>
        <div className="relative">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full h-8 pl-7 pr-2 rounded-lg bg-paper-card hairline text-[12px] text-ink placeholder-ink-muted focus:outline-none focus:ring-2 focus:ring-polaris-400"
          />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted">
            <SearchGlyph />
          </span>
        </div>
      </div>

      {/* Threads */}
      <div className="flex-1 overflow-y-auto overscroll-contain px-1.5 pb-3">
        {loading ? (
          <div className="px-3 py-4 text-[12px] text-ink-muted italic">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-4 text-[12px] text-ink-muted italic">
            {search ? "No matches." : "No conversations yet."}
          </div>
        ) : (
          Object.entries(bucketed).map(([bucket, items]) => (
            <div key={bucket} className="mt-2">
              <div className="px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-ink-muted font-medium">{bucket}</div>
              {items.map((t) => {
                const isActive = t.id === activeId;
                const isEditing = editingId === t.id;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "group relative rounded-lg mx-1.5 mb-0.5 transition-colors",
                      isActive ? "bg-paper-card ring-1 ring-inset ring-polaris-300" : "hover:bg-paper-card/70",
                    )}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onBlur={() => void rename(t.id, draftTitle)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void rename(t.id, draftTitle);
                          else if (e.key === "Escape") setEditingId(null);
                        }}
                        className="w-full px-2.5 py-1.5 text-[12.5px] bg-paper-card text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-polaris-400"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelect(t.id)}
                        onDoubleClick={() => { setEditingId(t.id); setDraftTitle(t.title); }}
                        className="w-full text-left px-2.5 py-2 pr-14 text-ink"
                        title={t.title}
                      >
                        <span className="block truncate text-[12.5px] font-medium">{t.title}</span>
                        {t.surfaces?.length ? (
                          <span className="mt-0.5 flex items-center gap-1 text-[9.5px] uppercase tracking-[0.12em] text-ink-muted">
                            {surfaceLabel(t.surfaces)}
                            {t.mode ? <><span aria-hidden>&middot;</span><span>{t.mode}</span></> : null}
                          </span>
                        ) : null}
                      </button>
                    )}
                    {!isEditing && (
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingId(t.id); setDraftTitle(t.title); }}
                          title="Rename"
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-ink-muted hover:text-ink hover:bg-paper-soft"
                        >
                          <PencilGlyph />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); void remove(t.id); }}
                          title="Delete"
                          className="h-6 w-6 inline-flex items-center justify-center rounded text-ink-muted hover:text-rose-500 hover:bg-paper-soft"
                        >
                          <TrashGlyph />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* ─── Drag-to-resize handle ───
          Sits on the right edge, full height, 6px wide. The visible bar in
          the middle is just 1px, but the hit-area is wide enough to grab
          comfortably. Cursor changes + accent appears on hover/drag. */}
      <ResizeHandle
        onResize={onResize}
        onResizeStart={onResizeStart}
        onResizeEnd={onResizeEnd}
        resizing={resizing}
      />
    </aside>
  );
}

function ResizeHandle({
  onResize, onResizeStart, onResizeEnd, resizing,
}: {
  onResize: (px: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  resizing: boolean;
}) {
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    // Capture the rail element NOW - React nulls currentTarget once the
    // synthetic event is released, so the async listeners can't read it.
    const railEl = (e.currentTarget as HTMLElement).parentElement;
    if (!railEl) return;
    onResizeStart();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: PointerEvent) {
      if (!railEl) return;
      const rect = railEl.getBoundingClientRect();
      onResize(ev.clientX - rect.left);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      onResizeEnd();
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div
      onPointerDown={onPointerDown}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      onDoubleClick={() => onResize(260)}
      className={cn(
        "group absolute top-0 right-0 h-full w-1.5 cursor-col-resize select-none",
        "flex items-center justify-center",
      )}
    >
      <span
        className={cn(
          "h-full w-px transition-all duration-200",
          resizing
            ? "bg-polaris-500 w-[2px]"
            : "bg-polaris-500/20 group-hover:bg-polaris-500 group-hover:w-[2px]",
        )}
      />
    </div>
  );
}

/* ─── helpers ─── */
function toDemoSummaries(): ThreadSummary[] {
  return listDemoStrategistThreads().map((thread) => ({
    id: thread.id,
    title: thread.title,
    messageCount: thread.messages.length,
    lastMessageAt: thread.lastMessageAt,
    createdAt: thread.createdAt,
    mode: thread.mode,
    surfaces: thread.surfaces,
  }));
}

function surfaceLabel(surfaces: DemoStrategistSurface[]) {
  if (surfaces.includes("main") && surfaces.includes("sidebar")) return "Main + side panel";
  return surfaces.includes("sidebar") ? "Side panel" : "Main Strategist";
}
function bucketByDate(threads: ThreadSummary[]): Record<string, ThreadSummary[]> {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  const out: Record<string, ThreadSummary[]> = {};
  for (const t of threads) {
    const dt = new Date(t.lastMessageAt).getTime();
    const age = (now - dt) / day;
    const bucket =
      age < 1  ? "Today" :
      age < 7  ? "Previous 7 days" :
      age < 30 ? "Previous 30 days" :
                 "Older";
    (out[bucket] ||= []).push(t);
  }
  return out;
}

function PlusGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function PanelGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16" />
    </svg>
  );
}
function PencilGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
    </svg>
  );
}
function TrashGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  );
}
