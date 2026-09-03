"use client";

/**
 * Workspace theme provider. A single persisted preference controls every app
 * route, while the marketing site keeps its intentional light presentation.
 *
 * The route split lives in lib/theme/routes so this and the pre-hydration
 * script in the document head cannot disagree - see the note there for why
 * that mattered.
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { isThemedPath, leadingSegment } from "@/lib/theme/routes";
import { THEME_PREFERENCE_KEY, THEME_STORAGE_KEY } from "@/lib/theme/preflight";

type Theme = "light" | "dark";
export type ThemePreference = Theme | "auto";

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
  const themed = isThemedPath(pathname);
  const [theme, setTheme] = useState<Theme>("light");
  const [preference, setPreference] = useState<ThemePreference>("auto");

  useEffect(() => {
    if (!themed) {
      apply("light");
      setTheme("light");
      return;
    }

    const savedPreference = readStored(THEME_PREFERENCE_KEY) as ThemePreference | null;
    const legacyTheme = readStored(THEME_STORAGE_KEY) as Theme | null;
    const demoDefault = leadingSegment(pathname) === "demo";
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
    writeStored(THEME_STORAGE_KEY, nextTheme);

    if (nextPreference !== "auto") return;
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const resolved: Theme = media?.matches ? "dark" : "light";
      apply(resolved);
      setTheme(resolved);
      writeStored(THEME_STORAGE_KEY, resolved);
    };
    media?.addEventListener?.("change", syncSystemTheme);
    return () => media?.removeEventListener?.("change", syncSystemTheme);
  }, [themed, pathname]);

  const set = useCallback(
    (nextPreference: ThemePreference) => {
      if (!themed) return;
      const nextTheme = resolveTheme(nextPreference);
      apply(nextTheme);
      writeStored(THEME_PREFERENCE_KEY, nextPreference);
      writeStored(THEME_STORAGE_KEY, nextTheme);
      setPreference(nextPreference);
      setTheme(nextTheme);
    },
    [themed],
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

/**
 * localStorage throws, rather than returning null, in a browser configured to
 * block site data. The preflight script guards for the same reason.
 */
function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* preference simply will not persist */
  }
}

function apply(t: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = t;
  document.documentElement.style.colorScheme = t;
}

export function useTheme() {
  return useContext(ThemeCtx);
}
