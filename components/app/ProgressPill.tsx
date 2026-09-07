"use client";

/**
 * Level and coins, in the top bar.
 *
 * These lived only on /achievements, which meant the economy was invisible
 * unless you went looking for it - and a reward nobody can see rewards nobody.
 * The bar is where a student's eye already goes for their plan and their name,
 * so it is where the number belongs.
 *
 * Kept to two facts and one destination. The level ring fills to progress
 * through the current level and the coin shows the spendable balance; the whole
 * thing is a link to the full surface rather than a menu, because there is
 * nothing here to decide.
 *
 * It renders nothing at all until the data arrives. A skeleton in a top bar
 * flashes on every navigation and reads as breakage, and this is decoration on
 * the critical path, not content.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CoinGlyph } from "./PolarisCoin";

export type ProgressSummary = {
  level: number;
  levelName: string;
  levelPercent: number;
  points: number;
  today: number;
  dailyCap: number;
  coins: number;
};

export function ProgressPill({
  basePath = "",
  demoSummary,
}: {
  basePath?: string;
  /** The demo shell has no session; seeded numbers stand in. */
  demoSummary?: ProgressSummary;
}) {
  const reduce = useReducedMotion();
  const pathname = usePathname();
  const [data, setData] = useState<ProgressSummary | null>(demoSummary ?? null);

  useEffect(() => {
    if (demoSummary) return;
    let alive = true;

    const load = () => {
      fetch("/api/progress/summary", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d) setData(d as ProgressSummary); })
        .catch(() => {});
    };

    load();

    // Points are awarded server-side inside the action that earned them, so
    // the client has no way to know a number changed. Two cheap signals cover
    // it: navigating (a student almost always moves after finishing something)
    // and an explicit event for changes that happen without navigation, like a
    // purchase.
    window.addEventListener("polaris:progressEarned", load);
    return () => {
      alive = false;
      window.removeEventListener("polaris:progressEarned", load);
    };
  }, [demoSummary, pathname]);

  if (!data) return null;

  const capLeft = Math.max(0, data.dailyCap - data.today);
  const title =
    `Level ${data.level} - ${data.levelName} - ${data.points.toLocaleString()} points\n` +
    `${data.today} of ${data.dailyCap} earned today` +
    (capLeft > 0 ? ` (${capLeft} left)` : " (day full)") +
    `\n${data.coins} coins`;

  return (
    <Link
      href={`${basePath}/achievements`}
      title={title}
      aria-label={`Level ${data.level}, ${data.coins} coins. Open achievements.`}
      className="hidden sm:inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-2 pr-2.5 ring-1 ring-inset ring-white/[0.10] transition-all hover:-translate-y-px hover:bg-white/[0.10]"
    >
      <span className="relative inline-grid h-[22px] w-[22px] place-items-center">
        <svg width="22" height="22" viewBox="0 0 24 24" className="-rotate-90" aria-hidden>
          <circle cx="12" cy="12" r="10" fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth="2.4" />
          <motion.circle
            cx="12" cy="12" r="10" fill="none"
            stroke="url(#pp-ring)" strokeWidth="2.4" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 10}
            initial={reduce ? false : { strokeDashoffset: 2 * Math.PI * 10 }}
            animate={{ strokeDashoffset: (2 * Math.PI * 10) * (1 - data.levelPercent / 100) }}
            transition={{ duration: reduce ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
          />
          <defs>
            <linearGradient id="pp-ring" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#C47D4E" />
              <stop offset="100%" stopColor="#8FB89A" />
            </linearGradient>
          </defs>
        </svg>
        <span className="absolute font-mono text-[9.5px] font-bold tabular-nums text-paper">
          {data.level}
        </span>
      </span>

      <span className="h-4 w-px bg-white/[0.12]" aria-hidden />

      <span className="inline-flex items-center gap-1">
        <CoinGlyph size={13} />
        <motion.span
          key={data.coins}
          initial={reduce ? false : { y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.3 }}
          className="font-mono text-[11.5px] font-semibold tabular-nums text-paper"
        >
          {data.coins}
        </motion.span>
      </span>
    </Link>
  );
}
