/**
 * Shared UI primitives + icon set for the (app) shell - ported 1:1 from the
 * Polaris hi-fi prototype (Polaris App.html). Presentational only (no hooks),
 * so these are importable by both server and client components. Interactive
 * primitives (Segment, SearchField, Tip) live in ./interactive.tsx.
 */

import { cn } from "@/lib/cn";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

type Tone = "polaris" | "nova" | "aurora" | "ink" | "rose";

// ─── Icons (single-stroke SVG glyphs) ────────────────────────────────────────

type GlyphProps = { size?: number; sw?: number };
const I = ({ d, size = 16, sw = 1.6 }: { d: string } & GlyphProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export const Icon = {
  star: (p: GlyphProps = {}) => <svg width={p.size || 16} height={p.size || 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 14.39 8.26 21 9 16 13.74 17.18 20.5 12 17.27 6.82 20.5 8 13.74 3 9 9.61 8.26 12 2" /></svg>,
  map: (p: GlyphProps = {}) => <I size={p.size} d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15" />,
  chat: (p: GlyphProps = {}) => <I size={p.size} d="M21 12a8.5 8.5 0 1 1-3.4-6.8L21 4l-1.2 3.6A8.5 8.5 0 0 1 21 12z" />,
  cal: (p: GlyphProps = {}) => <I size={p.size} d="M3 7h18 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4" />,
  uni: (p: GlyphProps = {}) => <I size={p.size} d="M2 10l10-5 10 5-10 5z M6 12v6c0 1 3 2 6 2s6-1 6-2v-6 M22 10v6" />,
  book: (p: GlyphProps = {}) => <I size={p.size} d="M4 4h10a4 4 0 0 1 4 4v12 M4 4v16 M4 20h10a4 4 0 0 0 4-4" />,
  link: (p: GlyphProps = {}) => <I size={p.size} d="M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5 M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5" />,
  users: (p: GlyphProps = {}) => <I size={p.size} d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" />,
  search: (p: GlyphProps = {}) => <I size={p.size} d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z M21 21l-4.3-4.3" />,
  plus: (p: GlyphProps = {}) => <I size={p.size} d="M12 5v14 M5 12h14" />,
  send: (p: GlyphProps = {}) => <I size={p.size} d="M22 2L11 13 M22 2l-7 20-4-9-9-4 20-7z" />,
  chev: (p: GlyphProps = {}) => <I size={p.size || 12} sw={2} d="M9 6l6 6-6 6" />,
  chevDown: (p: GlyphProps = {}) => <I size={p.size || 12} sw={2} d="M6 9l6 6 6-6" />,
  check: (p: GlyphProps = {}) => <I size={p.size || 14} sw={2.2} d="M20 6L9 17l-5-5" />,
  dot: (p: GlyphProps = {}) => <svg width={p.size || 10} height={p.size || 10} viewBox="0 0 10 10"><circle cx="5" cy="5" r="3" fill="currentColor" /></svg>,
  bolt: (p: GlyphProps = {}) => <I size={p.size} d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />,
  play: (p: GlyphProps = {}) => <I size={p.size || 12} sw={1.8} d="M5 3l14 9-14 9V3z" />,
  pdf: (p: GlyphProps = {}) => <I size={p.size} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z M14 2v6h6" />,
  pin: (p: GlyphProps = {}) => <I size={p.size} d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />,
  filter: (p: GlyphProps = {}) => <I size={p.size} d="M3 4h18l-7 9v6l-4-2v-4L3 4z" />,
  close: (p: GlyphProps = {}) => <I size={p.size || 14} sw={2} d="M6 6l12 12 M18 6L6 18" />,
  arrow: (p: GlyphProps = {}) => <I size={p.size || 14} sw={1.8} d="M5 12h14 M13 6l6 6-6 6" />,
  more: (p: GlyphProps = {}) => <I size={p.size || 16} d="M5 12h.01 M12 12h.01 M19 12h.01" />,
  cog: (p: GlyphProps = {}) => <I size={p.size} d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />,
  card: (p: GlyphProps = {}) => <I size={p.size} d="M3 7h18v10H3z M3 11h18" />,
  globe: (p: GlyphProps = {}) => <I size={p.size} d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M2 12h20 M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20z" />,
  spark: (p: GlyphProps = {}) => <I size={p.size} d="M12 3v3 M12 18v3 M3 12h3 M18 12h3 M5.6 5.6l2 2 M16.4 16.4l2 2 M5.6 18.4l2-2 M16.4 7.6l2-2" />,
  mic: (p: GlyphProps = {}) => <I size={p.size} d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z M19 10v2a7 7 0 0 1-14 0v-2 M12 19v4 M8 23h8" />,
  attach: (p: GlyphProps = {}) => <I size={p.size} d="M21.4 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />,
};

// ─── Pill / Tag / Card ────────────────────────────────────────────────────────

export function Pill({ tone = "polaris", soft = true, children, className }: { tone?: Tone; soft?: boolean; children: ReactNode; className?: string }) {
  const map: Record<Tone, string> = {
    polaris: soft
      ? "bg-polaris-100 text-polaris-700 ring-polaris-200 dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/40"
      : "bg-polaris-500 text-white",
    nova: soft
      ? "bg-[#FBEFE2] text-nova-600 ring-[#F2D9BE] dark:bg-nova-400/20 dark:text-nova-100 dark:ring-nova-400/40"
      : "bg-nova-500 text-white",
    aurora: soft
      ? "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/20 dark:text-aurora-100 dark:ring-aurora-400/40"
      : "bg-aurora-500 text-white",
    ink: soft
      // text-ink-dim already swaps to LIGHT in dark mode via the CSS-var palette.
      // No dark:text-paper override - that would resolve to DARK on dark.
      ? "bg-paper-deep text-ink-dim ring-ink-faint/40 dark:bg-white/[0.10] dark:ring-white/[0.18]"
      : "bg-ink text-white dark:bg-paper dark:text-ink",
    rose: soft
      ? "bg-[#F5DDE3] text-signal-rose ring-[#EFC8D2] dark:bg-rose-400/20 dark:text-rose-100 dark:ring-rose-400/40"
      : "bg-signal-rose text-white",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", map[tone], className)}>{children}</span>;
}

export function Tag({ children, tone = "ink", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  const map: Record<Tone, string> = {
    polaris: "border-polaris-200 text-polaris-700 bg-polaris-50 dark:border-polaris-400/40 dark:text-polaris-100 dark:bg-polaris-400/15",
    nova:    "border-[#F2D9BE] text-nova-600 bg-[#FDF4E9] dark:border-nova-400/40 dark:text-nova-100 dark:bg-nova-400/15",
    aurora:  "border-aurora-400/40 text-aurora-700 bg-aurora-100 dark:border-aurora-400/40 dark:text-aurora-100 dark:bg-aurora-400/15",
    ink:     "border-ink-faint/40 text-ink-dim bg-paper dark:border-white/[0.18] dark:bg-white/[0.08]",
    rose:    "border-[#EFC8D2] text-signal-rose bg-[#F5DDE3] dark:border-rose-400/40 dark:text-rose-100 dark:bg-rose-400/15",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", map[tone], className)}>{children}</span>;
}

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-paper-card rounded-2xl shadow-card", className)} {...rest}>{children}</div>;
}

export function SectionTitle({ eyebrow, title, sub, action }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-6 mb-5">
      <div className="min-w-0">
        {eyebrow && <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">{eyebrow}</div>}
        <div className="font-serif text-[28px] leading-tight font-bold tracking-tight text-ink">{title}</div>
        {sub && <div className="text-sm text-ink-dim mt-1.5 max-w-2xl">{sub}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Button ───────────────────────────────────────────────────────────────────

type BtnProps = {
  variant?: "primary" | "accent" | "ghost" | "outline" | "link";
  size?: "sm" | "md" | "lg";
  icon?: ReactNode;
} & ComponentProps<"button">;

export function Btn({ variant = "primary", size = "md", icon, className, children, ...rest }: BtnProps) {
  const sizes = { sm: "h-7 px-2.5 text-xs gap-1.5", md: "h-9 px-3.5 text-[13px] gap-2", lg: "h-11 px-5 text-sm gap-2" } as const;
  const variants = {
    primary: "bg-ink text-paper hover:bg-polaris-700",
    accent: "bg-polaris-500 text-white hover:bg-polaris-600",
    ghost: "text-ink hover:bg-paper-deep/70",
    outline: "bg-paper-card text-ink hairline hover:bg-paper-soft",
    link: "text-polaris-500 hover:text-polaris-600 px-0",
  } as const;
  return (
    <button {...rest} className={cn("inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-100 disabled:opacity-50 disabled:cursor-not-allowed", sizes[size], variants[variant], className)}>
      {icon}
      {children}
    </button>
  );
}

export function KBD({ children }: { children: ReactNode }) {
  return <kbd className="inline-flex items-center justify-center rounded border border-ink-faint/40 bg-paper-card px-1.5 h-5 text-[10.5px] font-mono text-ink-dim">{children}</kbd>;
}

// ─── Progress / Ring / Avatar / badges ────────────────────────────────────────

export function Progress({ value, tone = "polaris", height = "h-1.5" }: { value: number; tone?: Tone; height?: string }) {
  const fill: Record<Tone, string> = { polaris: "bg-polaris-500", nova: "bg-nova-500", aurora: "bg-aurora-500", ink: "bg-ink", rose: "bg-signal-rose" };
  return (
    <div className={cn("w-full rounded-full bg-paper-deep overflow-hidden", height)}>
      <div className={cn("h-full rounded-full", fill[tone])} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function RingMini({ value, size = 36, stroke = 3, tone = "polaris", label }: { value: number; size?: number; stroke?: number; tone?: "polaris" | "nova" | "aurora"; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  const col = { polaris: "#8B5E3C", nova: "#C47D4E", aurora: "#5B8C6D" }[tone];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(139,94,60,0.12)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={col} strokeWidth={stroke} strokeLinecap="round" fill="none" strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-ink-dim">{label ?? value}</span>
    </div>
  );
}

type AvatarColor = "polaris" | "nova" | "aurora" | "ink";
export function Avatar({ initials, color, tone, size = 32, ring }: { initials: string; color?: AvatarColor; tone?: AvatarColor; size?: number; ring?: boolean }) {
  const map: Record<AvatarColor, string> = {
    polaris: "bg-polaris-500 text-white",
    nova: "bg-nova-500 text-white",
    aurora: "bg-aurora-500 text-white",
    ink: "bg-ink text-paper",
  };
  const c = color ?? tone ?? "polaris";
  return (
    <div className={cn("inline-flex items-center justify-center rounded-full font-serif font-semibold shrink-0", map[c], ring && "ring-2 ring-paper")} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {initials}
    </div>
  );
}

export function PriorityDot({ p }: { p: "high" | "medium" | "low" }) {
  const map = { high: "text-signal-rose", medium: "text-nova-500", low: "text-ink-muted" };
  return <span className={map[p]}><Icon.dot size={8} /></span>;
}

export function StatusBadge({ s }: { s: "pending" | "todo" | "in-progress" | "done" | "at-risk" }) {
  const map = {
    "in-progress": { tone: "polaris" as Tone, label: "In progress" },
    todo: { tone: "ink" as Tone, label: "To do" },
    pending: { tone: "ink" as Tone, label: "To do" },
    done: { tone: "aurora" as Tone, label: "Done" },
    "at-risk": { tone: "rose" as Tone, label: "At risk" },
  } as const;
  const x = map[s] ?? map.todo;
  return <Pill tone={x.tone}><span className="marker-dot" />{x.label}</Pill>;
}

// ─── Sparkline / resource thumbnail ───────────────────────────────────────────

export function Sparkline({ data = [], width = 96, height = 28, tone = "polaris" }: { data?: number[]; width?: number; height?: number; tone?: "polaris" | "nova" | "aurora" }) {
  if (data.length < 2) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);
  const pts = data.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`);
  const col = { polaris: "#8B5E3C", nova: "#C47D4E", aurora: "#5B8C6D" }[tone];
  return (
    <svg width={width} height={height} className="spark">
      <polyline points={pts.join(" ")} fill="none" stroke={col} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(data.length - 1) * stepX} cy={height - ((data[data.length - 1] - min) / range) * height} r="2" fill={col} />
    </svg>
  );
}

export type ResourceKind = "video" | "pdf" | "book" | "doc" | "essay" | "link";
export function ResourceThumb({ kind, thumb = "brown", className }: { kind: ResourceKind; thumb?: "brown" | "green" | "orange" | "sand"; className?: string }) {
  const palette = ({
    brown: ["#F0D8BF", "#C47D4E"],
    green: ["#D7E5DA", "#5B8C6D"],
    orange: ["#F3D7B7", "#C47D4E"],
    sand: ["#EFE3CF", "#A89888"],
  } as const)[thumb] ?? ["#F0D8BF", "#C47D4E"];
  const glyph: Record<string, ReactNode> = { video: <Icon.play size={14} />, pdf: <Icon.pdf size={14} />, book: <Icon.book size={14} />, doc: <Icon.pdf size={14} />, essay: <Icon.book size={14} />, link: <Icon.link size={14} /> };
  return (
    <div className={cn("relative overflow-hidden rounded-lg", className)} style={{ background: `linear-gradient(135deg, ${palette[0]} 0%, ${palette[1]} 100%)` }}>
      <div className="absolute inset-0 frame opacity-20" />
      <div className="absolute inset-0 flex items-center justify-center text-white drop-shadow">{glyph[kind]}</div>
    </div>
  );
}
