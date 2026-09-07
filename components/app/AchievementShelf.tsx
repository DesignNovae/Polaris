"use client";

/**
 * The achievement shelf.
 *
 * These were medallions - a disc, a star, a centred caps label. That reads as
 * a game trophy, and a game trophy is exactly the wrong register for the one
 * artifact in this product that has to survive being read by an admissions
 * officer. A trophy says "this student enjoys our app". A stamp says "this was
 * checked".
 *
 * So each achievement is a stamped record instead:
 *
 *   - a rubber stamp, struck slightly off-square because a hand pressed it,
 *     with the tier set on a curve inside the ring the way real stamps carry
 *     their issuing office
 *   - the *claim* as the primary line, in the serif the passport uses. The
 *     short title is a filing label; the claim is the thing worth reading, and
 *     leading with it means the shelf shows what the recommender will see
 *   - left-aligned, hairline-ruled, with the date in mono at the foot - the
 *     furniture of a record, not a card
 *
 * Locked entries are the same object in dry ink: an unstruck ring with the
 * count inside it. Same shape, no pigment - the difference you want to feel.
 *
 * The tilt survives from the previous version because it earns its place: the
 * stamp sits on its own depth plane above the card, so moving across it
 * parallaxes the stamp over the paper the way a real impression catches light.
 * All of it is off under prefers-reduced-motion.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { cn } from "@/lib/cn";
import { TIER_LABEL, type BadgeTier } from "@/lib/badges/catalog";

export type ShelfBadge = {
  id: string;
  title: string;
  claim: string;
  signal: string;
  gap: string;
  tier: BadgeTier;
  earnedAt: string | null;
  have?: number;
  need?: number;
};

/** Ink colours. Tier is the pigment, never the shape. */
const INK: Record<BadgeTier, { ink: string; soft: string; edge: string }> = {
  foundation:    { ink: "#8B5E3C", soft: "rgba(139,94,60,0.10)",  edge: "rgba(139,94,60,0.34)" },
  sustained:     { ink: "#3F6E56", soft: "rgba(63,110,86,0.10)",  edge: "rgba(63,110,86,0.34)" },
  distinguished: { ink: "#9A6B1F", soft: "rgba(154,107,31,0.11)", edge: "rgba(154,107,31,0.36)" },
};

export function AchievementShelf({
  badges,
  emptyHint,
}: {
  badges: ShelfBadge[];
  emptyHint?: string;
}) {
  const [open, setOpen] = useState<ShelfBadge | null>(null);

  if (badges.length === 0) {
    return <p className="text-[13.5px] text-ink-dim">{emptyHint ?? "No achievements yet."}</p>;
  }

  return (
    <>
      {/* auto-fill with a hard minimum, not viewport breakpoints: this column
          changes width when the Strategist rail opens, so a breakpoint grid
          silently squeezes three cards into space for one and the claim
          wraps to five lines. */}
      <ul
        className="grid gap-3"
        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(305px, 1fr))" }}
      >
        {badges.map((badge, i) => (
          <li key={badge.id}>
            <StampRecord badge={badge} index={i} onOpen={() => setOpen(badge)} />
          </li>
        ))}
      </ul>
      <RecordSheet badge={open} onClose={() => setOpen(null)} />
    </>
  );
}

