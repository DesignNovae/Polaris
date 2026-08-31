"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PathSummary } from "@/types/app";
import { cn } from "@/lib/cn";

/**
 * Active-path selector. The Strategist and every page in the workspace
 * reads `?path=<id>` from the URL - switching paths just updates the query
 * and triggers a server re-fetch. No client cache to invalidate.
 * Dark-themed to sit inside the dark-glass LeftNav.
 */
export function PathSwitcher({
  paths,
  activePathId,
  basePath = "",
}: {
  paths: PathSummary[];
  activePathId: string;
  basePath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const active = paths.find(p => p.id === activePathId) ?? paths[0];

  function pick(id: string) {
    setOpen(false);
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("path", id);
      router.replace(url.pathname + url.search, { scroll: false });
    });
  }

  if (!active) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="w-full text-left bg-white/[0.05] ring-1 ring-inset ring-white/[0.10] rounded-xl p-3 hover:bg-white/[0.08] transition-colors"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.18em] text-paper/55 mb-1 font-medium">Active path</div>
            <div className="font-serif text-[15px] font-bold tracking-tight text-paper truncate">{active.name}</div>
            <div className="text-[11px] text-paper/65 mt-0.5 truncate">{active.degree} · {active.horizon}</div>
          </div>
          <Caret/>
        </div>
        <div className="mt-2.5 flex items-center gap-2">
          <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full",
                active.color === "polaris" && "bg-polaris-400",
                active.color === "nova" && "bg-nova-400",
                active.color === "aurora" && "bg-aurora-400",
              )}
              style={{ width: `${Math.max(2, Math.min(100, active.probability * 100))}%` }}
            />
          </div>
          <span className="font-mono text-[10.5px] text-paper/65 tabular-nums">{Math.round(active.probability * 100)}%</span>
        </div>
      </button>

      {open && (
        <div role="menu" className="absolute left-0 right-0 mt-1.5 z-30 bg-paper-card rounded-xl shadow-pop ring-1 ring-inset ring-polaris-500/10 p-1.5">
          {paths.map(p => (
            <button
              key={p.id}
              role="menuitem"
              onClick={() => pick(p.id)}
              className={cn(
                "w-full text-left rounded-lg px-2.5 py-2 hover:bg-paper-soft flex items-start gap-2",
                p.id === active.id && "bg-paper-soft",
              )}
            >
              <span className={cn(
                "mt-1 h-1.5 w-1.5 rounded-full shrink-0",
                p.color === "polaris" && "bg-polaris-500",
                p.color === "nova" && "bg-nova-500",
                p.color === "aurora" && "bg-aurora-500",
              )}/>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[13.5px] font-semibold text-ink truncate">{p.name}</span>
                <span className="block text-[11px] text-ink-dim">{p.degree} · {Math.round(p.probability * 100)}% prob.</span>
              </span>
            </button>
          ))}
          <div className="h-px bg-polaris-500/10 my-1.5"/>
          <Link
            href={basePath || "/roadmap"}
            className="w-full text-left rounded-lg px-2.5 py-2 hover:bg-paper-soft flex items-center gap-2 text-polaris-500 text-[13px] font-medium"
          >
            <Plus/> Create new path…
          </Link>
        </div>
      )}
    </div>
  );
}

function Caret() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-paper/55">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  );
}

function Plus() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14 M5 12h14"/>
    </svg>
  );
}

