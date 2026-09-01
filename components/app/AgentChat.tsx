"use client";

/**
 * Persistent right-rail Strategist chat. Streams /api/strategist over SSE,
 * with abort, reconnect, and a small client-side message cache. The panel
 * visibility is controlled by `documentElement.dataset.agentOpen` (set by
 * the TopBar toggle) and persists across reloads via localStorage.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gemmaHeaders, getBrowserKnowledgeNotes } from "@/lib/gemma/browser-key";
import { usePathname } from "next/navigation";
import { Avatar, Tag } from "./ui";
import { QuotaModal, resetHintFrom, type QuotaState } from "./QuotaModal";
import { MarkdownMessage, type CitationSource } from "./MarkdownMessage";
import { CompactModelPicker, type CmpRouteMode } from "./CompactModelPicker";
import type { StrategistChunk } from "@/lib/strategist/schemas";
import type { StrategistMessage, StrategistSource } from "@/types/app";
import {
  useRoadmapStrategist, roadmapStore, findNode, currentFocus,
  deriveInsight, deriveQuickPrompts, strategistContextPayload,
  type RoadmapDoc,
} from "@/lib/roadmap/store";
import {
  isPlanMutation,
  refreshRoadmapAfterMutation,
  toolDoneLabel,
  toolRunningLabel,
} from "@/lib/strategist/tool-ui";
import { cn } from "@/lib/cn";
import {
  appendDemoStrategistMessage,
  ensureDemoStrategistThread,
  getDemoStrategistThread,
} from "@/lib/demo/strategist-history";

type Props = {
  studentInitials: string;
  pathLabel: string;
  contextChips?: string[];
  demo?: boolean;
};

const STORAGE_KEY = "polaris.strategist.thread";
const MODEL_KEY = "polaris.strategist.model";
const MODE_KEY = "polaris.strategist.mode";
const PAID_KEY = "polaris.strategist.allowPaid";
const OFFLINE_KEY = "polaris.strategist.offline";
const ROUTE_MODE_KEY = "polaris.strategist.routeMode";
/** Shared with StrategistClient - both surfaces read/write the same thread. */
const ACTIVE_THREAD_KEY = "polaris.chat.activeThread";
const WIDTH_KEY = "polaris.strategist.railWidth";
const DEFAULT_RAIL_WIDTH = 416;
const MIN_RAIL_WIDTH = 360;
const MAX_RAIL_WIDTH = 520;

type Mode = "general" | "research" | "study" | "coding";
type Tier = "free" | "paid" | "local";

type ProviderInfo = {
  id: string;
  name: string;
  defaultTier: Tier;
  configured: boolean;
  models: Array<{ id: string; label: string; tier: Tier; legacy?: boolean }>;
};

type ModelChoice = { providerId: string; modelId: string } | "auto";

const DEMO_PROVIDERS: ProviderInfo[] = [{
  id: "gemma",
  name: "Polaris",
  defaultTier: "free",
  configured: true,
  models: [
    { id: "gemma-4-26b-a4b-it", label: "Polaris AI", tier: "free" },
    { id: "gemma-4-31b-it", label: "Polaris AI Advanced", tier: "free" },
  ],
}];

const MODES: Array<{ id: Mode; label: string }> = [
  { id: "general",  label: "General"  },
  { id: "research", label: "Research" },
  { id: "study",    label: "Study"    },
  { id: "coding",   label: "Coding"   },
];

