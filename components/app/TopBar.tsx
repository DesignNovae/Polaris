"use client";

/**
 * Top bar - glass chrome with breadcrumb / search / actions / account menu.
 *
 *   Search       - ⌘K focus, glow ring on focus
 *   Strategist   - luminous gradient-border button; live insight count from
 *                  the shared roadmap store (events this session), pulsing
 *                  status dot when there's something new to read
 *   Account menu - theme-aware glass panel, avatar (real photo when set,
 *                  synced via `polaris:avatarUpdated`), plan badge, real
 *                  profile-completion bar (same getMissingFields logic as
 *                  /account), quick links, sign out
 */

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, useSignOut } from "@/components/SessionProvider";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, Pill } from "./ui";
import { useTheme } from "./ThemeProvider";
import { useRoadmapStrategist } from "@/lib/roadmap/store";
import { getMissingFields } from "@/lib/profile";
import { cn } from "@/lib/cn";
import { useLang } from "@/lib/i18n/LangProvider";
import { WorkspaceSearch } from "@/components/app/WorkspaceSearch";

const TITLES: Record<string, { eyebrow: string; title: string }> = {
  roadmap:      { eyebrow: "Workspace", title: "Roadmap" },
  strategist:   { eyebrow: "Workspace", title: "Strategist" },
  deadlines:    { eyebrow: "Workspace", title: "Deadlines" },
  universities: { eyebrow: "Workspace", title: "Universities" },
  resources:    { eyebrow: "Workspace", title: "Resources" },
  "action-lab": { eyebrow: "Workspace", title: "Action Lab" },
  passport:     { eyebrow: "Workspace", title: "Passport" },
  cohort:       { eyebrow: "Workspace", title: "Benchmarks" },
  affordability:{ eyebrow: "Workspace", title: "Affordability" },
  connections:  { eyebrow: "Workspace", title: "Connections" },
  partners:     { eyebrow: "Workspace", title: "Partner offers" },
  consultants:  { eyebrow: "Workspace", title: "Consultants" },
  community:    { eyebrow: "Workspace", title: "Community" },
  family:       { eyebrow: "Workspace", title: "Family & partners" },
  bookings:     { eyebrow: "Account",   title: "Bookings" },
  billing:      { eyebrow: "Account",   title: "Billing" },
  transactions: { eyebrow: "Account",   title: "Transactions" },
  settings:     { eyebrow: "Account",   title: "Settings" },
};

type TopBarProps = {
  basePath?: string;
  demoUser?: { name: string; email: string; plan: "free" | "pro" | "elite" };
};

