/**
 * The theme applied before React hydrates.
 *
 * This runs as a blocking inline script in <head>. Without it the document
 * paints with the server's default and then snaps to the saved theme once the
 * provider mounts - the white flash on every hard navigation into the
 * workspace. It therefore has to reach exactly the same conclusion the
 * provider will, from the same inputs, which is why the route list it uses is
 * imported rather than restated.
 */

import { THEMED_ROUTE_SEGMENTS } from "./routes";

/** Resolved theme actually in effect. Read by the pre-hydration script. */
export const THEME_STORAGE_KEY = "polaris.theme";

/** The student's choice: "light", "dark", or "auto" (follow the OS). */
export const THEME_PREFERENCE_KEY = "polaris.theme.preference";

/**
 * The inline script, built from the shared route list.
 *
 * Segment matching is a split-and-lookup rather than a regex: the previous
 * version embedded a regex literal inside a template string, so every `\` in
 * it needed doubling, and getting that wrong fails silently - the test just
 * stops matching and every route looks like marketing.
 *
 * Wrapped in try/catch because localStorage throws outright in a browser set
 * to block site data; a theme preference is not worth breaking the page over.
 */
export function themePreflightScript(): string {
  const segments = JSON.stringify(THEMED_ROUTE_SEGMENTS);
  return `
(function(){
  try {
    var path = location.pathname || '/';
    var seg = path.split('/')[1] || '';
    var themed = ${segments}.indexOf(seg) !== -1;
    var theme = 'light';
    if (themed) {
      var system = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      var pref = localStorage.getItem(${JSON.stringify(THEME_PREFERENCE_KEY)});
      var saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
      if (pref === 'dark' || pref === 'light') theme = pref;
      else if (pref === 'auto') theme = system;
      else if (saved === 'dark' || saved === 'light') theme = saved;
      else theme = seg === 'demo' ? 'dark' : system;
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;
}

/** Precomputed so the layout can drop it straight into the document head. */
export const THEME_PREFLIGHT_SCRIPT = themePreflightScript();
