"use client";

/**
 * "What's new" ribbon.
 *
 * The cheapest way to make continuous shipping visible to people who are not
 * watching the repository. Shows the single highlighted changelog entry, and
 * remembers its dismissal by entry id - so shipping the next thing brings the
 * ribbon back, while dismissing this one keeps it gone.
 *
 * Rendered under the fixed Nav and above the hero. It reserves no layout space
 * until it decides to show, so it can never push the hero down on first paint.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { highlightedEntry } from "@/lib/changelog";
import { GArrow } from "./shared";

const STORAGE_KEY = "polaris.whatsNewDismissed";

export function WhatsNewRibbon() {
  const entry = highlightedEntry();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!entry) return;
    try {
      // Storage can throw outright in some privacy modes - never let that
      // stop the page rendering.
      if (window.localStorage.getItem(STORAGE_KEY) !== entry.id) setShow(true);
    } catch {
      setShow(true);
    }
  }, [entry]);

  function dismiss() {
    setShow(false);
    try {
      if (entry) window.localStorage.setItem(STORAGE_KEY, entry.id);
    } catch {
      // Dismissal simply won't persist. Acceptable.
    }
  }

  if (!entry) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-0 top-[76px] z-40 flex justify-center px-4"
        >
          <div className="flex max-w-[92vw] items-center gap-2.5 rounded-full border border-white/[0.14] bg-[#241510]/90 py-1.5 pl-3 pr-1.5 text-paper shadow-[0_14px_40px_-16px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:gap-3 sm:pl-4">
            <span className="shrink-0 rounded-full bg-polaris-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink">
              New
            </span>
            <Link
              href={entry.href ?? "/changelog"}
              className="group flex min-w-0 items-center gap-1.5 text-[12.5px] font-medium text-paper/90 hover:text-paper"
            >
              <span className="truncate">{entry.title}</span>
              <span className="hidden shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 sm:inline">
                <GArrow s={11} />
              </span>
            </Link>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-paper/50 transition-colors hover:bg-white/[0.10] hover:text-paper"
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M1 1l10 10M11 1L1 11" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