export function TopBar({ basePath = "", demoUser }: TopBarProps = {}) {
  const path = usePathname();
  const id = basePath ? (path.split("/")[2] || "roadmap") : (path.split("/")[1] || "roadmap");
  const t = TITLES[id] ?? TITLES.roadmap;
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const { data: session } = useSession();
  const signOut = useSignOut();
  const { theme, toggle: toggleTheme } = useTheme();
  const { events } = useRoadmapStrategist();
  const { lang, setLang } = useLang();

  const name = demoUser?.name ?? session?.user?.name ?? "";
  const email = demoUser?.email ?? session?.user?.email ?? "";
  const plan = demoUser?.plan ?? (session?.user?.plan as "free" | "pro" | "elite") ?? "free";
  const initials =
    name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "P";
  const planTone = plan === "elite" ? "aurora" : plan === "pro" ? "polaris" : "ink";

  // Avatar - real photo when set; kept in sync app-wide via the upload event.
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  useEffect(() => {
    let alive = true;
    if (!demoUser) {
      fetch("/api/account", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.account?.avatarUrl) setAvatarUrl(d.account.avatarUrl); })
        .catch(() => {});
    }
    function onAvatar(e: Event) {
      setAvatarUrl((e as CustomEvent<{ url: string }>).detail?.url ?? "");
    }
    window.addEventListener("polaris:avatarUpdated", onAvatar);
    return () => { alive = false; window.removeEventListener("polaris:avatarUpdated", onAvatar); };
  }, [demoUser]);

  // Profile completion - lazy-loaded the first time the menu opens, using the
  // same getMissingFields logic the /account page renders.
  const [completion, setCompletion] = useState<number | null>(demoUser ? 100 : null);
  useEffect(() => {
    if (demoUser || !profileOpen || completion !== null) return;
    let alive = true;
    Promise.all([
      fetch("/api/account").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, p]) => {
        if (!alive) return;
        const missing = getMissingFields(p?.profile ?? null, a?.account ?? {});
        setCompletion(Math.max(0, Math.min(100, Math.round(((8 - missing.length) / 8) * 100))));
      })
      .catch(() => { if (alive) setCompletion(100); });
    return () => { alive = false; };
  }, [profileOpen, completion, demoUser]);

  /**
   * Whether anyone has shared a student with this account. A teacher or a
   * parent who also has their own student account keeps role "student", so the
   * portal cannot be reached by a role redirect - this link is how they find
   * it. Resolved lazily when the menu opens, like profile completion.
   */
  const [sharedCount, setSharedCount] = useState<number | null>(demoUser ? 0 : null);
  useEffect(() => {
    if (demoUser || !profileOpen || sharedCount !== null) return;
    let alive = true;
    fetch("/api/monitor/view", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (alive) setSharedCount(d?.students?.length ?? 0); })
      .catch(() => { if (alive) setSharedCount(0); });
    return () => { alive = false; };
  }, [profileOpen, sharedCount, demoUser]);

  // Strategist insight count - store events from this session.
  const insightCount = events.length;

  // ⌘K to focus search.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("top-search")?.focus();
      }
      if (e.key === "Escape") setProfileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes the profile menu.
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

  function toggleAgent() {
    const k = "polaris.agentOpen";
    const next = localStorage.getItem(k) === "false" ? "true" : "false";
    localStorage.setItem(k, next);
    document.documentElement.dataset.agentOpen = next;
  }

  function openStreak() {
    setProfileOpen(false);
    window.dispatchEvent(new CustomEvent("polaris:openStreak"));
  }

  return (
    <header className="app-glass-dark h-14 sticky top-0 z-20 text-paper shadow-[0_10px_28px_-16px_rgba(0,0,0,0.55)]">
      {/* gradient hairline instead of a flat border */}
      <span aria-hidden className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-polaris-400/40 to-transparent" />

      <div className="h-full px-4 sm:px-6 flex items-center gap-3 sm:gap-4">
        <div className="min-w-0 shrink-0">
          <div className="hidden sm:block text-[10px] uppercase tracking-[0.22em] text-paper/55">{t.eyebrow}</div>
          <div className="font-serif text-[15px] font-bold text-paper leading-none sm:mt-0.5 truncate max-w-[120px] sm:max-w-none">{t.title}</div>
        </div>

        {/* search */}
        <WorkspaceSearch basePath={basePath} lang={lang} />

        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
                    <Link href={basePath || "/roadmap"} className="hidden md:inline-flex h-8 px-3 rounded-lg text-[13px] font-medium items-center gap-1.5 bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] text-paper hover:bg-white/[0.10] hover:-translate-y-px transition-all">
            New task
          </Link>
                    <Link href={basePath || "/roadmap"} className="hidden lg:inline-flex h-8 px-3 rounded-lg text-[13px] font-medium items-center gap-1.5 text-paper/75 hover:bg-white/[0.06] hover:text-paper transition-colors">
            Replan
          </Link>
          <div className="hidden md:block h-6 w-px bg-white/[0.10] mx-1" />

          <button
            type="button"
            data-no-translate
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            aria-label={lang === "bn" ? "Switch to English" : "Switch to Bengali"}
            title={lang === "bn" ? "Switch to English" : "Switch to Bengali"}
            className="h-9 min-w-9 rounded-lg px-2 inline-flex items-center justify-center bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] text-paper text-[11px] font-semibold hover:bg-white/[0.10] transition-all"
          >
            {lang === "bn" ? "EN" : "বাংলা"}
          </button>

          {/* theme toggle */}
          <button
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
            className="relative hidden sm:inline-flex h-9 w-9 rounded-lg items-center justify-center bg-white/[0.06] ring-1 ring-inset ring-white/[0.10] text-paper hover:bg-white/[0.10] transition-all overflow-hidden"
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

          {/* ─── Strategist - the luminous one ─── */}
          <button
            onClick={toggleAgent}
            title={insightCount > 0 ? `${insightCount} new signal${insightCount === 1 ? "" : "s"} for the Strategist` : "Open the Strategist"}
            className="hidden xl:inline-flex relative rounded-xl p-[1.5px] group hover:-translate-y-px transition-transform"
          >
            {/* gradient halo */}
            <span aria-hidden className={cn(
              "absolute inset-0 rounded-xl bg-gradient-to-r from-polaris-400 via-nova-400 to-aurora-400 transition-opacity",
              insightCount > 0 ? "opacity-90" : "opacity-50 group-hover:opacity-80",
            )} />
            {insightCount > 0 && (
              <span aria-hidden className="absolute -inset-1 rounded-xl bg-polaris-400/25 blur-md animate-pulse" />
            )}
            <span className="relative h-[33px] px-3 rounded-[10.5px] bg-ink text-paper text-[13px] font-semibold inline-flex items-center gap-2">
              <SparkGlyph />
              Strategist
              {insightCount > 0 ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-aurora-400/20 text-aurora-200 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
                  <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 animate-pulse" />
                  {insightCount}
                </span>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-paper/30" aria-hidden />
              )}
            </span>
          </button>

          {/* ─── Account menu ─── */}
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
              <HeaderAvatar url={avatarUrl} initials={initials} size={26} tone={planTone} />
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
                  className="theme-pop absolute right-0 top-full mt-2 w-72 origin-top-right rounded-2xl bg-paper-card text-ink shadow-pop ring-1 ring-inset ring-polaris-500/15 dark:ring-white/[0.14] overflow-hidden z-30"
                >
                  {/* identity */}
                  <div className="px-4 pt-4 pb-3.5 border-b border-polaris-500/10 dark:border-white/[0.08]">
                    <div className="flex items-center gap-3">
                      <HeaderAvatar url={avatarUrl} initials={initials} size={40} tone={planTone} ring />
                      <div className="min-w-0 flex-1">
                        <div className="text-[13.5px] font-semibold text-ink truncate">{name || "Signed in"}</div>
                        <div className="text-[11px] text-ink-muted truncate">{email}</div>
                      </div>
                      <Pill tone={planTone}>{plan}</Pill>
                    </div>

                    {/* profile completion */}
                    <div className="mt-3">
                      {completion === null ? (
                        <div className="h-1.5 rounded-full bg-paper-deep dark:bg-white/[0.07] animate-pulse" />
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[10.5px] mb-1">
                            <span className="text-ink-muted font-medium">Profile completion</span>
                            <span className={cn("font-bold tabular-nums", completion === 100 ? "text-aurora-700 dark:text-aurora-200" : "text-ink")}>
                              {completion}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-paper-deep dark:bg-white/[0.07] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${completion}%` }}
                              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                              className={cn(
                                "h-full rounded-full",
                                completion === 100
                                  ? "bg-gradient-to-r from-aurora-400 to-aurora-500"
                                  : "bg-gradient-to-r from-polaris-400 to-nova-400",
                              )}
                            />
                          </div>
                          {completion < 100 && (
                            <Link href={basePath ? `${basePath}/settings?tab=profile` : "/account"} onClick={() => setProfileOpen(false)}
                              className="mt-1.5 inline-block text-[10.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline">
                              Complete your profile →
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* links */}
                  <ul className="py-1.5">
                    <MenuLink href={basePath ? `${basePath}/settings?tab=profile` : "/account"} onClick={() => setProfileOpen(false)} icon={<UserGlyph />}>Account</MenuLink>
                    <MenuLink href={basePath ? `${basePath}/settings?tab=appearance` : "/settings"} onClick={() => setProfileOpen(false)} icon={<CogGlyph />}>Settings</MenuLink>
                    <MenuLink href={`${basePath}/billing`} onClick={() => setProfileOpen(false)} icon={<CardGlyph />}>Billing &amp; plan</MenuLink>
                    <MenuLink href={`${basePath}/transactions`} onClick={() => setProfileOpen(false)} icon={<ReceiptGlyph />}>Transactions</MenuLink>
                    {!demoUser && sharedCount !== null && sharedCount > 0 && (
                      <MenuLink href="/portal" onClick={() => setProfileOpen(false)} icon={<SharedGlyph />}>
                        Shared with you
                        <span className="ml-auto rounded-full bg-polaris-500/15 px-1.5 text-[10px] font-bold tabular-nums text-polaris-700 dark:text-polaris-300">
                          {sharedCount}
                        </span>
                      </MenuLink>
                    )}
                    {/* Phones only: the header has no room for the toggle. */}
                    <li className="sm:hidden">
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-ink hover:bg-paper-soft dark:hover:bg-white/[0.05] transition-colors"
                        role="menuitem"
                      >
                        <span className={glyphCls}>{theme === "dark" ? <SunGlyph /> : <MoonGlyph />}</span>
                        {theme === "dark" ? "Light mode" : "Dark mode"}
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={openStreak}
                        className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-ink hover:bg-paper-soft dark:hover:bg-white/[0.05] transition-colors"
                        role="menuitem"
                      >
                        <FlameGlyph /> Day streak
                      </button>
                    </li>
                  </ul>

                  <div className="border-t border-polaris-500/10 dark:border-white/[0.08] py-1.5">
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        if (demoUser) window.location.href = "/";
                        else signOut({ callbackUrl: "/" });
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] text-rose-600 dark:text-rose-300 hover:bg-rose-500/[0.07] transition-colors"
                      role="menuitem"
                    >
                      <LogoutGlyph /> {demoUser ? "Exit demo" : "Sign out"}
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
/* ─── avatar with photo support ─── */

function HeaderAvatar({
  url, initials, size, tone, ring,
}: {
  url: string;
  initials: string;
  size: number;
  tone: "aurora" | "polaris" | "ink";
  ring?: boolean;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        height={size}
        width={size}
        className={cn("rounded-full object-cover shrink-0", ring && "ring-2 ring-polaris-400/40")}
        style={{ height: size, width: size }}
      />
    );
  }
  return <Avatar initials={initials} size={size} tone={tone === "ink" ? "ink" : tone} />;
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
        onClick={onClick}
        className="flex w-full items-center gap-2.5 px-4 py-2 text-[13px] text-ink hover:bg-paper-soft dark:hover:bg-white/[0.05] transition-colors"
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
function SparkGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" className="text-aurora-300">
      <path d="M12 2l2.1 7.9L22 12l-7.9 2.1L12 22l-2.1-7.9L2 12l7.9-2.1z" />
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
function ReceiptGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
function FlameGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}
function SharedGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={glyphCls}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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