export function AgentChat({ studentInitials, pathLabel, contextChips = [], demo = false }: Props) {
  // Start empty on both server and client - sessionStorage can't be read
  // during SSR, so initializing from it desyncs hydration. The cached thread
  // is restored in the effect just below (declared before the persist effect
  // so it reads the cache before anything rewrites it).
  const [messages, setMessages] = useState<StrategistMessage[]>([]);
  useEffect(() => {
    if (demo) {
      const thread = getDemoStrategistThread();
      if (thread?.messages.length) {
        setMessages(thread.messages.map((message) => ({
          id: message.id,
          role: message.role === "user" ? "user" : "agent",
          text: message.text,
          sources: message.sources,
          createdAt: message.createdAt,
        })));
      }
      return;
    }
    const cached = loadCachedThread();
    if (cached.length) setMessages(cached);
  }, [demo]);
  const [draft, setDraft] = useState("");
  const [streaming, setStreaming] = useState(false);
  // What the strategist is doing right now ("Searching the web…" etc).
  // Cleared on each `done` or `error`, and on each new send.
  const [thinking, setThinking] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  // Multi-provider state.
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [model, setModel] = useState<ModelChoice>("auto");
  const [mode, setMode] = useState<Mode>("general");
  const [routeMode, setRouteMode] = useState<CmpRouteMode>("balanced");
  const [allowPaid, setAllowPaid] = useState(false);
  const [offline, setOffline] = useState(false);
  // Guards the server write-through: skip until the saved pref has loaded.
  const prefLoadedRef = useRef(false);
  const [routeInfo, setRouteInfo] = useState<{ provider: string; model: string; reason: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLElement | null>(null);

  // Wheel routing when the cursor is over the rail. Priority:
  //   1. If the messages scroller has its own overflow AND the cursor is
  //      inside it, let the browser scroll natively.
  //   2. Otherwise forward the wheel to the <main> element so the user can
  //      scroll the roadmap / deadlines / etc. without moving the mouse off
  //      the rail.
  //   3. Final fallback: if main has nothing to scroll either, scroll the
  //      messages region (in case it does have overflow but the cursor is
  //      over the header/composer/etc.).
  useEffect(() => {
    const aside = asideRef.current;
    const scroll = scroller.current;
    if (!aside) return;
    function onWheel(e: WheelEvent) {
      const targetIsInScroll =
        !!scroll && e.target instanceof Node && scroll.contains(e.target);
      const scrollHasOverflow = !!scroll && scroll.scrollHeight > scroll.clientHeight;
      if (targetIsInScroll && scrollHasOverflow) return;
      const main = document.querySelector<HTMLElement>("main");
      if (main && main.scrollHeight > main.clientHeight) {
        e.preventDefault();
        main.scrollBy({ top: e.deltaY, behavior: "auto" });
        return;
      }
      if (scroll && scrollHasOverflow) {
        e.preventDefault();
        scroll.scrollBy({ top: e.deltaY, behavior: "auto" });
      }
    }
    aside.addEventListener("wheel", onWheel, { passive: false });
    return () => aside.removeEventListener("wheel", onWheel);
  }, []);

  // Hydrate persisted picker state: localStorage first (instant), then the
  // server-saved preference (source of truth - follows the user across
  // devices). Only after the server answer do we start writing back.
  useEffect(() => {
    try {
      const m = localStorage.getItem(MODEL_KEY);
      if (m === "auto" || m === null) setModel("auto");
      else setModel(JSON.parse(m) as ModelChoice);
      const md = localStorage.getItem(MODE_KEY) as Mode | null;
      if (md && (MODES.some((x) => x.id === md))) setMode(md);
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
      .catch(() => { /* offline/unauthenticated - local state stands */ })
      .finally(() => { if (!cancelled) prefLoadedRef.current = true; });
    return () => { cancelled = true; };
  }, [demo]);
  useEffect(() => { localStorage.setItem(MODEL_KEY, model === "auto" ? "auto" : JSON.stringify(model)); }, [model]);
  useEffect(() => { localStorage.setItem(MODE_KEY, mode); }, [mode]);
  useEffect(() => { localStorage.setItem(ROUTE_MODE_KEY, routeMode); }, [routeMode]);
  useEffect(() => { localStorage.setItem(PAID_KEY, String(allowPaid)); }, [allowPaid]);
  useEffect(() => { localStorage.setItem(OFFLINE_KEY, String(offline)); }, [offline]);

  // Write-through: debounce-save the preference server-side so it persists
  // across devices and steers server jobs (roadmap generation, replans).
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
    if (demo) {
      setProviders(DEMO_PROVIDERS);
      return;
    }
    try {
      const r = await fetch("/api/providers", { cache: "no-store" });
      if (!r.ok) return;
      const data = await r.json();
      if (data?.providers) setProviders(data.providers as ProviderInfo[]);
    } catch { /* ignore */ }
  }, [demo]);

  useEffect(() => {
    if (!open) return;
    void refreshProviders();
  }, [open, refreshProviders]);

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

  // Hydrate visibility from the html data attribute (set by TopBar).
  useEffect(() => {
    const saved = localStorage.getItem("polaris.agentOpen");
    if (saved !== null) setOpen(saved !== "false");
    const obs = new MutationObserver(() => {
      const v = document.documentElement.dataset.agentOpen;
      if (v !== undefined) setOpen(v !== "false");
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-agent-open"] });
    return () => obs.disconnect();
  }, []);

  // Resizable rail width (right-side strategy panel). Persisted, clamped.
  const [railWidth, setRailWidth] = useState<number>(DEFAULT_RAIL_WIDTH);
  const [resizing, setResizing] = useState(false);
  // Below xl the rail is an overlay opened from a floating button.
  const [mobileOpen, setMobileOpen] = useState(false);

  // ─── Roadmap ⇄ Strategist shared store ───
  const roadmapState = useRoadmapStrategist();
  const selectedNode = findNode(roadmapState.doc, roadmapState.selectedNodeId);
  const focusNode = selectedNode ?? currentFocus(roadmapState.doc);
  const insight = useMemo(() => deriveInsight(roadmapState), [roadmapState]);
  const quickPrompts = useMemo(() => deriveQuickPrompts(roadmapState), [roadmapState]);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applied, setApplied] = useState<string | null>(null);

  // "Ask Strategist about this node" focuses the rail with context loaded.
  useEffect(() => {
    function onOpen(e: Event) {
      setMobileOpen(true);
      const draft = (e as CustomEvent<{ draft?: string }>).detail?.draft;
      if (draft) setDraft(draft);
    }
    window.addEventListener("polaris:openAgentRail", onOpen);
    return () => window.removeEventListener("polaris:openAgentRail", onOpen);
  }, []);

  // Apply an actionable insight: the Strategist rewrites upcoming phases.
  const applyInsight = useCallback(async (reason: string) => {
    setApplyBusy(true);
    try {
      if (demo) {
        roadmapStore.emit("STRATEGIST_RECOMMENDATION_APPLIED", `Demo recommendation: ${reason.slice(0, 120)}`);
        setApplied("Preview applied to this browser session.");
        setTimeout(() => setApplied(null), 8000);
        return;
      }
      const r = await fetch("/api/roadmap/v2/adapt", {
        method: "POST",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({ reason }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.doc) {
        roadmapStore.setDoc(d.doc as RoadmapDoc);
        roadmapStore.emit("STRATEGIST_RECOMMENDATION_APPLIED", `Applied: ${reason.slice(0, 120)}`);
        const last = (d.doc as RoadmapDoc).adaptations.slice(-1)[0];
        setApplied(last?.reason ?? "Roadmap updated.");
        setTimeout(() => setApplied(null), 8000);
      }
    } finally {
      setApplyBusy(false);
    }
  }, [demo]);
  useEffect(() => {
    const v = parseInt(localStorage.getItem(WIDTH_KEY) ?? "", 10);
    if (Number.isFinite(v) && v >= MIN_RAIL_WIDTH && v <= MAX_RAIL_WIDTH) {
      setRailWidth(v);
    } else if (Number.isFinite(v)) {
      // Drop legacy widths that can overwhelm the main workspace.
      try { localStorage.removeItem(WIDTH_KEY); } catch {}
      setRailWidth(DEFAULT_RAIL_WIDTH);
    }
  }, []);
  const applyRailWidth = useCallback((px: number) => {
    const clamped = Math.max(MIN_RAIL_WIDTH, Math.min(MAX_RAIL_WIDTH, Math.round(px)));
    setRailWidth(clamped);
    try { localStorage.setItem(WIDTH_KEY, String(clamped)); } catch {}
  }, []);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight;
  }, [messages, streaming]);

  useEffect(() => {
    if (!demo) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-50)));
  }, [messages, demo]);

  /* ─── Thread sync with the /strategist page ───
   * Both surfaces share one active thread (id in localStorage). The rail
   * reloads that thread's messages whenever the route changes - so a
   * conversation started on /strategist continues here, and vice versa. */
  const pathnameForSync = usePathname();
  const threadIdRef = useRef<string | null>(null);
  const loadedThreadRef = useRef<string | null>(null);

  useEffect(() => {
    if (demo) {
      const thread = getDemoStrategistThread();
      threadIdRef.current = thread?.id ?? null;
      loadedThreadRef.current = thread?.id ?? null;
      if (thread?.messages.length) {
        setMessages(thread.messages.map((message) => ({
          id: message.id,
          role: message.role === "user" ? "user" : "agent",
          text: message.text,
          sources: message.sources,
          createdAt: message.createdAt,
        })));
      }
      return;
    }
    const id = localStorage.getItem(ACTIVE_THREAD_KEY) || null;
    threadIdRef.current = id;
    if (!id || loadedThreadRef.current === id) return;
    let cancelled = false;
    fetch(`/api/chat/threads/${id}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.messages) return;
        loadedThreadRef.current = id;
        const loaded: StrategistMessage[] = d.messages.map(
          (m: { id: string; role: "user" | "assistant"; text: string; sources?: StrategistSource[]; createdAt?: string }) => ({
            id: m.id,
            role: m.role === "user" ? "user" : "agent",
            text: m.text,
            sources: m.sources ?? [],
            createdAt: m.createdAt ?? new Date().toISOString(),
          }),
        );
        if (loaded.length) setMessages(loaded);
      })
      .catch(() => { /* thread may have been deleted - keep local cache */ });
    return () => { cancelled = true; };
  }, [pathnameForSync, demo]);

  /** Create (or reuse) the shared thread; returns its id. */
  const ensureThread = useCallback(async (firstUserText: string): Promise<string | null> => {
    if (demo) {
      const thread = ensureDemoStrategistThread(firstUserText, mode, "sidebar");
      threadIdRef.current = thread.id;
      loadedThreadRef.current = thread.id;
      return thread.id;
    }
    if (threadIdRef.current) return threadIdRef.current;
    try {
      const title = firstUserText.length > 60 ? firstUserText.slice(0, 57) + "…" : firstUserText;
      const res = await fetch("/api/chat/threads", {
        method: "POST",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return null;
      const d = await res.json();
      const id = (d?.thread?.id as string | undefined) ?? null;
      if (id) {
        threadIdRef.current = id;
        loadedThreadRef.current = id; // we already hold its messages locally
        try { localStorage.setItem(ACTIVE_THREAD_KEY, id); } catch { /* ignore */ }
      }
      return id;
    } catch {
      return null;
    }
  }, [demo, mode]);

  const persistMessage = useCallback(async (
    tid: string,
    role: "user" | "assistant",
    text: string,
    sources?: StrategistSource[],
  ) => {
    if (!text.trim()) return;
    if (demo) {
      appendDemoStrategistMessage(tid, {
        role,
        text,
        sources: sources ?? [],
      }, mode, "sidebar");
      return;
    }
    try {
      await fetch(`/api/chat/threads/${tid}/messages`, {
        method: "POST",
        headers: { "content-type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify({ role, text, ...(sources?.length ? { sources } : {}), mode }),
      });
    } catch { /* best-effort */ }
  }, [mode, demo]);

  const send = useCallback(async (override?: string) => {
    const text = (override ?? draft).trim();
    if (!text || streaming) return;
    const userMsg: StrategistMessage = {
      id: crypto.randomUUID(), role: "user", text, createdAt: new Date().toISOString(),
    };
    const placeholder: StrategistMessage = {
      id: crypto.randomUUID(), role: "agent", text: "", sources: [], createdAt: new Date().toISOString(),
    };
    setMessages(m => [...m, userMsg, placeholder]);
    setDraft("");
    setStreaming(true);
    setThinking(null);
    setRouteInfo(null);

    // Persist to the shared thread so /strategist sees this exchange too.
    const tid = await ensureThread(text);
    if (tid) void persistMessage(tid, "user", text);
    let agentText = "";
    const agentSources: StrategistSource[] = [];

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      if (demo) {
        setThinking("Consulting Polaris…");
        const response = await fetch("/api/demo/strategist", {
          method: "POST",
          headers: { "content-type": "application/json", ...gemmaHeaders() },
          body: JSON.stringify({
            message: text,
            section: pathnameForSync.split("/")[2] || "roadmap",
            roadmapSummary: JSON.stringify(strategistContextPayload(roadmapStore.get())),
            knowledgeNotes: getBrowserKnowledgeNotes(),
          }),
          signal: ctrl.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "The Strategist is temporarily unavailable.");
        const sources: StrategistSource[] = (data.sources || []).map((source: { title?: string; source?: string }) => ({
          label: source.title || "Polaris knowledge base",
          uri: "#",
          kind: "kb" as const,
        }));
        setMessages((items) => withLastAgent(items, (message) => ({ ...message, text: data.text, sources })));
        if (tid) void persistMessage(tid, "assistant", data.text, sources);
        setRouteInfo({ provider: "Polaris AI", model: "Polaris AI", reason: "Competition demo route" });
        return;
      }
      const body: Record<string, unknown> = {
        message: text,
        // Lets the server load recent turns and resolve follow-up references
        // ("what about the second one?") before retrieval.
        ...(tid ? { threadId: tid } : {}),
        mode,
        routeMode,
        offline,
        allowPaid,
        // Live roadmap context: focused node + recent events from the store.
        roadmapContext: strategistContextPayload(roadmapStore.get()),
      };
      if (model === "auto") {
        body.autoSelect = true;
      } else {
        body.model = { providerId: model.providerId, modelId: model.modelId };
      }
      const res = await fetch("/api/strategist", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...gemmaHeaders() },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (res.status === 429) {
        // Plan message budget exhausted - drop the empty placeholder, pop the modal.
        setMessages(m => m.slice(0, -1));
        setQuota({ kind: "plan", resetHint: resetHintFrom(res.headers.get("X-RateLimit-Reset")) });
        return;
      }
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => "Stream failed");
        setMessages(m => withLastAgent(m, msg => ({ ...msg, text: err })));
        return;
      }
      await consumeSse(res.body.getReader(), chunk => {
        if (chunk.kind === "error" && chunk.code === "AI_QUOTA") {
          setQuota({ kind: "ai" });
          setMessages(m => m.slice(0, -1));
          setThinking(null);
          return;
        }
        // Surface research progress as a small inline indicator.
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
            const r = chunk.result as { sources?: number; queries?: string[] } | undefined;
            setThinking(
              r?.sources
                ? `Read ${r.sources} source${r.sources === 1 ? "" : "s"} - synthesizing…`
                : null,
            );
          } else if (chunk.status === "start") {
            setThinking(toolRunningLabel(chunk.name));
          } else if (chunk.status === "done") {
            setThinking(toolDoneLabel(chunk.name));
            // The Strategist just changed the plan; pull the tree back in sync
            // so both surfaces show the same state without a reload.
            if (isPlanMutation(chunk.name)) {
              void refreshRoadmapAfterMutation("Strategist updated your plan");
            }
          } else if (chunk.status === "error") {
            setThinking(null);
          }
          return;
        }
        if (chunk.kind === "verification") {
          // Deterministic numeric guard fired: the answer quotes a figure that
          // is in none of its sources. Say so where the student will see it.
          agentText += `

> **Verify before relying on this.** ${chunk.message}`;
          setMessages((items) =>
            withLastAgent(items, (message) => ({ ...message, text: agentText })),
          );
          return;
        }
        if (chunk.kind === "done") {
          setThinking(null);
        }
        if (chunk.kind === "text") agentText += chunk.delta;
        if (chunk.kind === "source") agentSources.push({ label: chunk.label, uri: chunk.uri, kind: chunk.source });
        setMessages(m => {
          const last = m[m.length - 1];
          if (!last || last.role !== "agent") return m;
          if (chunk.kind === "text") {
            // First text chunk → clear the "searching…" hint, we're answering now.
            if (!last.text) setThinking(null);
            return [...m.slice(0, -1), { ...last, text: (last.text ?? "") + chunk.delta }];
          }
          if (chunk.kind === "source") {
            const src: StrategistSource = { label: chunk.label, uri: chunk.uri, kind: chunk.source };
            return [...m.slice(0, -1), { ...last, sources: [...(last.sources ?? []), src] }];
          }
          if (chunk.kind === "error") {
            return [...m.slice(0, -1), { ...last, text: chunk.message }];
          }
          return m;
        });
      });
      // Persist the assistant's full reply to the shared thread.
      if (tid && agentText.trim()) void persistMessage(tid, "assistant", agentText, agentSources);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages(m => withLastAgent(m, msg => ({ ...msg, text: "The Strategist disconnected. Tap a suggestion to retry." })));
      }
    } finally {
      setStreaming(false);
      setThinking(null);
      abortRef.current = null;
    }
  }, [draft, streaming, mode, model, routeMode, offline, allowPaid, ensureThread, persistMessage, demo, pathnameForSync]);

  function stop() { abortRef.current?.abort(); }

  // The /strategist page already hosts the full-feature chat in the main
  // canvas - don't duplicate it as a right rail there.
  const pathname = usePathname();
  if (pathname === "/strategist" || pathname === "/demo/strategist") return null;

  if (!open) return null;

  return (
    <>
    {/* Floating chat trigger - below xl only */}
    {!mobileOpen && (
      <button
        onClick={() => setMobileOpen(true)}
        aria-label="Open Strategist chat"
        className="xl:hidden fixed bottom-5 right-5 z-40 h-12 w-12 rounded-full bg-gradient-to-br from-polaris-500 to-nova-500 text-white flex items-center justify-center shadow-pop active:scale-95 transition-transform"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8.5 8.5 0 1 1-3.4-6.8L21 4l-1.2 3.6A8.5 8.5 0 0 1 21 12z"/></svg>
      </button>
    )}

    {/* Backdrop - overlay mode */}
    {mobileOpen && (
      <button
        aria-label="Close Strategist chat"
        onClick={() => setMobileOpen(false)}
        className="xl:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
      />
    )}

    <aside
      ref={asideRef}
      style={{ width: railWidth, maxWidth: "min(94vw, 520px)" }}
      className={cn(
        // h-full + min-h-0 fills the parent column exactly; overflow-hidden so
        // only the inner messages region scrolls. Locked into the flex shell,
        // never moves when the main pane scrolls.
        "app-glass-dark shrink-0 border-l border-white/[0.06] flex flex-col min-h-0 overflow-hidden text-paper",
        // Desktop (xl+): static column. Below xl: fixed right overlay drawer.
        "fixed inset-y-0 right-0 z-50 h-[100dvh] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "xl:static xl:translate-x-0 xl:z-auto xl:relative",
        !resizing && "xl:transition-[width] xl:duration-300",
        mobileOpen ? "translate-x-0" : "translate-x-full xl:translate-x-0",
      )}
    >
      <RailResizeHandle
        width={railWidth}
        onResize={applyRailWidth}
        onResizeStart={() => setResizing(true)}
        onResizeEnd={() => setResizing(false)}
        resizing={resizing}
      />
      <Header
        pathLabel={pathLabel}
        onClose={() => {
          // Below xl the X just closes the overlay; on desktop it hides the rail.
          if (typeof window !== "undefined" && window.matchMedia("(max-width: 1279px)").matches) {
            setMobileOpen(false);
            return;
          }
          localStorage.setItem("polaris.agentOpen", "false");
          document.documentElement.dataset.agentOpen = "false";
        }}
      />

      {/* Mode + model controls */}
      <div className="px-3 py-2 border-b border-white/10 flex flex-col gap-1.5 bg-white/[0.02]">
        <div className="flex flex-wrap items-center gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className={cn(
                "text-[11px] font-medium px-2.5 py-1 rounded-full ring-1 ring-inset transition-colors whitespace-nowrap",
                mode === m.id
                  ? "bg-polaris-500/25 text-polaris-100 ring-polaris-400/50 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  : "bg-white/[0.05] text-paper/70 ring-white/15 hover:text-paper hover:bg-white/[0.10]",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <CompactModelPicker
          theme="dark"
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

      {/* ─── Mission control: sync status + focus + insight ─── */}
      {roadmapState.doc ? (
        <div className="px-3 py-2 border-b border-white/[0.06] space-y-1.5 bg-white/[0.015]">
          {/* Sync status */}
          <SyncStatusRow lastSyncAt={roadmapState.lastSyncAt} eventCount={roadmapState.events.length} />

          <details className="group rounded-xl bg-white/[0.025] ring-1 ring-inset ring-white/[0.08]">
            <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[11px] text-paper/75 marker:hidden">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-polaris-400/15 text-polaris-200">✦</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="font-semibold text-paper">{focusNode?.title ?? "Roadmap context"}</span>
                {focusNode ? ` · ${focusNode.progress}%` : ""}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-paper/45">Details</span>
              <svg className="transition-transform group-open:rotate-180" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M6 9l6 6 6-6" />
              </svg>
            </summary>
            <div className="space-y-1.5 border-t border-white/[0.06] p-1.5">
              {focusNode && (
                <FocusCard
                  node={focusNode}
                  isSelected={!!selectedNode}
                  phaseLabel={roadmapState.doc.phases[focusNode.phase] ?? `Phase ${focusNode.phase + 1}`}
                  onClear={selectedNode ? () => roadmapStore.selectNode(null, { silent: true }) : undefined}
                />
              )}

              {applied ? (
            <div className="rounded-xl px-3 py-2 bg-aurora-400/15 ring-1 ring-inset ring-aurora-400/40 text-[11.5px] text-paper leading-snug">
              <span className="font-bold text-aurora-200">Roadmap updated:</span> {applied}
            </div>
          ) : insight && (
            <div className={cn(
              "rounded-xl px-3 py-2 ring-1 ring-inset text-[11.5px] leading-snug",
              insight.tone === "warn" ? "bg-nova-400/10 ring-nova-400/30 text-paper" :
              insight.tone === "good" ? "bg-aurora-400/10 ring-aurora-400/30 text-paper" :
              "bg-white/[0.04] ring-white/[0.10] text-paper/85",
            )}>
              <div className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0">{insight.tone === "warn" ? "⚠" : insight.tone === "good" ? "✦" : "ℹ"}</span>
                <span className="flex-1">{insight.text}</span>
              </div>
              {insight.applyReason && (
                <button
                  onClick={() => void applyInsight(insight.applyReason!)}
                  disabled={applyBusy}
                  className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-paper text-ink px-2.5 py-1 text-[10.5px] font-bold hover:bg-polaris-100 transition-colors disabled:opacity-50"
                >
                  {applyBusy ? (
                    <><span className="h-2.5 w-2.5 rounded-full border border-ink/30 border-t-ink animate-spin" /> Applying…</>
                  ) : (
                    <>Apply to roadmap →</>
                  )}
                </button>
              )}
            </div>
              )}
            </div>
          </details>
        </div>
      ) : contextChips.length > 0 && (
        <div className="px-4 py-2 border-b border-white/[0.06] flex items-center gap-2 overflow-x-auto">
          {contextChips.map(c => <Tag key={c}>{c}</Tag>)}
        </div>
      )}

      <div ref={scroller} className="polaris-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4 space-y-4">
        {messages.length === 0 && <EmptyState onPick={send}/>}
        {messages.map(m => <Bubble key={m.id} m={m} initials={studentInitials}/>)}
        {thinking && streaming && <ThinkingIndicator label={thinking} />}
        {routeInfo && !streaming && (
          <div className="text-[10px] font-mono text-paper/45 px-1" title={routeInfo.reason}>
            Routed → {routeInfo.provider} · {routeInfo.model}
          </div>
        )}
      </div>

      {/* Roadmap-aware quick prompts - change with selection, scores, level */}
      <div className="px-4 py-2 border-t border-white/[0.06] flex flex-wrap gap-1.5">
        {quickPrompts.map(q => (
          <button key={q} onClick={() => send(q)} disabled={streaming}
            className="text-[11px] px-2 py-1 rounded-full bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] text-paper/75 hover:text-paper hover:bg-white/[0.10] transition-colors disabled:opacity-50 max-w-full truncate">
            {q}
          </button>
        ))}
      </div>

      <Composer
        value={draft}
        onChange={setDraft}
        onSend={() => send()}
        onStop={stop}
        streaming={streaming}
      />
      {quota && <QuotaModal quota={quota} onClose={() => setQuota(null)} />}
    </aside>
    </>
  );
}

// ─── pieces ─────────────────────────────────────────────────────────────────

/** "Synced with Roadmap · updated Xs ago" with a live pulse. */
function SyncStatusRow({ lastSyncAt, eventCount }: { lastSyncAt: number | null; eventCount: number }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const ago = lastSyncAt ? Math.max(0, Math.round((Date.now() - lastSyncAt) / 1000)) : null;
  const agoLabel =
    ago === null ? "live" :
    ago < 60 ? "just now" :
    ago < 3600 ? `${Math.round(ago / 60)}m ago` :
    `${Math.round(ago / 3600)}h ago`;
  return (
    <div className="flex items-center gap-1.5 text-[10px] font-mono text-paper/55">
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-400 opacity-60 animate-ping" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-400" />
      </span>
      Synced with Roadmap · updated {agoLabel}
      {eventCount > 0 && <span className="ml-auto text-paper/40">{eventCount} event{eventCount === 1 ? "" : "s"}</span>}
    </div>
  );
}

/** Focused-node context card with an animated connection glow. */
function FocusCard({
  node, isSelected, phaseLabel, onClear,
}: {
  node: { title: string; branchCategory: string; status: string; priority: string; progress: number; completionCriteria: string };
  isSelected: boolean;
  phaseLabel: string;
  onClear?: () => void;
}) {
  const r = 14;
  const c = 2 * Math.PI * r;
  return (
    <div className={cn(
      "relative rounded-xl p-[1.5px] overflow-hidden",
      isSelected && "animate-pulse [animation-duration:3s]",
    )}>
      {/* animated gradient border = the "connected glow" */}
      <div className={cn(
        "absolute inset-0",
        isSelected
          ? "bg-gradient-to-r from-polaris-400 via-nova-400 to-aurora-400 opacity-70"
          : "bg-white/[0.10]",
      )} />
      <div className="relative rounded-[10.5px] bg-ink/90 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[9.5px] uppercase tracking-[0.18em] font-bold text-polaris-300 flex items-center gap-1.5">
              {isSelected ? "Focused on this node" : "Current mission"}
              {isSelected && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-polaris-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-polaris-400" />
                </span>
              )}
            </div>
            <div className="text-[12.5px] font-semibold text-paper truncate mt-0.5">{node.title}</div>
            <div className="text-[10px] font-mono text-paper/55 mt-0.5 truncate">
              {node.branchCategory} · {phaseLabel} · {node.status} · {node.priority} priority
            </div>
          </div>
          {/* progress ring */}
          <span className="relative h-9 w-9 shrink-0">
            <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90">
              <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-white/10" />
              <circle
                cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={c} strokeDashoffset={c - (c * node.progress) / 100}
                className="stroke-polaris-400 transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[8.5px] font-mono font-bold text-paper/85">
              {node.progress}%
            </span>
          </span>
          {onClear && (
            <button onClick={onClear} aria-label="Clear focus" className="shrink-0 text-paper/45 hover:text-paper p-1 -mr-1 transition-colors">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ pathLabel, onClose }: { pathLabel: string; onClose: () => void }) {
  return (
    <div className="relative px-3 py-2.5 border-b border-white/10 flex items-center gap-2.5 bg-gradient-to-b from-white/[0.05] to-transparent">
      {/* Top gradient accent so the rail always has a visible top edge */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-polaris-500 via-nova-400 to-aurora-400 opacity-80" />
      <Avatar initials="P" tone="polaris" size={30} />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-paper leading-none">Strategist</div>
        <div className="text-[10.5px] text-paper/60 mt-1 font-mono truncate">grounded · {pathLabel} · live</div>
      </div>
      <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-paper/55 px-1.5 py-0.5 rounded-full bg-aurora-400/15 ring-1 ring-aurora-400/30">
        <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 animate-pulse" /> online
      </span>
      <button onClick={onClose} aria-label="Close" className="text-paper/65 hover:text-paper p-1.5 rounded-md hover:bg-white/10 transition-colors">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12 M18 6L6 18"/></svg>
      </button>
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (q: string) => void }) {
  const seeds = [
    "What's the single highest-leverage thing this week?",
    "Why am I at 41% for MIT?",
    "What am I missing compared to admits?",
  ];
  return (
    <div className="flex flex-col items-stretch gap-3">
      <div className="rounded-2xl p-4 bg-gradient-to-br from-polaris-500/15 via-nova-500/10 to-aurora-500/10 ring-1 ring-inset ring-white/10">
        <div className="flex items-center gap-2 mb-2">
          <span className="h-7 w-7 rounded-lg bg-gradient-to-br from-polaris-500 to-nova-500 inline-flex items-center justify-center text-white text-[11px]">✦</span>
          <div className="font-serif text-[14px] font-bold text-paper leading-none">Hi, I&apos;m your Strategist</div>
        </div>
        <p className="text-[12px] text-paper/70 leading-relaxed">
          I&apos;m grounded in your profile, memory, and the live web. Ask anything about your roadmap, deadlines, or universities.
        </p>
      </div>
      <div className="text-[10.5px] uppercase tracking-[0.18em] text-paper/45 font-medium px-1">Try one of these</div>
      <ul className="space-y-1.5">
        {seeds.map((s) => (
          <li key={s}>
            <button
              onClick={() => onPick(s)}
              className="w-full text-left text-[12.5px] text-paper/80 hover:text-paper px-3 py-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] ring-1 ring-inset ring-white/[0.06] hover:ring-polaris-400/40 transition-all"
            >
              <span className="text-polaris-300 mr-1.5">→</span>{s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ThinkingIndicator({ label }: { label: string }) {
  return (
    <div className="flex gap-2 items-start text-paper/65">
      <Avatar initials="P" tone="polaris" size={22}/>
      <div className="bg-white/[0.04] ring-1 ring-inset ring-white/[0.08] rounded-2xl rounded-tl-sm px-3 py-2 text-[12px] inline-flex items-center gap-2">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full rounded-full bg-polaris-400 opacity-75 animate-ping"/>
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-polaris-300"/>
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function Bubble({ m, initials }: { m: StrategistMessage; initials: string }) {
  if (m.role === "user") {
    return (
      <div className="flex justify-end gap-2">
        <div className="max-w-[80%] bg-polaris-500 text-white rounded-2xl rounded-tr-sm px-3 py-2 text-[13px] leading-relaxed">{m.text}</div>
        <Avatar initials={initials} tone="polaris" size={22}/>
      </div>
    );
  }
  const citationSources: CitationSource[] = (m.sources ?? []).map((s) => ({
    label: s.label,
    uri: s.uri,
    kind: (s.kind as CitationSource["kind"]),
  }));

  return (
    <div className="flex gap-2 items-start animate-fadeUp">
      <Avatar initials="P" tone="polaris" size={22}/>
      <div className="max-w-[88%] space-y-2 min-w-0 flex-1">
        {m.text && (
          <div className="bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] rounded-2xl rounded-tl-sm px-3 py-2.5">
            <MarkdownMessage text={m.text} sources={citationSources} theme="dark" className="text-[13px]" />
          </div>
        )}
        {m.sources && m.sources.length > 0 && (
          <div className="pl-1">
            <div className="text-[9.5px] uppercase tracking-[0.18em] text-paper/40 font-medium mb-1">Sources</div>
            <div className="flex flex-wrap gap-1.5">
              {m.sources.map((s, i) => {
                const isWeb = s.kind === "web";
                const chipCls = cn(
                  "text-[10.5px] inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md ring-1 ring-inset transition-colors max-w-[220px]",
                  isWeb
                    ? "text-polaris-200 bg-polaris-500/10 ring-polaris-400/30 hover:bg-polaris-500/20 hover:text-polaris-100"
                    : s.kind === "roadmap"
                      ? "text-nova-200 bg-nova-500/10 ring-nova-400/30"
                      : "text-paper/65 bg-white/[0.06] ring-white/[0.10]",
                );
                const content = (
                  <>
                    <span className="font-mono text-[9.5px] font-semibold opacity-70">{i + 1}</span>
                    <WebIcon />
                    <span className="truncate">{s.label}</span>
                  </>
                );
                if (isWeb && /^https?:/.test(s.uri)) {
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
        )}
      </div>
    </div>
  );
}

function Composer({ value, onChange, onSend, onStop, streaming }: {
  value: string; onChange: (v: string) => void; onSend: () => void; onStop: () => void; streaming: boolean;
}) {
  return (
    <div className="p-3 border-t border-white/[0.06]">
      <div className="bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] rounded-xl px-2.5 py-2 flex items-end gap-2 focus-within:ring-polaris-400 transition-colors">
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
          rows={1}
          placeholder="Ask anything about your path…"
          className="flex-1 bg-transparent text-[13px] placeholder-paper/40 text-paper outline-none resize-none min-w-0 py-1"
        />
        {streaming
          ? <button onClick={onStop} className="text-[12px] font-medium text-paper/65 hover:text-paper px-2 py-1 transition-colors">Stop</button>
          : <button onClick={onSend} disabled={!value.trim()} aria-label="Send"
              className={cn("h-7 w-7 rounded-md bg-paper text-ink inline-flex items-center justify-center hover:bg-paper-soft transition-colors",
                !value.trim() && "opacity-50")}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z"/>
              </svg>
            </button>}
      </div>
      <div className="mt-1.5 px-1 text-[10.5px] text-paper/45 flex items-center gap-2">
        <span>Grounded in your profile, memory & the live web.</span>
        <span className="ml-auto">⌘ ↩ to send</span>
      </div>
    </div>
  );
}

function WebIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M2 12h20"/>
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z"/>
    </svg>
  );
}

// ─── helpers ────────────────────────────────────────────────────────────────

function loadCachedThread(): StrategistMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StrategistMessage[]) : [];
  } catch { return []; }
}

function withLastAgent(m: StrategistMessage[], fn: (msg: StrategistMessage) => StrategistMessage) {
  if (m.length === 0) return m;
  const last = m[m.length - 1];
  if (last.role !== "agent") return m;
  return [...m.slice(0, -1), fn(last)];
}

async function consumeSse(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  onChunk: (c: StrategistChunk) => void,
) {
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
        try {
          const data = JSON.parse(line.slice(5).trim()) as StrategistChunk;
          onChunk(data);
        } catch { /* ignore malformed line */ }
      }
    }
  }
}

/* ─── Resize handle for the right-side rail ─── */
function RailResizeHandle({
  width, onResize, onResizeStart, onResizeEnd, resizing,
}: {
  width: number;
  onResize: (px: number) => void;
  onResizeStart: () => void;
  onResizeEnd: () => void;
  resizing: boolean;
}) {
  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    onResizeStart();
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    function onMove(ev: PointerEvent) {
      // Dragging LEFT increases width (handle is on the rail's left edge).
      const delta = startX - ev.clientX;
      onResize(startWidth + delta);
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
      onDoubleClick={() => onResize(380)}
      role="separator"
      aria-orientation="vertical"
      title="Drag to resize · double-click to reset"
      className="group absolute top-0 left-0 hidden h-full w-1.5 cursor-col-resize select-none z-20 items-center justify-center xl:flex"
    >
      <span
        className={cn(
          "h-full w-px transition-all duration-200",
          resizing
            ? "bg-polaris-400 w-[2px]"
            : "bg-white/10 group-hover:bg-polaris-400 group-hover:w-[2px]",
        )}
      />
    </div>
  );
}
