"use client";

/**
 * Action Lab - the seven tools, as one constellation.
 *
 * The landing sold the roadmap and the Strategist and said nothing at all about
 * Action Lab, Exam Lab, Decision Twin, Evidence Graph, Smart Routine or Essay
 * Studio. This section carries the whole lab in one screen: seven nodes on an
 * orbit, one focused at a time, with the centre morphing into a working
 * vignette of whichever tool is active.
 *
 * Each vignette animates the *mechanism* rather than decorating the name -
 * Decision Twin separates two probability arcs, Evidence Graph draws an edge
 * from a claim to its artifact and stamps it, Smart Routine fills a week grid.
 *
 * Motion rules: the auto-advance is ambient (paused off-screen, on reduced
 * motion, and on save-data via `useAmbient`), but focus is always changeable by
 * hover, click, or keyboard, and every node stays visible at rest so the
 * section reads correctly in a screenshot.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, useAmbient, glassDark, GArrow,
} from "./shared";

type Tool = {
  id: string;
  name: string;
  tagline: string;
  detail: string;
  href: string;
};

/** Every tool here exists in the product; `href` is its real demo route. */
const TOOLS: Tool[] = [
  {
    id: "decision",
    name: "Decision Twin",
    tagline: "Stress-test a change before you make it",
    detail: "Move the SAT date six weeks earlier and see the acceptance probability before and after, next to a diff of what the plan would do differently.",
    href: "/demo/action-lab",
  },
  {
    id: "evidence",
    name: "Evidence Graph",
    tagline: "Every claim, tied to the thing that proves it",
    detail: "Maps a claim to its artifact, then names the verified signal, the remaining gap, and the next action. Claims with nothing behind them are surfaced, not quietly counted.",
    href: "/demo/action-lab",
  },
  {
    id: "routine",
    name: "Smart Routine",
    tagline: "A week that fits the hours you actually have",
    detail: "Turns the roadmap and a declared weekly capacity into protected blocks. Add them in plain language - “math practice Monday 9 to 10 pm” - and edit anything it generates.",
    href: "/demo/action-lab",
  },
  {
    id: "exam",
    name: "Exam Lab",
    tagline: "Timed mocks that survive a lost connection",
    detail: "A SAT Math module, a full adaptive SAT of four modules plus a break, and all four IELTS papers. An interrupted attempt comes back as Resume instead of being lost.",
    href: "/demo/action-lab",
  },
  {
    id: "practice",
    name: "AI Practice",
    tagline: "A fresh set, aimed at your weakest skill",
    detail: "Generates original practice for a chosen exam, section, difficulty and target skill. Unofficial questions - they do not predict an official band or score, and the product says so.",
    href: "/demo/action-lab",
  },
  {
    id: "essay",
    name: "Essay Studio",
    tagline: "Bangla handwriting into an editable draft",
    detail: "Photograph a handwritten essay in Bengali, English or both and it becomes editable text with the original language and paragraphing intact. The image is never stored.",
    href: "/demo/action-lab",
  },
  {
    id: "video",
    name: "Video Learning",
    tagline: "Vetted lessons, with an interpreter track",
    detail: "Official lessons collected for the section you are working on, with an AI lesson finder that refreshes the list and a sign language track you can switch on.",
    href: "/demo/action-lab",
  },
];

const RADIUS = 132;
const CENTER = 170;

