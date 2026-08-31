/**
 * Brand logos - real SVG paths sourced from Simple Icons (CC0 license).
 * Each logo includes its canonical brand color so we can render either:
 *   - full-color on a neutral background (default), or
 *   - monochrome currentColor when `color="current"`.
 *
 * Used by the Connections / Partners pages so the provider grid carries
 * actual recognisable marks instead of letter monograms.
 */

import type { SVGProps } from "react";

export type BrandKey =
  | "notion"
  | "obsidian"
  | "gcal"
  | "github"
  | "khan"
  | "codeforces"
  | "gdrive"
  | "linkedin"
  | "youtube"
  | "googlebooks"
  | "stripe"
  | "bkash"
  | "sslcommerz";

export const BRAND_META: Record<BrandKey, { name: string; color: string; href: string }> = {
  notion:      { name: "Notion",          color: "#000000", href: "https://notion.so" },
  obsidian:    { name: "Obsidian",        color: "#7C3AED", href: "https://obsidian.md" },
  gcal:        { name: "Google Calendar", color: "#4285F4", href: "https://calendar.google.com" },
  github:      { name: "GitHub",          color: "#181717", href: "https://github.com" },
  khan:        { name: "Khan Academy",    color: "#14BF96", href: "https://khanacademy.org" },
  codeforces:  { name: "Codeforces",      color: "#1F8ACB", href: "https://codeforces.com" },
  gdrive:      { name: "Google Drive",    color: "#1FA463", href: "https://drive.google.com" },
  linkedin:    { name: "LinkedIn",        color: "#0A66C2", href: "https://linkedin.com" },
  youtube:     { name: "YouTube",         color: "#FF0000", href: "https://youtube.com" },
  googlebooks: { name: "Google Books",    color: "#4285F4", href: "https://books.google.com" },
  stripe:      { name: "Stripe",          color: "#635BFF", href: "https://stripe.com" },
  bkash:       { name: "bKash",           color: "#E2136E", href: "https://bkash.com" },
  sslcommerz:  { name: "SSLCommerz",      color: "#1A4E8A", href: "https://sslcommerz.com" },
};

type Props = SVGProps<SVGSVGElement> & { brand: BrandKey };

export function BrandLogo({ brand, ...rest }: Props) {
  const Glyph = GLYPHS[brand];
  return <Glyph {...rest} />;
}

/* ──────────────────────────────────────────────────────────────────────────
   Glyph paths - Simple Icons (CC0). Rendered with `fill="currentColor"` so
   callers can colour-tint, or wrap in a coloured tile.
   ────────────────────────────────────────────────────────────────────────── */

