"use client";

/**
 * Exam Lab and Essay Studio.
 *
 * The two surfaces most likely to make someone describe Polaris to a friend,
 * and neither appeared on the landing page at all.
 *
 * Essay Studio is scroll-scrubbed: the reader controls the transcription by
 * scrolling, so the handwriting resolving into an editable draft happens at
 * their pace rather than on a timer they might miss. Under reduced motion the
 * scrub is skipped and the finished state renders immediately - the point of
 * the section is what it produces, not the transition.
 */

import { useRef } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, useAmbient, glassLight, GArrow, GCheck,
} from "./shared";

/**
 * A real Bengali sentence, so the demonstration is honest about what the OCR is
 * being asked to read rather than showing lorem squiggles.
 */
const BANGLA_LINES = [
  "আমার লক্ষ্য প্রকৌশল বিভাগে ভর্তি হওয়া।",
  "আমি প্রতিদিন গণিত ও পদার্থবিজ্ঞান অনুশীলন করি।",
  "গত বছর আমি একটি রোবোটিক্স প্রকল্প সম্পন্ন করেছি।",
];

export function ExamEssayShowcase() {
  return (
    <section
      id="exam-essay"
      data-section-theme="light"
      className="relative overflow-hidden bg-paper"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow="Exam Lab & Essay Studio"
          title={<>Practice that <Accent>survives the real world</Accent><Dot /></>}
          sub="A dropped connection mid-exam, an essay that only exists on paper - the two places where a study tool usually gives up."
        />

        <div className="mt-16 grid gap-6 lg:grid-cols-2 lg:gap-8">
          <ExamCard />
          <EssayScrub />
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Exam Lab - an interrupted attempt coming back as Resume
   ═══════════════════════════════════════════════════════════════════════════ */

function ExamCard() {
  const { ref, active } = useAmbient<HTMLDivElement>();
  const reduce = useReducedMotion();

  return (
    <Reveal>
      <div ref={ref} className={cn(glassLight, "h-full p-6 sm:p-8")}>
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-polaris-600">
          <span className="h-1.5 w-1.5 rounded-full bg-polaris-500" />
          Exam Lab
        </div>

        <h3 className="mt-4 font-serif text-[24px] font-bold leading-tight text-ink sm:text-[27px]">
          Autosave that assumes the power will go out
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-dim">
          A full adaptive SAT is four modules and a break. Every response is
          written as you go, so a lost connection an hour in comes back as{" "}
          <strong className="font-semibold text-ink">Resume</strong>, not a lost
          afternoon.
        </p>

        {/* Session list - one interrupted, one complete. */}
        <div className="mt-6 space-y-2.5">
          <SessionRow
            title="SAT - full adaptive"
            meta="Module 2 of 4 · 32:10 left"
            state="resume"
            pulse={active && !reduce}
          />
          <SessionRow title="IELTS - Reading" meta="Completed · Band 7.5" state="done" />
          <SessionRow title="SAT - Math module" meta="Completed · 690" state="done" />
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 border-t border-polaris-500/10 pt-5">
          {[
            { k: "4+1", v: "SAT modules & break" },
            { k: "4", v: "IELTS papers" },
            { k: "0", v: "Attempts lost" },
          ].map((s) => (
            <div key={s.v}>
              <div className="font-serif text-[21px] font-bold text-ink tabular-nums" data-no-translate>
                {s.k}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-ink-dim">{s.v}</div>
            </div>
          ))}
        </div>
      </div>
    </Reveal>
  );
}

function SessionRow({
  title, meta, state, pulse,
}: {
  title: string; meta: string; state: "resume" | "done"; pulse?: boolean;
}) {
  const resume = state === "resume";
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border px-3.5 py-3",
        resume
          ? "border-polaris-400/40 bg-polaris-400/[0.07]"
          : "border-polaris-500/10 bg-paper-soft",
      )}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        {pulse && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-polaris-400 opacity-70" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            resume ? "bg-polaris-500" : "bg-aurora-500",
          )}
        />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13.5px] font-semibold text-ink">{title}</div>
        <div className="text-[11.5px] text-ink-dim">{meta}</div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          resume ? "bg-polaris-500 text-paper" : "text-ink-dim",
        )}
      >
        {resume ? "Resume" : <GCheck />}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Essay Studio - handwriting resolving into a draft, scrubbed by scroll
   ═══════════════════════════════════════════════════════════════════════════ */

