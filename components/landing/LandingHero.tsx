"use client";

/**
 * Hero - cinematic dark opener.
 *
 * Layers (back to front): drifting warm light waves → star field →
 * perspective grid floor → headline + CTAs → floating 3D product mockup
 * (mouse-tilt glass browser showing the real app: roadmap tree, strategist
 * reply, fit ring, deadline countdown) with satellite insight cards.
 */

import Link from "next/link";
import { useSession } from "next-auth/react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  Eyebrow, Accent, Dot, FloatWrap, StarField, useTilt,
  GFlame, GArrow, NorthStarMark,
} from "./shared";

export function LandingHero() {
  const { data: session } = useSession();
  const reduce = useReducedMotion();

  return (
    <section
      id="home"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper min-h-screen flex flex-col"
    >
      {/* ── Background layers ── */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Drifting light waves */}
        <motion.div
          className="absolute -top-[20%] left-[8%] h-[60vh] w-[60vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.20), transparent 70%)" }}
          animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 30, 0] }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-[30%] right-[-10%] h-[55vh] w-[50vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(91,140,109,0.13), transparent 70%)" }}
          animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -36, 0] }}
          transition={{ duration: 26, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div
          className="absolute bottom-[-15%] left-[30%] h-[45vh] w-[45vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(184,84,106,0.10), transparent 70%)" }}
          animate={reduce ? undefined : { x: [0, 40, 0] }}
          transition={{ duration: 30, repeat: Infinity, ease: "easeInOut", delay: 6 }}
        />
        <StarField count={26} />
        {/* Perspective grid floor */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-[55%] opacity-40"
          style={{
            background: `
              linear-gradient(to top, #2C1810 5%, transparent 60%),
              repeating-linear-gradient(0deg, rgba(196,125,78,0.16) 0 1px, transparent 1px 56px),
              repeating-linear-gradient(90deg, rgba(196,125,78,0.16) 0 1px, transparent 1px 56px)
            `,
            transform: "perspective(900px) rotateX(60deg)",
            transformOrigin: "bottom",
          }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative mx-auto w-full max-w-7xl px-6 pt-28 sm:pt-32 pb-10 flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 lg:gap-8 items-center">
          {/* Left - message */}
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Eyebrow onDark>Polaris academic strategy</Eyebrow>
            </motion.div>

            <motion.h1
              className="mt-7 text-balance font-sans text-[40px] sm:text-6xl lg:text-[64px] xl:text-[72px] font-bold leading-[1.05] tracking-tight text-paper"
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              Turn your dream university into a <Accent>living roadmap</Accent>
              <Dot />
            </motion.h1>

            <motion.p
              className="mt-6 mx-auto lg:mx-0 max-w-xl text-base sm:text-lg text-paper/70 leading-relaxed"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              Polaris builds a personalized admission roadmap from your education
              level, scores, deadlines, and target universities - then keeps
              adapting as you improve.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-3"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link
                href={session ? "/roadmap" : "/demo"}
                className="group relative inline-flex items-center gap-2 rounded-full bg-paper px-6 py-3.5 text-[14px] font-semibold text-ink hover:bg-paper-soft transition-colors shadow-[0_12px_40px_-12px_rgba(250,246,240,0.45)]"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-500 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-500" />
                </span>
                {session ? "Open your roadmap" : "Try the live Polaris demo"}
                <span className="transition-transform duration-200 group-hover:translate-x-1"><GArrow /></span>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-5 py-3.5 text-[13.5px] font-medium text-paper hover:bg-white/15 transition-colors"
              >
                See the product
              </Link>
            </motion.div>

            <motion.div
              className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-x-5 gap-y-2 text-[12.5px] text-paper/50"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.4 }}
            >
              <span>Free plan, no card required</span>
              <span className="hidden sm:inline h-1 w-1 rounded-full bg-paper/30" />
              <span>EN / বাংলা</span>
              <span className="hidden sm:inline h-1 w-1 rounded-full bg-paper/30" />
              <span>Built for every level, Class 5 to HSC</span>
            </motion.div>
          </div>

          {/* Right - floating product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 36, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 1, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <HeroProductMockup />
          </motion.div>
        </div>
      </div>

      {/* Scroll cue */}
      <div className="relative pb-7 flex flex-col items-center gap-2.5 text-[11px] uppercase tracking-[0.32em] text-paper/50">
        <span>scroll</span>
        <motion.span
          aria-hidden
          className="block h-9 w-px bg-paper/30 origin-top"
          animate={{ scaleY: [0.3, 1, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Floating product mockup - glass browser with live app vignettes
   ═══════════════════════════════════════════════════════════════════════════ */

function HeroProductMockup() {
  const tilt = useTilt(6);

  return (
    <div className="relative mx-auto max-w-[560px]" style={{ perspective: 1100 }}>
      <FloatWrap amplitude={6} duration={7}>
        <motion.div
          onMouseMove={tilt.onMouseMove}
          onMouseLeave={tilt.onMouseLeave}
          style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: "preserve-3d" }}
          className="relative rounded-2xl border border-white/12 bg-[#241510]/85 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_40px_120px_-30px_rgba(0,0,0,0.75)]"
        >
          {/* Browser chrome */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07]">
            <span className="h-2.5 w-2.5 rounded-full bg-[#E0655A]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#E8C757]/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#6B9E7B]/80" />
            <div className="ml-3 flex-1 max-w-[240px] rounded-full bg-white/[0.06] px-3 py-1 text-[10.5px] text-paper/45 truncate">
              polaris.app/roadmap
            </div>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-3 p-4">
            {/* Mini roadmap tree */}
            <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 overflow-hidden">
              <div className="text-[10px] uppercase tracking-[0.2em] text-paper/40 mb-2">Roadmap</div>
              <MiniTree />
              <div className="mt-2.5 flex items-center justify-between text-[10.5px]">
                <span className="text-paper/50">Admission sprint - week 6 of 24</span>
                <span className="text-aurora-300 font-medium">62%</span>
              </div>
              <div className="mt-1.5 h-1 rounded-full bg-white/[0.07] overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-polaris-400 to-aurora-400"
                  initial={{ width: 0 }}
                  animate={{ width: "62%" }}
                  transition={{ duration: 1.6, delay: 0.9, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
            </div>

            {/* Right column - strategist + fit + deadline */}
            <div className="flex flex-col gap-3">
              <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] text-paper/40 mb-2">
                  <span className="text-nova-300"><NorthStarMark s={11} /></span> Strategist
                </div>
                <div className="rounded-lg rounded-bl-sm bg-white/[0.07] px-2.5 py-2 text-[10.5px] leading-snug text-paper/80">
                  Your SAT math is 60 below target - I moved two practice blocks
                  into this week.
                </div>
                <div className="mt-2 flex gap-1 pl-1">
                  <span className="typing-dot h-1 w-1 rounded-full bg-paper/60" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-paper/60" />
                  <span className="typing-dot h-1 w-1 rounded-full bg-paper/60" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FitRingCard />
                <DeadlineCard />
              </div>
            </div>
          </div>

          {/* Edge glow */}
          <div
            aria-hidden
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{ boxShadow: "0 0 60px -18px rgba(196,125,78,0.45)" }}
          />
        </motion.div>
      </FloatWrap>

      {/* Satellite cards - float at different phases for depth */}
      <FloatWrap
        amplitude={9}
        duration={6}
        delay={0.6}
        className="absolute -left-4 sm:-left-10 top-[16%] z-10 hidden sm:block"
      >
        <SatelliteChip tone="rose" label="Deadline risk" value="Scholarship closes in 9d" />
      </FloatWrap>
      <FloatWrap
        amplitude={8}
        duration={7.5}
        delay={1.4}
        className="absolute -right-3 sm:-right-8 top-[44%] z-10 hidden sm:block"
      >
        <SatelliteChip tone="aurora" label="Score adapted" value="SAT 1210 → plan rebalanced" />
      </FloatWrap>
      <FloatWrap
        amplitude={7}
        duration={6.8}
        delay={2.2}
        className="absolute left-[12%] -bottom-5 z-10 hidden sm:block"
      >
        <SatelliteChip tone="nova" icon={<GFlame s={13} />} label="Day streak" value="14 days" />
      </FloatWrap>
    </div>
  );
}

function SatelliteChip({
  tone, label, value, icon,
}: {
  tone: "rose" | "aurora" | "nova";
  label: string; value: string; icon?: React.ReactNode;
}) {
  const dot = {
    rose: "bg-rose-300",
    aurora: "bg-aurora-300",
    nova: "bg-nova-300",
  }[tone];
  const text = {
    rose: "text-rose-300",
    aurora: "text-aurora-300",
    nova: "text-nova-300",
  }[tone];
  return (
    <div className="rounded-2xl border border-white/12 bg-[#241510]/90 backdrop-blur-xl px-3.5 py-2.5 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.7)]">
      <div className={cn("flex items-center gap-1.5 text-[9.5px] uppercase tracking-[0.18em] font-semibold", text)}>
        {icon ?? <span className={cn("h-1.5 w-1.5 rounded-full pulse-dot", dot)} />}
        {label}
      </div>
      <div className="mt-1 text-[12px] font-medium text-paper/90 whitespace-nowrap">{value}</div>
    </div>
  );
}

/* Mini skill tree - paths draw in, leaves pulse */
function MiniTree() {
  const leaves = [
    { cx: 30, cy: 18, done: true },
    { cx: 74, cy: 12, done: true },
    { cx: 118, cy: 26, done: false },
    { cx: 152, cy: 56, done: false },
    { cx: 52, cy: 56, done: true },
    { cx: 96, cy: 64, done: false },
  ];
  return (
    <svg viewBox="0 0 180 96" className="w-full h-auto" aria-hidden>
      <defs>
        <linearGradient id="heroBranch" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#C47D4E" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#6B9E7B" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {[
        "M14 88 C30 70 38 64 52 56",
        "M14 88 C40 56 50 38 74 12",
        "M14 88 C46 64 60 40 30 18",
        "M14 88 C60 76 78 70 96 64",
        "M14 88 C72 64 92 44 118 26",
        "M14 88 C92 84 124 72 152 56",
      ].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="url(#heroBranch)"
          strokeWidth="1.4"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 0.75 }}
          transition={{ duration: 1.2, delay: 0.6 + i * 0.14, ease: "easeOut" }}
        />
      ))}
      {leaves.map((l, i) => (
        <g key={i}>
          {l.done && (
            <motion.circle
              cx={l.cx} cy={l.cy} r="7"
              fill="none" stroke="#8FB89A" strokeWidth="0.8" opacity="0.4"
              animate={{ r: [5, 9, 5], opacity: [0.5, 0.08, 0.5] }}
              transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
          <motion.circle
            cx={l.cx} cy={l.cy} r="3.4"
            fill={l.done ? "#6B9E7B" : "#3d2a20"}
            stroke={l.done ? "#8FB89A" : "rgba(255,255,255,0.25)"}
            strokeWidth="1"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 1 + i * 0.15, type: "spring", stiffness: 300, damping: 18 }}
          />
        </g>
      ))}
      <circle cx="14" cy="88" r="4.5" fill="#C47D4E" />
    </svg>
  );
}

