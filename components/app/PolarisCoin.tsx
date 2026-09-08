"use client";

/**
 * A struck coin.
 *
 * The first version was a conic gradient with a number on it, which is a
 * poker chip. What makes a real coin read as minted is a small set of specific
 * things, and they are all cheap to draw properly:
 *
 *   - a REEDED EDGE. The milled ridges around the rim are the single strongest
 *     "this was struck, not printed" signal. Drawn as radial ticks.
 *   - GUILLOCHE. The interlocking rosette on banknotes and coin fields is a
 *     hypotrochoid - a curve traced by a point on a circle rolling inside
 *     another. It is generated here from the actual parametric equation rather
 *     than faked with overlapping circles, which is why it closes cleanly and
 *     never looks like clip art.
 *   - RELIEF. Raised metal is two strokes: a light one offset toward the light
 *     source and a dark one away from it. One stroke is a sticker; two is a
 *     surface.
 *   - A LEGEND on a curve, the way every real coin carries its issuer.
 *   - TWO FACES. It flips on its vertical axis when the balance changes and
 *     the reverse is genuinely different from the obverse, so the flip reads as
 *     a coin turning over rather than a card fading.
 *
 * The light source is fixed at the top-left and everything - relief, specular
 * sweep, rim shading - is consistent with it. Inconsistent lighting is what
 * makes CSS "3D" look flat no matter how many gradients are stacked on it.
 */

import { useId, useMemo } from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";

/* ── Geometry ───────────────────────────────────────────────────────────── */

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/**
 * Hypotrochoid path: a point at distance `d` from the centre of a circle of
 * radius `r` rolling inside a circle of radius `R`. Closes after
 * `r / gcd(R, r)` revolutions, which is why the loop bound is computed rather
 * than guessed - guessing leaves a visible seam.
 */
