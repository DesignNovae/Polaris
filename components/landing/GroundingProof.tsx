"use client";

/**
 * Grounding proof.
 *
 * "Grounded, not generative-only" is the strategic claim, and the landing page
 * previously asserted it in prose while the repository could prove it in
 * numbers. These are the figures the eval harnesses actually produce
 * (`npm run rag:eval`, `npm run rag:faith`, `npm run rag:calibrate`), reported
 * with their sample sizes rather than rounded into marketing.
 *
 * The pipeline diagram traces one real Strategist turn, in order, ending on the
 * two checks that run after generation - which is the part that makes the claim
 * different from every other admissions chatbot.
 */

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, CountUp, useAmbient, glassDark,
} from "./shared";

type Metric = {
  value: number;
  decimals: number;
  suffix?: string;
  label: string;
  note: string;
};

/** Straight from docs/RAG.md - see the README's retrieval section. */
const METRICS: Metric[] = [
  {
    value: 0.957, decimals: 3,
    label: "Citation precision",
    note: "Share of citations that point at a passage actually retrieved for that answer.",
  },
  {
    value: 0, decimals: 0,
    label: "Unsupported figures",
    note: "Numbers asserted without a retrieved source. A deterministic guard scans every answer.",
  },
  {
    value: 0.903, decimals: 3,
    label: "Groundedness",
    note: "LLM judge, itself calibrated against labelled fixtures at 0.800 detection and a 0.000 false-alarm rate.",
  },
  {
    value: 0.98, decimals: 2,
    label: "Recall@3",
    note: "Hybrid BM25 + dense retrieval over 50 labelled queries spanning 5 query kinds.",
  },
];

const PIPELINE = [
  { step: "Plan queries", note: "Follow-ups rewritten into standalone questions" },
  { step: "Retrieve", note: "Shared knowledge base and your own record, in parallel" },
  { step: "Second pass", note: "Fires when the best passage falls below threshold" },
  { step: "Generate", note: "Gemma 4, streamed, with only what retrieval found" },
  { step: "Audit citations", note: "Every reference checked against what was retrieved", check: true },
  { step: "Scan for figures", note: "Unsupported numbers surface a visible warning", check: true },
];

export function GroundingProof() {
  const { ref, active } = useAmbient<HTMLDivElement>();
  const reduce = useReducedMotion();

  return (
    <section
      id="grounding"
      data-section-theme="dark"
      className="relative overflow-hidden bg-[#241510] text-paper"
    >
      <div ref={ref} className="relative mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          onDark
          eyebrow="Measured, not asserted"
          title={<>The answer is <Accent>checked</Accent> before it reaches you<Dot /></>}
          sub="A model that sounds confident is easy. Polaris retrieves first, cites what it used, and then runs two deterministic checks over its own answer - and publishes what those checks score."
        />

        {/* ── Metrics ── */}
        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.07] sm:grid-cols-2 lg:grid-cols-4">
          {METRICS.map((m, i) => (
            <Reveal key={m.label} delay={i * 0.06}>
              <div className="h-full bg-[#241510] p-6">
                <div className="font-serif text-[38px] font-bold leading-none text-polaris-200 tabular-nums">
                  <CountUp value={m.value} decimals={m.decimals} suffix={m.suffix} />
                </div>
                <div className="mt-3 text-[13px] font-semibold text-paper">{m.label}</div>
                <p className="mt-1.5 text-[12px] leading-relaxed text-paper/50">{m.note}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={0.1}>
          <p className="mt-4 text-center text-[11.5px] text-paper/40">
            Retrieval measured over 50 labelled queries against 114 indexed chunks; generation checks over an 8-answer sample. Reproduce with{" "}
            <code className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-paper/70" data-no-translate>
              npm run rag:eval
            </code>{" "}
            and{" "}
            <code className="rounded bg-white/[0.07] px-1.5 py-0.5 text-[11px] text-paper/70" data-no-translate>
              npm run rag:faith
            </code>
            .
          </p>
        </Reveal>

        {/* ── One turn, in order ── */}
        <Reveal delay={0.14}>
          <div className={cn(glassDark, "mt-14 p-6 sm:p-8")}>
            <div className="text-[10.5px] uppercase tracking-[0.22em] text-polaris-300">
              One Strategist turn
            </div>

            <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {PIPELINE.map((p, i) => (
                <li key={p.step} className="relative">
                  <motion.div
                    className={cn(
                      "h-full rounded-xl border p-4",
                      p.check
                        ? "border-aurora-400/35 bg-aurora-400/[0.07]"
                        : "border-white/[0.09] bg-white/[0.03]",
                    )}
                    initial={reduce ? false : { opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-10%" }}
                    transition={{ duration: 0.5, delay: i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold tabular-nums",
                          p.check ? "bg-aurora-400 text-ink" : "bg-white/[0.10] text-paper/70",
                        )}
                        data-no-translate
                      >
                        {i + 1}
                      </span>
                      <span className="text-[13.5px] font-semibold text-paper">{p.step}</span>
                      {p.check && (
                        <span className="ml-auto text-[9.5px] font-bold uppercase tracking-[0.16em] text-aurora-200">
                          check
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-paper/60">{p.note}</p>
                  </motion.div>
                </li>
              ))}
            </ol>

            {/* The honest edge case, stated rather than hidden. */}
            <div className="mt-6 flex items-start gap-3 rounded-xl border border-white/[0.09] bg-white/[0.03] p-4">
              <motion.span
                aria-hidden
                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-rose-300"
                animate={active ? { opacity: [1, 0.3, 1] } : undefined}
                transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <p className="text-[13px] leading-relaxed text-paper/65">
                When retrieval genuinely finds nothing, the model is handed an empty
                context so it declines - rather than answering from memory and citing
                nothing. Refusing is a feature.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
