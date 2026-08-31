"use client";

/**
 * Integrations - a data-flow scene: real brand tiles (GitHub, Google
 * Calendar, Drive, Codeforces) stream progress into the Polaris core along
 * animated dashed lines; coming-soon tools sit dimmed at the edges. The
 * privacy promise is stated explicitly, matching the real Connections hub.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { BrandLogo, BRAND_META, type BrandKey } from "@/components/app/BrandLogos";
import {
  SectionIntro, Accent, Dot, Reveal, FloatWrap, glassDark,
  GShield, NorthStarMark,
} from "./shared";

/** Active tools - positions are % of the scene; the SVG paths match them. */
const ACTIVE: { key: BrandKey; left: number; top: number; feeds: string }[] = [
  { key: "github",     left: 8,  top: 16, feeds: "repos & commits" },
  { key: "codeforces", left: 86, top: 14, feeds: "rating & solves" },
  { key: "gcal",       left: 6,  top: 72, feeds: "study schedule" },
  { key: "gdrive",     left: 88, top: 70, feeds: "essays & docs" },
];

const COMING: BrandKey[] = ["notion", "linkedin", "khan", "youtube"];

/** Dashed flow lines from each tool into the center (scene is 700×360). */
const FLOWS = [
  "M92 78 C220 110 280 150 340 172",
  "M610 72 C490 105 420 145 366 170",
  "M82 268 C210 240 290 205 340 188",
  "M624 262 C500 235 425 203 368 186",
];

export function IntegrationsOrbitPreview() {
  const reduce = useReducedMotion();

  return (
    <section
      id="connections-section"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 50% at 50% 45%, rgba(94,140,168,0.12), transparent 65%)" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          onDark
          eyebrow="Connections"
          title={<>Connect the tools that <Accent>already show your progress</Accent><Dot /></>}
          sub="GitHub commits, Codeforces ratings, calendar blocks, and essay drafts become roadmap signals - imported only when you say so."
        />

        {/* ── Data-flow scene ── */}
        <div className="relative mt-14 mx-auto max-w-3xl">
          <svg viewBox="0 0 700 360" className="w-full h-auto" aria-hidden>
            {FLOWS.map((d, i) => (
              <g key={i}>
                <motion.path
                  d={d}
                  fill="none" stroke="rgba(125,182,224,0.3)" strokeWidth="1.5" strokeDasharray="5 7"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.1, delay: 0.3 + i * 0.15 }}
                />
                {!reduce && (
                  <motion.circle
                    r="3" fill="#7DB6E0"
                    style={{ offsetPath: `path("${d}")` }}
                    animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut", delay: 1 + i * 0.6 }}
                  />
                )}
              </g>
            ))}
          </svg>

          {/* Core */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              aria-hidden
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-28 w-28 rounded-full"
              style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.32), transparent 70%)" }}
              animate={reduce ? undefined : { scale: [1, 1.3, 1], opacity: [0.7, 0.35, 0.7] }}
              transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="relative flex h-16 w-16 sm:h-[72px] sm:w-[72px] items-center justify-center rounded-full bg-gradient-to-br from-polaris-400 via-polaris-500 to-aurora-600 text-paper shadow-[0_18px_50px_-12px_rgba(0,0,0,0.6)] ring-2 ring-white/15">
              <NorthStarMark s={28} />
            </div>
          </div>

          {/* Active tool tiles */}
          {ACTIVE.map((t, i) => (
            <div key={t.key} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${t.left + 5}%`, top: `${t.top + 4}%` }}>
              <FloatWrap amplitude={5} duration={6 + i * 0.7} delay={i * 0.5}>
                <motion.div
                  className="flex flex-col items-center gap-1.5"
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 240, damping: 17 }}
                >
                  <span className="flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-white text-ink shadow-[0_14px_36px_-12px_rgba(0,0,0,0.6)]">
                    <BrandLogo brand={t.key} width={26} height={26} style={{ color: BRAND_META[t.key].color }} />
                  </span>
                  <span className="hidden sm:block rounded-full bg-white/[0.07] px-2.5 py-0.5 text-[10.5px] text-paper/65 whitespace-nowrap">
                    {t.feeds}
                  </span>
                </motion.div>
              </FloatWrap>
            </div>
          ))}
        </div>

        {/* Coming soon row */}
        <Reveal delay={0.2}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <span className="text-[11px] uppercase tracking-[0.22em] text-paper/40">Coming soon</span>
            {COMING.map((k) => (
              <span
                key={k}
                className="flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[12px] text-paper/45"
              >
                <BrandLogo brand={k} width={14} height={14} className="opacity-60" />
                {BRAND_META[k].name}
              </span>
            ))}
          </div>
        </Reveal>

        {/* Privacy promise */}
        <Reveal delay={0.3}>
          <div className={cn(glassDark, "mt-10 mx-auto max-w-xl p-4 flex items-center gap-3.5")}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-aurora-500/20 text-aurora-300">
              <GShield s={19} />
            </span>
            <p className="text-[13px] leading-relaxed text-paper/70">
              <span className="font-semibold text-paper">Explicit permission only.</span>{" "}
              You choose what each tool shares, see exactly what was imported,
              and can disconnect - and wipe the data - anytime.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
