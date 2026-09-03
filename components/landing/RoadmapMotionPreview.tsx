"use client";

/**
 * Roadmap section - a glowing skill tree that grows in as you scroll, with a
 * progress pulse traveling the trunk. Copy stays minimal; the level/timeline
 * chips and the score-adaptation card carry the "it adapts to you" story.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { SectionIntro, Accent, Dot, Reveal, glassDark, GCheck } from "./shared";

export function RoadmapMotionPreview() {
  return (
    <section
      id="roadmap-section"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 65% 55% at 70% 45%, rgba(91,140,109,0.13), transparent 65%), radial-gradient(ellipse 50% 40% at 15% 80%, rgba(196,125,78,0.12), transparent 60%)" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-12 lg:gap-10 items-center">
          {/* ── Copy ── */}
          <div>
            <SectionIntro
              align="left"
              onDark
              eyebrow="The roadmap"
              title={<>A roadmap that changes with your <Accent>level, timeline, and goals</Accent><Dot /></>}
              sub="Not a static checklist - a living plan that knows where you are and how long you have."
            />

            <div className="mt-8 space-y-4">
              <AdaptRow
                k="Level-aware"
                v="A Class 5 explorer gets curiosity tracks. An HSC candidate gets an admission sprint. Younger students never see test-prep pressure."
              />
              <AdaptRow
                k="Timeline-aware"
                v="A 15-day sprint is planned differently from a one-year campaign - same goal, different pacing and milestones."
              />
              <AdaptRow
                k="Score-adaptive"
                v="Update a SAT or IELTS score and the branches rebalance: weak areas grow practice tasks, strong ones advance."
              />
            </div>

            {/* Score adaptation event card */}
            <Reveal delay={0.15}>
              <div className={cn(glassDark, "mt-8 p-4 flex items-center gap-3.5")}>
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-400 opacity-60 animate-ping" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-aurora-400" />
                </span>
                <div className="text-[13px] leading-snug">
                  <span className="text-paper/55">Score updated:</span>{" "}
                  <span className="font-semibold text-paper">SAT 1210</span>{" "}
                  <span className="text-paper/55">→ practice branch rebalanced, 3 tasks moved up</span>
                </div>
              </div>
            </Reveal>
          </div>

          {/* ── Tree scene ── */}
          <Reveal className="relative">
            <GrowingTree />
            {/* Level / timeline chips floating over the scene */}
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              {["Class 5 - exploration", "SSC - foundations", "HSC / A-Level - admission sprint"].map((c, i) => (
                <motion.span
                  key={c}
                  className="rounded-full border border-white/12 bg-white/[0.05] backdrop-blur-md px-3.5 py-1.5 text-[12px] text-paper/80"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.12, duration: 0.5 }}
                >
                  {c}
                </motion.span>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap justify-center gap-2.5">
              {["15-day sprint", "6-month plan", "1-year campaign"].map((c, i) => (
                <motion.span
                  key={c}
                  className="rounded-full bg-polaris-400/15 ring-1 ring-inset ring-polaris-400/30 px-3.5 py-1.5 text-[12px] text-nova-300"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.55 + i * 0.12, duration: 0.5 }}
                >
                  {c}
                </motion.span>
              ))}
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ─── Adaptation rows (icon + text, no boxes) ──────────────────────────── */

function AdaptRow({ k, v }: { k: string; v: string }) {
  return (
    <Reveal>
      <div className="flex gap-3.5">
        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aurora-500/20 text-aurora-300">
          <GCheck s={13} />
        </span>
        <div>
          <span className="font-semibold text-paper text-[14.5px]">{k}.</span>{" "}
          <span className="text-[14px] text-paper/65 leading-relaxed">{v}</span>
        </div>
      </div>
    </Reveal>
  );
}

/* ─── The tree - branches draw on scroll, leaves glow, pulse travels ───── */