export function ActionLabConstellation() {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  const { ref, active: ambient } = useAmbient<HTMLDivElement>();
  const reduce = useReducedMotion();

  // Auto-advance only while the section is on screen and nobody is steering.
  useEffect(() => {
    if (!ambient || held) return;
    const id = window.setInterval(
      () => setActive((i) => (i + 1) % TOOLS.length),
      4200,
    );
    return () => window.clearInterval(id);
  }, [ambient, held]);

  const pick = useCallback((index: number) => {
    setActive(index);
    setHeld(true);
  }, []);

  const tool = TOOLS[active];

  return (
    <section
      id="action-lab"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      {/* Ambient field */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div
          className="absolute left-1/2 top-1/2 h-[80vh] w-[80vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.13), transparent 70%)" }}
        />
      </div>

      <div ref={ref} className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          onDark
          eyebrow="Action Lab"
          title={<>Seven tools that turn intent into <Accent>evidence</Accent><Dot /></>}
          sub="The plan says what to do. The lab is where it gets done - and where the proof that it happened gets recorded."
        />

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
          {/* ── Orbit ── */}
          <Reveal className="order-2 lg:order-1">
            <div
              className="relative mx-auto w-full max-w-[380px]"
              onMouseLeave={() => setHeld(false)}
            >
              <svg
                viewBox="0 0 340 340"
                className="h-auto w-full overflow-visible"
                role="group"
                aria-label="The seven Action Lab tools"
              >
                <defs>
                  <linearGradient id="alSpoke" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#C47D4E" stopOpacity="0.55" />
                    <stop offset="100%" stopColor="#6B9E7B" stopOpacity="0.4" />
                  </linearGradient>
                  <radialGradient id="alCore">
                    <stop offset="0%" stopColor="#C47D4E" />
                    <stop offset="100%" stopColor="#8B5E3C" />
                  </radialGradient>
                </defs>

                {/* Guide rings */}
                <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1" strokeDasharray="2 8" />
                <circle cx={CENTER} cy={CENTER} r={78} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />

                {/* Sweeping arc - the only looping element */}
                <motion.circle
                  cx={CENTER} cy={CENTER} r={RADIUS}
                  fill="none" stroke="rgba(196,125,78,0.5)" strokeWidth="1.5"
                  strokeDasharray="46 780" strokeLinecap="round"
                  animate={ambient ? { strokeDashoffset: [0, -826] } : undefined}
                  transition={{ duration: 14, repeat: Infinity, ease: "linear" }}
                />

                {TOOLS.map((t, i) => {
                  const angle = (i / TOOLS.length) * Math.PI * 2 - Math.PI / 2;
                  const x = CENTER + RADIUS * Math.cos(angle);
                  const y = CENTER + RADIUS * Math.sin(angle);
                  const on = i === active;
                  const labelRight = Math.cos(angle) > -0.2;
                  return (
                    <g
                      key={t.id}
                      role="button"
                      tabIndex={0}
                      aria-label={t.name}
                      aria-pressed={on}
                      className="cursor-pointer outline-none"
                      onMouseEnter={() => pick(i)}
                      onFocus={() => pick(i)}
                      onClick={() => pick(i)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(i); }
                      }}
                    >
                      <line
                        x1={CENTER + 78 * Math.cos(angle)} y1={CENTER + 78 * Math.sin(angle)}
                        x2={x} y2={y}
                        stroke={on ? "url(#alSpoke)" : "rgba(255,255,255,0.12)"}
                        strokeWidth={on ? 1.6 : 1}
                        className="transition-all duration-500"
                      />
                      {/* Generous invisible hit area - the dot alone is a poor target. */}
                      <circle cx={x} cy={y} r="22" fill="transparent" />
                      <circle
                        cx={x} cy={y} r={on ? 9 : 5.5}
                        fill={on ? "#C47D4E" : "#2C1810"}
                        stroke={on ? "#E0A87C" : "rgba(255,255,255,0.28)"}
                        strokeWidth="1.5"
                        className="transition-all duration-500"
                      />
                      {on && !reduce && (
                        <circle cx={x} cy={y} r="9" fill="none" stroke="#C47D4E" strokeWidth="1.5" opacity="0.55">
                          <animate attributeName="r" values="9;19;9" dur="2.4s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.55;0;0.55" dur="2.4s" repeatCount="indefinite" />
                        </circle>
                      )}
                      <text
                        x={x + (labelRight ? 17 : -17)}
                        y={y + 3.5}
                        textAnchor={labelRight ? "start" : "end"}
                        className="pointer-events-none select-none text-[9.5px] font-medium transition-all duration-500"
                        fill={on ? "#F0D9C6" : "rgba(250,246,240,0.45)"}
                      >
                        {t.name}
                      </text>
                    </g>
                  );
                })}

                {/* Centre stage */}
                <circle cx={CENTER} cy={CENTER} r="62" fill="rgba(36,21,16,0.9)" stroke="rgba(255,255,255,0.10)" />
              </svg>

              {/* The vignette sits over the SVG centre so it can use real DOM. */}
              <div className="pointer-events-none absolute left-1/2 top-1/2 h-[124px] w-[124px] -translate-x-1/2 -translate-y-1/2">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={tool.id}
                    initial={reduce ? false : { opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, scale: 0.94 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="flex h-full w-full items-center justify-center"
                  >
                    <Vignette id={tool.id} animate={ambient} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>

          {/* ── Read-out ── */}
          <Reveal delay={0.08} className="order-1 lg:order-2">
            <div className={cn(glassDark, "p-6 sm:p-8")}>
              <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-polaris-300">
                <span className="h-1.5 w-1.5 rounded-full bg-polaris-400" />
                <span data-no-translate>{`${active + 1} / ${TOOLS.length}`}</span>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={tool.id}
                  initial={reduce ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h3 className="mt-4 font-serif text-[26px] font-bold leading-tight text-paper sm:text-[30px]">
                    {tool.name}
                  </h3>
                  <p className="mt-1.5 text-[14px] font-medium text-polaris-200">
                    {tool.tagline}
                  </p>
                  <p className="mt-4 min-h-[96px] text-[14.5px] leading-relaxed text-paper/70">
                    {tool.detail}
                  </p>
                </motion.div>
              </AnimatePresence>

              <Link
                href={tool.href}
                className="group mt-2 inline-flex items-center gap-2 rounded-full bg-paper px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-soft"
              >
                Open the lab in the demo
                <span className="transition-transform duration-200 group-hover:translate-x-1">
                  <GArrow />
                </span>
              </Link>

              {/* Direct picker - the orbit is a pointer target, this is a list. */}
              <div className="mt-6 flex flex-wrap gap-1.5 border-t border-white/[0.08] pt-5">
                {TOOLS.map((t, i) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick(i)}
                    aria-pressed={i === active}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                      i === active
                        ? "bg-polaris-400 text-ink"
                        : "bg-white/[0.06] text-paper/60 hover:bg-white/[0.12] hover:text-paper",
                    )}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Vignettes - each animates what its tool actually does
   ═══════════════════════════════════════════════════════════════════════════ */

function Vignette({ id, animate }: { id: string; animate: boolean }) {
  switch (id) {
    case "decision": return <VDecision animate={animate} />;
    case "evidence": return <VEvidence animate={animate} />;
    case "routine": return <VRoutine animate={animate} />;
    case "exam": return <VExam animate={animate} />;
    case "practice": return <VPractice animate={animate} />;
    case "essay": return <VEssay animate={animate} />;
    default: return <VVideo animate={animate} />;
  }
}

/** Two probability arcs separating - before and after the change. */
function VDecision({ animate }: { animate: boolean }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 84 84" className="h-full w-full" aria-hidden>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="5" />
      <circle
        cx="42" cy="42" r={r} fill="none" stroke="rgba(250,246,240,0.35)" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - 0.41)}
        transform="rotate(-90 42 42)"
      />
      <motion.circle
        cx="42" cy="42" r={r} fill="none" stroke="#6B9E7B" strokeWidth="5"
        strokeLinecap="round" strokeDasharray={c}
        transform="rotate(-90 42 42)"
        initial={{ strokeDashoffset: c * (1 - 0.41) }}
        animate={animate ? { strokeDashoffset: [c * (1 - 0.41), c * (1 - 0.63)] } : { strokeDashoffset: c * (1 - 0.63) }}
        transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="42" y="46" textAnchor="middle" fill="#E3EEE6" fontSize="16" fontWeight="700">+22</text>
    </svg>
  );
}

