"use client";

/**
 * Resources - a knowledge galaxy, not a blog grid. Concentric orbit rings
 * carry floating orbs (stories, scholarships, costs, SAT/IELTS), with one
 * spotlight story card in front.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, FloatWrap, glassLight, GArrow,
} from "./shared";
import Link from "next/link";

type Orb = {
  label: string;
  kind: "story" | "scholarship" | "cost" | "test";
  left: number;  // % of scene
  top: number;
  delay: number;
};

const ORBS: Orb[] = [
  { label: "IELTS band 8 plan",   kind: "test",        left: 12, top: 16, delay: 0 },
  { label: "Full-ride at KAIST",  kind: "scholarship", left: 78, top: 10, delay: 0.8 },
  { label: "True cost: Germany",  kind: "cost",        left: 86, top: 52, delay: 1.6 },
  { label: "SAT 1500 in 90 days", kind: "test",        left: 6,  top: 58, delay: 2.2 },
  { label: "DAAD scholarships",   kind: "scholarship", left: 30, top: 4,  delay: 1.2 },
  { label: "Visa interview notes", kind: "story",      left: 62, top: 78, delay: 0.4 },
];

const KIND_STYLE: Record<Orb["kind"], string> = {
  story:       "from-[#C36F89] to-signal-rose",
  scholarship: "from-[#D2A24C] to-[#A87B2E]",
  cost:        "from-aurora-400 to-aurora-600",
  test:        "from-[#5E8CA8] to-[#3E647D]",
};

export function ResourcesDreamPreview() {
  const reduce = useReducedMotion();

  return (
    <section
      id="resources-section"
      data-section-theme="light"
      className="relative overflow-hidden bg-paper"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow="The knowledge hub"
          title={<>Learn from <Accent>real stories</Accent>, scholarships, costs, and resources<Dot /></>}
          sub="Student journeys, scholarship databases, true cost breakdowns, and SAT/IELTS material - organized around where you are in your own journey."
        />

        <div className="relative mt-14 mx-auto max-w-3xl">
          {/* Galaxy rings */}
          <svg viewBox="0 0 720 420" className="w-full h-auto" aria-hidden>
            <defs>
              <radialGradient id="galaxyBed" cx="50%" cy="50%">
                <stop offset="0%" stopColor="rgba(196,125,78,0.10)" />
                <stop offset="100%" stopColor="rgba(196,125,78,0)" />
              </radialGradient>
            </defs>
            <ellipse cx="360" cy="210" rx="330" ry="180" fill="url(#galaxyBed)" />
            {[{ rx: 320, ry: 165 }, { rx: 245, ry: 122 }, { rx: 165, ry: 80 }].map((ring, i) => (
              <motion.ellipse
                key={i}
                cx="360" cy="210" rx={ring.rx} ry={ring.ry}
                fill="none" stroke="rgba(139,94,60,0.16)" strokeWidth="1" strokeDasharray="3 7"
                initial={{ opacity: 0, scale: 0.92 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15, duration: 0.8 }}
              />
            ))}
            {/* Drifting spark on the middle ring */}
            {!reduce && (
              <motion.circle
                r="3.5" fill="#C47D4E"
                style={{ offsetPath: 'path("M 605 210 A 245 122 0 1 1 115 210 A 245 122 0 1 1 605 210")' }}
                animate={{ offsetDistance: ["0%", "100%"] }}
                transition={{ duration: 26, repeat: Infinity, ease: "linear" }}
              />
            )}
          </svg>

          {/* Floating orbs */}
          {ORBS.map((o) => (
            <div
              key={o.label}
              className="absolute"
              style={{ left: `${o.left}%`, top: `${o.top}%` }}
            >
              <FloatWrap amplitude={6} duration={5.6 + (o.delay % 2)} delay={o.delay}>
                <motion.span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] sm:text-[12px] font-semibold text-white",
                    "bg-gradient-to-br shadow-[0_10px_30px_-10px_rgba(139,94,60,0.45)]",
                    KIND_STYLE[o.kind],
                  )}
                  initial={{ opacity: 0, scale: 0.7 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + o.delay * 0.25, type: "spring", stiffness: 240, damping: 17 }}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                  {o.label}
                </motion.span>
              </FloatWrap>
            </div>
          ))}

          {/* Spotlight story card */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] sm:w-auto">
            <Reveal delay={0.2}>
              <div className={cn(glassLight, "p-5 sm:p-6 max-w-sm mx-auto")}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-polaris-300 to-polaris-500 text-white font-bold text-[15px]">
                    N
                  </span>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.18em] text-ink-muted">Student story</div>
                    <div className="text-[14.5px] font-bold text-ink">From Dhaka to Toronto - on a scholarship</div>
                  </div>
                </div>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">
                  How Nusrat planned 14 months of SAT prep, essays, and aid
                  applications - and what she would do differently.
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                    <PlayGlyph /> 12 min read · video inside
                  </span>
                  <Link href="/signup" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-polaris-500 hover:text-polaris-600 transition-colors">
                    All stories <GArrow s={11} />
                  </Link>
                </div>
              </div>
            </Reveal>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[12px] text-ink-muted">
          {[
            ["story", "Student stories"],
            ["scholarship", "Scholarships"],
            ["cost", "Cost breakdowns"],
            ["test", "SAT / IELTS prep"],
          ].map(([kind, label]) => (
            <span key={kind} className="inline-flex items-center gap-2">
              <span className={cn("h-2.5 w-2.5 rounded-full bg-gradient-to-br", KIND_STYLE[kind as Orb["kind"]])} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlayGlyph() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4l14 8-14 8V4z" />
    </svg>
  );
}