function StampRecord({
  badge,
  index,
  onOpen,
}: {
  badge: ShelfBadge;
  index: number;
  onOpen: () => void;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const earned = badge.earnedAt !== null;
  const ink = INK[badge.tier];

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 210, damping: 24, mass: 0.6 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-9, 9]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [7, -7]);
  const glareX = useTransform(sx, [-0.5, 0.5], [70, 30]);
  const glare = useMotionTemplate`linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.16) ${glareX}%, transparent 68%)`;

  const onMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce) return;
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    px.set((e.clientX - box.left) / box.width - 0.5);
    py.set((e.clientY - box.top) / box.height - 0.5);
  }, [px, py, reduce]);

  const pct = !earned && badge.need
    ? Math.min(100, Math.round(((badge.have ?? 0) / badge.need) * 100))
    : 100;

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => { px.set(0); py.set(0); }}
      style={{ perspective: 1100 }}
    >
      <motion.button
        type="button"
        onClick={onOpen}
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.04, ease: [0.16, 1, 0.3, 1] }}
        whileHover={reduce ? undefined : { z: 26 }}
        style={{
          rotateX: reduce ? 0 : rotateX,
          rotateY: reduce ? 0 : rotateY,
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "group relative flex w-full gap-4 overflow-hidden rounded-xl px-4 py-4 text-left transition-shadow duration-300",
          "bg-paper-card ring-1 ring-inset",
          earned
            ? "ring-ink/[0.10] shadow-[0_8px_24px_-16px_rgba(44,24,16,0.5)] hover:shadow-[0_20px_40px_-22px_rgba(44,24,16,0.6)] dark:ring-white/[0.10]"
            : "ring-ink/[0.06] dark:ring-white/[0.06]",
        )}
      >
        {/* Paper grain. Kept faint - it is the surface, not the subject. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(44,24,16,0.05) 0.5px, transparent 0.5px)",
            backgroundSize: "7px 7px",
          }}
        />
        {earned && !reduce && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: glare }}
          />
        )}

        {/* The impression, on its own plane above the paper. */}
        <span
          className="relative shrink-0"
          style={{ transform: "translateZ(30px)" }}
        >
          <Stamp badge={badge} earned={earned} ink={ink} percent={pct} />
        </span>

        <span className="relative min-w-0 flex-1" style={{ transform: "translateZ(14px)" }}>
          <span
            className={cn(
              "block font-serif text-[14.5px] font-semibold leading-snug",
              earned ? "text-ink" : "text-ink-muted",
            )}
          >
            {badge.claim}
          </span>

          <span className="mt-2.5 flex items-center gap-2 border-t border-ink/[0.08] pt-2 dark:border-white/[0.08]">
            <span
              className="font-mono text-[9.5px] uppercase tracking-[0.14em]"
              style={{ color: earned ? ink.ink : undefined }}
            >
              {earned ? TIER_LABEL[badge.tier] : "Not yet struck"}
            </span>
            <span className="ml-auto font-mono text-[9.5px] tabular-nums text-ink-muted">
              {earned
                ? new Date(badge.earnedAt!).toLocaleDateString("en-GB", {
                    day: "2-digit", month: "short", year: "numeric",
                  })
                : `${badge.have ?? 0} / ${badge.need ?? 0}`}
            </span>
          </span>
        </span>
      </motion.button>
    </div>
  );
}

/**
 * The stamp itself.
 *
 * Tier text runs along the inner ring on a path, which is what makes it read
 * as an issuing mark rather than a badge with a caption. Path ids are scoped
 * to the badge id - several stamps share a document and duplicate ids would
 * make every one of them render the first stamp's text.
 */
