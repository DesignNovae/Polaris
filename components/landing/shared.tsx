"use client";

/**
 * Landing design primitives - the shared visual language for every section:
 * eyebrow pills, serif-accent headlines, glass panels, 3D tilt, and float
 * loops. Pure presentation; all motion is transform/opacity-only so the page
 * stays smooth on low-end devices.
 */

import { useCallback } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/cn";

/* ─── Eyebrow pill ─────────────────────────────────────────────────────── */

export function Eyebrow({ children, onDark }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3.5 py-1.5 text-[11px] uppercase tracking-[0.24em] font-semibold",
        onDark
          ? "bg-signal-rose/15 text-[#F5C0C9] ring-1 ring-inset ring-signal-rose/30"
          : "bg-[#F5DDE3] text-signal-rose ring-1 ring-inset ring-[#EFC8D2]",
      )}
    >
      {children}
    </span>
  );
}

/* ─── Serif accent inside bold headlines ───────────────────────────────── */

export function Accent({ children }: { children: React.ReactNode }) {
  return <em className="font-serif font-normal italic text-signal-rose">{children}</em>;
}

/** Rose full-stop that ends every headline. */
export function Dot() {
  return <span className="text-signal-rose">.</span>;
}

/* ─── Section intro (eyebrow + headline + sub) ─────────────────────────── */

export function SectionIntro({
  eyebrow, title, sub, onDark, align = "center", className,
}: {
  eyebrow: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  onDark?: boolean;
  align?: "center" | "left";
  className?: string;
}) {
  const centered = align === "center";
  return (
    <div className={cn(centered && "text-center", className)}>
      <Reveal>
        <Eyebrow onDark={onDark}>{eyebrow}</Eyebrow>
      </Reveal>
      <Reveal delay={0.06}>
        <h2
          className={cn(
            "mt-6 text-balance font-sans text-3xl sm:text-4xl md:text-5xl lg:text-[52px] font-bold leading-[1.08] tracking-tight",
            centered && "mx-auto max-w-4xl",
            onDark ? "text-paper" : "text-ink",
          )}
        >
          {title}
        </h2>
      </Reveal>
      {sub && (
        <Reveal delay={0.12}>
          <p
            className={cn(
              "mt-5 max-w-2xl text-base sm:text-lg leading-relaxed",
              centered && "mx-auto",
              onDark ? "text-paper/65" : "text-ink-dim",
            )}
          >
            {sub}
          </p>
        </Reveal>
      )}
    </div>
  );
}

/* ─── Scroll reveal (viewport-once, gentle rise) ───────────────────────── */

export function Reveal({
  children, delay = 0, y = 18, className,
}: {
  children: React.ReactNode; delay?: number; y?: number; className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Glass panel class helpers ────────────────────────────────────────── */

export const glassDark =
  "rounded-3xl border border-white/10 bg-white/[0.05] backdrop-blur-md " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_70px_-30px_rgba(0,0,0,0.6)]";

export const glassLight =
  "rounded-3xl bg-paper-card border border-ink/[0.07] " +
  "shadow-[0_1px_0_rgba(139,94,60,0.04),0_24px_60px_-30px_rgba(139,94,60,0.2)]";

/* ─── 3D mouse tilt ────────────────────────────────────────────────────── */

export function useTilt(max = 7): {
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent<HTMLElement>) => void;
  onMouseLeave: () => void;
} {
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rotateX = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 140, damping: 18 });
  const rotateY = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 140, damping: 18 });

  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      px.set((e.clientX - r.left) / r.width);
      py.set((e.clientY - r.top) / r.height);
    },
    [px, py],
  );
  const onMouseLeave = useCallback(() => {
    px.set(0.5);
    py.set(0.5);
  }, [px, py]);

  return { rotateX, rotateY, onMouseMove, onMouseLeave };
}

/* ─── Idle float loop (disabled for reduced-motion users) ──────────────── */

