"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeCtx = { theme: Theme; toggle: () => void };

const ThemeContext = createContext<ThemeCtx>({ theme: "light", toggle: () => {} });

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Inline script that runs before React hydrates to prevent a flash of wrong
 * theme. Reads localStorage and sets `data-theme` on <html>.
 */
export const THEME_PREFLIGHT_SCRIPT = `
(function(){
  try {
    var t = localStorage.getItem('polaris.theme');
    if (t === 'dark') document.documentElement.dataset.theme = 'dark';
  } catch(e) {}
})();
`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  // Sync on mount
  useEffect(() => {
    const stored = localStorage.getItem("polaris.theme") as Theme | null;
    if (stored === "dark") {
      setTheme("dark");
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("polaris.theme", next);
      if (next === "dark") {
        document.documentElement.dataset.theme = "dark";
      } else {
        delete document.documentElement.dataset.theme;
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