/** A claim drawing an edge to its artifact, then stamping verified. */
function VEvidence({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 96 84" className="h-full w-full" aria-hidden>
      <rect x="4" y="14" width="34" height="18" rx="4" fill="rgba(255,255,255,0.10)" stroke="rgba(255,255,255,0.22)" />
      <text x="21" y="26" textAnchor="middle" fill="#FAF6F0" fontSize="7.5">claim</text>
      <rect x="58" y="52" width="34" height="18" rx="4" fill="rgba(107,158,123,0.18)" stroke="#6B9E7B" />
      <text x="75" y="64" textAnchor="middle" fill="#C7E0CF" fontSize="7.5">proof</text>
      <motion.path
        d="M38 26 C 52 26, 58 46, 66 52"
        fill="none" stroke="#C47D4E" strokeWidth="1.8" strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: animate ? 1 : 0, ease: "easeOut" }}
      />
      <motion.g
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: animate ? 1 : 0, type: "spring", stiffness: 260, damping: 16 }}
        style={{ transformOrigin: "75px 61px" }}
      >
        <circle cx="75" cy="61" r="12" fill="none" stroke="#6B9E7B" strokeWidth="1.4" opacity="0.7" />
        <path d="M70 61 l3.5 3.5 L81 57" fill="none" stroke="#8FB89A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </motion.g>
    </svg>
  );
}

