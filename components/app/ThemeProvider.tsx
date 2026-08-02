"use client";

/**
 * Workspace theme provider. A single persisted preference controls every app
 * route, while the marketing site keeps its intentional light presentation.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Theme = "light" | "dark";
export type ThemePreference = Theme | "auto";

const STORAGE_KEY = "polaris.theme";
const PREFERENCE_KEY = "polaris.theme.preference";

const APP_PREFIX_RE =
  /^\/(strategist|dashboard|account|billing|connections|deadlines|family|partners|consultants|community|bookings|resources|roadmap|settings|transactions|universities|admin|monitor|demo|action-lab)(\/|$)/;

const ThemeCtx = createContext<{
  theme: Theme;
  preference: ThemePreference;
  toggle: () => void;
  set: (t: ThemePreference) => void;
}>({
  theme: "light",
  preference: "auto",
  toggle: () => {},
  set: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const isAppRoute = APP_PREFIX_RE.test(pathname);
  const [theme, setTheme] = useState<Theme>("light");
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    if (!isAppRoute) {
      apply("light");
      setTheme("light");
      return;
    }

    const savedPreference = localStorage.getItem(PREFERENCE_KEY) as ThemePreference | null;
    const legacyTheme = localStorage.getItem(STORAGE_KEY) as Theme | null;
    const demoDefault = pathname === "/demo" || pathname.startsWith("/demo/");
    const nextPreference: ThemePreference =
      savedPreference === "light" || savedPreference === "dark" || savedPreference === "auto"
        ? savedPreference
        : legacyTheme === "light" || legacyTheme === "dark"
          ? legacyTheme
          : demoDefault
            ? "dark"
            : "auto";
    const nextTheme = resolveTheme(nextPreference);

    apply(nextTheme);
    setTheme(nextTheme);
    setPreference(nextPreference);
    localStorage.setItem(STORAGE_KEY, nextTheme);

    if (nextPreference !== "auto") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const resolved: Theme = media?.matches ? "dark" : "light";
      apply(resolved);
      setTheme(resolved);
      localStorage.setItem(STORAGE_KEY, resolved);
    };
    media?.addEventListener?.("change", syncSystemTheme);
    return () => media?.removeEventListener?.("change", syncSystemTheme);
  }, [isAppRoute, pathname]);

  const set = useCallback(
    (nextPreference: ThemePreference) => {
      if (!isAppRoute) return;
      const nextTheme = resolveTheme(nextPreference);
      apply(nextTheme);
      localStorage.setItem(PREFERENCE_KEY, nextPreference);
      localStorage.setItem(STORAGE_KEY, nextTheme);
      setPreference(nextPreference);
      setTheme(nextTheme);
    },
    [isAppRoute],
  );

  const toggle = useCallback(() => {
    set(theme === "dark" ? "light" : "dark");
  }, [theme, set]);

  return <ThemeCtx.Provider value={{ theme, preference, toggle, set }}>{children}</ThemeCtx.Provider>;
}

function resolveTheme(preference: ThemePreference): Theme {
  if (preference === "light" || preference === "dark") return preference;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
}

export function useTheme() {
  return useContext(ThemeCtx);
}

/** Set the resolved theme before hydration so app navigation never flashes. */
export const THEME_PREFLIGHT_SCRIPT = `
(function(){
  try {
    var p = location.pathname || '/';
    var isApp = /^\\/(strategist|dashboard|account|billing|connections|deadlines|family|partners|consultants|community|bookings|resources|roadmap|settings|transactions|universities|admin|monitor|demo|action-lab)(\\/|$)/.test(p);
    var t = 'light';
    if (isApp) {
      var pref = localStorage.getItem('${PREFERENCE_KEY}');
      var saved = localStorage.getItem('${STORAGE_KEY}');
      var demoDefault = p === '/demo' || p.indexOf('/demo/') === 0;
      if (pref === 'dark' || pref === 'light') t = pref;
      else if (pref === 'auto') t =
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      else if (saved === 'dark' || saved === 'light') t = saved;
      else t = demoDefault ? 'dark' :
        (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    }
    document.documentElement.dataset.theme = t;
    document.documentElement.style.colorScheme = t;
  } catch(e) {}
})();
`;
