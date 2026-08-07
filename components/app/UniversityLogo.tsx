"use client";

/**
 * UniversityLogo - branded badge per school using each university's real
 * primary color + a serif monogram.
 *
 * Each entry carries:
 *   • bg          - the school's primary brand color
 *   • fg          - best contrast text color (default white)
 *   • mark        - 2–4 letter monogram (defaults to school's acronym)
 *   • gradientTo  - optional second color for a subtle gradient finish
 *
 * Avoids the mess of mismatched bitmap logos by giving every school the
 * same elegant treatment with its authentic palette.
 */

import { cn } from "@/lib/cn";

export type UniLogoTheme = {
  bg: string;
  fg?: string;
  mark?: string;
  /** Optional second color for a diagonal gradient. */
  gradientTo?: string;
  /** Optional accent ring color around the badge. */
  ring?: string;
  /** Use a specially shaped silhouette (shield, square crest). Default: circle. */
  shape?: "circle" | "shield" | "rounded";
};

/* ─── School palettes (real brand colors) ─────────────────────────── */
export const UNI_THEMES: Record<string, UniLogoTheme> = {
  mit:        { bg: "#A31F34", gradientTo: "#7A1626", mark: "MIT",  ring: "rgba(163,31,52,.25)", shape: "rounded" },
  stanford:   { bg: "#8C1515", gradientTo: "#5E0E0E", mark: "S",    ring: "rgba(140,21,21,.25)" },
  harvard:    { bg: "#A51C30", gradientTo: "#6D0E1E", mark: "H",    ring: "rgba(165,28,48,.25)", shape: "shield" },
  cmu:        { bg: "#C41230", gradientTo: "#7B0A1F", mark: "CMU",  ring: "rgba(196,18,48,.25)", shape: "rounded" },
  berkeley:   { bg: "#003262", gradientTo: "#001a33", mark: "UCB",  fg: "#FDB515", ring: "rgba(0,50,98,.25)", shape: "rounded" },
  uchicago:   { bg: "#800000", gradientTo: "#500000", mark: "UC",   ring: "rgba(128,0,0,.25)" },
  princeton:  { bg: "#E77500", gradientTo: "#A65300", mark: "P",    ring: "rgba(231,117,0,.25)", shape: "shield" },
  yale:       { bg: "#00356B", gradientTo: "#001f3f", mark: "Y",    ring: "rgba(0,53,107,.25)", shape: "shield" },
  oxford:     { bg: "#002147", gradientTo: "#000F2A", mark: "OX",   ring: "rgba(0,33,71,.25)", shape: "shield" },
  cambridge:  { bg: "#A3C1AD", gradientTo: "#6F9479", mark: "CA",   fg: "#11243A", ring: "rgba(163,193,173,.4)", shape: "shield" },
  imperial:   { bg: "#003E74", gradientTo: "#001f3a", mark: "IC",   ring: "rgba(0,62,116,.25)", shape: "rounded" },
  ucl:        { bg: "#002248", gradientTo: "#5DA3D6", mark: "UCL",  ring: "rgba(0,34,72,.25)", shape: "rounded" },
  toronto:    { bg: "#002A5C", gradientTo: "#25303B", mark: "UT",   ring: "rgba(0,42,92,.25)", shape: "shield" },
  uwaterloo:  { bg: "#FED34C", gradientTo: "#E5BB30", mark: "UW",   fg: "#000000", ring: "rgba(254,211,76,.4)", shape: "rounded" },
  nus:        { bg: "#003D7C", gradientTo: "#EF7C00", mark: "NUS",  ring: "rgba(0,61,124,.25)", shape: "rounded" },
  ntu:        { bg: "#C8102E", gradientTo: "#7A0C20", mark: "NTU",  ring: "rgba(200,16,46,.25)", shape: "rounded" },
  tum:        { bg: "#3070B3", gradientTo: "#1F4D7C", mark: "TUM",  ring: "rgba(48,112,179,.25)", shape: "rounded" },
  "iit-bombay": { bg: "#1D3461", gradientTo: "#4A2E2A", mark: "IITB", ring: "rgba(29,52,97,.25)", shape: "shield" },
  buet:       { bg: "#7B0A1F", gradientTo: "#3D0510", mark: "BUET", ring: "rgba(123,10,31,.25)", shape: "rounded" },
  "iba-du":   { bg: "#1E5631", gradientTo: "#0E2B17", mark: "IBA",  ring: "rgba(30,86,49,.25)", shape: "rounded" },
};

const FALLBACK: UniLogoTheme = { bg: "#5C3D26", gradientTo: "#3A2718", ring: "rgba(92,61,38,.25)" };

function themeFor(id: string, name?: string): UniLogoTheme {
  const t = UNI_THEMES[id];
  if (t) return t;
  const initials = (name ?? id)
    .replace(/^[A-Za-z]/, (c) => c.toUpperCase())
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");
  return { ...FALLBACK, mark: initials || (id[0]?.toUpperCase() ?? "?") };
}

/**
 * Render an elegantly branded square logo. Size is in pixels (defaults 36).
 * Mark text auto-scales with size.
 */
export function UniversityLogo({
  id, name, size = 36, className,
}: {
  id: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const t = themeFor(id, name);
  const mark = t.mark ?? "•";
  const fg = t.fg ?? "#FFFFFF";
  const shape = t.shape ?? "circle";
  const radius =
    shape === "circle" ? "50%" :
    shape === "shield" ? "32% 32% 50% 50% / 32% 32% 60% 60%" :
                         "22%";

  // Mark font-size: scales with logo size but caps so it fits.
  const fontSize = Math.max(9, Math.min(size * 0.42, mark.length > 3 ? size * 0.28 : size * 0.42));

  return (
    <div
      data-no-translate
      className={cn(
        "relative inline-flex items-center justify-center shrink-0 overflow-hidden",
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: t.gradientTo
          ? `linear-gradient(135deg, ${t.bg} 0%, ${t.gradientTo} 110%)`
          : t.bg,
        color: fg,
        boxShadow:
          `inset 0 1px 0 rgba(255,255,255,.18), 0 1px 3px ${t.ring ?? "rgba(0,0,0,.18)"}`,
        fontFamily: "var(--font-libre), Georgia, serif",
      }}
      aria-label={name ?? id}
      title={name ?? id}
    >
      {/* Subtle inner highlight */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, rgba(255,255,255,.18), transparent 55%)",
        }}
      />
      <span
        className="relative font-bold tracking-tight tabular-nums select-none"
        style={{
          fontSize,
          letterSpacing: mark.length >= 3 ? "-0.04em" : "-0.02em",
          textShadow: "0 1px 0 rgba(0,0,0,.15)",
        }}
      >
        {mark}
      </span>
    </div>
  );
}
