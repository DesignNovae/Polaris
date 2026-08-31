"use client";

/**
 * Community - topic/country/stage channels with a polling chat pane.
 *
 * Safety surface: per-message report + block menus, server-side link and
 * payment-number guard (errors surface inline), guidelines drawer, and the
 * "peer advice ≠ official counsel" disclaimer pinned to every channel.
 * Open to all plans.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  CHANNELS, CHANNEL_KIND_LABELS, COMMUNITY_GUIDELINES, COMMUNITY_DISCLAIMER,
  getChannel, type Channel, type ChannelKind,
} from "@/lib/community/registry";

type Msg = {
  id: string;
  channel: string;
  userId: string;
  userName: string;
  authorRole: string;
  mine: boolean;
  text: string;
  createdAt: string;
};

const TONE_DOT: Record<Channel["tone"], string> = {
  polaris: "bg-polaris-400",
  aurora:  "bg-aurora-500",
  nova:    "bg-nova-400",
  sky:     "bg-[#5E8CA8]",
  rose:    "bg-signal-rose",
};

export function CommunityClient({
  initialChannel, me, demo = false,
}: {
  initialChannel: string;
  me: { id: string; name: string; role: string };
  demo?: boolean;
}) {
  const [channelId, setChannelId] = useState(getChannel(initialChannel) ? initialChannel : "general");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [guidelinesOpen, setGuidelinesOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

const channel = getChannel(channelId)!;

  /* Load messages*/
  useEffect(() => {
    fetch("/api/community?channel=" + channelId)
      .then((res) => res.json())
      .then((data) => setMessages(data));
  }, [channelId]);

  const grouped = useMemo(() => {
    const out = new Map<ChannelKind, Channel[]>();
    for (const c of CHANNELS) out.set(c.kind, [...(out.get(c.kind) ?? []), c]);
    return [...out.entries()];
  }, []);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  /* Initial load + poll every 5s for new messages. */
  useEffect(() => {
    if (demo) { setLoading(false); setMessages([]); return; }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setLoading(true);
    setMessages([]);

    async function load(after?: string) {
      try {
        const url = `/api/community/messages?channel=${channelId}${after ? `&after=${encodeURIComponent(after)}` : ""}`;
        const r = await fetch(url, { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const d = await r.json();
        const fresh = (d.messages ?? []) as Msg[];
        if (fresh.length) {
          setMessages((cur) => {
            const seen = new Set(cur.map((m) => m.id));
            const merged = [...cur, ...fresh.filter((m) => !seen.has(m.id))];
            return merged.slice(-200);
          });
          scrollToEnd();
        }
      } catch { /* offline blip - next poll retries */ }
    }

    async function cycle() {
      if (cancelled) return;
      const last = lastIsoRef.current;
      await load(last ?? undefined);
      timer = setTimeout(cycle, 5000);
    }

    const lastIsoRef = { current: null as string | null };
    void load().then(() => {
      if (!cancelled) {
        setLoading(false);
        scrollToEnd();
        timer = setTimeout(cycle, 5000);
      }
    });

    // Keep the poll cursor on the newest message we hold.
    const sync = setInterval(() => {
      setMessages((cur) => {
        lastIsoRef.current = cur.length ? cur[cur.length - 1].createdAt : null;
        return cur;
      });
    }, 1000);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      clearInterval(sync);
    };
  }, [channelId, scrollToEnd, demo]);

  async function send() {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setSendErr(null);
    try {
      if (demo) {
        setMessages((items) => [...items, { id: crypto.randomUUID(), channel: channelId, userId: me.id, userName: me.name, authorRole: me.role, mine: true, text: body, createdAt: new Date().toISOString() }]);
        setText("");
        scrollToEnd();
        return;
      }
      const r = await fetch("/api/community/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channel: channelId, text: body }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setSendErr(d?.error ?? "Couldn't send."); return; }
      setMessages((cur) => [...cur, d.message as Msg]);
      setText("");
      scrollToEnd();
    } finally {
      setBusy(false);
    }
  }

  async function moderate(action: "report" | "block", msg: Msg) {
    setMenuFor(null);
    const r = await fetch("/api/community/moderation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        action === "report"
          ? { action, messageId: msg.id, reason: "Reported from chat" }
          : { action, userId: msg.userId },
      ),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setToast(d?.error ?? "Action failed.");
    } else if (action === "block") {
      setMessages((cur) => cur.filter((m) => m.userId !== msg.userId));
      setToast("User blocked - you won't see their messages.");
    } else {
      setToast("Reported. Messages with multiple reports auto-hide for moderation.");
    }
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* ── Channel rail ── */}
      <aside
        className={cn(
          "lg:w-[230px] shrink-0 border-b lg:border-b-0 lg:border-r border-ink/[0.06] dark:border-white/[0.08] bg-paper-soft/40",
          "lg:block", railOpen ? "block" : "hidden lg:block",
        )}
      >
        <div className="p-4 lg:h-full lg:overflow-y-auto scroll-y">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium">Community</div>
          {grouped.map(([kind, list]) => (
            <div key={kind} className="mt-4">
              <div className="text-[10px] uppercase tracking-[0.18em] text-ink-faint font-semibold mb-1.5">
                {CHANNEL_KIND_LABELS[kind]}
              </div>
              <div className="space-y-0.5">
                {list.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setChannelId(c.id); setRailOpen(false); }}
                    className={cn(
                      "w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors",
                      c.id === channelId
                        ? "bg-paper-card text-ink font-semibold shadow-sm ring-1 ring-inset ring-ink/[0.05]"
                        : "text-ink-dim hover:bg-paper-card/60 hover:text-ink",
                    )}
                  >
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", TONE_DOT[c.tone])} />
                    <span className="truncate">{c.name}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button
            onClick={() => setGuidelinesOpen(true)}
            className="mt-6 w-full rounded-xl bg-paper-card ring-1 ring-inset ring-ink/[0.06] px-3 py-2.5 text-left text-[11.5px] text-ink-dim hover:text-ink transition-colors"
          >
            <span className="font-semibold text-ink">Community guidelines</span>
            <span className="block mt-0.5 text-ink-muted">Safety rules &amp; verified badges</span>
          </button>
        </div>
      </aside>

      {/* ── Chat pane ── */}
      <div className="flex-1 min-w-0 flex flex-col min-h-0">
        {/* Channel header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-ink/[0.06] dark:border-white/[0.08] flex items-center gap-3">
          <button
            onClick={() => setRailOpen((v) => !v)}
            className="lg:hidden rounded-lg bg-paper-soft p-2 text-ink-dim"
            aria-label="Channels"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <span className={cn("h-2 w-2 rounded-full", TONE_DOT[channel.tone])} />
          <div className="min-w-0">
            <div className="text-[14.5px] font-bold text-ink leading-tight">{channel.name}</div>
            <div className="text-[11px] text-ink-muted truncate">{channel.blurb}</div>
          </div>
          {channel.kind === "official" && (
            <span className="ml-auto rounded-full bg-polaris-100 dark:bg-polaris-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-polaris-700 dark:text-polaris-100">
              Hosted by Polaris
            </span>
          )}
        </div>

        {/* Disclaimer strip */}
        <div className="px-4 sm:px-6 py-2 bg-paper-soft/60 text-[10.5px] text-ink-muted border-b border-ink/[0.05] dark:border-white/[0.06]">
          {COMMUNITY_DISCLAIMER}
        </div>

        {/* Messages */}
        <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto scroll-y px-4 sm:px-6 py-4 space-y-3">
          {loading ? (
            <div className="space-y-3 pt-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-2.5 animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-paper-soft" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-32 rounded bg-paper-soft" />
                    <div className="h-3 rounded bg-paper-soft" style={{ width: `${55 + i * 10}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="pt-16 text-center">
              <div className="text-[14px] font-semibold text-ink">Quiet in here so far</div>
              <p className="mt-1 text-[12.5px] text-ink-muted">Be the first - introduce yourself or ask a question.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m) => (
                <motion.div
                  key={m.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className={cn("group flex gap-2.5", m.mine && "flex-row-reverse")}
                >
                  <span className={cn(
                    "h-8 w-8 shrink-0 rounded-full inline-flex items-center justify-center text-[11px] font-bold text-white bg-gradient-to-br",
                    m.mine ? "from-polaris-300 to-polaris-500" : "from-[#5E8CA8] to-[#3E647D]",
                  )}>
                    {m.userName.split(/\s+/).slice(0, 2).map((s) => s[0]).join("")}
                  </span>
                  <div className={cn("min-w-0 max-w-[78%]", m.mine && "text-right")}>
                    <div className={cn("flex items-baseline gap-2", m.mine && "flex-row-reverse")}>
                      <span className="text-[12px] font-semibold text-ink truncate">{m.mine ? "You" : m.userName}</span>
                      {m.authorRole === "admin" && (
                        <span className="rounded bg-polaris-100 dark:bg-polaris-400/20 px-1 text-[8.5px] font-bold uppercase tracking-wide text-polaris-700 dark:text-polaris-100">Polaris</span>
                      )}
                      <span className="text-[10px] text-ink-faint">
                        {new Date(m.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className={cn(
                      "mt-1 inline-block rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed text-left",
                      m.mine
                        ? "bg-ink text-paper rounded-br-md"
                        : "bg-paper-card ring-1 ring-inset ring-ink/[0.05] dark:ring-white/[0.08] text-ink rounded-bl-md",
                    )}>
                      {m.text}
                    </div>
                    {!m.mine && (
                      <div className="relative inline-block align-middle ml-1">
                        <button
                          onClick={() => setMenuFor(menuFor === m.id ? null : m.id)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-ink-faint hover:text-ink p-1 transition-all"
                          aria-label="Message actions"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>
                        </button>
                        <AnimatePresence>
                          {menuFor === m.id && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.97 }}
                              className="absolute z-20 left-0 top-full mt-1 w-40 rounded-xl bg-paper-card ring-1 ring-inset ring-ink/[0.08] dark:ring-white/[0.12] shadow-pop overflow-hidden"
                            >
                              <button onClick={() => void moderate("report", m)} className="w-full px-3 py-2 text-left text-[12px] text-ink-dim hover:bg-paper-soft transition-colors">
                                Report message
                              </button>
                              <button onClick={() => void moderate("block", m)} className="w-full px-3 py-2 text-left text-[12px] text-rose-600 dark:text-rose-300 hover:bg-paper-soft transition-colors">
                                Block {m.userName.split(" ")[0]}
                              </button>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Composer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-ink/[0.06] dark:border-white/[0.08]">
          {sendErr && <div className="mb-2 text-[11.5px] text-rose-600 dark:text-rose-300">{sendErr}</div>}
          <div className="flex items-end gap-2">
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setSendErr(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              placeholder={`Message #${channel.name.toLowerCase()} - no links, be kind`}
              rows={1}
              maxLength={800}
              className="flex-1 resize-none rounded-2xl border border-polaris-200 bg-paper-card px-4 py-2.5 text-[13px] text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none dark:border-white/[0.14] max-h-32"
            />
            <button
              onClick={() => void send()}
              disabled={busy || !text.trim()}
              className="h-10 w-10 shrink-0 rounded-full bg-ink text-paper inline-flex items-center justify-center hover:bg-polaris-700 transition-colors disabled:opacity-40"
              aria-label="Send"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4z" /></svg>
            </button>
          </div>
          <div className="mt-1.5 text-[10px] text-ink-faint">
            Signed in as {me.name} · Enter to send · Shift+Enter for a new line
          </div>
        </div>
      </div>

      {/* ── Guidelines drawer ── */}
      <AnimatePresence>
        {guidelinesOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/45 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setGuidelinesOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className="w-full max-w-md rounded-3xl bg-paper-card ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.12] p-6 shadow-pop"
            >
              <div className="font-serif text-[18px] font-bold text-ink">Community guidelines</div>
              <ul className="mt-4 space-y-2.5">
                {COMMUNITY_GUIDELINES.map((g) => (
                  <li key={g} className="flex gap-2.5 text-[12.5px] text-ink-dim leading-relaxed">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-polaris-400 shrink-0" />
                    {g}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setGuidelinesOpen(false)}
                className="mt-5 w-full rounded-full bg-ink text-paper py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
