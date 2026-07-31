"use client";

/**
 * Shared UI primitives for the app shell.
 */

import { cn } from "@/lib/cn";

/* ─── Pill ─── */

type PillTone = "polaris" | "aurora" | "nova" | "ink" | "rose";

const PILL_STYLES: Record<PillTone, string> = {
  polaris: "bg-polaris-500/10 text-polaris-500 ring-polaris-400/30",
  aurora:  "bg-aurora-500/10 text-aurora-500 ring-aurora-400/30",
  nova:    "bg-nova-500/10 text-nova-500 ring-nova-400/30",
  ink:     "bg-ink/5 text-ink-dim ring-ink/10",
  rose:    "bg-rose-500/10 text-rose-500 ring-rose-400/30",
};

export function Pill({
  tone = "polaris",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ring-1 ring-inset",
        PILL_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ─── KBD ─── */

export function KBD({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded border border-white/[0.12] bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-paper/45 font-mono">
      {children}
    </kbd>
  );
}

/* ─── Avatar ─── */

const AVATAR_COLORS: Record<string, string> = {
  polaris: "bg-polaris-500",
  aurora:  "bg-aurora-500",
  nova:    "bg-nova-500",
  ink:     "bg-ink",
};

export function Avatar({
  initials,
  size = 32,
  tone = "polaris",
}: {
  initials: string;
  size?: number;
  tone?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white font-serif font-semibold shrink-0",
        AVATAR_COLORS[tone] ?? "bg-polaris-500",
      )}
      style={{ height: size, width: size, fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}