/* Fit ring - animated stroke sweep */
function FitRingCard() {
  const r = 17;
  const c = 2 * Math.PI * r;
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5 flex flex-col items-center">
      <svg width="48" height="48" viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <motion.circle
          cx="24" cy="24" r={r}
          fill="none" stroke="#6B9E7B" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c}
          transform="rotate(-90 24 24)"
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - 0.78) }}
          transition={{ duration: 1.6, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x="24" y="27.5" textAnchor="middle" fill="#E3EEE6" fontSize="11" fontWeight="700">78</text>
      </svg>
      <div className="mt-1 text-[9.5px] uppercase tracking-[0.16em] text-paper/45">Fit score</div>
    </div>
  );
}

/* Deadline countdown chip */
function DeadlineCard() {
  return (
    <div className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-2.5 flex flex-col items-center justify-center">
      <div className="flex items-baseline gap-0.5">
        <motion.span
          className="text-[20px] font-bold text-rose-300 tabular-nums"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3, duration: 0.5 }}
        >
          23
        </motion.span>
        <span className="text-[10px] text-paper/50">days</span>
      </div>
      <div className="mt-1 text-[9.5px] uppercase tracking-[0.16em] text-paper/45 text-center leading-tight">
        Next deadline
      </div>
    </div>
  );
}
