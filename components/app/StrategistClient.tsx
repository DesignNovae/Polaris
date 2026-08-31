"use client";

/**
 * Full-page Strategist (AgentView).
 *
 * Replaces the previous duplicate-of-the-right-rail layout. On /strategist
 * THIS is the only chat surface - the right-rail AgentChat hides itself
 * when the route is /strategist (see AgentChat.tsx).
 *
 * Feature parity with the right-rail chat:
 *   ? Gemma 4-only model status and thinking-depth control.
 *   • Mode pills (General / Research / Study / Coding).
 *   • Web-search thinking indicator.
 *   • Web sources rendered as clickable chips.
 *   • Routing reason shown post-stream.
 *   • Real /api/strategist SSE - same backend as the right rail.
 *
 * Layout:
 *   ┌──── chat canvas ────────┬── context strip ──┐
 *   │  hero + chat            │ student card      │
 *   │                         │ gap engine        │
 *   │                         │ tools             │
 *   └─────────────────────────┴───────────────────┘
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gemmaHeaders, getBrowserKnowledgeNotes } from "@/lib/gemma/browser-key";
import type { StrategistChunk } from "@/lib/strategist/schemas";
import { Card, Pill, Tag, Avatar, Icon } from "./ui";
import { QuotaModal, resetHintFrom, type QuotaState } from "./QuotaModal";
import { roadmapStore, strategistContextPayload } from "@/lib/roadmap/store";
import { MarkdownMessage, type CitationSource } from "./MarkdownMessage";
import { ChatHistoryRail } from "./ChatHistoryRail";
import { CompactModelPicker, type CmpRouteMode } from "./CompactModelPicker";
import { cn } from "@/lib/cn";
import {
  appendDemoStrategistMessage,
  ensureDemoStrategistThread,
  getDemoStrategistThread,
  selectDemoStrategistThread,
} from "@/lib/demo/strategist-history";

type Tier = "free" | "paid" | "local";
type Mode = "general" | "research" | "study" | "coding";

type ProviderInfo = {
  id: string;
  name: string;
  defaultTier: Tier;
  configured: boolean;
  models: Array<{ id: string; label: string; tier: Tier; legacy?: boolean }>;
};

type ModelChoice = { providerId: string; modelId: string } | "auto";
const DEMO_PROVIDERS: ProviderInfo[] = [{ id: "gemma", name: "Polaris", defaultTier: "free", configured: true, models: [
  { id: "gemma-4-26b-a4b-it", label: "Polaris AI", tier: "free" },
  { id: "gemma-4-31b-it", label: "Polaris AI Advanced", tier: "free" },
] }];

type WebSource = { label: string; uri: string; kind: "kb" | "case" | "web" | "profile" | "roadmap" };
type Msg = {
  id: string;
  role: "user" | "agent";
  text: string;
  sources: WebSource[];
  gap?: boolean;
};

export type GapRow = { signal: string; you: string; admit: string; move: string };
type CtxRow = { k: string; v: string };

const SUGGESTIONS = [
  "Plan my week",
  "Why is my probability where it is?",
  "What am I missing vs. admits?",
  "Re-run my probability",
  "Find a recommender outside school",
];

const MODES: Array<{ id: Mode; label: string; desc: string }> = [
  { id: "general",  label: "General",  desc: "Balanced co-pilot" },
  { id: "research", label: "Research", desc: "Deep web research" },
  { id: "study",    label: "Study",    desc: "Step-by-step explainer" },
  { id: "coding",   label: "Coding",   desc: "Code-first" },
];

const MODEL_KEY = "polaris.strategist.model";
const MODE_KEY = "polaris.strategist.mode";
const PAID_KEY = "polaris.strategist.allowPaid";
const OFFLINE_KEY = "polaris.strategist.offline";
const ROUTE_MODE_KEY = "polaris.strategist.routeMode";
/** Shared with the right-rail AgentChat - both surfaces use one thread. */
const ACTIVE_THREAD_KEY = "polaris.chat.activeThread";
/** One-shot draft handoff (e.g. "Ask Strategist for help" on a weekly task). */
const DRAFT_KEY = "polaris.strategist.draft";

