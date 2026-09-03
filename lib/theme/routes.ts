/**
 * Which paths follow the workspace theme.
 *
 * The marketing site is deliberately light-only; everything behind a sign-in
 * follows the student's saved preference. The pre-hydration script in the
 * document head and the runtime provider both have to agree on that split, and
 * they used to carry two hand-maintained copies of the same route list written
 * as regex alternations - one in TypeScript, one re-escaped inside a template
 * string.
 *
 * They drifted the moment new routes shipped. /passport, /cohort and
 * /affordability were added to the workspace and to the nav but to neither
 * list, so opening any of them fell through to the marketing branch and reset
 * the workspace to light mid-session. /portal had the same problem for anyone
 * signing in as a parent or partner.
 *
 * So: one list, one matcher, no regex escaping, and a test that reads the
 * app/(app) directory off disk and fails when a new route is not represented
 * here. Adding a workspace route without theming it is now a failing test
 * rather than a bug a user reports.
 */

/**
 * The first path segment of every route that follows the workspace theme.
 *
 * Everything under app/(app), plus the workspace surfaces that sit outside
 * that route group. Kept sorted so additions are easy to see in a diff.
 *
 * Segments must be lowercase letters, digits and hyphens - `themePreflight`
 * embeds them in an inline script, and `tests/theme-routes.test.ts` enforces
 * the charset so nothing that needs escaping can get in.
 */
export const THEMED_ROUTE_SEGMENTS = [
  "account",
  "action-lab",
  "admin",
  "affordability",
  "billing",
  "bookings",
  "cohort",
  "community",
  "connections",
  "consultants",
  "dashboard",
  "deadlines",
  "demo",
  "exams",
  "family",
  "monitor",
  "partners",
  "passport",
  "portal",
  "resources",
  "roadmap",
  "settings",
  "strategist",
  "transactions",
  "universities",
] as const;

/**
 * Routes that must stay light regardless of preference.
 *
 * Not used for matching - anything absent from THEMED_ROUTE_SEGMENTS is light
 * already. This records the ones that are light *on purpose*, so the test can
 * assert they were never quietly added to the themed list. `p` is the public
 * passport a student shares with a recommender; `university` and
 * `case-studies` are marketing.
 */
export const INTENTIONALLY_LIGHT_SEGMENTS = [
  "",
  "case-studies",
  "changelog",
  "p",
  "signin",
  "signout",
  "signup",
  "university",
] as const;

const SEGMENTS: ReadonlySet<string> = new Set(THEMED_ROUTE_SEGMENTS);

/** The leading segment of a path: "/roadmap/42" -> "roadmap", "/" -> "". */
export function leadingSegment(pathname: string): string {
  return pathname.split("/")[1] ?? "";
}

/** True when this path follows the saved workspace theme. */
export function isThemedPath(pathname: string): boolean {
  return SEGMENTS.has(leadingSegment(pathname));
}
