"use client";

/**
 * Product ecosystem - Polaris core with orbiting module nodes.
 *
 * Reuses the app's .orbit-ring / .orbit-item CSS (GPU rotation, counter-
 * rotated children stay upright). Hovering or tapping a node reveals a
 * detail card under the orbit - every module shown actually exists in the
 * product, with its real route.
 */

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, glassLight,
  GRoute, GChat, GBuilding, GCalendar, GBook, GLink, GGift, GUser,
  GArrow, NorthStarMark,
} from "./shared";

type Module = {
  key: string;
  name: string;
  blurb: string;
  href: string;
  icon: React.ReactNode;
  tone: string;       // icon tile gradient
  ring: "inner" | "outer";
  angle: number;      // initial position on the ring, degrees
};

const MODULES: Module[] = [
  { key: "roadmap",    name: "Roadmap",     ring: "inner", angle: 0,   tone: "from-polaris-300 to-polaris-500", icon: <GRoute />,    href: "/roadmap",
    blurb: "A living skill tree built from your level, timeline, and target universities - tasks adapt as your scores move." },
  { key: "strategist", name: "Strategist",  ring: "inner", angle: 120, tone: "from-nova-400 to-nova-600",       icon: <GChat />,     href: "/strategist",
    blurb: "The AI brain. It reads your roadmap, scores, and deadlines, then tells you exactly what to do next." },
  { key: "profile",    name: "Profile",     ring: "inner", angle: 240, tone: "from-[#A8836B] to-[#7C5A42]",     icon: <GUser />,     href: "/account",
    blurb: "Education level, score inputs, completion ring, and a day streak earned by real actions only." },
  { key: "universities", name: "Universities", ring: "outer", angle: 0,   tone: "from-aurora-400 to-aurora-600", icon: <GBuilding />, href: "/universities",
    blurb: "Discover real universities, see fit and reach analysis, compare shortlists, and import their deadlines." },
  { key: "deadlines",  name: "Deadlines",   ring: "outer", angle: 72,  tone: "from-[#C36F89] to-signal-rose",   icon: <GCalendar />, href: "/deadlines",
    blurb: "A smart calendar with urgency scoring, countdowns, and checklists - synced with your roadmap." },
  { key: "resources",  name: "Resources",   ring: "outer", angle: 144, tone: "from-[#D2A24C] to-[#A87B2E]",     icon: <GBook />,     href: "/resources",
    blurb: "Student stories, scholarships, real cost breakdowns, and SAT/IELTS material in one knowledge hub." },
  { key: "connections", name: "Connections", ring: "outer", angle: 216, tone: "from-[#5E8CA8] to-[#3E647D]",    icon: <GLink />,     href: "/connections",
    blurb: "GitHub, Codeforces, Google Calendar and Drive - connected with explicit permission only." },
  { key: "partners",   name: "Partners",    ring: "outer", angle: 288, tone: "from-[#9C7BB8] to-[#6E548A]",     icon: <GGift />,     href: "/partners",
    blurb: "Free student tools and verified offers, matched to your roadmap - free resources always rank first." },
];

