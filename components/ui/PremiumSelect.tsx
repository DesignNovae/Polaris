"use client";

/**
 * PremiumSelect - the app-wide replacement for native <select>.
 *
 *   Trigger : glass pill, hover lift, focus ring, animated chevron,
 *             "active" treatment when a real filter is applied
 *   Panel   : floating glass (blur + ring + pop shadow), fade/scale/slide
 *             entrance, hover highlight, animated check + glow on the
 *             selected row, icons / descriptions / counts / badges
 *   Search  : built-in when `searchable` (or >8 options), instant filter,
 *             polished empty state
 *   A11y    : full keyboard nav (arrows / Home / End / Enter / Escape),
 *             listbox + option roles, aria-activedescendant, outside-click
 *             and focus-loss close
 *
 * Theme-aware throughout - no white panels in dark mode.
 */

import {
  useCallback, useEffect, useId, useMemo, useRef, useState,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

export type PremiumOption = {
  value: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  badge?: string;
  count?: number;
  disabled?: boolean;
};

type Props = {
  value: string;
  options: PremiumOption[];
  onChange: (value: string) => void;
  /** Static prefix on the trigger, e.g. "Country" → "Country: USA". */
  label?: string;
  /** Value treated as "no filter" - trigger stays quiet on it. Default "all". */
  quietValue?: string;
  searchable?: boolean;
  size?: "sm" | "md";
  /** Panel alignment relative to the trigger. */
  align?: "left" | "right";
  className?: string;
  /** Solid input-like trigger (forms) instead of the filter pill. */
  variant?: "pill" | "input";
  placeholder?: string;
};

export function PremiumSelect({
  value, options, onChange, label, quietValue = "all", searchable,
  size = "md", align = "left", className, variant = "pill", placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = options.find((o) => o.value === value) ?? null;
  const isActive = variant === "pill" && value !== quietValue;
  const showSearch = searchable ?? options.length > 8;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      o.label.toLowerCase().includes(q) || (o.description ?? "").toLowerCase().includes(q),
    );
  }, [options, query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(null);
  }, []);

  // Outside click closes.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  // Focus search + sync highlight on open.
  useEffect(() => {
    if (!open) return;
    setHighlight(value);
    const t = setTimeout(() => searchRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open, value]);

  // Keep the highlighted row in view.
  useEffect(() => {
    if (!open || !highlight) return;
    listRef.current
      ?.querySelector(`[data-value="${CSS.escape(highlight)}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, highlight]);

  function pick(v: string) {
    const opt = options.find((o) => o.value === v);
    if (!opt || opt.disabled) return;
    onChange(v);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    const enabled = visible.filter((o) => !o.disabled);
    const idx = enabled.findIndex((o) => o.value === highlight);
    switch (e.key) {
      case "Escape": e.preventDefault(); close(); break;
      case "ArrowDown": e.preventDefault(); setHighlight(enabled[Math.min(idx + 1, enabled.length - 1)]?.value ?? null); break;
      case "ArrowUp": e.preventDefault(); setHighlight(enabled[Math.max(idx - 1, 0)]?.value ?? null); break;
      case "Home": e.preventDefault(); setHighlight(enabled[0]?.value ?? null); break;
      case "End": e.preventDefault(); setHighlight(enabled[enabled.length - 1]?.value ?? null); break;
      case "Enter": e.preventDefault(); if (highlight) pick(highlight); break;
      case "Tab": close(); break;
    }
  }

  const sizeCls = size === "sm" ? "h-8 text-[11.5px]" : "h-9 text-[12px]";

  return (
    <div ref={rootRef} className={cn("relative", className)} onKeyDown={onKeyDown}>
      {/* ─── trigger ─── */}
      <motion.button
        type="button"
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        className={cn(
          "inline-flex items-center gap-1.5 font-medium ring-1 ring-inset transition-colors outline-none cursor-pointer select-none",
          "focus-visible:ring-2 focus-visible:ring-polaris-400",
          variant === "input"
            ? "w-full justify-between rounded-xl border-0 bg-paper-card px-3 py-2 text-sm text-ink ring-polaris-200 dark:ring-white/[0.14] dark:bg-paper-deep h-auto"
            : cn(
                "rounded-xl pl-3 pr-2.5", sizeCls,
                isActive
                  ? "bg-ink text-paper ring-ink shadow-[0_4px_14px_-6px_rgba(42,32,24,0.5)] dark:bg-polaris-400/25 dark:text-polaris-100 dark:ring-polaris-400/40"
                  : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
              ),
          open && variant === "pill" && !isActive && "ring-polaris-400/50 text-ink",
        )}
      >
        {selected?.icon && <span className="shrink-0 inline-flex">{selected.icon}</span>}
        <span className="truncate">
          {label ? `${label}: ` : ""}
          {selected ? selected.label : (placeholder ?? "Select…")}
        </span>
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          className={cn("shrink-0 transition-transform duration-200 opacity-60", open && "rotate-180")}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </motion.button>

      {/* ─── panel ─── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "absolute top-full mt-1.5 z-50 min-w-full w-max max-w-[300px] origin-top",
              align === "right" ? "right-0" : "left-0",
            )}
          >
            <div className="rounded-2xl bg-paper-card/95 backdrop-blur-xl shadow-pop ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.14] overflow-hidden">
              {showSearch && (
                <div className="p-2 border-b border-polaris-500/10 dark:border-white/[0.08]">
                  <label className="flex items-center gap-2 h-8 px-2.5 rounded-lg bg-paper-soft dark:bg-white/[0.05] ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.08] focus-within:ring-polaris-400/60">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-ink-muted shrink-0">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" />
                    </svg>
                    <input
                      ref={searchRef}
                      value={query}
                      onChange={(e) => { setQuery(e.target.value); setHighlight(null); }}
                      placeholder="Search…"
                      className="flex-1 bg-transparent text-[12px] text-ink placeholder:text-ink-muted/70 outline-none min-w-0"
                    />
                  </label>
                </div>
              )}

              <div
                ref={listRef}
                role="listbox"
                id={listboxId}
                aria-activedescendant={highlight ? `${listboxId}-${highlight}` : undefined}
                className="polaris-scrollbar max-h-[280px] overflow-y-auto overscroll-contain p-1.5"
              >
                {visible.length === 0 ? (
                  <div className="px-3 py-6 text-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="mx-auto text-ink-muted/60 mb-1.5">
                      <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.3-4.3" /><path d="M8 11h6" />
                    </svg>
                    <div className="text-[12px] font-medium text-ink">No matches</div>
                    <div className="text-[10.5px] text-ink-muted mt-0.5">Try a different search</div>
                  </div>
                ) : (
                  visible.map((o) => {
                    const isSel = o.value === value;
                    const isHi = o.value === highlight;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        role="option"
                        id={`${listboxId}-${o.value}`}
                        data-value={o.value}
                        aria-selected={isSel}
                        disabled={o.disabled}
                        onClick={() => pick(o.value)}
                        onMouseEnter={() => setHighlight(o.value)}
                        className={cn(
                          "relative w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                          o.disabled && "opacity-40 cursor-not-allowed",
                        )}
                      >
                        {/* floating highlight behind hovered/selected row */}
                        {(isHi || isSel) && !o.disabled && (
                          <motion.span
                            layoutId={`${listboxId}-hl`}
                            transition={{ duration: 0.15, ease: "easeOut" }}
                            className={cn(
                              "absolute inset-0 rounded-lg",
                              isSel
                                ? "bg-polaris-100 ring-1 ring-inset ring-polaris-400/40 dark:bg-polaris-400/15 dark:ring-polaris-400/30"
                                : "bg-paper-soft dark:bg-white/[0.06]",
                            )}
                            aria-hidden
                          />
                        )}
                        {o.icon && <span className="relative shrink-0 inline-flex">{o.icon}</span>}
                        <span className="relative min-w-0 flex-1">
                          <span className={cn("block text-[12.5px] truncate", isSel ? "font-semibold text-ink" : "font-medium text-ink-dim")}>
                            {o.label}
                          </span>
                          {o.description && (
                            <span className="block text-[10.5px] text-ink-muted truncate">{o.description}</span>
                          )}
                        </span>
                        {o.badge && (
                          <span className="relative shrink-0 text-[9px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[2px] bg-paper-deep text-ink-muted dark:bg-white/[0.08]">
                            {o.badge}
                          </span>
                        )}
                        {o.count !== undefined && (
                          <span className="relative shrink-0 font-mono text-[10.5px] text-ink-muted tabular-nums">{o.count}</span>
                        )}
                        {isSel && (
                          <motion.span
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                            className="relative shrink-0 text-polaris-600 dark:text-polaris-300"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 6 9 17l-5-5" />
                            </svg>
                          </motion.span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Small colored dot - handy for difficulty/status option icons. */
export function OptionDot({ className }: { className?: string }) {
  return <span className={cn("h-2 w-2 rounded-full shrink-0", className)} aria-hidden />;
}
