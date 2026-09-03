/**
 * Public changelog.
 *
 * Seven Action Lab tools shipped and a visitor had no way to learn that any of
 * them were new. This is the source of truth for both `/changelog` and the
 * "what's new" ribbon on the landing page.
 *
 * Rules that keep it worth reading:
 *   • Newest first; `id` is stable and is what the ribbon stores as dismissed,
 *     so never reuse or renumber one.
 *   • `kind` is what actually happened, not how it was marketed.
 *   • Only ship entries for things a student can now do. Internal refactors,
 *     dependency bumps and infrastructure work do not belong here.
 */

export type ChangeKind = "feature" | "improvement" | "fix" | "security";

export type ChangeEntry = {
  id: string;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  kind: ChangeKind;
  title: string;
  /** One or two sentences, written from the student's side of the screen. */
  body: string;
  /** Where to go and try it. Omitted when there is nothing to open. */
  href?: string;
  /** Surfaced in the landing ribbon. At most one entry should carry this. */
  highlight?: boolean;
};

export const CHANGELOG: ChangeEntry[] = [
  {
    id: "2026-09-passport",
    date: "2026-09-03",
    kind: "feature",
    title: "Verified Student Passport",
    body: "Turn your evidence into one shareable page. Every claim that has an artifact behind it is listed with the proof and the date it was verified - and the claims that don't are left visibly empty.",
    href: "/passport",
    highlight: true,
  },
  {
    id: "2026-09-cohort",
    date: "2026-09-03",
    kind: "feature",
    title: "Cohort benchmarking",
    body: "See where you stand against anonymised students targeting the same universities. Cohorts under twenty students never render, so nobody is identifiable.",
    href: "/cohort",
  },
  {
    id: "2026-09-affordability",
    date: "2026-09-03",
    kind: "feature",
    title: "Affordability planner",
    body: "Total cost after aid in BDT against your family budget, with the funding gap named and the scholarships that would close it ranked against it.",
    href: "/affordability",
  },
  {
    id: "2026-09-exam-replan",
    date: "2026-09-03",
    kind: "feature",
    title: "Exam results now rewrite the plan",
    body: "Finish a mock and Polaris proposes the change to next week's blocks - which to add, which to drop, and why - as a diff you approve or reject.",
    href: "/action-lab",
  },
  {
    id: "2026-09-teacher-portal",
    date: "2026-09-03",
    kind: "feature",
    title: "Teacher and recommender portal",
    body: "Share a scoped, read-only view with a teacher: the evidence relevant to a recommendation and the deadlines that affect it, and nothing else.",
    href: "/family",
  },
  {
    id: "2026-09-deadline-autopilot",
    date: "2026-09-03",
    kind: "feature",
    title: "Deadline reminders that leave the app",
    body: "Risk-scored deadlines now reach you by email and SMS, not just in a tab you had to remember to open.",
    href: "/deadlines",
  },
  {
    id: "2026-09-offline",
    date: "2026-09-03",
    kind: "improvement",
    title: "Works on a bad connection",
    body: "Your roadmap and the current week are cached for offline reading, and exam answers queue locally until the connection comes back.",
  },
  {
    id: "2026-09-billing-sslcommerz",
    date: "2026-09-03",
    kind: "security",
    title: "Payments moved to SSLCommerz",
    body: "Checkout now runs on SSLCommerz with server-side validation on every payment, and plan access is tied to the paid term rather than to gateway events.",
    href: "/billing",
  },
  {
    id: "2026-09-clerk",
    date: "2026-09-03",
    kind: "security",
    title: "Accounts moved to Clerk",
    body: "Sign-in, email verification and two-factor authentication are now handled by Clerk. Existing accounts are adopted automatically on your next sign-in.",
  },
  {
    id: "2026-09-mobile-topbar",
    date: "2026-09-03",
    kind: "fix",
    title: "Language and account controls reachable on phones",
    body: "The workspace header pushed the Bengali toggle, theme switch and account menu off the right edge of a phone screen. All three are reachable again.",
  },
];

export const KIND_LABEL: Record<ChangeKind, string> = {
  feature: "New",
  improvement: "Improved",
  fix: "Fixed",
  security: "Security",
};

/** The one entry the landing ribbon offers, if any. */
export function highlightedEntry(): ChangeEntry | null {
  return CHANGELOG.find((e) => e.highlight) ?? null;
}

/** Entries grouped by date, newest first - the shape `/changelog` renders. */
export function groupedByDate(): { date: string; entries: ChangeEntry[] }[] {
  const groups = new Map<string, ChangeEntry[]>();
  for (const entry of CHANGELOG) {
    const list = groups.get(entry.date) ?? [];
    list.push(entry);
    groups.set(entry.date, list);
  }
  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, entries]) => ({ date, entries }));
}
