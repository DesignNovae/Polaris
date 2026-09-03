"use client";

/**
 * Final CTA - cinematic close: deep ink, a breathing north-star burst with
 * slow-rotating compass rays, star field, and the strongest buttons on the
 * page.
 */

import Link from "next/link";
import { useSession } from "@/components/SessionProvider";
import { motion, useReducedMotion } from "framer-motion";
import { Accent, Dot, Reveal, StarField, GArrow, GRoute, NorthStarMark } from "./shared";

export function LandingCTA() {
  const { data: session } = useSession();
  const reduce = useReducedMotion();

  return (
    <section
      data-section-theme="dark"
      className="relative overflow-hidden bg-ink text-paper"
    >
      {/* Background drama */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[80vh] w-[80vw] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgba(196,125,78,0.22), rgba(184,84,106,0.08) 55%, transparent 75%)" }}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: [0.85, 0.6, 0.85] }}
          transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
        />
        <StarField count={30} />
        {/* Slow-rotating compass rays */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-[0.07]"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
        >
          <svg width="900" height="900" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="none" stroke="#C47D4E" strokeWidth="0.3" />
            <circle cx="50" cy="50" r="32" fill="none" stroke="#C47D4E" strokeWidth="0.3" />
            <line x1="50" y1="2" x2="50" y2="98" stroke="#C47D4E" strokeWidth="0.25" />
            <line x1="2" y1="50" x2="98" y2="50" stroke="#C47D4E" strokeWidth="0.25" />
            <line x1="16" y1="16" x2="84" y2="84" stroke="#C47D4E" strokeWidth="0.2" />
            <line x1="84" y1="16" x2="16" y2="84" stroke="#C47D4E" strokeWidth="0.2" />
          </svg>
        </motion.div>
      </div>

      <div className="relative mx-auto max-w-4xl px-6 py-28 sm:py-36 text-center">
        {/* Star mark with pulse halo */}
        <Reveal>
          <div className="relative inline-flex">
            {!reduce && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: "0 0 60px 8px rgba(196,125,78,0.45)" }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-polaris-400 via-polaris-500 to-aurora-600 text-paper shadow-[0_20px_60px_-15px_rgba(0,0,0,0.6)]">
              <NorthStarMark s={30} />
            </span>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <h2 className="mt-8 text-balance font-sans text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.06] tracking-tight">
            Start building your admission roadmap <Accent>today</Accent>
            <Dot />
          </h2>
        </Reveal>

        <Reveal delay={0.18}>
          <p className="mt-6 mx-auto max-w-xl text-base sm:text-lg text-paper/65 leading-relaxed">
            Your level, your timeline, your universities - turned into a plan
            that knows what you should do next.
          </p>
        </Reveal>

        <Reveal delay={0.26}>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href={session ? "/roadmap" : "/signup"}
              className="group inline-flex items-center gap-2 rounded-full bg-paper px-7 py-4 text-[15px] font-semibold text-ink hover:bg-paper-soft transition-colors shadow-[0_16px_50px_-12px_rgba(250,246,240,0.5)]"
            >
              Get started - free
              <span className="transition-transform duration-200 group-hover:translate-x-1"><GArrow /></span>
            </Link>
            <Link
              href="/roadmap"
              className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-6 py-4 text-[14px] font-medium text-paper hover:bg-white/15 transition-colors"
            >
              <GRoute s={16} /> Build my roadmap
            </Link>
          </div>
        </Reveal>

        <Reveal delay={0.34}>
          <p className="mt-7 text-[12.5px] text-paper/45">
            Free plan, no card required · EN / বাংলা
          </p>
        </Reveal>
      </div>
    </section>
  );
}