function Stamp({
  badge,
  earned,
  ink,
  percent,
}: {
  badge: ShelfBadge;
  earned: boolean;
  ink: { ink: string; soft: string; edge: string };
  percent: number;
}) {
  const reduce = useReducedMotion();
  // Per instance, not per badge: the same badge is drawn in its card and again
  // in the record sheet, so keying on the badge id alone puts two identical
  // ids in the document and the second textPath silently follows the first.
  const topId = `stamp-top-${useId().replace(/:/g, "")}`;
  const colour = earned ? ink.ink : "currentColor";
  // A hand-pressed stamp is never square to the page.
  const tilt = earned ? -6 : 0;
  const r = 30;
  const c = 2 * Math.PI * r;

  return (
    <span
      className={cn("block", !earned && "text-ink-muted/55")}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <svg width="64" height="64" viewBox="0 0 100 100" aria-hidden>
        <defs>
          <path id={topId} d="M 20,50 A 30,30 0 0 1 80,50" fill="none" />
        </defs>

        {/* outer ring */}
        <circle
          cx="50" cy="50" r="45.5" fill={earned ? ink.soft : "transparent"}
          stroke={colour} strokeWidth={earned ? 2.4 : 1.6}
          strokeDasharray={earned ? undefined : "4 3.5"}
          opacity={earned ? 0.9 : 0.65}
        />
        {/* inner rule */}
        <circle
          cx="50" cy="50" r="38" fill="none" stroke={colour}
          strokeWidth="0.9" opacity={earned ? 0.55 : 0.35}
        />

        {/* issuing line, curved inside the ring */}
        <text
          fill={colour}
          fontSize="8.4"
          fontWeight="700"
          letterSpacing="2.4"
          opacity={earned ? 0.9 : 0.5}
          style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
        >
          <textPath href={`#${topId}`} startOffset="50%" textAnchor="middle">
            {earned ? TIER_LABEL[badge.tier].toUpperCase() : "IN PROGRESS"}
          </textPath>
        </text>

        {earned ? (
          <>
            {/* the mark */}
            <path
              d="M50 30l3.1 11.6L64.7 45 53.1 48.1 50 60l-3.1-11.9L35.3 45l11.6-3.4z"
              fill={colour}
              opacity="0.95"
            />
            <path
              d="M32 68h36"
              stroke={colour} strokeWidth="1.6" strokeLinecap="round" opacity="0.5"
            />
          </>
        ) : (
          <>
            {/* progress, struck as an arc so the shape stays a stamp */}
            <circle
              cx="50" cy="50" r={r} fill="none"
              stroke="currentColor" strokeWidth="4" opacity="0.16"
            />
            <motion.circle
              cx="50" cy="50" r={r} fill="none"
              stroke="currentColor" strokeWidth="4" strokeLinecap="round"
              opacity="0.75"
              transform="rotate(-90 50 50)"
              strokeDasharray={c}
              initial={reduce ? false : { strokeDashoffset: c }}
              animate={{ strokeDashoffset: c - (c * percent) / 100 }}
              transition={{ duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <text
              x="50" y="54" textAnchor="middle"
              fontSize="19" fontWeight="700" fill="currentColor" opacity="0.8"
              style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
            >
              {percent}
            </text>
          </>
        )}
      </svg>
    </span>
  );
}

/**
 * The full record.
 *
 * A sheet rather than the old inline block: the detail used to expand inside
 * the grid and shove every card below it down the page, which made reading one
 * achievement cost you your place in the list. This opens over the page,
 * closes on Escape, and returns focus where it was.
 */
function RecordSheet({ badge, onClose }: { badge: ShelfBadge | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!badge) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);

    // The workspace scrolls <main>, not the document, so locking body does
    // nothing here and the page slides around behind the open sheet. Lock
    // whichever element is actually the scroller.
    const scroller =
      document.querySelector<HTMLElement>("main.polaris-scrollbar") ?? document.body;
    const previous = scroller.style.overflow;
    scroller.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      scroller.style.overflow = previous;
    };
  }, [badge, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {badge && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-ink/45 p-4 backdrop-blur-[3px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={badge.title}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={reduce ? false : { opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: reduce ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-paper-card shadow-pop"
          >
            {/* a ruled head, like the top of a record card */}
            <div
              className="flex items-start gap-4 border-b border-ink/[0.09] px-6 py-5 dark:border-white/[0.09]"
              style={{ background: INK[badge.tier].soft }}
            >
              <Stamp
                badge={badge}
                earned={badge.earnedAt !== null}
                ink={INK[badge.tier]}
                percent={
                  badge.need
                    ? Math.min(100, Math.round(((badge.have ?? 0) / badge.need) * 100))
                    : 100
                }
              />
              <div className="min-w-0 flex-1 pt-1">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-muted">
                  {badge.earnedAt ? "Attested by Polaris" : "Not yet earned"}
                </div>
                <h3 className="mt-1 font-serif text-[19px] font-bold leading-snug text-ink">
                  {badge.claim}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-ink/[0.06] hover:text-ink"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <Field label="What Polaris observed">{badge.signal}</Field>

              {/* The limits are given the same weight as the claim, on purpose.
                  A statement without them is advertising. */}
              <div className="rounded-xl border border-dashed border-ink/15 px-4 py-3 dark:border-white/15">
                <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
                  Does not establish
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{badge.gap}</p>
              </div>

              {badge.earnedAt ? (
                <div className="flex items-center justify-between border-t border-ink/[0.08] pt-3.5 dark:border-white/[0.08]">
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                    Recorded
                  </span>
                  <span className="font-mono text-[11.5px] tabular-nums text-ink">
                    {new Date(badge.earnedAt).toLocaleDateString("en-GB", {
                      day: "2-digit", month: "long", year: "numeric",
                    })}
                  </span>
                </div>
              ) : (
                <div className="border-t border-ink/[0.08] pt-3.5 dark:border-white/[0.08]">
                  <div className="flex items-baseline justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
                      Progress
                    </span>
                    <span className="font-mono text-[11.5px] tabular-nums text-ink">
                      {badge.have ?? 0} of {badge.need ?? 0}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-deep dark:bg-white/[0.08]">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: INK[badge.tier].ink }}
                      initial={reduce ? false : { width: 0 }}
                      animate={{
                        width: `${badge.need ? Math.min(100, ((badge.have ?? 0) / badge.need) * 100) : 0}%`,
                      }}
                      transition={{ duration: reduce ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-dim">{children}</p>
    </div>
  );
}
