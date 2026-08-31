"use client";

/**
 * Left navigation rail - dark-glass chrome to match the landing nav pill.
 * Reads the active route via usePathname and renders NAV / NAV_FOOTER
 * entries from `lib/nav.ts`. Plan-gated items render disabled with an
 * upgrade hint for users below the required tier.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { NAV, NAV_FOOTER } from "@/lib/nav";
import { planMeets } from "@/lib/features";
import type { Plan } from "@/lib/db/collections";
import type { NavItem, PathSummary } from "@/types/app";
import { Pill, KBD } from "./ui";
import { PathSwitcher } from "./PathSwitcher";
import { StreakWidget } from "./StreakWidget";
import { cn } from "@/lib/cn";
import { CompassLogo } from "@/components/Nav";

type Props = {
  plan: Plan;
  studentName: string;
  studentInitials: string;
  studentGrade: string;
  paths: PathSummary[];
  activePathId: string;
  basePath?: string;
  demo?: boolean;
};

export function LeftNav({
  plan, studentName, studentInitials, studentGrade, paths, activePathId,
  basePath = "", demo = false,
}: Props) {
  const pathname = usePathname();
  const activeId = basePath ? (pathname.split("/")[2] || "roadmap") : pathname.split("/")[1];

  // Mobile drawer state - below lg the nav slides over the content.
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => { setMobileOpen(false); }, [pathname]); // close on navigation
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setMobileOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
    {/* Hamburger - mobile only */}
    <button
      onClick={() => setMobileOpen(true)}
      aria-label="Open navigation"
      className={cn(
        "lg:hidden fixed bottom-5 left-5 z-40 h-12 w-12 rounded-full app-glass-dark text-paper",
        "flex items-center justify-center shadow-pop ring-1 ring-inset ring-white/[0.12]",
        "active:scale-95 transition-transform",
        mobileOpen && "hidden",
      )}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18"/></svg>
    </button>

    {/* Backdrop - mobile only */}
    {mobileOpen && (
      <button
        aria-label="Close navigation"
        onClick={() => setMobileOpen(false)}
        className="lg:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
      />
    )}

    <aside
      className={cn(
        "app-glass-dark w-[252px] shrink-0 border-r border-white/[0.06] flex flex-col min-h-0 overflow-y-auto text-paper",
        // Desktop: static column. Mobile: fixed slide-over drawer.
        "fixed inset-y-0 left-0 z-50 h-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "lg:static lg:translate-x-0 lg:transition-none lg:z-auto",
        mobileOpen ? "translate-x-0" : "-translate-x-full",
      )}
    >
      {/* Logo */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-2.5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Polaris home">
          <CompassLogo className="h-7 w-7" onDark />
          <span className="font-serif text-[17px] font-bold tracking-tight text-paper">Polaris</span>
        </Link>
        <PlanBadge plan={plan} />
      </div>

      {/* Path switcher - inline, so the nav sections below flow naturally. */}
      <div className="px-3 pb-3">
        <PathSwitcher paths={paths} activePathId={activePathId} basePath={basePath} />
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-2.5 overflow-y-auto">
        <Section title="Workspace">
          {NAV.map(item => <Item key={item.id} item={item} activeId={activeId} plan={plan} basePath={basePath}/>)}
        </Section>
        <Section title="Account" topMargin>
          {NAV_FOOTER.map(item => <Item key={item.id} item={item} activeId={activeId} plan={plan} basePath={basePath} small/>)}
        </Section>

        {/* Streak card - real data via /api/streak, earned by meaningful work */}
        <StreakWidget demo={demo} />
      </nav>

      {/* User */}
      <div className="border-t border-white/[0.06] px-3 py-3 flex items-center gap-2.5">
        <div className="h-8 w-8 rounded-full bg-polaris-500 text-white inline-flex items-center justify-center font-serif font-semibold text-xs">
          {studentInitials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-paper truncate">{studentName}</div>
          <div className="text-[11px] text-paper/55 truncate">{studentGrade}</div>
        </div>
        <Link href={`${basePath}/settings`} className="text-paper/55 hover:text-paper p-1.5 transition-colors" aria-label="Settings">
          <Cog/>
        </Link>
      </div>
    </aside>
    </>
  );
}
function Section({ title, children, topMargin }: { title: string; children: React.ReactNode; topMargin?: boolean }) {
  return (
    <div className={topMargin ? "pt-5" : ""}>
      <div className="text-[10px] uppercase tracking-[0.22em] text-paper/45 px-2 pb-1.5 font-medium">{title}</div>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

function Item({ item, activeId, plan, basePath, small }: { item: NavItem; activeId: string; plan: Plan; basePath: string; small?: boolean }) {
  const active = activeId === item.id;
  const locked = !!item.minPlan && !planMeets(plan, item.minPlan);
  return (
    <li>
      <Link
        href={item.id === "roadmap" && basePath ? basePath : `${basePath}/${item.id}`}
        aria-disabled={locked}
        onClick={e => locked && e.preventDefault()}
        className={cn(
          "group w-full flex items-center gap-2.5 rounded-lg pl-2.5 pr-2 py-1.5 transition-colors text-left",
          active
            ? "bg-white/15 text-paper shadow-[inset_0_1px_0_rgba(255,255,255,0.10)]"
            : "text-paper/70 hover:bg-white/[0.06] hover:text-paper",
          locked && "opacity-50 hover:bg-transparent hover:text-paper/70 cursor-not-allowed",
        )}
      >
        <span className={active ? "text-polaris-300" : "text-paper/55 group-hover:text-paper/85"}>
          <NavGlyph id={item.id}/>
        </span>
        <span className={cn("text-[13px] flex-1", small ? "font-medium" : "font-semibold")}>{item.label}</span>
        {locked
          ? <Pill tone="polaris" className="!text-[9.5px]">{item.minPlan?.toUpperCase()}</Pill>
          : <span className="opacity-0 group-hover:opacity-100"><KBD>{item.shortcut}</KBD></span>}
      </Link>
    </li>
  );
}

function NavGlyph({ id }: { id: NavItem["id"] }) {
  const d: Record<NavItem["id"], string> = {
    roadmap:      "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z M9 3v15 M15 6v15",
    strategist:   "M21 12a8.5 8.5 0 1 1-3.4-6.8L21 4l-1.2 3.6A8.5 8.5 0 0 1 21 12z",
    deadlines:    "M3 7h18 M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z M8 3v4 M16 3v4",
    universities: "M2 10l10-5 10 5-10 5z M6 12v6c0 1 3 2 6 2s6-1 6-2v-6",
    resources:    "M4 4h10a4 4 0 0 1 4 4v12 M4 4v16 M4 20h10a4 4 0 0 0 4-4",
    "action-lab": "M9 3h6 M10 3v5l-5.5 9.5A2.3 2.3 0 0 0 6.5 21h11a2.3 2.3 0 0 0 2-3.5L14 8V3 M8 15h8 M9.5 12h5",
    connections:  "M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5 M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5",
    partners:     "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z M7 7h.01",
    consultants:  "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 7l.9 1.9 2.1.3-1.5 1.4.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.4 2.1-.3z",
    community:    "M14 4H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1v3l3-3h5a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z M16 9h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v2.5L15.5 18H13",
    family:       "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
    bookings:     "M8 2v4 M16 2v4 M3 8h18 M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z M9 14l2 2 4-4",
    billing:      "M3 7h18v10H3z M3 11h18",
    transactions: "M4 6h16 M4 10h16 M4 14h10 M4 18h7",
    settings:     "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={d[id]}/>
    </svg>
  );
}

/**
 * PlanBadge - designed specifically for the LeftNav's dark-glass surface.
 * The generic Pill component's contrast values don't pop against the dark
 * glass background, so we ship a tuned variant here: solid gradient fill
 * for paid tiers + subtle dark-glass overlay for free.
 */
function PlanBadge({ plan }: { plan: Plan }) {
  if (plan === "elite") {
    return (
      <span className="ml-auto relative inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold tracking-wider uppercase text-white shadow-sm overflow-hidden"
        style={{ background: "linear-gradient(135deg, #5B8C6D 0%, #4A7458 60%, #365A41 130%)" }}
      >
        <span className="h-1 w-1 rounded-full bg-aurora-100 shadow-[0_0_6px_rgba(255,255,255,0.6)]"/>
        Elite
      </span>
    );
  }
  if (plan === "pro") {
    return (
      <span className="ml-auto relative inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold tracking-wider uppercase text-white shadow-sm overflow-hidden"
        style={{ background: "linear-gradient(135deg, #C47D4E 0%, #8B5E3C 60%, #5C3D26 130%)" }}
      >
        <span className="h-1 w-1 rounded-full bg-polaris-100 shadow-[0_0_6px_rgba(255,255,255,0.6)]"/>
        Pro
      </span>
    );
  }
  return (
    <span className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-[3px] text-[10.5px] font-bold tracking-wider uppercase text-paper/85 bg-white/[0.10] ring-1 ring-inset ring-white/[0.18]">
      Free
    </span>
  );
}

function Cog() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.3-2.8h-.2a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.3-2.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.3v-.2a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.3 2.8h.2a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.3 2.8z"/>
    </svg>
  );
}
