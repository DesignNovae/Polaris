"use client";

/**
 * StrategistLocked - the premium upgrade screen Free users see instead of
 * the working Strategist chat (page variant), plus a compact rail variant
 * for the right-hand AgentChat column. Both surfaces tell the truth about
 * what Pro unlocks and route to /billing.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

const UNLOCKS = [
  "AI roadmap guidance synced with your tree",
  "Score analysis - SAT/IELTS gaps turned into tasks",
  "Deadline-aware recommendations",
  "Profile gap analysis",
  "Personalized next steps, every session",
];

function StarMark({ s = 26 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z" />
    </svg>
  );
}

export function StrategistLockedPage() {
  const reduce = useReducedMotion();
  return (
    <div className="relative min-h-full flex items-center justify-center px-6 py-16 overflow-hidden">
      {/* Aura */}
      <motion.div
        aria-hidden
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[60vh] w-[70vw] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.14), transparent 70%)" }}
        animate={reduce ? undefined : { scale: [1, 1.15, 1], opacity: [0.8, 0.5, 0.8] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg rounded-3xl bg-paper-card ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.12] shadow-pop p-8 sm:p-10 text-center"
      >
        <div className="relative inline-flex">
          {!reduce && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-2xl"
              style={{ boxShadow: "0 0 44px 4px rgba(196,125,78,0.4)" }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <span className="relative inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-polaris-400 via-polaris-500 to-aurora-600 text-white">
            <StarMark />
          </span>
        </div>

        <h1 className="mt-6 font-serif text-[26px] font-bold tracking-tight text-ink">
          The AI Strategist is on <span className="grad-text">Pro &amp; Elite</span>
        </h1>
        <p className="mt-2 text-[13.5px] text-ink-dim leading-relaxed">
          Your roadmap, deadlines, universities, and community stay free.
          Upgrade when you want an AI strategist that reads all of it and tells
          you what to do next.
        </p>

        <ul className="mt-6 space-y-2.5 text-left">
          {UNLOCKS.map((u, i) => (
            <motion.li
              key={u}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.25 + i * 0.08, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-start gap-2.5 text-[13px] text-ink-dim"
            >
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-aurora-100 text-aurora-600 dark:bg-aurora-400/15 dark:text-aurora-200">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              {u}
            </motion.li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-2.5">
          <Link
            href="/billing"
            className="w-full sm:w-auto rounded-full bg-ink text-paper px-6 py-3 text-[13.5px] font-semibold hover:bg-polaris-700 transition-colors"
          >
            Upgrade to Pro - $5/mo
          </Link>
          <Link
            href="/consultants"
            className="w-full sm:w-auto rounded-full bg-paper-soft text-ink px-5 py-3 text-[13px] font-medium ring-1 ring-inset ring-ink/10 hover:bg-paper-deep transition-colors"
          >
            Or talk to a human consultant
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-ink-muted">
          No lock-in - monthly plans cancel anytime from Billing.
        </p>
      </motion.div>
    </div>
  );
}

/** Compact variant for the right-hand rail column (desktop xl+). */
export function StrategistLockedRail({ className }: { className?: string }) {
  return (
    <aside
      className={cn(
        "app-glass-dark shrink-0 border-l border-white/[0.06] hidden xl:flex w-[300px] flex-col text-paper",
        className,
      )}
    >
      <div className="px-4 py-4 border-b border-white/10 text-[12.5px] font-bold">Strategist</div>
      <div className="flex-1 flex flex-col items-center justify-center px-5 text-center">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-polaris-400 to-aurora-600 text-white">
          <StarMark s={20} />
        </span>
        <div className="mt-3 text-[13.5px] font-bold">Pro &amp; Elite feature</div>
        <p className="mt-1.5 text-[11.5px] text-paper/60 leading-relaxed">
          The AI Strategist reads your roadmap, scores, and deadlines - then
          tells you what to do next.
        </p>
        <Link
          href="/billing"
          className="mt-4 rounded-full bg-paper text-ink px-4 py-2 text-[12px] font-semibold hover:bg-paper-soft transition-colors"
        >
          Upgrade to Pro
        </Link>
        <Link href="/consultants" className="mt-2 text-[11px] text-paper/50 hover:text-paper/80 transition-colors underline underline-offset-2">
          or book a human consultant
        </Link>
      </div>
      <div className="px-4 py-3 border-t border-white/[0.06] text-[10px] text-paper/40">
        Everything else in Polaris stays free.
      </div>
    </aside>
  );
}