export function FloatWrap({
  children, className, amplitude = 7, duration = 6, delay = 0,
}: {
  children: React.ReactNode; className?: string;
  amplitude?: number; duration?: number; delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      animate={{ y: [-amplitude, amplitude, -amplitude] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {children}
    </motion.div>
  );
}

/* ─── Deterministic star field (hydration-safe: no Math.random) ────────── */

export function StarField({ count = 24, className }: { count?: number; className?: string }) {
  const stars = Array.from({ length: count }, (_, i) => ({
    left: ((i * 67 + 13) % 100),
    top: ((i * 41 + 7) % 88),
    size: 1 + ((i * 29) % 3) * 0.6,
    delay: ((i * 53) % 40) / 10,
  }));
  return (
    <div aria-hidden className={cn("absolute inset-0 pointer-events-none", className)}>
      {stars.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-paper/80 animate-twinkle"
          style={{
            left: `${s.left}%`,
            top: `${s.top}%`,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            opacity: 0.5,
          }}
        />
      ))}
    </div>
  );
}

/* ─── Tiny glyphs shared across sections ───────────────────────────────── */

const stroke = {
  fill: "none", stroke: "currentColor", strokeWidth: 1.8,
  strokeLinecap: "round" as const, strokeLinejoin: "round" as const,
};

export function GRoute({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <circle cx="6" cy="19" r="2" /><circle cx="18" cy="5" r="2" />
      <path d="M8 19h6a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h6" />
    </svg>
  );
}
export function GChat({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M21 12a8.5 8.5 0 1 1-3.4-6.8L21 4l-1.2 3.6A8.5 8.5 0 0 1 21 12z" />
    </svg>
  );
}
export function GBuilding({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M3 10l9-5 9 5" /><path d="M5 10v9h14v-9" />
      <line x1="9" y1="14" x2="9" y2="19" /><line x1="12" y1="14" x2="12" y2="19" />
      <line x1="15" y1="14" x2="15" y2="19" />
    </svg>
  );
}
export function GCalendar({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="5" width="18" height="16" rx="2.5" />
      <line x1="3" y1="11" x2="21" y2="11" />
      <line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  );
}
export function GBook({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M2 4h7a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H2V4z" />
      <path d="M22 4h-7a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h8V4z" />
    </svg>
  );
}
export function GLink({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5" />
      <path d="M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" />
    </svg>
  );
}
export function GGift({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8" />
      <line x1="12" y1="8" x2="12" y2="20" />
      <path d="M12 8a3 3 0 1 0-3-5c1.5 0 3 2 3 5zM12 8a3 3 0 1 1 3-5c-1.5 0-3 2-3 5z" />
    </svg>
  );
}
export function GUser({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  );
}
export function GStar({ s = 20, filled }: { s?: number; filled?: boolean }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...(filled ? { fill: "currentColor" } : stroke)}>
      <polygon points="12 2 14.4 8.26 21 9 16 13.74 17.2 20.5 12 17.27 6.82 20.5 8 13.74 3 9 9.6 8.26 12 2" />
    </svg>
  );
}
export function GShield({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </svg>
  );
}
export function GFlame({ s = 20 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" {...stroke}>
      <path d="M12 22c4 0 7-2.7 7-6.7 0-3.6-2.6-6.1-4.4-8.3C13.3 5.4 12.6 3.7 12.5 2c-2.3 1.6-3.7 3.6-3.9 6-.1 1.3.2 2.4.6 3.3-1-.3-1.9-1-2.4-2.1C5.6 10.6 5 12.4 5 15.3 5 19.3 8 22 12 22z" />
    </svg>
  );
}
export function GCheck({ s = 14 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}
export function GArrow({ s = 13 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
export function NorthStarMark({ s = 28 }: { s?: number }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 1.5c.7 4.6 2.4 7.8 4.5 8.5 2-.7 3.8-3.9 4.5-8.5-4.6.7-7.8 2.4-8.5 4.5-.7-2.1-3.9-3.8-9-4.5.7 5.1 2.4 8.3 4.5 9C5.9 11.2 4.2 14.4 3.5 19c4.6-.7 7.8-2.4 8.5-4.5.7 2.1 3.9 3.8 8.5 4.5-.7-4.6-2.4-7.8-4.5-8.5z" transform="rotate(45 12 12) scale(0.78) translate(3.4 3.4)" />
      <path d="M12 2l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z" />
    </svg>
  );
}