export function StrategistClient({
  studentName, initials, grade, contextRows, gapRows, eyebrow, demo = false,
}: {
  studentName: string;
  initials: string;
  grade: string;
  contextRows: CtxRow[];
  gapRows: GapRow[];
  eyebrow: string;
  demo?: boolean;
}) {
  /* ─── core chat state ─── */
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "seed",
      role: "agent",
      text: `I'm grounded in your profile, your roadmap, your saved memories, and the live web. Here's how your profile compares to admits - ask me to turn any gap into a plan.`,
      sources: [],
      gap: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [thinking, setThinking] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{ provider: string; model: string; reason: string } | null>(null);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  /* ─── provider + mode state ─── */
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [model, setModel] = useState<ModelChoice>("auto");
  const [mode, setMode] = useState<Mode>("general");
  const [routeMode, setRouteMode] = useState<CmpRouteMode>("balanced");
  const [allowPaid, setAllowPaid] = useState(false);
  const [offline, setOffline] = useState(false);
  // Guards the server write-through: skip until the saved pref has loaded.
  const prefLoadedRef = useRef(false);

  /* ─── Responsive breakpoint (drives the grid template) ─── */
  const [bp, setBp] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const [mobileChatsOpen, setMobileChatsOpen] = useState(false);
  useEffect(() => {
    const mdQ = window.matchMedia("(min-width: 768px)");
    const xlQ = window.matchMedia("(min-width: 1280px)");
    const update = () => setBp(xlQ.matches ? "desktop" : mdQ.matches ? "tablet" : "mobile");
    update();
    mdQ.addEventListener("change", update);
    xlQ.addEventListener("change", update);
    return () => { mdQ.removeEventListener("change", update); xlQ.removeEventListener("change", update); };
  }, []);

  /* ─── Chat history state ─── */
  const [threadId, setThreadId] = useState<string | null>(demo ? "demo-conversation" : null);

  // Restore the thread shared with the right-rail chat, and pick up any
  // one-shot draft handed off from a weekly task ("Ask Strategist for help").
  useEffect(() => {
    try {
      const tid = localStorage.getItem(ACTIVE_THREAD_KEY);
      if (tid) setThreadId(tid);
      const draft = localStorage.getItem(DRAFT_KEY);
      if (draft) {
        setInput(draft);
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  // Keep the shared key in sync so the right-rail picks up this conversation.
  useEffect(() => {
    try {
      if (threadId) {
        localStorage.setItem(ACTIVE_THREAD_KEY, threadId);
        if (demo) selectDemoStrategistThread(threadId);
      } else localStorage.removeItem(ACTIVE_THREAD_KEY);
    } catch { /* ignore */ }
  }, [threadId, demo]);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [threadsReloadKey, setThreadsReloadKey] = useState(0);
  const [railWidth, setRailWidth] = useState(260);
  const [resizingRail, setResizingRail] = useState(false);

  // Hydrate the persisted rail width / collapsed state.
  useEffect(() => {
    try {
      const w = parseInt(localStorage.getItem("polaris.chatRail.width") ?? "", 10);
      if (Number.isFinite(w) && w >= 100 && w <= 600) setRailWidth(w);
      const c = localStorage.getItem("polaris.chatRail.collapsed");
      if (c === "true") setRailCollapsed(true);
    } catch { /* ignore */ }
  }, []);

  // Clamp + persist on every width change.
  const setRailWidthClamped = useCallback((px: number) => {
    // Below 140px → snap to collapsed.
    if (px < 140) {
      setRailCollapsed(true);
      try { localStorage.setItem("polaris.chatRail.collapsed", "true"); } catch { /* ignore */ }
      return;
    }
    const next = Math.max(180, Math.min(560, px));
    setRailCollapsed(false);
    setRailWidth(next);
    try {
      localStorage.setItem("polaris.chatRail.collapsed", "false");
      localStorage.setItem("polaris.chatRail.width", String(next));
    } catch { /* ignore */ }
  }, []);

  function toggleRailCollapsed() {
    const next = !railCollapsed;
    setRailCollapsed(next);
    try { localStorage.setItem("polaris.chatRail.collapsed", String(next)); } catch { /* ignore */ }
  }

  // Hydrate persisted picker state (shared with right-rail): localStorage
  // first for instant boot, then the server-saved preference wins.
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODEL_KEY);
      if (m === "auto" || m === null) setModel("auto");
      else setModel(JSON.parse(m) as ModelChoice);
      const md = localStorage.getItem(MODE_KEY) as Mode | null;
      if (md && MODES.some((x) => x.id === md)) setMode(md);
      const rm = localStorage.getItem(ROUTE_MODE_KEY) as CmpRouteMode | null;
      if (rm && ["fast", "balanced", "advanced", "reasoning"].includes(rm)) setRouteMode(rm);
      setAllowPaid(localStorage.getItem(PAID_KEY) === "true");
      setOffline(localStorage.getItem(OFFLINE_KEY) === "true");
    } catch { /* ignore */ }

    let cancelled = false;
    if (demo) {
      prefLoadedRef.current = true;
      setProviders(DEMO_PROVIDERS);
      setModel("auto");
      return () => { cancelled = true; };
    }
    fetch("/api/account/model-pref", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        const pref = d?.pref;
        if (pref) {
          setModel(pref.choice === "auto" ? "auto" : (pref.choice as ModelChoice));
          setRouteMode(pref.mode as CmpRouteMode);
          setAllowPaid(!!pref.allowPaid);
          setOffline(!!pref.offline);
        }
      })
      .catch(() => { /* local state stands */ })
      .finally(() => { if (!cancelled) prefLoadedRef.current = true; });
    return () => { cancelled = true; };
  }, [demo]);
  useEffect(() => { localStorage.setItem(MODEL_KEY, model === "auto" ? "auto" : JSON.stringify(model)); }, [model]);
  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);
  useEffect(() => { localStorage.setItem(ROUTE_MODE_KEY, routeMode); }, [routeMode]);
  useEffect(() => { localStorage.setItem(PAID_KEY, String(allowPaid)); }, [allowPaid]);
  useEffect(() => { localStorage.setItem(OFFLINE_KEY, String(offline)); }, [offline]);

  // Debounced write-through to the server-saved preference.
  useEffect(() => {
    if (demo || !prefLoadedRef.current) return;
    const t = setTimeout(() => {
      void fetch("/api/account/model-pref", {
        method: "PUT",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({
          choice: model === "auto" ? "auto" : model,
          mode: routeMode,
          allowPaid,
          offline,
        }),
      }).catch(() => { /* best-effort */ });
    }, 600);
    return () => clearTimeout(t);
  }, [model, routeMode, allowPaid, offline, demo]);

  // Fetch the single server-enforced Gemma 4 provider.
  const refreshProviders = useCallback(async () => {
    if (demo) { setProviders(DEMO_PROVIDERS); return; }
    try {
      const r = await fetch("/api/providers", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.providers) setProviders(data.providers as ProviderInfo[]);
    } catch { /* ignore */ }
  }, [demo]);

  useEffect(() => { void refreshProviders(); }, [refreshProviders]);

  const availableModels = useMemo(() => {
    const out: Array<{ providerId: string; providerName: string; modelId: string; modelLabel: string; tier: Tier; legacy: boolean }> = [];
    for (const p of providers) {
      if (!p.configured) continue;
      for (const m of p.models) {
        if (offline && m.tier !== "local") continue;
        if (!allowPaid && m.tier === "paid") continue;
        out.push({
          providerId: p.id,
          providerName: p.name,
          modelId: m.id,
          modelLabel: m.label,
          tier: m.tier,
          legacy: !!m.legacy,
        });
      }
    }
    return out;
  }, [providers, offline, allowPaid]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, streaming]);

  /* ─── Thread persistence ─── */

  // Load messages when threadId changes.
  useEffect(() => {
    if (demo) {
      const thread = getDemoStrategistThread(threadId);
      if (!thread || thread.messages.length === 0) {
        setMessages([{
          id: "seed",
          role: "agent",
          text: `I'm grounded in your profile, your roadmap, your saved memories, and the live web. Ask me to turn any gap into a plan.`,
          sources: [],
          gap: true,
        }]);
        return;
      }
      setMessages(thread.messages.map((message) => ({
        id: message.id,
        role: message.role === "user" ? "user" : "agent",
        text: message.text,
        sources: message.sources,
      })));
      return;
    }
    if (!threadId) {
      // Fresh session - reset to seed.
      setMessages([{
        id: "seed",
        role: "agent",
        text: `I'm grounded in your profile, your roadmap, your saved memories, and the live web. Here's how your profile compares to admits - ask me to turn any gap into a plan.`,
        sources: [],
        gap: true,
      }]);
      return;
    }
    let cancelled = false;
    fetch(`/api/chat/threads/${threadId}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.messages) return;
        const loaded: Msg[] = d.messages.map((m: { id: string; role: "user" | "assistant"; text: string; sources?: WebSource[] }) => ({
          id: m.id,
          role: m.role === "user" ? "user" : "agent",
          text: m.text,
          sources: m.sources ?? [],
        }));
        setMessages(loaded.length ? loaded : [{
          id: "seed", role: "agent", text: "Loaded an empty conversation. Ask me anything.", sources: [],
        }]);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [threadId, demo]);

  // Create or reuse a thread for the current send.
  const ensureThread = useCallback(async (firstUserText: string): Promise<string | null> => {
    if (demo) {
      const thread = ensureDemoStrategistThread(firstUserText, mode, "main");
      setThreadId(thread.id);
      setThreadsReloadKey((key) => key + 1);
      return thread.id;
    }
    if (threadId) return threadId;
    try {
      const title = firstUserText.length > 60 ? firstUserText.slice(0, 57) + "…" : firstUserText;
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const id = d?.thread?.id as string | undefined;
      if (id) {
        setThreadId(id);
        setThreadsReloadKey((k) => k + 1);
        return id;
      }
    } catch { /* swallow */ }
    return null;
  }, [threadId, demo, mode]);

  // Persist a user or assistant message.
  const persistMessage = useCallback(async (
    tid: string,
    role: "user" | "assistant",
    text: string,
    extras: Partial<{ sources: WebSource[]; providerId: string; modelId: string; mode: Mode }> = {},
  ) => {
    if (demo) {
      appendDemoStrategistMessage(tid, {
        role,
        text,
        sources: extras.sources ?? [],
      }, mode, "main");
      setThreadsReloadKey((key) => key + 1);
      return;
    }
    try {
      await fetch(`/api/chat/threads/${tid}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({ role, text, ...extras }),
      });
      setThreadsReloadKey((k) => k + 1);
    } catch { /* best-effort */ }
  }, [demo, mode]);

  function startNewChat(nextThreadId?: string) {
    setThreadId(nextThreadId ?? null);
    setInput("");
    setStreaming(false);
    setThinking(null);
    setRouteInfo(null);
    setMessages([{
      id: "seed",
      role: "agent",
      text: `I'm grounded in your profile, your roadmap, your saved memories, and the live web. Here's how your profile compares to admits - ask me to turn any gap into a plan.`,
      sources: [],
      gap: true,
    }]);
  }

  // Suppress the layout's <main> scroll so wheel events land on the inner
  // messages scroller. Revert on unmount so other pages still scroll.
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    const prevOverflow = main.style.overflow;
    const prevHeight = main.style.height;
    main.style.overflow = "hidden";
    main.style.height = "100%";
    return () => {
      main.style.overflow = prevOverflow;
      main.style.height = prevHeight;
    };
  }, []);

  // Forward wheel events from the hero / non-scrollable areas of the chat
  // column into the messages scroller, so the wheel works anywhere over the
  // middle column - not only when hovering the messages themselves.
  const chatColRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const col = chatColRef.current;
    const scroll = scroller.current;
    if (!col || !scroll) return;
    function onWheel(e: WheelEvent) {
      if (!scroll) return;
      if (e.target instanceof Node && scroll.contains(e.target)) return; // native
      e.preventDefault();
      scroll.scrollBy({ top: e.deltaY, behavior: "auto" });
    }
    col.addEventListener("wheel", onWheel, { passive: false });
    return () => col.removeEventListener("wheel", onWheel);
  }, []);

  const send = useCallback(async (override?: string) => {
    const text = (override ?? input).trim();
    if (!text || streaming) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text, sources: [] };
    const placeholder: Msg = { id: crypto.randomUUID(), role: "agent", text: "", sources: [] };
    setMessages((m) => [...m, userMsg, placeholder]);
    setInput("");
    setStreaming(true);
    setThinking(null);
    setRouteInfo(null);

    // Ensure a thread exists + persist the user turn (fire-and-forget).
    const tid = await ensureThread(text);
    if (tid) void persistMessage(tid, "user", text, { mode });
    // Keep a local copy of the streamed reply so persistence does not depend
    // on a state update completing inside the async stream/finally path.
    let assistantText = "";
    const assistantSources: WebSource[] = [];

    try {
      if (demo) {
        setThinking("Consulting Polaris…");
        const response = await fetch("/api/demo/strategist", {
          method: "POST",
          headers: { "content-type": "application/json", ...gemmaHeaders() },
          body: JSON.stringify({ message: text, section: "strategist", roadmapSummary: JSON.stringify(strategistContextPayload(roadmapStore.get())), knowledgeNotes: getBrowserKnowledgeNotes() }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "The Strategist is temporarily unavailable.");
        const sources: WebSource[] = (data.sources || []).map((source: { title?: string }) => ({ label: source.title || "Polaris knowledge base", uri: "#", kind: "kb" as const }));
        setMessages((items) => patchLast(items, (message) => ({ ...message, text: data.text, sources })));
        if (tid) void persistMessage(tid, "assistant", data.text, { sources, mode });
        setRouteInfo({ provider: "Polaris AI", model: "Polaris AI", reason: "Competition demo route" });
        return;
      }
      // threadId lets the server load recent turns and resolve follow-up
      // references ("what about the second one?") before retrieval runs.
      const body: Record<string, unknown> = {
        message: text,
        mode,
        routeMode,
        offline,
        allowPaid,
        ...(tid ? { threadId: tid } : {}),
      };
      // Live roadmap context: focused node + recent roadmap events.
      body.roadmapContext = strategistContextPayload(roadmapStore.get());
      if (model === "auto") body.autoSelect = true;
      else body.model = { providerId: model.providerId, modelId: model.modelId };

      const res = await fetch("/api/strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify(body),
      });
      const rem = res.headers.get("X-RateLimit-Remaining");
      if (rem !== null) setRemaining(parseInt(rem, 10));
      if (res.status === 429) {
        setMessages((m) => m.slice(0, -1));
        setQuota({ kind: "plan", resetHint: resetHintFrom(res.headers.get("X-RateLimit-Reset")) });
        return;
      }
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "The Strategist is unavailable right now.");
        setMessages((m) => patchLast(m, (msg) => ({ ...msg, text: err })));
        return;
      }

      await consumeSse(res.body.getReader(), (chunk) => {
        if (chunk.kind === "error" && chunk.code === "AI_QUOTA") {
          setQuota({ kind: "ai" });
          setMessages((m) => m.slice(0, -1));
          setThinking(null);
          return;
        }
        if (chunk.kind === "tool") {
          if (chunk.name === "model_route" && chunk.status === "done") {
            const r = chunk.result as { providerName?: string; modelLabel?: string; reason?: string } | undefined;
            if (r?.providerName && r?.modelLabel) {
              setRouteInfo({ provider: r.providerName, model: r.modelLabel, reason: r.reason ?? "" });
              setThinking(`Using ${r.modelLabel}…`);
            }
            return;
          }
          if (chunk.name === "retrieval") {
            if (chunk.status === "start") {
              setThinking("Searching your roadmap and knowledge base…");
            } else if (chunk.status === "done") {
              const r = chunk.result as { kbHits?: number; userHits?: number } | undefined;
              const found = (r?.kbHits ?? 0) + (r?.userHits ?? 0);
              setThinking(found ? `Grounded in ${found} passage${found === 1 ? "" : "s"}…` : null);
            }
            return;
          }
          if (chunk.status === "start" && chunk.name === "web_search") {
            setThinking("Searching the web…");
          } else if (chunk.status === "done" && chunk.name === "web_search") {
            const r = chunk.result as { sources?: number } | undefined;
            setThinking(
              r?.sources
                ? `Read ${r.sources} source${r.sources === 1 ? "" : "s"} - synthesizing…`
                : null,
            );
          } else if (chunk.status === "error") {
            setThinking(null);
          }
          return;
        }
        if (chunk.kind === "verification") {
          // Deterministic numeric guard fired: the answer quotes a figure that
          // is in none of its sources. Say so where the student will see it.
          assistantText += `\n\n> **Verify before relying on this.** ${chunk.message}`;
          setMessages((m) =>
            patchLast(m, (message) => ({
              ...message,
              text: assistantText,
            })),
          );
          return;
        }
        if (chunk.kind === "done") setThinking(null);
        if (chunk.kind === "text") assistantText += chunk.delta;
        if (chunk.kind === "source") assistantSources.push({ label: chunk.label, uri: chunk.uri, kind: chunk.source });
        setMessages((m) => {
          const last = m[m.length - 1];
          if (!last || last.role !== "agent") return m;
          if (chunk.kind === "text") {
            if (!last.text) setThinking(null);
            return [...m.slice(0, -1), { ...last, text: last.text + chunk.delta }];
          }
          if (chunk.kind === "source") {
            const src: WebSource = { label: chunk.label, uri: chunk.uri, kind: chunk.source };
            return [...m.slice(0, -1), { ...last, sources: [...last.sources, src] }];
          }
          if (chunk.kind === "error") {
            return [...m.slice(0, -1), { ...last, text: chunk.message }];
          }
          return m;
        });
      });
      if (tid && assistantText.trim()) {
        void persistMessage(tid, "assistant", assistantText, {
          sources: assistantSources,
          mode,
          providerId: routeInfo?.provider,
          modelId: routeInfo?.model,
        });
      }
    } catch {
      setMessages((m) => patchLast(m, (msg) => ({ ...msg, text: "The Strategist disconnected. Try a suggestion to retry." })));
    } finally {
      setStreaming(false);
      setThinking(null);
    }
  }, [input, streaming, mode, model, routeMode, offline, allowPaid, routeInfo, ensureThread, persistMessage, demo]);

  // A real exchange exists (not just the seed greeting) → collapse the hero.
  const hasConversation = messages.some((m) => m.role === "user");

  const railCol = railCollapsed ? "48px" : `${railWidth}px`;
  const gridCols =
    bp === "mobile" ? "1fr" :
    bp === "tablet" ? `${railCol} 1fr` :
    `${railCol} minmax(0, 1fr) 264px`;

  return (
    <div
      className={cn(
        "h-full min-h-0 grid overflow-hidden",
        // Smooth grid-template transition only when not actively dragging.
        !resizingRail && "transition-[grid-template-columns] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
      )}
      style={{ gridTemplateColumns: gridCols }}
    >
      {/* ─── Chat history rail - grid column (md+) or overlay drawer (mobile) ─── */}
      {bp !== "mobile" ? (
        <ChatHistoryRail
          activeId={threadId}
          onSelect={(id) => setThreadId(id)}
          onNew={startNewChat}
          collapsed={railCollapsed}
          onToggleCollapse={toggleRailCollapsed}
          reloadKey={threadsReloadKey}
          width={railWidth}
          onResize={setRailWidthClamped}
          resizing={resizingRail}
          onResizeStart={() => setResizingRail(true)}
          onResizeEnd={() => setResizingRail(false)}
          demo={demo}
        />
      ) : (
        <>
          {mobileChatsOpen && (
            <button
              aria-label="Close conversations"
              onClick={() => setMobileChatsOpen(false)}
              className="fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
            />
          )}
          <div
            className={cn(
              "fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
              mobileChatsOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <ChatHistoryRail
              activeId={threadId}
              onSelect={(id) => { setThreadId(id); setMobileChatsOpen(false); }}
              onNew={(id) => { startNewChat(id); setMobileChatsOpen(false); }}
              collapsed={false}
              onToggleCollapse={() => setMobileChatsOpen(false)}
              reloadKey={threadsReloadKey}
              width={Math.min(railWidth, 320)}
              onResize={() => {}}
              resizing={false}
              onResizeStart={() => {}}
              onResizeEnd={() => {}}
              demo={demo}
            />
          </div>
        </>
      )}

      {/* ─── Main chat column ───
          min-h-0 is critical: grid children default to min-height:auto and
          would grow past the row, leaving the inner scroller unconstrained
          (= content clipped by the grid's overflow-hidden, wheel dead). */}
      <div ref={chatColRef} className="flex flex-col bg-paper min-w-0 min-h-0">
        {/* Hero - full only while the conversation is fresh; collapses to a
            slim strip once the user starts chatting so messages get the room. */}
        <div className={cn(
          "px-4 sm:px-6 lg:px-8 border-b border-polaris-500/10 bg-gradient-to-b from-paper-soft/55 to-paper",
          hasConversation ? "py-2" : "pt-3 lg:pt-3 pb-2",
        )}>
          <div className={cn(
            "flex items-center gap-2",
            hasConversation ? "flex-wrap lg:flex-nowrap" : "mb-2",
          )}>
            {bp === "mobile" && (
              <button
                onClick={() => setMobileChatsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-paper-card hairline px-3 py-1.5 text-[11.5px] font-medium text-ink-dim hover:text-ink transition-colors shrink-0"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a8.5 8.5 0 1 1-3.4-6.8L21 4l-1.2 3.6A8.5 8.5 0 0 1 21 12z"/></svg>
                Chats
              </button>
            )}
            {hasConversation ? (
              <span className="mr-1 shrink-0 font-serif text-[15px] font-bold tracking-tight text-ink">Strategist</span>
            ) : (
              <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium">{eyebrow}</div>
            )}
            {hasConversation && (
              <>
                <div className="flex min-w-0 items-center gap-1 overflow-x-auto py-0.5">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      title={m.desc}
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors",
                        mode === m.id
                          ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                          : "bg-paper-card text-ink-dim ring-polaris-200 hover:text-ink hover:ring-polaris-300 dark:bg-white/[0.06] dark:ring-white/[0.18] dark:hover:bg-white/[0.12]",
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <div className="ml-auto w-full sm:w-[300px] lg:w-[340px]">
                  <CompactModelPicker
                    theme="light"
                    model={model}
                    setModel={setModel}
                    availableModels={availableModels}
                    providers={providers}
                    allowPaid={allowPaid}
                    setAllowPaid={setAllowPaid}
                    offline={offline}
                    setOffline={setOffline}
                    onRefresh={refreshProviders}
                    modeChip={mode[0].toUpperCase() + mode.slice(1)}
                    routeMode={routeMode}
                    setRouteMode={setRouteMode}
                  />
                </div>
              </>
            )}
          </div>
          {!hasConversation && (
            <>
              <h1 className="font-serif text-[21px] sm:text-[24px] lg:text-[27px] leading-tight font-bold tracking-tight text-ink">
                Your <span className="grad-text">long-horizon</span> AI academic strategist.
              </h1>
              <p className="hidden sm:block text-[12px] text-ink-dim mt-1 max-w-3xl leading-relaxed">
                Grounded in global admit patterns, your profile, your notes, your saved memories, and the live web.
                Every answer cites its sources and proposes the next concrete action.
              </p>
            </>
          )}

          {/* Mode + model picker row */}
          {!hasConversation && (
          <div className="mt-2 flex max-w-none flex-col gap-1.5 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  title={m.desc}
                  className={cn(
                    "text-[11.5px] font-medium px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors",
                    mode === m.id
                      ? "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/50"
                      // text-ink + text-ink-dim already swap to LIGHT in dark mode
                      // via the CSS-var-driven palette. Don't override with text-paper.
                      : "bg-paper-card text-ink-dim ring-polaris-200 hover:text-ink hover:ring-polaris-300 dark:bg-white/[0.06] dark:ring-white/[0.18] dark:hover:bg-white/[0.12]",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto sm:w-[270px]">
              <CompactModelPicker
                theme="light"
                model={model}
                setModel={setModel}
                availableModels={availableModels}
                providers={providers}
                allowPaid={allowPaid}
                setAllowPaid={setAllowPaid}
                offline={offline}
                setOffline={setOffline}
                onRefresh={refreshProviders}
                modeChip={mode[0].toUpperCase() + mode.slice(1)}
                routeMode={routeMode}
                setRouteMode={setRouteMode}
              />
            </div>
          </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-y px-4 sm:px-6 lg:px-10 py-5 lg:py-6 space-y-5">
          {messages.map((m) => <BigBubble key={m.id} m={m} initials={initials} gapRows={gapRows} />)}
          {thinking && streaming && (
            <div className="max-w-3xl mx-auto flex items-center gap-2 text-ink-muted pl-10 text-[12.5px]">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-polaris-400 opacity-75 animate-ping" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-polaris-500" />
              </span>
              <span>{thinking}</span>
            </div>
          )}
          {routeInfo && !streaming && (
            <div className="max-w-3xl mx-auto pl-10 text-[10.5px] font-mono text-ink-muted" title={routeInfo.reason}>
              Routed → {routeInfo.provider} · {routeInfo.model}
            </div>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 sm:px-6 lg:px-10 pb-4 lg:pb-6 pt-3 border-t border-polaris-500/10 bg-paper">
          <div className="bg-paper-card hairline rounded-2xl p-3 max-w-3xl mx-auto focus-within:shadow-[0_0_0_2px_rgba(196,125,78,0.18)]">
            <textarea value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
              rows={2} placeholder="Ask the Strategist anything - your profile, your KB, your roadmap, the live web."
              className="w-full bg-transparent text-[14px] placeholder-ink-muted outline-none resize-none" />
            <div className="flex items-center gap-2 pt-2 border-t border-polaris-500/10 mt-2">
              <CapabilityChip tone="polaris" icon={<Icon.book size={11} />} label="KB grounded" />
              <CapabilityChip tone="aurora" icon={<Icon.spark size={11} />} label="Cites sources" />
              <CapabilityChip tone="nova" icon={<WebDot />} label="Live web" />
              <div className="ml-auto flex items-center gap-2">
                {remaining !== null && <span className="text-[10.5px] font-mono text-ink-muted">{remaining} left</span>}
                <span className="text-[10.5px] font-mono text-ink-muted">↩ to send</span>
                <button onClick={() => send()} disabled={streaming || !input.trim()} className="h-8 px-3 rounded-lg bg-ink text-paper text-[12.5px] font-medium inline-flex items-center gap-1.5 hover:bg-polaris-700 disabled:opacity-50 transition-colors">
                  <Icon.send size={12} /> Send
                </button>
              </div>
            </div>
          </div>
          <div className="max-w-3xl mx-auto mt-2 flex flex-wrap items-center gap-1.5">
            {SUGGESTIONS.map((q) => (
              <button key={q} onClick={() => send(q)} disabled={streaming}
                className="text-[11.5px] px-2.5 py-1 rounded-full bg-paper-card hairline text-ink-dim hover:text-ink hover:bg-paper-soft disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Right context strip (desktop only - grid drops it below xl) ─── */}
      <div className={cn("border-l border-polaris-500/10 bg-paper-soft/50 p-3 min-h-0 overflow-y-auto overscroll-contain scroll-y", bp !== "desktop" && "hidden")}>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="text-[9.5px] uppercase tracking-[0.2em] text-ink-muted font-medium">Live context</div>
          <span className="inline-flex items-center gap-1 text-[9.5px] text-aurora-700 dark:text-aurora-200">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora-500" /> Synced
          </span>
        </div>
        <Card className="p-3 mb-2">
          <div className="flex items-center gap-2 mb-2.5">
            <Avatar initials={initials} size={28} />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink leading-none truncate">{studentName}</div>
              <div className="text-[10.5px] text-ink-dim mt-0.5">{grade}</div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-1.5 text-[11px]">
            {contextRows.map((r) => (
              <div key={r.k} className="rounded-lg bg-paper-soft px-2 py-1.5">
                <dt className="text-[9.5px] text-ink-muted truncate">{r.k}</dt>
                <dd className="font-mono font-semibold text-ink mt-0.5 truncate">{r.v}</dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="text-[9.5px] uppercase tracking-[0.2em] text-ink-muted font-medium mb-2 mt-3 px-1">Available tools</div>
        <ul className="grid gap-1.5 text-[10.5px] text-ink-dim">
          {["Search KB + cite sources", "Search the live web", "Re-prioritize your roadmap", "Read a milestone in full", "Re-run the probability engine"].map((t) => (
            <li key={t} className="flex items-center gap-2 rounded-lg bg-paper-card px-2.5 py-2 ring-1 ring-inset ring-polaris-500/10">
              <span className="text-aurora-600"><Icon.check size={11} /></span><span className="leading-tight">{t}</span>
            </li>
          ))}
        </ul>
      </div>
      {quota && <QuotaModal quota={quota} onClose={() => setQuota(null)} />}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */

/**
 * CapabilityChip - composer "this AI can …" badges. Built for both themes:
 * soft brand-color gradient backing, ring-1 inset, small icon, pulsing dot
 * accent so they look alive instead of dead labels.
 */
function CapabilityChip({
  tone, icon, label,
}: {
  tone: "polaris" | "aurora" | "nova";
  icon: React.ReactNode;
  label: string;
}) {
  const toneClasses = {
    polaris: "from-polaris-100 to-polaris-50 text-polaris-700 ring-polaris-300/40 hover:from-polaris-200 hover:to-polaris-100 dark:from-polaris-400/25 dark:to-polaris-400/10 dark:text-polaris-100 dark:ring-polaris-400/40 dark:hover:from-polaris-400/35",
    aurora:  "from-aurora-100 to-aurora-50 text-aurora-700 ring-aurora-400/40 hover:from-aurora-200 hover:to-aurora-100 dark:from-aurora-400/25 dark:to-aurora-400/10 dark:text-aurora-100 dark:ring-aurora-400/40 dark:hover:from-aurora-400/35",
    nova:    "from-nova-100 to-nova-50 text-nova-700 ring-nova-400/40 hover:from-nova-200 hover:to-nova-100 dark:from-nova-400/25 dark:to-nova-400/10 dark:text-nova-100 dark:ring-nova-400/40 dark:hover:from-nova-400/35",
  }[tone];
  const dotColor = {
    polaris: "bg-polaris-500 dark:bg-polaris-300",
    aurora:  "bg-aurora-500 dark:bg-aurora-300",
    nova:    "bg-nova-500 dark:bg-nova-300",
  }[tone];
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium",
      "bg-gradient-to-br ring-1 ring-inset transition-all duration-200",
      "shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]",
      toneClasses,
    )}>
      <span className="relative flex h-1.5 w-1.5">
        <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping", dotColor)}/>
        <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", dotColor)}/>
      </span>
      <span className="opacity-80">{icon}</span>
      {label}
    </span>
  );
}

function WebDot() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/>
      <path d="M2 12h20"/>
      <path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/>
    </svg>
  );
}

function BigBubble({ m, initials, gapRows }: { m: Msg; initials: string; gapRows: GapRow[] }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end gap-3 max-w-3xl mx-auto animate-fadeUp">
        <div className="max-w-[70%] bg-polaris-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] leading-relaxed shadow-sm">{m.text}</div>
        <Avatar initials={initials} size={28} />
      </div>
    );
  }
  const citationSources: CitationSource[] = m.sources.map((s) => ({
    label: s.label,
    uri: s.uri,
    kind: s.kind,
  }));

  return (
    <div className="flex gap-3 max-w-3xl mx-auto items-start animate-fadeUp">
      <Avatar initials="P" size={28} color="ink" />
      <div className="max-w-[88%] space-y-2.5 min-w-0 flex-1">
        {m.text && (
          <div className="bg-paper-card hairline rounded-2xl rounded-tl-sm px-5 py-3.5 shadow-sm">
            <MarkdownMessage text={m.text} sources={citationSources} theme="light" />
          </div>
        )}
        {m.gap && <GapAnalysis rows={gapRows} />}
        {m.sources.length > 0 && (
          <SourceFooter sources={m.sources} />
        )}
      </div>
    </div>
  );
}

function SourceFooter({ sources }: { sources: WebSource[] }) {
  return (
    <div className="pl-1 pt-1">
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-ink-muted font-medium mb-1.5">Sources</div>
      <div className="flex flex-wrap gap-1.5">
        {sources.map((s, i) => {
          const isWeb = s.kind === "web" && /^https?:/.test(s.uri);
          const n = i + 1;
          const chipCls = cn(
            "group inline-flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all max-w-[280px] text-[11.5px]",
            isWeb
              ? "text-polaris-700 bg-polaris-50 hairline hover:bg-polaris-100 hover:shadow-sm"
              : s.kind === "roadmap"
                ? "text-nova-700 bg-nova-100 ring-1 ring-inset ring-nova-400/30"
                : "text-ink-dim bg-paper-card hairline",
          );
          const content = (
            <>
              <span className="font-mono text-[10px] font-semibold opacity-70">{n}</span>
              <Icon.link size={10} />
              <span className="truncate">{s.label}</span>
            </>
          );
          if (isWeb) {
            return (
              <a key={i} href={s.uri} target="_blank" rel="noopener noreferrer" className={chipCls} title={s.uri}>
                {content}
              </a>
            );
          }
          return (
            <span key={i} className={chipCls} title={s.uri}>
              {content}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function GapAnalysis({ rows }: { rows: GapRow[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="px-4 py-2.5 border-b border-polaris-500/10 flex items-center gap-2">
        <Icon.spark size={14} />
        <div className="text-[12.5px] font-semibold text-ink">Your signals vs. the admit-median reference</div>
        <Pill tone="aurora" className="ml-auto">engine</Pill>
      </div>
      <table className="w-full text-[12.5px]">
        <thead className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">
          <tr className="text-left">
            <th className="px-4 py-1.5 font-medium">Signal</th>
            <th className="px-2 py-1.5 font-medium">You</th>
            <th className="px-2 py-1.5 font-medium">Admit ref.</th>
            <th className="px-4 py-1.5 font-medium">Next move</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-polaris-500/10">
              <td className="px-4 py-2 text-ink">{r.signal}</td>
              <td className="px-2 py-2 font-mono text-ink-dim">{r.you}</td>
              <td className="px-2 py-2 font-mono text-aurora-600">{r.admit}</td>
              <td className="px-4 py-2 text-polaris-500 font-medium">{r.move}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MODEL PICKER - light theme variant (different from the dark right-rail)
   ════════════════════════════════════════════════════════════════════════ */

function patchLast(m: Msg[], fn: (msg: Msg) => Msg): Msg[] {
  if (!m.length) return m;
  const last = m[m.length - 1];
  if (last.role !== "agent") return m;
  return [...m.slice(0, -1), fn(last)];
}

async function consumeSse(reader: ReadableStreamDefaultReader<Uint8Array>, onChunk: (c: StrategistChunk) => void) {
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const raw = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of raw.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try { onChunk(JSON.parse(line.slice(5).trim()) as StrategistChunk); } catch { /* ignore */ }
      }
    }
  }
}