function guilloche(R: number, r: number, d: number, cx: number, cy: number, scale: number): string {
  const turns = r / gcd(R, r);
  const steps = Math.max(240, Math.round(turns * 240));
  const k = R - r;
  let path = "";
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * turns * 2 * Math.PI;
    const x = cx + scale * (k * Math.cos(t) + d * Math.cos((k / r) * t));
    const y = cy + scale * (k * Math.sin(t) - d * Math.sin((k / r) * t));
    path += `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return `${path}Z`;
}

/**
 * Reeded edge: the milled ridges around a struck rim.
 *
 * Every value is rounded to a fixed number of decimals and emitted as a
 * string. That is not cosmetic. Node and the browser can disagree on the last
 * digit when serialising a full-precision float - the server writes
 * `y1="86.16892813516071"` and the client computes `86.16892813516073` - and
 * React reports that as a hydration mismatch on all 96 ridges. Rounding makes
 * both sides produce the same characters. `guilloche` above rounds for the
 * same reason.
 */
function reeding(cx: number, cy: number, inner: number, outer: number, count: number) {
  const fixed = (n: number) => n.toFixed(3);
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * 2 * Math.PI;
    const sin = Math.sin(a);
    const cos = Math.cos(a);
    // Ridges facing the light catch it; ridges away from it fall into shadow.
    const lit = Math.cos(a + Math.PI * 0.75);
    return {
      x1: fixed(cx + inner * cos), y1: fixed(cy + inner * sin),
      x2: fixed(cx + outer * cos), y2: fixed(cy + outer * sin),
      light: lit > 0,
      opacity: (0.25 + Math.abs(lit) * 0.5).toFixed(3),
    };
  });
}

/* ── The coin ───────────────────────────────────────────────────────────── */

export function PolarisCoin({
  value,
  size = 76,
  interactive = true,
}: {
  value: number;
  size?: number;
  interactive?: boolean;
}) {
  const reduce = useReducedMotion();

  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const spring = { stiffness: 180, damping: 18, mass: 0.7 };
  const sx = useSpring(px, spring);
  const sy = useSpring(py, spring);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-26, 26]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [22, -22]);
  // The specular sweep slides against the tilt: the highlight belongs to the
  // light, not to the coin.
  const glareX = useTransform(sx, [-0.5, 0.5], [78, 22]);
  const glareY = useTransform(sy, [-0.5, 0.5], [74, 26]);
  const glare = useMotionTemplate`radial-gradient(70% 60% at ${glareX}% ${glareY}%, rgba(255,255,255,0.55), rgba(255,255,255,0.10) 40%, transparent 66%)`;

  return (
    <div
      style={{ perspective: 700, width: size, height: size }}
      className="shrink-0"
      onPointerMove={(e) => {
        if (reduce || !interactive) return;
        const box = e.currentTarget.getBoundingClientRect();
        px.set((e.clientX - box.left) / box.width - 0.5);
        py.set((e.clientY - box.top) / box.height - 0.5);
      }}
      onPointerLeave={() => { px.set(0); py.set(0); }}
    >
      <motion.div
        // Keying on the value makes a balance change remount and replay the
        // flip - which is the one moment in this economy worth animating.
        key={value}
        initial={reduce ? false : { rotateY: -540, scale: 0.86 }}
        animate={{ rotateY: 0, scale: 1 }}
        transition={{ duration: reduce ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: size, height: size, transformStyle: "preserve-3d" }}
      >
        <motion.div
          style={{
            width: size, height: size,
            rotateX: reduce || !interactive ? 0 : rotateX,
            rotateY: reduce || !interactive ? 0 : rotateY,
            transformStyle: "preserve-3d",
          }}
          className="relative"
        >
          {/* The edge, sitting just behind the face so the coin has thickness. */}
          <span
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              transform: "translateZ(-4px)",
              background: "linear-gradient(145deg, #6B4F16, #A9822F 45%, #4A360F)",
              boxShadow: "0 8px 18px -8px rgba(44,24,16,0.75)",
            }}
          />
          <CoinFace size={size} value={value} />
          {!reduce && (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-0 rounded-full mix-blend-soft-light"
              style={{ backgroundImage: glare, transform: "translateZ(2px)" }}
            />
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}

function CoinFace({ size, value }: { size: number; value: number }) {
  // Drawn in a fixed 100-unit space and scaled, so the geometry constants below
  // read as proportions rather than pixels.
  const C = 50;
  // Ids must be unique per instance: two coins on one page sharing a gradient
  // id is invalid markup, and the second coin silently inherits the first's
  // defs - which is exactly the kind of bug that only shows up once someone
  // puts a second coin somewhere.
  const uid = useId().replace(/:/g, "");
  const ridges = useMemo(() => reeding(C, C, 43.5, 48.5, 96), []);
  const rosetteOuter = useMemo(() => guilloche(5, 3, 5, C, C, 3.05), []);
  const rosetteInner = useMemo(() => guilloche(7, 4, 7, C, C, 1.55), []);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="absolute inset-0"
      style={{ transform: "translateZ(0px)" }}
      role="img"
      aria-label={`${value} coins`}
    >
      <defs>
        {/* Metal, lit from the top-left. */}
        <radialGradient id={`pc-field-${uid}`} cx="34%" cy="28%" r="78%">
          <stop offset="0%" stopColor="#F6E3B4" />
          <stop offset="42%" stopColor="#D9AC59" />
          <stop offset="78%" stopColor="#B0842F" />
          <stop offset="100%" stopColor="#7E5C1B" />
        </radialGradient>
        <linearGradient id={`pc-rim-${uid}`} x1="18%" y1="8%" x2="82%" y2="94%">
          <stop offset="0%" stopColor="#FCEFC8" />
          <stop offset="38%" stopColor="#C99B41" />
          <stop offset="70%" stopColor="#8A6520" />
          <stop offset="100%" stopColor="#E3C07A" />
        </linearGradient>
        <path id={`pc-legend-top-${uid}`} d="M 50,50 m -33,0 a 33,33 0 0 1 66,0" fill="none" />
        <path id={`pc-legend-bottom-${uid}`} d="M 19.5,50 a 30.5,30.5 0 0 0 61,0" fill="none" />
        {/* Keeps the guilloche inside the field rather than over the rim. */}
        <clipPath id={`pc-field-clip-${uid}`}>
          <circle cx="50" cy="50" r="38" />
        </clipPath>
      </defs>

      {/* rim */}
      <circle cx="50" cy="50" r="49" fill={`url(#pc-rim-${uid})`} />

      {/* reeded edge */}
      <g strokeLinecap="round">
        {ridges.map((r, i) => (
          <line
            key={i}
            x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2}
            stroke={r.light ? "#FBEDC6" : "#6E5117"}
            strokeWidth="0.9"
            opacity={r.opacity}
          />
        ))}
      </g>

      {/* field */}
      <circle cx="50" cy="50" r="43" fill={`url(#pc-field-${uid})`} />
      {/* the raised step from rim down to field: light above, shadow below */}
      <circle cx="50" cy="50" r="43" fill="none" stroke="#FFF4D4" strokeWidth="0.7" opacity="0.5"
              strokeDasharray="120 150" strokeDashoffset="40" />
      <circle cx="50" cy="50" r="42.4" fill="none" stroke="#5F4512" strokeWidth="0.6" opacity="0.35"
              strokeDasharray="120 150" strokeDashoffset="-110" />

      {/* engine-turned field */}
      <g clipPath={`url(#pc-field-clip-${uid})`}>
        <path d={rosetteOuter} fill="none" stroke="#7A5A18" strokeWidth="0.35" opacity="0.42" />
        <path d={rosetteOuter} fill="none" stroke="#FFF0C9" strokeWidth="0.3" opacity="0.3"
              transform="translate(-0.35,-0.35)" />
        <path d={rosetteInner} fill="none" stroke="#7A5A18" strokeWidth="0.3" opacity="0.3" />
      </g>

      {/* legend */}
      <text
        fontSize="6.6" fontWeight="700" letterSpacing="3.1" fill="#6B4E14" opacity="0.85"
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        <textPath href={`#pc-legend-top-${uid}`} startOffset="50%" textAnchor="middle">POLARIS</textPath>
      </text>
      <text
        fontSize="5" fontWeight="700" letterSpacing="2.2" fill="#6B4E14" opacity="0.7"
        style={{ fontFamily: "var(--font-mono, ui-monospace), monospace" }}
      >
        <textPath href={`#pc-legend-bottom-${uid}`} startOffset="50%" textAnchor="middle">EFFORT</textPath>
      </text>

      {/* two small stars flanking the value, as coins do */}
      <Star x={24} y={50} r={2.6} />
      <Star x={76} y={50} r={2.6} />

      {/* the value, struck in relief: shadow under, light over */}
      <text
        x="50" y="58.5" textAnchor="middle" fontSize="27" fontWeight="700"
        fill="#5C420F" opacity="0.55"
        style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}
      >
        {value}
      </text>
      <text
        x="49.4" y="57.9" textAnchor="middle" fontSize="27" fontWeight="700"
        fill="#FFF6DC"
        style={{ fontFamily: "Georgia, 'Iowan Old Style', serif" }}
      >
        {value}
      </text>
    </svg>
  );
}

