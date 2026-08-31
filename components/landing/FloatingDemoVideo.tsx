"use client";

/**
 * Floating product-demo video - sits between the hero and the ecosystem
 * section. A premium glass frame around the Vimeo demo: aura glow behind,
 * spring entrance, gentle hover lift, fully responsive 16:9.
 *
 * Performance: the iframe is NOT rendered until the section scrolls into
 * view (or the user clicks the poster) - no layout shift because the
 * aspect-ratio box reserves the space. Playback starts muted+looped per
 * browser autoplay rules; native Vimeo controls stay visible so the user
 * can unmute with one click.
 */

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Eyebrow, Accent, Dot, Reveal } from "./shared";

const VIMEO_ID = "1200552705";
const EMBED_SRC =
  `https://player.vimeo.com/video/${VIMEO_ID}` +
  `?badge=0&autopause=0&player_id=0&app_id=58479` +
  `&autoplay=1&muted=1&loop=1&controls=1`;

export function FloatingDemoVideo() {
  const [active, setActive] = useState(false);
  const reduce = useReducedMotion();

  return (
    <section data-section-theme="dark" className="relative overflow-hidden bg-ink text-paper">
      {/* Aura behind the frame */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 h-[70vh] w-[85vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.20), rgba(91,140,109,0.07) 55%, transparent 75%)" }}
          animate={reduce ? undefined : { scale: [1, 1.08, 1], opacity: [0.85, 0.6, 0.85] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-6 pt-4 pb-24 sm:pb-28">
        {/* Intro - short; the visual is the focus */}
        <div className="text-center">
          <Reveal>
            <Eyebrow onDark>Product demo</Eyebrow>
          </Reveal>
          <Reveal delay={0.06}>
            <h2 className="mt-6 mx-auto max-w-3xl text-balance font-sans text-3xl sm:text-4xl md:text-[44px] font-bold leading-[1.08] tracking-tight text-paper">
              See Polaris <Accent>in action</Accent>
              <Dot />
            </h2>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-4 mx-auto max-w-xl text-[15px] text-paper/65 leading-relaxed">
              From confusion to a living admission roadmap - in minutes.
            </p>
          </Reveal>
        </div>

        {/* Floating glass frame */}
        <motion.div
          initial={{ opacity: 0, y: 42, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-12%" }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          onViewportEnter={() => setActive(true)}
          whileHover={reduce ? undefined : { y: -7, transition: { duration: 0.3 } }}
          className="relative mt-10 sm:mt-12"
          style={{ perspective: 1100 }}
        >
          {/* Edge glow */}
          <div
            aria-hidden
            className="absolute -inset-1 rounded-[26px] pointer-events-none"
            style={{ boxShadow: "0 0 80px -16px rgba(196,125,78,0.5), 0 0 30px -12px rgba(91,140,109,0.35)" }}
          />

          <div className="relative rounded-3xl border border-white/12 bg-[#241510]/85 backdrop-blur-xl p-2 sm:p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_50px_140px_-40px_rgba(0,0,0,0.8)]">
            {/* Chrome strip */}
            <div className="flex items-center gap-2 px-3 pb-2 pt-1">
              <span className="h-2.5 w-2.5 rounded-full bg-[#E0655A]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#E8C757]/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#6B9E7B]/80" />
              <span className="ml-3 hidden sm:block flex-1 max-w-[260px] rounded-full bg-white/[0.06] px-3 py-1 text-[10.5px] text-paper/45 truncate">
                polaris - product demo
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] font-semibold text-paper/60">
                <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 pulse-dot" />
                Muted - tap to unmute
              </span>
            </div>

            {/* 16:9 stage - reserved height, zero layout shift */}
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#1a0f0a]">
              {active ? (
                <iframe
                  src={EMBED_SRC}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full"
                  frameBorder="0"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  title="Polaris product demo"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActive(true)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-paper/70 hover:text-paper transition-colors"
                  aria-label="Play the Polaris demo"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, rgba(196,125,78,0.16), transparent 70%)" }}
                  />
                  <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-paper text-ink shadow-[0_18px_50px_-12px_rgba(250,246,240,0.45)]">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M7 4l13 8-13 8V4z" />
                    </svg>
                  </span>
                  <span className="relative text-[12.5px] font-medium">Watch the demo</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
