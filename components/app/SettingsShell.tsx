"use client";

/**
 * SettingsShell - master-detail tab UI for /settings.
 *
 * The server page passes ALL sections pre-rendered as keyed slots; this
 * component holds the active tab state and shows only that section's
 * content. Sections keep their hidden state in the DOM (display:none) so
 * client islands inside them (forms, toggles) preserve their state across
 * tab switches. Deep-linkable via ?tab=<id> (and updates the URL on change
 * without scrolling).
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "./ui";
import { cn } from "@/lib/cn";

export type SettingsSectionId =
  | "profile"
  | "security"
  | "memory"
  | "usage"
  | "notifications"
  | "appearance"
  | "connected"
  | "family"
  | "billing"
  | "marketplace"
  | "data";

export type SettingsNavItem = {
  id: SettingsSectionId;
  label: string;
};

const NAV: SettingsNavItem[] = [
  { id: "profile",       label: "Profile" },
  { id: "security",      label: "Password & security" },
  { id: "memory",        label: "Strategist memory" },
  { id: "usage",         label: "AI usage" },
  { id: "notifications", label: "Notifications" },
  { id: "appearance",    label: "Appearance" },
  { id: "connected",     label: "Connected accounts" },
  { id: "family",        label: "Family & viewers" },
  { id: "billing",       label: "Billing & plan" },
  { id: "marketplace",   label: "Marketplace" },
  { id: "data",          label: "Privacy & data" },
];

/** Line icons per section - crisp SVGs, theme-aware via currentColor. */
const NAV_PATHS: Record<SettingsSectionId, string> = {
  "profile":       "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  "security":      "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  "memory":        "M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  "usage":         "M3 21h18M7 21V9M12 21V3M17 21v-7",
  "notifications": "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  "appearance":    "M12 21a9 9 0 1 1 0-18c5 0 9 3.6 9 8a4 4 0 0 1-4 4h-2a2 2 0 0 0-1.5 3.3c.3.4.5.8.5 1.2a1.5 1.5 0 0 1-2 1.5zM7.5 10.5h.01M12 7.5h.01M16.5 10.5h.01",
  "connected":     "M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5",
  "family":        "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
  "billing":       "M2 7h20v12H2zM2 11h20",
  "marketplace":   "M20.6 13.4 12 22 2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8zM7 7h.01",
  "data":          "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
};

function NavIcon({ id, size = 14 }: { id: SettingsSectionId; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={NAV_PATHS[id]} />
    </svg>
  );
}

const DEFAULT: SettingsSectionId = "profile";

function isValidTab(v: string | null): v is SettingsSectionId {
  return !!v && NAV.some((n) => n.id === v);
}

export function SettingsShell({
  sections,
  snapshot, basePath = "",
}: {
  sections: Partial<Record<SettingsSectionId, React.ReactNode>>;
  snapshot: React.ReactNode;
  basePath?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const initial = isValidTab(search.get("tab")) ? (search.get("tab") as SettingsSectionId) : DEFAULT;
  const [active, setActive] = useState<SettingsSectionId>(initial);

  // Follow deep links from the account menu even when the settings shell is
  // already mounted.
  useEffect(() => {
    const requested = search.get("tab");
    if (isValidTab(requested)) setActive(requested);
  }, [search]);

  // Keep the URL in sync (deep-linking) - but don't push scroll.
  useEffect(() => {
    const next = new URLSearchParams(Array.from(search.entries()));
    if (next.get("tab") === active) return;
    next.set("tab", active);
    const settingsPath = basePath ? `${basePath}/settings` : "/settings";
    router.replace(`${settingsPath}?${next.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, basePath]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-[72px] self-start">
        <Card className="p-2">
          <nav>
            <ul className="text-[13px]">
              {NAV.map((i) => {
                const isActive = i.id === active;
                return (
                  <li key={i.id}>
                    <button
                      type="button"
                      onClick={() => setActive(i.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                        isActive
                          ? "bg-polaris-500/15 text-ink dark:bg-polaris-400/20 dark:text-polaris-100 font-semibold"
                          : "text-ink-dim hover:bg-paper-soft hover:text-ink dark:hover:bg-white/[0.06]",
                      )}
                      aria-current={isActive ? "page" : undefined}
                    >
                      <span className={cn("shrink-0", isActive ? "text-polaris-500 dark:text-polaris-300" : "text-ink-muted")}>
                        <NavIcon id={i.id} />
                      </span>
                      <span className="truncate">{i.label}</span>
                      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-polaris-500" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </Card>

        <div className="mt-4">{snapshot}</div>
      </aside>

      {/* Main */}
      <main className="min-w-0">
        {NAV.map((i) => (
          <div key={i.id} hidden={i.id !== active} className={i.id === active ? "block" : ""}>
            {sections[i.id]}
          </div>
        ))}
      </main>
    </div>
  );
}