function EssayScrub() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  // Progress across the card's own passage through the viewport.
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start 0.85", "end 0.35"],
  });

  // Handwriting fades out as type fades in, with a deliberate overlap so both
  // are briefly visible - that overlap is what reads as "being transcribed".
  const inkOpacity = useTransform(scrollYProgress, [0, 0.55], [1, 0]);
  const typeOpacity = useTransform(scrollYProgress, [0.3, 0.75], [0, 1]);
  const scanY = useTransform(scrollYProgress, [0, 0.7], ["0%", "100%"]);
  const scanOpacity = useTransform(scrollYProgress, [0, 0.08, 0.62, 0.72], [0, 1, 1, 0]);

  return (
    <Reveal delay={0.08}>
      <div ref={wrapRef} className={cn(glassLight, "h-full p-6 sm:p-8")}>
        <div className="flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-aurora-700">
          <span className="h-1.5 w-1.5 rounded-full bg-aurora-500" />
          Essay Studio
        </div>

        <h3 className="mt-4 font-serif text-[24px] font-bold leading-tight text-ink sm:text-[27px]">
          Photograph the page. Keep the language.
        </h3>
        <p className="mt-3 text-[14.5px] leading-relaxed text-ink-dim">
          Bengali, English or a mix of both, in your own handwriting, becomes an
          editable draft with the original paragraphing intact. The image is
          processed for that one request and never stored.
        </p>

        {/* ── The page ── */}
        <div className="relative mt-6 overflow-hidden rounded-xl border border-polaris-500/12 bg-paper-soft p-4">
          {/* ruled paper */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.5]"
            style={{
              background:
                "repeating-linear-gradient(180deg, transparent 0 31px, rgba(139,94,60,0.14) 31px 32px)",
            }}
          />

          {/* scanning bar - only while scrubbing */}
          {!reduce && (
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 h-10"
              style={{
                top: scanY,
                opacity: scanOpacity,
                background:
                  "linear-gradient(180deg, transparent, rgba(107,158,123,0.22), transparent)",
              }}
            />
          )}

          <div className="relative min-h-[132px]">
            {/* handwritten layer */}
            <motion.div
              className="absolute inset-0 space-y-3"
              style={reduce ? { opacity: 0 } : { opacity: inkOpacity }}
              aria-hidden
            >
              {BANGLA_LINES.map((line, i) => (
                <div
                  key={i}
                  className="font-bangla text-[14.5px] leading-[32px] text-ink/55"
                  style={{
                    // A slight rotation and offset per line so it reads as a
                    // photographed page rather than typed text in a script font.
                    transform: `rotate(${i % 2 ? -0.5 : 0.6}deg) translateX(${i * 3}px)`,
                  }}
                >
                  {line}
                </div>
              ))}
            </motion.div>

            {/* transcribed layer */}
            <motion.div
              className="relative space-y-3"
              style={reduce ? { opacity: 1 } : { opacity: typeOpacity }}
            >
              {BANGLA_LINES.map((line, i) => (
                <div
                  key={i}
                  className="font-bangla text-[14.5px] leading-[32px] text-ink"
                >
                  {line}
                </div>
              ))}
            </motion.div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11.5px] text-ink-dim">
          <span className="inline-flex items-center gap-1.5">
            <span className="text-aurora-600"><GCheck /></span>
            Language preserved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-aurora-600"><GCheck /></span>
            Paragraphing kept
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="text-aurora-600"><GCheck /></span>
            Image not stored
          </span>
        </div>

        <Link
          href="/demo/action-lab"
          className="group mt-5 inline-flex items-center gap-2 text-[13.5px] font-semibold text-polaris-700 hover:text-polaris-800"
        >
          Try Essay Studio in the demo
          <span className="transition-transform duration-200 group-hover:translate-x-1">
            <GArrow />
          </span>
        </Link>
      </div>
    </Reveal>
  );
}
