"use client";

/**
 * Universities + Deadlines - two systems shown as one: floating tilt cards
 * with fit rings on the left, a deadline rail with countdown ring + urgency
 * states on the right, and a dashed "import" connection between them.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, FloatWrap, glassDark, useTilt, GCheck,
} from "./shared";

export function UniversityDeadlinePreview() {
  return (
    <section
      id="universities-section"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 55% 45% at 25% 30%, rgba(91,140,109,0.12), transparent 65%), radial-gradient(ellipse 50% 45% at 80% 75%, rgba(184,84,106,0.12), transparent 65%)" }}
      />

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          onDark
          eyebrow="Universities + deadlines"
          title={<>Explore universities, understand fit, and <Accent>never miss a deadline</Accent><Dot /></>}
          sub="Shortlist real universities with fit and reach analysis - then import their deadlines straight into a calendar that knows how much slack you really have."
        />

        <div className="relative mt-16 grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* ── Floating university cards ── */}
          <div className="relative mx-auto w-full max-w-md min-h-[360px]">
            <FloatWrap amplitude={6} duration={7} className="relative z-20">
              <UniCard
                name="University of Toronto"
                country="Canada"
                fit={78}
                tags={["Need-based aid", "SAT optional"]}
              />
            </FloatWrap>
            <FloatWrap amplitude={8} duration={7.8} delay={0.9} className="absolute top-[42%] -right-2 sm:right-0 w-[78%] z-10">
              <UniCard
                name="NUS Singapore"
                country="Singapore"
                fit={64}
                tags={["Merit scholarships"]}
                compact
              />
            </FloatWrap>
            <FloatWrap amplitude={7} duration={6.6} delay={1.7} className="absolute top-[68%] left-0 w-[72%] z-30">
              <UniCard
                name="TU Munich"
                country="Germany"
                fit={86}
                tags={["No tuition fees"]}
                compact
              />
            </FloatWrap>
          </div>

          {/* ── Deadline rail ── */}
          <div className="relative">
            {/* Import connection - dashed line flowing from cards to rail */}
            <svg
              aria-hidden
              className="absolute -left-14 top-10 hidden lg:block"
              width="60" height="120" viewBox="0 0 60 120"
            >
              <motion.path
                d="M2 10 C40 20 50 60 30 110"
                fill="none" stroke="rgba(196,125,78,0.5)" strokeWidth="1.5" strokeDasharray="4 6"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.6 }}
              />
              <motion.circle
                r="3" fill="#E3BC94"
                style={{ offsetPath: 'path("M2 10 C40 20 50 60 30 110")' }}
                animate={{ offsetDistance: ["0%", "100%"], opacity: [0, 1, 1, 0] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 1.4, repeatDelay: 0.8 }}
              />
            </svg>

            <Reveal>
              <div className={cn(glassDark, "p-5 sm:p-6")}>
                <div className="flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-paper/45">Deadline radar</div>
                  <span className="rounded-full bg-white/[0.07] px-2.5 py-1 text-[10.5px] text-paper/60">
                    synced with roadmap
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-5">
                  <CountdownRing days={9} total={30} />
                  <div>
                    <div className="text-[14.5px] font-semibold text-paper">NTU Global Scholarship</div>
                    <div className="mt-0.5 text-[12.5px] text-paper/55">Essay + 2 references still pending</div>
                    <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-signal-rose/15 ring-1 ring-inset ring-signal-rose/30 px-2.5 py-1 text-[10.5px] font-semibold text-[#F5C0C9]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#F08092] pulse-dot" /> High urgency
                    </span>
                  </div>
                </div>

                <div className="mt-5 space-y-2.5">
                  <DeadlineRow label="U of T - early application" days={23} tone="amber" checks={[true, true, false]} />
                  <DeadlineRow label="IELTS booking window" days={41} tone="ok" checks={[true, false, false]} />
                  <DeadlineRow label="TU Munich - uni-assist" days={67} tone="ok" checks={[false, false, false]} />
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── University card with fit ring ────────────────────────────────────── */

function UniCard({
  name, country, fit, tags, compact,
}: {
  name: string; country: string; fit: number; tags: string[]; compact?: boolean;
}) {
  const tilt = useTilt(5);
  return (
    <div style={{ perspective: 900 }}>
      <motion.div
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY }}
        className={cn(glassDark, "p-4 sm:p-5 bg-[#241510]/90")}
      >
        <div className="flex items-center gap-3.5">
          <FitRing value={fit} size={compact ? 46 : 56} />
          <div className="min-w-0">
            <div className={cn("font-semibold text-paper truncate", compact ? "text-[13.5px]" : "text-[15px]")}>
              {name}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-paper/50">
              <span className="rounded bg-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] tracking-wide">{country}</span>
              <span>fit preview</span>
            </div>
          </div>
        </div>
        {!compact && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span key={t} className="rounded-full bg-aurora-500/15 ring-1 ring-inset ring-aurora-500/25 px-2.5 py-1 text-[10.5px] text-aurora-200">
                {t}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function FitRing({ value, size }: { value: number; size: number }) {
  const r = size * 0.36;
  const c = 2 * Math.PI * r;
  const tone = value >= 75 ? "#6B9E7B" : value >= 55 ? "#D89466" : "#C36F89";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0" aria-hidden>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth={size * 0.09} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={tone} strokeWidth={size * 0.09} strokeLinecap="round"
        strokeDasharray={c}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        initial={{ strokeDashoffset: c }}
        whileInView={{ strokeDashoffset: c * (1 - value / 100) }}
        viewport={{ once: true }}
        transition={{ duration: 1.4, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
      />
      <text x="50%" y="54%" dominantBaseline="middle" textAnchor="middle" fill="#FAF6F0" fontSize={size * 0.26} fontWeight="700">
        {value}
      </text>
    </svg>
  );
}

/* ─── Deadline rows ────────────────────────────────────────────────────── */

function DeadlineRow({
  label, days, tone, checks,
}: {
  label: string; days: number; tone: "amber" | "ok"; checks: boolean[];
}) {
  return (
    <Reveal>
      <div className="flex items-center gap-3 rounded-xl bg-white/[0.04] border border-white/[0.06] px-3.5 py-2.5">
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            tone === "amber" ? "bg-nova-300" : "bg-aurora-400",
          )}
        />
        <span className="flex-1 text-[12.5px] text-paper/80 truncate">{label}</span>
        <span className="flex gap-1">
          {checks.map((done, i) => (
            <span
              key={i}
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                done ? "bg-aurora-500/30 text-aurora-200" : "bg-white/[0.07] text-paper/25",
              )}
            >
              <GCheck s={9} />
            </span>
          ))}
        </span>
        <span className="text-[12px] font-semibold tabular-nums text-paper/60 w-9 text-right">{days}d</span>
      </div>
    </Reveal>
  );
}

/* ─── Countdown ring ───────────────────────────────────────────────────── */

function CountdownRing({ days, total }: { days: number; total: number }) {
  const reduce = useReducedMotion();
  const size = 84;
  const r = 32;
  const c = 2 * Math.PI * r;
  const frac = days / total;
  return (
    <div className="relative shrink-0">
      {!reduce && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{ boxShadow: "0 0 30px -6px rgba(184,84,106,0.5)" }}
          animate={{ opacity: [0.4, 0.9, 0.4] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#F08092" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={c}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          initial={{ strokeDashoffset: c }}
          whileInView={{ strokeDashoffset: c * (1 - frac) }}
          viewport={{ once: true }}
          transition={{ duration: 1.4, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
        <text x="50%" y="46%" textAnchor="middle" fill="#FAF6F0" fontSize="20" fontWeight="800">{days}</text>
        <text x="50%" y="64%" textAnchor="middle" fill="rgba(250,246,240,0.5)" fontSize="9" letterSpacing="2">DAYS</text>
      </svg>
    </div>
  );
}