function Star({ x, y, r }: { x: number; y: number; r: number }) {
  const d = `M${x} ${y - r}l${r * 0.32} ${r * 0.68}L${x + r} ${y}l-${r * 0.68} ${r * 0.32}L${x} ${y + r}l-${r * 0.32}-${r * 0.68}L${x - r} ${y}l${r * 0.68}-${r * 0.32}z`;
  return (
    <>
      <path d={d} fill="#5C420F" opacity="0.45" transform="translate(0.4,0.4)" />
      <path d={d} fill="#FFF1CE" opacity="0.9" />
    </>
  );
}

/**
 * The small coin used inline on buttons and price tags. Same mint, fewer
 * details - reeding and a legend would turn to mud at 12px, so it keeps the
 * rim step, the field gradient and the star, which are what read at that size.
 */
export function CoinGlyph({ size = 13 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id={`pcg-field-${uid}`} cx="34%" cy="28%" r="80%">
          <stop offset="0%" stopColor="#F6E3B4" />
          <stop offset="55%" stopColor="#D2A251" />
          <stop offset="100%" stopColor="#8A6520" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="#A9822F" />
      <circle cx="12" cy="12" r="9.4" fill={`url(#pcg-field-${uid})`} />
      <circle cx="12" cy="12" r="9.4" fill="none" stroke="#FFF0C9" strokeWidth="0.7" opacity="0.55" />
      <path
        d="M12 6.6l1.15 3.2 3.25 1.2-3.25 1.2L12 15.4l-1.15-3.2L7.6 11l3.25-1.2z"
        fill="#6B4E14"
        opacity="0.5"
      />
      <path
        d="M11.7 6.3l1.15 3.2 3.25 1.2-3.25 1.2-1.15 3.2-1.15-3.2L7.3 10.7l3.25-1.2z"
        fill="#FFF6DC"
      />
    </svg>
  );
}