const GLYPHS: Record<BrandKey, (p: SVGProps<SVGSVGElement>) => React.JSX.Element> = {
  notion: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936.954l13.31-.98c1.636-.14 2.057-.047 3.086.7l4.249 2.987c.7.514.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726L8.28 23.98c-.98.047-1.448-.093-1.962-.747L3.01 18.795c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54.92-1.713z"/>
    </svg>
  ),
  obsidian: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M19.355 18.538c1.404-.745 1.66-.97 1.66-1.49 0-.518-.257-.745-1.66-1.49l-7.038-3.731c-1.403-.745-1.66-.97-1.66-1.49 0-.518.257-.744 1.66-1.49l7.038-3.731c1.404-.745 1.66-.971 1.66-1.49 0-.518-.257-.744-1.66-1.489L13.317.434c-1.404-.745-2.073-.745-3.476 0L2.802 4.164c-1.404.745-1.661.97-1.661 1.49 0 .517.257.744 1.661 1.49l7.038 3.73c1.404.745 1.66.97 1.66 1.49 0 .518-.256.745-1.66 1.49L2.802 17.6c-1.404.745-1.661.97-1.661 1.488 0 .52.257.745 1.661 1.49l7.038 3.732c1.404.744 2.073.744 3.477 0z"/>
    </svg>
  ),
  gcal: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M22.5 0H1.5C.675 0 0 .675 0 1.5v21c0 .825.675 1.5 1.5 1.5h21c.825 0 1.5-.675 1.5-1.5v-21C24 .675 23.325 0 22.5 0zM12 19.5c-2.486 0-4.5-2.014-4.5-4.5h2c0 1.378 1.122 2.5 2.5 2.5s2.5-1.122 2.5-2.5-1.122-2.5-2.5-2.5h-1V11h1c1.103 0 2-.897 2-2s-.897-2-2-2-2 .897-2 2H8c0-2.206 1.794-4 4-4s4 1.794 4 4c0 1.122-.476 2.124-1.225 2.84 1.31.696 2.225 2.07 2.225 3.66 0 2.486-2.014 4.5-4.5 4.5z"/>
    </svg>
  ),
  github: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  ),
  khan: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M24 1.5v21A1.5 1.5 0 0 1 22.5 24h-21A1.5 1.5 0 0 1 0 22.5v-21A1.5 1.5 0 0 1 1.5 0h21A1.5 1.5 0 0 1 24 1.5zM10.092 16.146a.93.93 0 0 0 1.276.265l4.21-2.79.61 1.43a.93.93 0 0 0 1.7-.75l-1.21-2.81 2.42-1.61a.93.93 0 0 0-1.02-1.54l-2.04 1.35-.31-.71a.93.93 0 0 0-1.7.75l.92 2.13-4.13 2.72a.93.93 0 0 0-.27 1.27zM6.66 18.07a.93.93 0 0 1 0-1.32l9-9a.93.93 0 0 1 1.32 1.32l-9 9a.93.93 0 0 1-1.32 0z"/>
    </svg>
  ),
  codeforces: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M4.5 7.5a1.5 1.5 0 0 1 1.5 1.5v10.5A1.5 1.5 0 0 1 4.5 21h-3A1.5 1.5 0 0 1 0 19.5V9a1.5 1.5 0 0 1 1.5-1.5h3zm9 3A1.5 1.5 0 0 1 15 12v7.5a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5V12a1.5 1.5 0 0 1 1.5-1.5h3zm9-7.5A1.5 1.5 0 0 1 24 4.5v15a1.5 1.5 0 0 1-1.5 1.5h-3a1.5 1.5 0 0 1-1.5-1.5v-15a1.5 1.5 0 0 1 1.5-1.5h3z"/>
    </svg>
  ),
  gdrive: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M7.71 3.5L1.15 15l3.42 6h11.66l3.42-6L13.09 3.5h-5.38zm5.38 1.5l5.69 9.85h-7.93L4.26 4.97 6.71 5h6.38zm-5.7 1.05L13.18 16H4.92l1.75-3.03L7.39 6.05zm9.86 10.95l-2.86 5h-9.04l2.86-5h9.04z"/>
    </svg>
  ),
  linkedin: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.063 2.063 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  youtube: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  googlebooks: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M21.5 1A1.5 1.5 0 0 1 23 2.5v17a1.5 1.5 0 0 1-1.5 1.5H17V23h-2v-2H9v2H7v-2H2.5A1.5 1.5 0 0 1 1 19.5v-17A1.5 1.5 0 0 1 2.5 1h19zM10 4H3v15h7V4zm11 0h-7v15h7V4zm-1 12h-5v-1h5v1zm0-3h-5v-1h5v1zm0-3h-5V9h5v1zm0-3h-5V6h5v1zM9 16H4v-1h5v1zm0-3H4v-1h5v1zm0-3H4V9h5v1zm0-3H4V6h5v1z"/>
    </svg>
  ),
  stripe: (p) => (
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M13.479 9.883c-1.626-.604-2.512-1.067-2.512-1.803 0-.622.511-.977 1.423-.977 1.667 0 3.379.642 4.558 1.22l.666-4.111c-.935-.446-2.847-1.177-5.49-1.177-1.87 0-3.425.488-4.536 1.4-1.155.954-1.757 2.334-1.757 4 0 3.023 1.847 4.312 4.847 5.403 1.936.688 2.602 1.177 2.602 1.934 0 .733-.629 1.155-1.762 1.155-1.403 0-3.736-.687-5.272-1.578l-.674 4.157c1.317.731 3.755 1.498 6.276 1.498 1.975 0 3.62-.467 4.733-1.355 1.245-.977 1.89-2.4 1.89-4.155 0-3.155-1.89-4.467-4.999-5.601l-.001-.01z"/>
    </svg>
  ),
  bkash: (p) => (
    // Stylised "b" mark (simplified, the real bKash logo is trademarked SVG).
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm-2 5h2.5c2.485 0 4.5 2.015 4.5 4.5S15.485 17 12.5 17H8V7h2zm0 2v6h2.5a3 3 0 0 0 0-6H10z"/>
    </svg>
  ),
  sslcommerz: (p) => (
    // Stylised lock / shield mark.
    <svg viewBox="0 0 24 24" fill="currentColor" {...p}>
      <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 6a3 3 0 0 1 3 3v1h.5a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-4a.5.5 0 0 1 .5-.5H9v-1a3 3 0 0 1 3-3zm0 1.5a1.5 1.5 0 0 0-1.5 1.5v1h3v-1A1.5 1.5 0 0 0 12 8.5z"/>
    </svg>
  ),
};

/**
 * Coloured tile that wraps a BrandLogo in the brand's canonical colour.
 * Default size is 12x12 (matches the Connections cards).
 */
export function BrandTile({
  brand,
  size = 48,
  className = "",
}: {
  brand: BrandKey;
  size?: number;
  className?: string;
}) {
  const meta = BRAND_META[brand];
  return (
    <div
      className={`rounded-xl flex items-center justify-center shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_4px_14px_-6px_rgba(0,0,0,0.25)] ${className}`}
      style={{ width: size, height: size, background: meta.color, color: "#ffffff" }}
      aria-label={meta.name}
    >
      <BrandLogo brand={brand} width={size * 0.5} height={size * 0.5} />
    </div>
  );
}
