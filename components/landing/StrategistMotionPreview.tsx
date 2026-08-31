"use client";

/**
 * Strategist section - the AI brain at the center of a context field.
 * A glass chat card with a pulsing glow ring, surrounded by floating context
 * cards (score insight, deadline warning, focused node, next step) that all
 * feed into it - making it read as more than a chatbot.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, FloatWrap, glassLight,
  NorthStarMark, GCalendar, GRoute, GArrow,
} from "./shared";

export function StrategistMotionPreview() {
  const reduce = useReducedMotion();

  return (
    <section
      id="strategist"
      data-section-theme="light"
      className="relative overflow-hidden bg-paper-soft"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow="The Strategist"
          title={<>Sees everything. Tells you <Accent>what to do next</Accent><Dot /></>}
          sub="The Strategist reads your roadmap, scores, deadlines, and progress - selected node included - then recommends the next move and can rebalance the whole plan."
        />

        <div className="relative mt-16 mx-auto max-w-3xl">
          {/* Glow field behind the chat */}
          <motion.div
            aria-hidden
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[420px] w-[420px] rounded-full pointer-events-none"
            style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.18), transparent 70%)" }}
            animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.8, 0.5, 0.8] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Chat card */}
          <Reveal>
            <div className={cn(glassLight, "relative p-5 sm:p-7 max-w-xl mx-auto")}>
              {/* Header */}
              <div className="flex items-center gap-2.5 pb-4 border-b border-ink/[0.06]">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-polaris-400 to-aurora-600 text-white">
                  <NorthStarMark s={18} />
                </span>
                <div>
                  <div className="text-[13.5px] font-bold text-ink">Strategist</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                    <span className="h-1.5 w-1.5 rounded-full bg-aurora-500 pulse-dot" />
                    synced with your roadmap
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="mt-4 space-y-3">
                <motion.div
                  className="ml-auto max-w-[85%] w-fit rounded-2xl rounded-br-md bg-ink text-paper px-4 py-2.5 text-[13.5px] leading-relaxed"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3, duration: 0.5 }}
                >
                  My SAT mock came back 1210 - what should I change?
                </motion.div>

                <motion.div
                  className="max-w-[90%] rounded-2xl rounded-bl-md bg-paper-deep px-4 py-3 text-[13.5px] leading-relaxed text-ink"
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                >
                  Math is 60 under your Toronto target while English is ahead, so
                  I rebalanced this month: two extra algebra blocks, essay review
                  moved to next week - and your scholarship deadline still has
                  9 days of slack.
                </motion.div>

                <motion.div
                  className="flex gap-1.5 pl-2"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 1.1 }}
                >
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink/40" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink/40" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-ink/40" />
                </motion.div>
              </div>
            </div>
          </Reveal>

          {/* Floating context cards - the Strategist's inputs */}
          <FloatWrap amplitude={8} duration={6.4} className="absolute -top-8 -left-2 lg:-left-16 hidden md:block z-10">
            <ContextCard
              tone="aurora"
              icon={<ScoreGlyph />}
              title="Score insight"
              line="Math −60 vs target · 3 practice tasks added"
              delay={0.4}
            />
          </FloatWrap>
          <FloatWrap amplitude={7} duration={7.2} delay={1.1} className="absolute -top-10 -right-2 lg:-right-14 hidden md:block z-10">
            <ContextCard
              tone="rose"
              icon={<GCalendar s={15} />}
              title="Deadline warning"
              line="NTU scholarship closes in 9 days"
              delay={0.6}
            />
          </FloatWrap>
          <FloatWrap amplitude={8} duration={6.8} delay={1.8} className="absolute -bottom-9 -left-1 lg:-left-12 hidden md:block z-10">
            <ContextCard
              tone="polaris"
              icon={<GRoute s={15} />}
              title="Focused node"
              line="Looking at: Essay draft v2"
              delay={0.8}
            />
          </FloatWrap>
          <FloatWrap amplitude={7} duration={7.6} delay={0.5} className="absolute -bottom-10 -right-1 lg:-right-16 hidden md:block z-10">
            <ContextCard
              tone="nova"
              icon={<GArrow s={14} />}
              title="Next step"
              line="Finish IELTS listening set 4"
              delay={1}
            />
          </FloatWrap>

          {/* Mobile: condensed context chips below the chat */}
          <div className="mt-5 flex md:hidden flex-wrap justify-center gap-2">
            {["Score insight", "Deadline warning", "Focused node", "Next step"].map((c, i) => (
              <motion.span
                key={c}
                className="rounded-full bg-paper-card ring-1 ring-ink/[0.08] px-3 py-1.5 text-[11.5px] font-medium text-ink-dim"
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {c}
              </motion.span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ContextCard({
  tone, icon, title, line, delay,
}: {
  tone: "aurora" | "rose" | "polaris" | "nova";
  icon: React.ReactNode; title: string; line: string; delay: number;
}) {
  const tile = {
    aurora:  "from-aurora-400 to-aurora-600",
    rose:    "from-[#C36F89] to-signal-rose",
    polaris: "from-polaris-300 to-polaris-500",
    nova:    "from-nova-400 to-nova-600",
  }[tone];
  return (
    <motion.div
      className={cn(glassLight, "px-4 py-3 max-w-[230px]")}
      initial={{ opacity: 0, scale: 0.9 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.5, type: "spring", stiffness: 200, damping: 18 }}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg text-white bg-gradient-to-br", tile)}>
          {icon}
        </span>
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-muted">{title}</span>
      </div>
      <div className="mt-2 text-[12.5px] font-medium text-ink leading-snug">{line}</div>
    </motion.div>
  );
}

function ScoreGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 17 9 11 13 15 21 7" /><polyline points="14 7 21 7 21 14" />
    </svg>
  );
}

