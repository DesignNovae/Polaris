"use client";

/**
 * Nav - floating glass pill in the rrad.ltd style.
 *
 * - Sticky rounded pill that floats above the content with backdrop blur.
 * - Adapts to the current section's theme: reads `data-section-theme` on the
 *   section under the nav and switches between a dark-glass and light-glass
 *   variant. Default is dark.
 * - Right-side CTA is always a dark pill with a green pulse dot for prospects.
 * - Active link sits inside a contrasting solid pill.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useLang } from "@/lib/i18n/LangProvider";
import { PLAN_LABELS } from "@/lib/features";
import { cn } from "@/lib/cn";

type NavLink = { href: string; label: string; accent?: boolean };
type Theme = "dark" | "light";
type NavCtx = { theme: Theme; activeAnchor: string };

/**
 * Scroll observer that returns BOTH the current section's theme AND its `id`,
 * so the Nav can swap glass variants AND highlight the matching anchor link
 * (Home / How it works / Pricing) as you scroll the landing page.
 */
function useNavContext(): NavCtx {
  const [ctx, setCtx] = useState<NavCtx>({ theme: "dark", activeAnchor: "home" });
  const raf = useRef<number | null>(null);

  useEffect(() => {
    function probe() {
      const sections = document.querySelectorAll<HTMLElement>("[data-section-theme]");
      let theme: Theme = "light";
      let activeAnchor = "";
      for (const sec of sections) {
        const rect = sec.getBoundingClientRect();
        if (rect.top <= 80 && rect.bottom > 80) {
          theme = (sec.getAttribute("data-section-theme") as Theme) ?? "light";
          activeAnchor = sec.id || "";
        }
      }
      setCtx((cur) =>
        cur.theme === theme && cur.activeAnchor === activeAnchor
          ? cur
          : { theme, activeAnchor },
      );
    }
    function onScroll() {
      if (raf.current != null) return;
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        probe();
      });
    }
    probe();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (raf.current != null) cancelAnimationFrame(raf.current);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return ctx;
}
export function Nav() {
  const { t, lang, setLang } = useLang();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { theme, activeAnchor } = useNavContext();

  const role = session?.user?.role ?? "student";
  const plan = session?.user?.plan ?? "free";
  const isViewer = role === "parent" || role === "partner";

  const links: NavLink[] = [
    { href: "/", label: "Home" },
    { href: "/#how", label: t.nav.howItWorks },
    { href: "/#pricing", label: t.nav.pricing },
    { href: "/case-studies", label: "Case studies" },
    ...(session && !isViewer ? [{ href: "/roadmap", label: "Roadmap" }] : []),
    { href: "/demo", label: "Live demo", accent: true },
    ...(session && isViewer ? [{ href: "/monitor", label: "Monitor" }] : []),
    ...(role === "admin" ? [{ href: "/admin", label: "Admin", accent: true }] : []),
  ];

  const onDark = theme === "dark";

  // Liquid-glass pill chrome - accurate to rrad.ltd: very dark glass with a
  // subtle inner top highlight (the glass reflection), faint hairline ring,
  // and a soft outer shadow.
  const pillBg = onDark
    ? "bg-black/45 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.10),0_10px_30px_-14px_rgba(0,0,0,0.6)]"
    : "bg-paper-card/55 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-inset ring-ink/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.6),0_10px_30px_-16px_rgba(139,94,60,0.25)]";
  const linkColor = onDark ? "text-paper/75 hover:text-paper" : "text-ink-dim hover:text-ink";
  const activePill = onDark ? "bg-white/15 text-paper" : "bg-ink text-paper";
  const accentColor = onDark
    ? "text-[#F5C0C9] hover:text-[#FBE0E5]"
    : "text-signal-rose hover:text-[#A24159]";
  const hamburgerStyle = onDark
    ? "bg-white/10 text-paper ring-1 ring-inset ring-white/15"
    : "bg-paper-card text-ink ring-1 ring-inset ring-ink/10";

  function isActive(href: string) {
    // Off-homepage routes (e.g. /case-studies, /signin) - pathname match only.
    if (pathname !== "/") {
      if (href === "/" || href.startsWith("/#")) return false;
      return pathname === href || pathname.startsWith(href + "/");
    }
    // On the homepage - drive active state from the section currently in view.
    // `activeAnchor` comes from data-section-theme sections' `id` attribute
    // (hero="home", how="how", pricing="pricing"; other sections have no id
    // and therefore highlight nothing).
    if (href === "/") return activeAnchor === "home" || activeAnchor === "";
    if (href.startsWith("/#")) return href.slice(2) === activeAnchor;
    return false;
  }

  const LangToggle = (
    <div
      className={cn(
        "rounded-full p-0.5 text-xs flex transition-colors duration-300",
        pillBg,
      )}
    >
      <button
        onClick={() => setLang("en")}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors duration-150",
          lang === "en"
            ? onDark ? "bg-white/20 text-paper font-medium" : "bg-paper-card text-ink font-medium shadow-sm"
            : onDark ? "text-paper/65 hover:text-paper" : "text-ink-dim hover:text-ink",
        )}
      >
        EN
      </button>
      <button
        onClick={() => setLang("bn")}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors duration-150",
          lang === "bn"
            ? onDark ? "bg-white/20 text-paper font-medium" : "bg-paper-card text-ink font-medium shadow-sm"
            : onDark ? "text-paper/65 hover:text-paper" : "text-ink-dim hover:text-ink",
        )}
      >
        বাংলা
      </button>
    </div>
  );

  return (
    <header className="sticky top-0 z-40 w-full pointer-events-none">
      <div className="pt-4 px-4 sm:px-6">
        <div className="pointer-events-auto mx-auto flex max-w-7xl items-center justify-between gap-4">
          {/* Brand (no pill, floats free) */}
          <Link
            href="/"
            className="flex items-center gap-2 shrink-0"
            onClick={() => setOpen(false)}
          >
            <CompassLogo onDark={onDark} />
            <span
              className={cn(
                "font-serif text-[17px] font-bold tracking-tight transition-colors",
                onDark ? "text-paper" : "text-ink",
              )}
            >
              Polaris
            </span>
          </Link>

          {/* Center: nav links inside their own glass pill */}
          <nav
            className={cn(
              "hidden xl:flex items-center gap-1 rounded-full px-2 py-1.5 text-[13px] transition-colors duration-300",
              pillBg,
            )}
          >
            {links.map((l) => {
              const active = isActive(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={cn(
                    "px-3 py-1.5 rounded-full whitespace-nowrap transition-colors",
                    active ? activePill : l.accent ? accentColor : linkColor,
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>

          {/* Right: lang toggle + auth - each its own floating element */}
          <div className="hidden xl:flex items-center gap-2 shrink-0">
            {LangToggle}
            {status === "loading" ? (
              <div className="h-9 w-24" />
            ) : session ? (
              <>
                <Link
                  href="/account"
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors",
                    pillBg,
                    onDark ? "text-paper/85 hover:text-paper" : "text-ink-dim hover:text-ink",
                  )}
                  title="Your profile & account"
                >
                  <UserIcon />
                  <span className="max-w-[100px] truncate">
                    {session.user?.name || session.user?.email}
                  </span>
                  <PlanBadge plan={plan} onDark={onDark} />
                </Link>
                <button
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className={cn(
                    "rounded-full px-3.5 py-2 text-[13px] font-medium transition-colors",
                    pillBg,
                    onDark ? "text-paper hover:text-paper" : "text-ink hover:text-ink",
                  )}
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/signin"
                  className={cn(
                    "text-[13px] font-medium transition-colors px-3.5 py-2 rounded-full",
                    pillBg,
                    onDark ? "text-paper/85 hover:text-paper" : "text-ink-dim hover:text-ink",
                  )}
                >
                  Sign in
                </Link>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-paper px-4 py-2 text-[13px] font-semibold text-ink hover:bg-paper-soft transition-colors duration-150 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)]"
                >
                  <span className="relative inline-flex">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-400 opacity-75 animate-ping" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-400" />
                  </span>
                  Start free
                  <ArrowRight />
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "xl:hidden inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors",
              hamburgerStyle,
            )}
            aria-label="Toggle menu"
            aria-expanded={open}
          >
            {open ? <CloseIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>

      {/* Mobile panel */}
      {open && (
        <div className="pointer-events-auto xl:hidden mx-auto mt-2 w-[min(1100px,calc(100%-2rem))]">
          <div
            className={cn(
              "rounded-2xl p-4 transition-colors",
              onDark
                ? "bg-ink/85 backdrop-blur-xl ring-1 ring-inset ring-white/10"
                : "bg-paper-card/95 backdrop-blur-xl ring-1 ring-inset ring-ink/10",
            )}
          >
            <nav className="flex flex-col">
              {links.map((l) => {
                const active = isActive(l.href);
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-lg px-3 py-2.5 text-sm transition-colors",
                      active ? activePill : l.accent ? accentColor : linkColor,
                    )}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </nav>

            <div
              className={cn(
                "mt-3 pt-3 border-t flex flex-col gap-3",
                onDark ? "border-white/10" : "border-ink/10",
              )}
            >
              {LangToggle}
              {status === "loading" ? null : session ? (
                <>
                  <Link
                    href="/account"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm",
                      onDark
                        ? "bg-white/10 text-paper ring-1 ring-inset ring-white/10"
                        : "bg-paper-soft text-ink ring-1 ring-inset ring-ink/10",
                    )}
                  >
                    <UserIcon />
                    <span className="flex-1 truncate">{session.user?.name || session.user?.email}</span>
                    <PlanBadge plan={plan} onDark={onDark} />
                  </Link>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className={cn(
                      "rounded-full px-4 py-2.5 text-sm font-medium transition-colors",
                      onDark
                        ? "bg-white/10 text-paper hover:bg-white/15 ring-1 ring-inset ring-white/10"
                        : "bg-paper-card text-ink hover:bg-paper-soft ring-1 ring-inset ring-ink/10",
                    )}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    className={cn(
                      "rounded-full px-4 py-2.5 text-center text-sm font-medium transition-colors",
                      onDark
                        ? "bg-white/10 text-paper hover:bg-white/15 ring-1 ring-inset ring-white/10"
                        : "bg-paper-card text-ink hover:bg-paper-soft ring-1 ring-inset ring-ink/10",
                    )}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setOpen(false)}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-center text-sm font-semibold text-paper hover:bg-polaris-700 transition-colors"
                  >
                    <span className="relative inline-flex">
                      <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-400 opacity-75 animate-ping" />
                      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-400" />
                    </span>
                    Start free
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export function CompassLogo({ className, onDark }: { className?: string; onDark?: boolean }) {
  const ring = onDark ? "#F4D7BC" : "#8B5E3C";
  const ringSoft = onDark ? "#F4D7BC" : "#C47D4E";
  const fillCore = onDark ? "#F4D7BC" : "#8B5E3C";
  const fillCenter = onDark ? "#2C1810" : "#FAF6F0";
  return (
    <span aria-hidden className={cn("relative inline-flex h-8 w-8 items-center justify-center shrink-0", className)}>
      <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={ring} strokeWidth="1.5" opacity="0.4" />
        <circle cx="16" cy="16" r="11" stroke={ringSoft} strokeWidth="0.75" opacity="0.35" />
        <line x1="16" y1="3" x2="16" y2="29" stroke={ring} strokeWidth="0.5" opacity="0.25" />
        <line x1="3" y1="16" x2="29" y2="16" stroke={ring} strokeWidth="0.5" opacity="0.25" />
        <polygon points="16,4 18.5,14 16,12.5 13.5,14" fill={fillCore} />
        <polygon points="16,28 18.5,18 16,19.5 13.5,18" fill={ringSoft} opacity="0.55" />
        <polygon points="28,16 18,13.5 19.5,16 18,18.5" fill={ringSoft} opacity="0.55" />
        <polygon points="4,16 14,13.5 12.5,16 14,18.5" fill={ringSoft} opacity="0.55" />
        <circle cx="16" cy="16" r="2" fill={fillCore} />
        <circle cx="16" cy="16" r="1" fill={fillCenter} />
      </svg>
    </span>
  );
}

export const StarLogo = CompassLogo;

function PlanBadge({ plan, onDark }: { plan: "free" | "pro" | "elite"; onDark?: boolean }) {
  const styleDark = {
    free: "bg-white/10 text-paper/70 ring-white/10",
    pro: "bg-polaris-400/25 text-[#F4D7BC] ring-polaris-400/30",
    elite: "bg-aurora-500/25 text-aurora-400 ring-aurora-400/30",
  }[plan];
  const styleLight = {
    free: "bg-paper-soft text-ink-dim ring-ink/10",
    pro: "bg-polaris-500/15 text-polaris-600 ring-polaris-400/40",
    elite: "bg-aurora-500/15 text-aurora-500 ring-aurora-400/40",
  }[plan];
  return (
    <span
      className={cn(
        "shrink-0 text-[10px] font-semibold uppercase tracking-wide rounded-full ring-1 ring-inset px-1.5 py-0.5",
        onDark ? styleDark : styleLight,
      )}
    >
      {PLAN_LABELS[plan]}
    </span>
  );
}

function ArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 5l7 7-7 7" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-75">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M3 6h18M3 12h18M3 18h18" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}