export function EcosystemOrbit() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState<Module>(MODULES[0]);

  return (
    <section
      id="how"
      data-section-theme="light"
      className="relative bg-paper overflow-hidden"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow="The ecosystem"
          title={<>One connected <Accent>command center</Accent> for your admission journey<Dot /></>}
          sub="Every module talks to the others. Update a score and the roadmap rebalances, the Strategist reacts, and your deadline risk recalculates."
        />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 items-center">
          {/* ── Orbit scene ── */}
          <Reveal className="relative mx-auto w-full max-w-[540px]">
            <div className="relative aspect-square select-none">
              {/* Ring guides */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 540 540" aria-hidden>
                <circle cx="270" cy="270" r="148" fill="none" stroke="rgba(139,94,60,0.16)" strokeWidth="1" strokeDasharray="3 7" />
                <circle cx="270" cy="270" r="234" fill="none" stroke="rgba(139,94,60,0.13)" strokeWidth="1" strokeDasharray="3 7" />
                <motion.circle
                  cx="270" cy="270" r="190"
                  fill="none" stroke="rgba(196,125,78,0.18)" strokeWidth="1"
                  strokeDasharray="40 320"
                  animate={reduce ? undefined : { strokeDashoffset: [0, -360] }}
                  transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                />
              </svg>

              {/* Core */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                <motion.div
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-32 w-32 rounded-full"
                  style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.3), transparent 70%)" }}
                  animate={reduce ? undefined : { scale: [1, 1.25, 1], opacity: [0.7, 0.35, 0.7] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <div className="relative flex h-[76px] w-[76px] items-center justify-center rounded-full bg-gradient-to-br from-polaris-400 via-polaris-500 to-aurora-600 text-paper shadow-[0_16px_50px_-12px_rgba(139,94,60,0.55)] ring-4 ring-paper">
                  <NorthStarMark s={30} />
                </div>
              </div>

              {/* Inner ring - 3 nodes */}
              <OrbitRing duration={34} reverse={false}>
                {MODULES.filter((m) => m.ring === "inner").map((m) => (
                  <OrbitNode key={m.key} module={m} active={active.key === m.key} onActivate={setActive} duration={34} />
                ))}
              </OrbitRing>

              {/* Outer ring - 5 nodes, opposite direction */}
              <OrbitRing duration={52} reverse>
                {MODULES.filter((m) => m.ring === "outer").map((m) => (
                  <OrbitNode key={m.key} module={m} active={active.key === m.key} onActivate={setActive} duration={52} reverse />
                ))}
              </OrbitRing>
            </div>
          </Reveal>

          {/* ── Active module detail ── */}
          <div className="relative min-h-[230px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className={cn(glassLight, "p-7 sm:p-8")}
              >
                <div className="flex items-center gap-3.5">
                  <span className={cn("inline-flex h-12 w-12 items-center justify-center rounded-2xl text-white bg-gradient-to-br shadow-md", active.tone)}>
                    {active.icon}
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-ink-muted">Module</div>
                    <div className="text-xl font-bold text-ink">{active.name}</div>
                  </div>
                </div>
                <p className="mt-4 text-[15px] leading-relaxed text-ink-dim">{active.blurb}</p>
                <Link
                  href={active.href}
                  className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-polaris-500 hover:text-polaris-600 transition-colors"
                >
                  Explore {active.name.toLowerCase()} <GArrow s={12} />
                </Link>
              </motion.div>
            </AnimatePresence>

            <p className="mt-4 text-[12.5px] text-ink-muted text-center lg:text-left">
              Hover or tap any orbiting module to see what it does.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Orbit machinery ──────────────────────────────────────────────────── */

function OrbitRing({
  duration, reverse, children,
}: {
  duration: number; reverse: boolean; children: React.ReactNode;
}) {
  // The whole layer spins; nodes are statically placed on it by trigonometry
  // and counter-spin individually (orbit-item) so the tiles stay upright.
  return (
    <div
      className="orbit-ring absolute inset-0"
      style={{
        ["--orbit-duration" as string]: `${duration}s`,
        animationDirection: reverse ? "reverse" : "normal",
      }}
    >
      {children}
    </div>
  );
}

/** Ring radii as % of the square container - match the dashed SVG guides. */
const RING_RADIUS = { inner: 27.4, outer: 43.3 } as const;

function OrbitNode({
  module: m, active, onActivate, duration, reverse,
}: {
  module: Module; active: boolean;
  onActivate: (m: Module) => void;
  duration: number; reverse?: boolean;
}) {
  const rad = (m.angle * Math.PI) / 180;
  const r = RING_RADIUS[m.ring];
  // toFixed keeps the server- and client-rendered style strings identical -
  // raw trig floats serialize at different precisions and break hydration.
  const left = (50 + r * Math.sin(rad)).toFixed(3);
  const top = (50 - r * Math.cos(rad)).toFixed(3);

  return (
    // Outer: static position + centering translate (no animation here, so the
    // transform survives). Inner .orbit-item runs the counter-rotation.
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${left}%`, top: `${top}%` }}
    >
      <div
        className="orbit-item"
        style={{
          ["--orbit-duration" as string]: `${duration}s`,
          animationDirection: reverse ? "reverse" : "normal",
        }}
      >
        <button
          type="button"
          onMouseEnter={() => onActivate(m)}
          onFocus={() => onActivate(m)}
          onClick={() => onActivate(m)}
          aria-label={m.name}
          className="flex flex-col items-center gap-1.5 group outline-none"
        >
          <span
            className={cn(
              "flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-white bg-gradient-to-br transition-all duration-300",
              m.tone,
              active
                ? "scale-110 shadow-[0_14px_40px_-10px_rgba(139,94,60,0.5)] ring-2 ring-paper"
                : "shadow-[0_8px_24px_-10px_rgba(139,94,60,0.4)] group-hover:scale-105",
            )}
          >
            {m.icon}
          </span>
          <span
            className={cn(
              "hidden sm:block rounded-full px-2 py-0.5 text-[10.5px] font-semibold transition-colors whitespace-nowrap",
              active ? "bg-ink text-paper" : "bg-paper-card/90 text-ink-dim ring-1 ring-ink/[0.07]",
            )}
          >
            {m.name}
          </span>
        </button>
      </div>
    </div>
  );
}

