"use client";

/**
 * Partners - a useful ecosystem, not a coupon wall. A loose floating cluster
 * of real offer chips (free-first), one card carrying the "matched to your
 * roadmap" ribbon, and the transparency promise stated outright - mirroring
 * the real marketplace rules in lib/partners.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/cn";
import {
  SectionIntro, Accent, Dot, Reveal, FloatWrap, glassLight,
  GGift, GArrow, GCheck,
} from "./shared";

const OFFERS: {
  name: string; kind: "Free" | "Curated"; line: string;
  matched?: boolean; float: number;
}[] = [
  { name: "GitHub Student Pack", kind: "Free", line: "Dev tools bundle for students", matched: true, float: 0 },
  { name: "Notion for Education", kind: "Free", line: "Free plan with a student email", float: 0.9 },
  { name: "Khan Academy SAT",     kind: "Free", line: "Official practice, no cost", float: 1.6 },
  { name: "IELTS mock bundle",    kind: "Curated", line: "Verified prep resource", float: 0.5 },
  { name: "Scholarship databases", kind: "Free", line: "DAAD, Chevening, Fulbright", float: 2.1 },
];

export function PartnersPreview() {
  return (
    <section
      id="partners-section"
      data-section-theme="light"
      className="relative overflow-hidden bg-paper-soft"
    >
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow="Partners + free student stuff"
          title={<>Free student tools and offers, <Accent>only when they match your goals</Accent><Dot /></>}
          sub="The marketplace reads your roadmap and surfaces what actually helps right now - free resources always rank first."
        />

        {/* Floating offer cluster */}
        <div className="mt-14 flex flex-wrap justify-center gap-4 sm:gap-5 max-w-4xl mx-auto">
          {OFFERS.map((o, i) => (
            <FloatWrap key={o.name} amplitude={6} duration={6 + o.float} delay={o.float}>
              <motion.div
                className={cn(
                  glassLight,
                  "relative px-5 py-4 w-[250px]",
                  o.matched && "ring-2 ring-polaris-400/40",
                )}
                initial={{ opacity: 0, y: 18, rotate: i % 2 ? 1.5 : -1.5 }}
                whileInView={{ opacity: 1, y: 0, rotate: i % 2 ? 1.2 : -1.2 }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ delay: 0.15 + i * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ rotate: 0, y: -5, transition: { duration: 0.25 } }}
              >
                {o.matched && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-polaris-500 px-2.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white shadow-md">
                    Matched to your roadmap
                  </span>
                )}
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#9C7BB8] to-[#6E548A] text-white">
                    <GGift s={16} />
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
                      o.kind === "Free"
                        ? "bg-aurora-100 text-aurora-700"
                        : "bg-[#F5DDE3] text-signal-rose",
                    )}
                  >
                    {o.kind}
                  </span>
                </div>
                <div className="mt-3 text-[14px] font-bold text-ink">{o.name}</div>
                <div className="mt-1 text-[12px] text-ink-dim leading-snug">{o.line}</div>
              </motion.div>
            </FloatWrap>
          ))}
        </div>

        {/* Transparency promise */}
        <Reveal delay={0.25}>
          <div className="mt-12 mx-auto max-w-2xl text-center">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] text-ink-dim">
              {[
                "Free resources always rank first",
                "Every offer has a verified source",
                "No hidden commissions",
              ].map((p) => (
                <span key={p} className="inline-flex items-center gap-1.5">
                  <span className="text-aurora-500"><GCheck s={12} /></span> {p}
                </span>
              ))}
            </div>
            <Link
              href="/signup"
              className="mt-6 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-polaris-500 hover:text-polaris-600 transition-colors"
            >
              Browse the marketplace <GArrow s={12} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
