"use client";

/**
 * Top bar - dark-glass chrome with breadcrumb, search placeholder,
 * theme toggle, and account menu.
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Pill } from "./ui";
import { useTheme } from "./ThemeProvider";
import { cn } from "@/lib/cn";

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  roadmap:      { eyebrow: "Workspace", title: "Roadmap" },
  strategist:   { eyebrow: "Workspace", title: "Strategist" },
  deadlines:    { eyebrow: "Workspace", title: "Deadlines" },
  universities: { eyebrow: "Workspace", title: "Universities" },
  resources:    { eyebrow: "Workspace", title: "Resources" },
  connections:  { eyebrow: "Workspace", title: "Connections" },
  partners:     { eyebrow: "Workspace", title: "Partner offers" },
  family:       { eyebrow: "Workspace", title: "Family & partners" },
  billing:      { eyebrow: "Account",   title: "Billing" },
  transactions: { eyebrow: "Account",   title: "Transactions" },
  settings:     { eyebrow: "Account",   title: "Settings" },
};

export function TopBar() {
  const path = usePathname();
  const id = path.split("/")[1] || "roadmap";
  const t = TITLES[id] ?? TITLES.roadmap;
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const { theme, toggle: toggleTheme } = useTheme();

  const name = session?.user?.name ?? "";
  const email = session?.user?.email ?? "";
  const plan = (session?.user?.plan as "free" | "pro" | "elite") ?? "free";
  const initials =
    name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "P";
  const planTone = plan === "elite" ? "aurora" : plan === "pro" ? "polaris" : "ink";

  // Click outside closes menu
  useEffect(() => {
    if (!profileOpen) return;
    function onClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [profileOpen]);

  // Escape closes menu
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setProfileOpen(false); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="app-glass-dark h-14 sticky top-0 z-20 text-paper shadow-[0_10px_28px_-16px_rgba(0,0,0,0.55)]">
      {/* gradient hairline */}
      <span aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-polaris-400/40 to-transparent" />

      <div className="h-full px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 shrink-0">
          <div className="hidden sm:block text-[10px] uppercase tracking-[0.22em] text-paper/55">{t.eyebrow}</div>
          <div className="font-serif text-[15px] font-bold text-paper leading-none sm:mt-0.5 truncate max-w-[120px] sm:max-w-none">{t.title}</div>
        </div>

        {/* Search placeholder */}
        <div className="hidden md:flex flex-1 max-w-xs items-center gap-2 rounded-lg bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] px-3 py-1.5 text-paper/55 text-[13px]">
          <SearchGlyph />
          <span>Search…</span>
          <kbd className="ml-auto text-[10px] text-paper/35 font-mono">⌘K</kbd>
        </div>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {/* Theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="relative h-9 w-9 rounded-lg inline-flex items-center justify-center bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] text-paper hover:bg-white/[0.10] transition-all overflow-hidden"
          >
            <span className={cn(
              "absolute inset-0 inline-flex items-center justify-center transition-all duration-300",
              theme === "dark" ? "opacity-100 rotate-0 scale-100" : "opacity-0 -rotate-90 scale-50",
            )}>
              <SunGlyph />
            </span>
            <span className={cn(
              "absolute inset-0 inline-flex items-center justify-center transition-all duration-300",
              theme === "dark" ? "opacity-0 rotate-90 scale-50" : "opacity-100 rotate-0 scale-100",
            )}>
              <MoonGlyph />
            </span>
          </button>

          {/* Account menu */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen((o) => !o)}
              aria-haspopup="menu"
              aria-expanded={profileOpen}
              className={cn(
                "h-9 inline-flex items-center gap-2 pl-1.5 pr-2.5 rounded-full ring-1 ring-inset transition-all",
                profileOpen
                  ? "bg-white/[0.12] ring-white/[0.18]"
                  : "bg-white/[0.06] ring-white/[0.10] hover:bg-white/[0.10] hover:-translate-y-px",
              )}
              title="Account"
            >
              <Avatar initials={initials} size={26} tone={planTone} />
              <span className="hidden md:inline text-[12.5px] font-medium text-paper truncate max-w-[120px]">
                {name || "Account"}
              </span>
              <ChevGlyph open={profileOpen} />
            </button>

            <AnimatePresence>
              {profileOpen && (
                <motion.div
                  role="menu"
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.97 }}
                  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                  className="theme-pop absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl bg-paper-card text-ink shadow-pop ring-1 ring-inset ring-polaris-500/15 overflow-hidden z-30"
                >
                  {/* Identity */}
                  <div className="px-4 pt-4 pb-3.5 border-b border-polaris-500/10">
                    <div className="flex items-center gap-3">
                      <Avatar initials={initials} size={40} tone={planTone} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-ink truncate">{name || "Signed in"}</div>
                        <div className="text-[11px] text-ink-muted truncate">{email}</div>
                      </div>
                      <Pill tone={planTone}>{plan}</Pill>
                    </div>
                  </div>

                  {/* Links */}
                  <ul className="py-1.5">
                    <MenuLink href="#" onClick={() => setProfileOpen(false)} icon={<UserGlyph />}>Account</MenuLink>
                    <MenuLink href="#" onClick={() => setProfileOpen(false)} icon={<CogGlyph />}>Settings</MenuLink>
                    <MenuLink href="#" onClick={() => setProfileOpen(false)} icon={<CardGlyph />}>Billing &amp; plan</MenuLink>
                  </ul>

                  <div className="border-t border-polaris-500/10 py-1.5">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        signOut({ callbackUrl: "/" });
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-rose-600 hover:bg-rose-500/[0.07] transition-colors"
                      role="menuitem"
                    >
                      <LogoutGlyph /> Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─── menu link ─── */

function MenuLink({
  href, onClick, icon, children,
}: {
  href: string;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        onClick={(e) => { e.preventDefault(); onClick(); }}
        className="flex items-center gap-2.5 px-4 py-2 text-[13px] text-ink hover:bg-paper-soft transition-colors"
        role="menuitem"
      >
        {icon} {children}
      </Link>
    </li>
  );
}

/* ─── glyphs ─── */

const glyphCls = "text-ink-dim shrink-0";

function SearchGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-paper/55">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}
function ChevGlyph({ open }: { open: boolean }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={cn("text-paper/55 transition-transform duration-200", open && "rotate-180")}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function UserGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function CogGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.8 1.2v.2a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.8-1.3l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.3-2.8h-.2a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.3-2.8l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.8-1.3v-.2a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.8 1.3l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.3 2.8z" />
    </svg>
  );
}
function CardGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}
function SunGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
function LogoutGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
