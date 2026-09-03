"use client";

/**
 * Sign language interpreter.
 *
 * A real accessibility commitment nobody else in this market has shipped, and
 * it was entirely absent from the landing page.
 *
 * Deliberately the quietest section on the page: no orbit, no parallax, one
 * restrained loop. Shouting about an accessibility feature with heavy motion
 * would undercut it - and the honesty note about what the pipeline will and
 * will not do matters more here than any animation.
 */

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, useAmbient, glassDark, GArrow,
} from "./shared";

export function InterpreterSection() {
  const { ref, active } = useAmbient<HTMLDivElement>();
  const reduce = useReducedMotion();

  return (
    <section
      id="interpreter"
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      <div ref={ref} className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          onDark
          align="left"
          eyebrow="Accessibility"
          title={<>A lesson every student can <Accent>actually follow</Accent><Dot /></>}
          sub="Video Learning carries an optional sign language interpreter track beside the player, for Deaf and hard-of-hearing students who are routinely left to lip-read a lecture recording."
        />

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
          {/* ── Player ── */}
          <Reveal>
            <div className={cn(glassDark, "overflow-hidden p-3")}>
              <div className="relative aspect-video overflow-hidden rounded-xl bg-[#1b100c]">
                {/* lesson frame stand-in - a diagram being drawn */}
                <svg viewBox="0 0 320 180" className="h-full w-full" aria-hidden>
                  <rect width="320" height="180" fill="#1b100c" />
                  {[40, 70, 100, 130].map((y, i) => (
                    <motion.line
                      key={y}
                      x1="28" y1={y} x2="196" y2={y}
                      stroke="rgba(250,246,240,0.16)" strokeWidth="2" strokeLinecap="round"
                      initial={{ pathLength: 0 }}
                      whileInView={{ pathLength: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.8, delay: i * 0.15, ease: "easeOut" }}
                    />
                  ))}
                  <motion.path
                    d="M28 150 C 70 150, 90 100, 130 92 S 180 70, 210 44"
                    fill="none" stroke="#C47D4E" strokeWidth="2.5" strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.4, delay: 0.5, ease: "easeOut" }}
                  />
                </svg>

                {/* interpreter inset */}
                <div className="absolute bottom-3 right-3 w-[30%] overflow-hidden rounded-lg border border-aurora-400/45 bg-[#2C1810] shadow-[0_10px_30px_-10px_rgba(0,0,0,0.8)]">
                  <div className="flex items-center gap-1 border-b border-white/[0.08] px-2 py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-aurora-400" />
                    <span className="text-[8.5px] font-semibold uppercase tracking-[0.14em] text-aurora-200">
                      Interpreter
                    </span>
                  </div>
                  <svg viewBox="0 0 80 64" className="w-full" aria-hidden>
                    <circle cx="40" cy="22" r="9" fill="#8FB89A" />
                    <path d="M26 56 q14 -16 28 0" fill="#6B9E7B" />
                    {/* the hands - the only looping motion in the section */}
                    <motion.g
                      animate={active ? { y: [0, -3, 1, 0], x: [0, 2, -2, 0] } : undefined}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <circle cx="26" cy="40" r="4.5" fill="#A8CDB4" />
                      <circle cx="54" cy="44" r="4.5" fill="#A8CDB4" />
                    </motion.g>
                  </svg>
                </div>

                {/* caption strip */}
                <div className="absolute inset-x-3 bottom-3 w-[64%] rounded-lg bg-black/55 px-3 py-2 backdrop-blur-sm">
                  <p className="text-[11px] leading-snug text-paper/90">
                    “Solve for x by isolating the variable on one side.”
                  </p>
                </div>
              </div>

              {/* transport */}
              <div className="flex items-center gap-3 px-2 pb-1 pt-3">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-paper text-ink">
                  <svg width="10" height="10" viewBox="0 0 10 12" fill="currentColor" aria-hidden>
                    <path d="M0 0l10 6-10 6z" />
                  </svg>
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.10]">
                  <motion.div
                    className="h-full rounded-full bg-polaris-400"
                    initial={{ width: "12%" }}
                    animate={active && !reduce ? { width: ["12%", "68%"] } : { width: "38%" }}
                    transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
                  />
                </div>
                <span className="rounded-md bg-aurora-400/15 px-2 py-1 text-[10px] font-semibold text-aurora-200">
                  Sign track on
                </span>
              </div>
            </div>
          </Reveal>

          {/* ── The commitment, and its limits ── */}
          <Reveal delay={0.08}>
            <ul className="space-y-5">
              {[
                {
                  t: "Signs come from a curated lexicon",
                  d: "Handshapes are never invented by the model. It selects and orders from a vetted vocabulary; anything outside it is finger-spelled instead of guessed.",
                },
                {
                  t: "The model never claims to have heard the audio",
                  d: "Where there is no transcript, what you get is a study outline, tagged as AI-generated - never presented as the speaker's words.",
                },
                {
                  t: "A failed upgrade never breaks playback",
                  d: "Every stage degrades to a working deterministic path. The lesson keeps playing.",
                },
              ].map((row) => (
                <li key={row.t} className="flex gap-3.5">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-400" />
                  <div>
                    <div className="text-[15px] font-semibold text-paper">{row.t}</div>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-paper/60">{row.d}</p>
                  </div>
                </li>
              ))}
            </ul>

            <Link
              href="/demo/action-lab"
              className="group mt-8 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13.5px] font-semibold text-paper backdrop-blur-md transition-colors hover:bg-white/[0.12]"
            >
              See Video Learning
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                <GArrow />
              </span>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