/** A week grid filling with protected blocks. */
function VRoutine({ animate }: { animate: boolean }) {
  const blocks = [
    { x: 6, y: 20, h: 22 }, { x: 24, y: 34, h: 16 }, { x: 42, y: 14, h: 30 },
    { x: 60, y: 40, h: 20 }, { x: 78, y: 24, h: 26 },
  ];
  return (
    <svg viewBox="0 0 100 84" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={i} x={6 + i * 18} y="10" width="14" height="62" rx="3"
          fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" />
      ))}
      {blocks.map((b, i) => (
        <motion.rect
          key={i} x={b.x} width="14" rx="3"
          fill={i % 2 ? "#6B9E7B" : "#C47D4E"} opacity="0.85"
          initial={{ y: b.y, height: 0 }}
          animate={{ y: b.y, height: b.h }}
          transition={{ duration: animate ? 0.5 : 0, delay: animate ? 0.12 * i : 0, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </svg>
  );
}

/** A timer ring closing over the module chips of a full adaptive SAT. */
function VExam({ animate }: { animate: boolean }) {
  const r = 28;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 84 84" className="h-full w-full" aria-hidden>
      <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="4" />
      <motion.circle
        cx="42" cy="42" r={r} fill="none" stroke="#C47D4E" strokeWidth="4" strokeLinecap="round"
        strokeDasharray={c} transform="rotate(-90 42 42)"
        initial={{ strokeDashoffset: 0 }}
        animate={animate ? { strokeDashoffset: [0, c * 0.68] } : { strokeDashoffset: c * 0.68 }}
        transition={{ duration: 2.6, ease: "linear" }}
      />
      <text x="42" y="40" textAnchor="middle" fill="#FAF6F0" fontSize="13" fontWeight="700">32:10</text>
      <text x="42" y="52" textAnchor="middle" fill="rgba(250,246,240,0.5)" fontSize="7">module 2 of 4</text>
    </svg>
  );
}

/** Questions assembling into a set. */
function VPractice({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 90 84" className="h-full w-full" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.g key={i}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: animate ? 0.45 : 0, delay: animate ? i * 0.16 : 0, ease: [0.16, 1, 0.3, 1] }}
        >
          <rect x="10" y={12 + i * 16} width="70" height="11" rx="3"
            fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.13)" />
          <circle cx="17" cy={17.5 + i * 16} r="2.6" fill={i === 1 ? "#6B9E7B" : "rgba(196,125,78,0.75)"} />
          <rect x="24" y={15 + i * 16} width={38 - i * 6} height="4" rx="2" fill="rgba(250,246,240,0.28)" />
        </motion.g>
      ))}
    </svg>
  );
}

/** Handwriting resolving into typed lines. */
function VEssay({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 96 84" className="h-full w-full" aria-hidden>
      {/* handwritten squiggles */}
      {[0, 1, 2].map((i) => (
        <motion.path
          key={`h${i}`}
          d={`M10 ${22 + i * 16} c 6 -6, 12 6, 18 0 s 12 -6, 18 0 s 12 6, 18 0`}
          fill="none" stroke="rgba(250,246,240,0.4)" strokeWidth="1.4" strokeLinecap="round"
          initial={{ opacity: 1 }}
          animate={animate ? { opacity: [1, 0] } : { opacity: 0 }}
          transition={{ duration: 0.7, delay: animate ? 0.5 + i * 0.15 : 0 }}
        />
      ))}
      {/* resolved type */}
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={`t${i}`}
          x="10" y={19 + i * 16} height="5" rx="2.5" fill="#C47D4E"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 68 - i * 10, opacity: 1 }}
          transition={{ duration: animate ? 0.55 : 0, delay: animate ? 0.9 + i * 0.15 : 0, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </svg>
  );
}

/** A lesson playing with the interpreter track switched on. */
function VVideo({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="0 0 96 84" className="h-full w-full" aria-hidden>
      <rect x="8" y="16" width="80" height="46" rx="5" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.14)" />
      <motion.path
        d="M40 30 L56 39 L40 48 Z" fill="#C47D4E"
        initial={{ scale: 0.85, opacity: 0.7 }}
        animate={animate ? { scale: [0.85, 1, 0.85], opacity: [0.7, 1, 0.7] } : { scale: 1, opacity: 1 }}
        transition={{ duration: 2.2, repeat: animate ? Infinity : 0, ease: "easeInOut" }}
        style={{ transformOrigin: "48px 39px" }}
      />
      {/* interpreter inset */}
      <rect x="63" y="40" width="21" height="18" rx="3" fill="#2C1810" stroke="#6B9E7B" strokeWidth="1.2" />
      <circle cx="73.5" cy="46" r="3" fill="#8FB89A" />
      <path d="M69 55 q4.5 -5 9 0" fill="none" stroke="#8FB89A" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
