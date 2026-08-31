"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { EducationLevel } from "@/lib/roadmap/types";
import { cn } from "@/lib/cn";

type LiveOffer = {
  id: string;
  title: string;
  provider: string;
  summary: string;
  eligibility: string;
  matchReason: string;
  sourceUrl: string;
  sourceLabel: string;
};

type RefreshResponse = {
  offers?: LiveOffer[];
  checkedAt?: string;
  message?: string;
  source?: "gemma4-live-web" | "no-search-results" | "gemma-unavailable";
  model?: string;
  error?: string;
};

const CACHE_KEY = "polaris.partners.live-refresh";

export function GemmaOfferRefresh({
  level,
  roadmapTopics,
  weakScores,
  deadlineTypesSoon,
}: {
  level: EducationLevel;
  roadmapTopics: string[];
  weakScores: Array<{ key: string; label: string; ratio: number }>;
  deadlineTypesSoon: string[];
}) {
  const [offers, setOffers] = useState<LiveOffer[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    "Check live official sources for new student benefits matched to this roadmap.",
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return;
      const parsed = JSON.parse(cached) as RefreshResponse;
      setOffers(parsed.offers ?? []);
      setCheckedAt(parsed.checkedAt ?? null);
      setMessage(parsed.message ?? message);
      setModel(parsed.model ?? null);
    } catch {
      // A corrupt optional cache must never block the marketplace.
    }
    // This cache is intentionally read only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4800);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function refresh() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await fetch("/api/partner-offers/refresh", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          level,
          roadmapTopics,
          weakScores,
          deadlineTypesSoon,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as RefreshResponse;
      if (!response.ok) throw new Error(data.error || "Offer refresh is temporarily unavailable.");

      const nextOffers = data.offers ?? [];
      setOffers(nextOffers);
      setCheckedAt(data.checkedAt ?? new Date().toISOString());
      setMessage(data.message ?? "Live offer check complete.");
      setModel(data.model ?? null);
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      } catch {
        // Private browsing may disable local storage.
      }
      setNotice(
        nextOffers.length
          ? `Polaris found ${nextOffers.length} verified offer update${nextOffers.length === 1 ? "" : "s"}.`
          : "Polaris checked the live sources. No new verified offer was added.",
      );
    } catch (reason) {
      const text = reason instanceof Error ? reason.message : "Offer refresh is temporarily unavailable.";
      setMessage(text);
      setNotice(text);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="mb-5 overflow-hidden rounded-2xl border border-polaris-500/20 bg-gradient-to-br from-polaris-500/[0.10] via-paper-card to-aurora-500/[0.07] shadow-soft">
        <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <span className="relative mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-paper shadow-sm">
              <span className="absolute inset-0 rounded-xl bg-gradient-to-br from-polaris-400/40 to-aurora-400/20" />
              <svg className="relative" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 2l2.15 7.85L22 12l-7.85 2.15L12 22l-2.15-7.85L2 12l7.85-2.15L12 2z" />
              </svg>
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-serif text-[17px] font-bold text-ink">Live student offer radar</h2>
                <span className="rounded-full bg-aurora-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-aurora-700 ring-1 ring-inset ring-aurora-500/25 dark:text-aurora-200">
                  Polaris AI + live web
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-ink-dim">{message}</p>
              {checkedAt && (
                <p className="mt-1 text-[9.5px] font-mono text-ink-muted">
                  Last checked {new Date(checkedAt).toLocaleString()} {model ? `· ${model}` : ""}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={busy}
            className={cn(
              "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-[12px] font-semibold shadow-sm transition-all",
              "bg-ink text-paper hover:-translate-y-0.5 hover:shadow-md disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0",
            )}
          >
            {busy ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-paper/30 border-t-paper" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M20 11a8.1 8.1 0 0 0-15.5-2M4 4v5h5M4 13a8.1 8.1 0 0 0 15.5 2M20 20v-5h-5" />
              </svg>
            )}
            {busy ? "Polaris is checking sources..." : "Refresh offers with Polaris"}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {offers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-polaris-500/15"
            >
              <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
                {offers.map((offer, index) => (
                  <motion.a
                    key={offer.id}
                    href={offer.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.06 }}
                    className="group rounded-xl border border-ink-faint/15 bg-paper-card/80 p-3.5 transition-all hover:-translate-y-0.5 hover:border-polaris-500/35 hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div data-no-translate className="truncate text-[10px] font-semibold uppercase tracking-wider text-polaris-600 dark:text-polaris-300">
                          {offer.provider}
                        </div>
                        <h3 data-no-translate className="mt-0.5 line-clamp-2 text-[13px] font-bold leading-snug text-ink">
                          {offer.title}
                        </h3>
                      </div>
                      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-aurora-500/10 text-aurora-700 ring-1 ring-inset ring-aurora-500/25 dark:text-aurora-200">
                        ↗
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-3 text-[11px] leading-relaxed text-ink-dim">{offer.summary}</p>
                    <div className="mt-3 rounded-lg bg-polaris-500/[0.07] px-2.5 py-2 text-[10px] leading-relaxed text-ink-dim">
                      <span className="font-semibold text-ink">Why it matches:</span> {offer.matchReason}
                    </div>
                    <div className="mt-2 flex items-center gap-1.5 text-[9.5px] text-ink-muted">
                      <span className="h-1.5 w-1.5 rounded-full bg-aurora-500" />
                      Official source checked: {offer.sourceLabel}
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {notice && (
          <motion.div
            role="status"
            aria-live="polite"
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            className="fixed bottom-6 left-1/2 z-[80] max-w-[92vw] -translate-x-1/2 rounded-full bg-ink px-5 py-3 text-center text-[12px] font-medium text-paper shadow-pop ring-1 ring-inset ring-white/15"
          >
            {notice}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