const TRUNK = "M210 360 C210 300 200 260 205 215 C209 180 215 150 213 110";
const BRANCHES = [
  { d: "M207 250 C160 225 120 215 78 218",   leaf: { x: 78,  y: 218 }, done: true,  label: "IELTS 7.0" },
  { d: "M206 230 C250 200 290 190 330 196",  leaf: { x: 330, y: 196 }, done: true,  label: "SAT English" },
  { d: "M209 180 C165 155 135 140 105 120",  leaf: { x: 105, y: 120 }, done: false, label: "Essay draft" },
  { d: "M212 160 C255 135 285 122 318 108",  leaf: { x: 318, y: 108 }, done: false, label: "Olympiad" },
  { d: "M213 110 C212 85 213 65 214 42",     leaf: { x: 214, y: 42 },  done: false, label: "Application" },
  { d: "M208 300 C170 290 140 290 112 300",  leaf: { x: 112, y: 300 }, done: true,  label: "Profile" },
  { d: "M209 290 C252 278 282 278 308 288",  leaf: { x: 308, y: 288 }, done: true,  label: "Shortlist" },
];

function GrowingTree() {
  const reduce = useReducedMotion();
  return (
    <div className="relative mx-auto max-w-[460px]">
      {/* Glow bed behind the tree */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[40px]"
        style={{ background: "radial-gradient(ellipse 60% 55% at 50% 45%, rgba(107,158,123,0.14), transparent 70%)" }}
      />
      <svg viewBox="0 0 420 400" className="relative w-full h-auto" aria-hidden>
        <defs>
          <linearGradient id="trunkGrad" x1="0%" y1="100%" x2="0%" y2="0%">
            <stop offset="0%" stopColor="#C47D4E" />
            <stop offset="100%" stopColor="#6B9E7B" />
          </linearGradient>
          <filter id="leafGlow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge>
              <feMergeNode in="b" /><feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Trunk */}
        <motion.path
          d={TRUNK}
          fill="none" stroke="url(#trunkGrad)" strokeWidth="3" strokeLinecap="round"
          initial={{ pathLength: 0 }}
          whileInView={{ pathLength: 1 }}
          viewport={{ once: true, margin: "-20%" }}
          transition={{ duration: 1.4, ease: "easeInOut" }}
        />

        {/* Branches */}
        {BRANCHES.map((b, i) => (
          <motion.path
            key={i}
            d={b.d}
            fill="none"
            stroke={b.done ? "rgba(143,184,154,0.8)" : "rgba(196,125,78,0.55)"}
            strokeWidth="1.8" strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-20%" }}
            transition={{ duration: 0.9, delay: 0.5 + i * 0.16, ease: "easeOut" }}
          />
        ))}

        {/* Leaves */}
        {BRANCHES.map((b, i) => (
          <g key={`leaf-${i}`}>
            {b.done && !reduce && (
              /* Animated `r` needs a numeric `initial`, not the r="10"
                 attribute - see the same fix in LandingHero's MiniTree. */
              <motion.circle
                cx={b.leaf.x} cy={b.leaf.y}
                fill="none" stroke="#8FB89A" strokeWidth="1"
                initial={{ r: 7, opacity: 0.45 }}
                animate={{ r: [7, 13, 7], opacity: [0.45, 0.05, 0.45] }}
                transition={{ duration: 3.2, delay: i * 0.4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <motion.circle
              cx={b.leaf.x} cy={b.leaf.y} r="5.5"
              fill={b.done ? "#5B8C6D" : "#33231b"}
              stroke={b.done ? "#8FB89A" : "rgba(255,255,255,0.3)"} strokeWidth="1.4"
              filter={b.done ? "url(#leafGlow)" : undefined}
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ delay: 1.1 + i * 0.16, type: "spring", stiffness: 280, damping: 16 }}
            />
            <motion.text
              x={b.leaf.x} y={b.leaf.y - 13}
              textAnchor="middle"
              fontSize="10.5" fontWeight="600"
              fill={b.done ? "#B7D4BE" : "rgba(250,246,240,0.55)"}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true, margin: "-20%" }}
              transition={{ delay: 1.3 + i * 0.16, duration: 0.5 }}
            >
              {b.label}
            </motion.text>
          </g>
        ))}

        {/* Root node */}
        <circle cx="210" cy="360" r="7" fill="#C47D4E" />
        <circle cx="210" cy="360" r="11" fill="none" stroke="#C47D4E" strokeWidth="1" opacity="0.35" />

        {/* Progress pulse traveling the trunk */}
        {!reduce && (
          <motion.circle
            r="4" fill="#F0D8BF"
            filter="url(#leafGlow)"
            initial={{ offsetDistance: "0%" }}
            animate={{ offsetDistance: ["0%", "100%"] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut", delay: 1.6, repeatDelay: 1.2 }}
            style={{ offsetPath: `path("${TRUNK}")` }}
          />
        )}
      </svg>
    </div>
  );
}

