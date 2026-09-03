/**
 * Product analytics.
 *
 * There was none: no funnel, no retention signal, nothing to say which of the
 * seven Action Lab tools anyone comes back to. That made every roadmap decision
 * a guess, so this ships before the next feature does.
 *
 * Deliberately provider-thin. `NEXT_PUBLIC_ANALYTICS_HOST` + `_KEY` point at a
 * PostHog-compatible capture endpoint; with neither set, `track()` is a no-op in
 * production and logs to the console in development, so the call sites are
 * always safe to write and nothing is sent from a developer's machine.
 *
 * No PII. The distinct id is the application user id (already a random
 * ObjectId) or an anonymous per-browser id. Never an email, name, or anything
 * a student typed.
 */

export type AnalyticsEvent =
  // ── Acquisition ──
  | "demo_opened"
  | "demo_section_viewed"
  | "signup_started"
  | "signup_completed"
  // ── Activation ──
  | "roadmap_generated"
  | "strategist_first_message"
  | "action_lab_tool_used"
  | "exam_started"
  | "exam_completed"
  // ── Revenue ──
  | "upgrade_viewed"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed";

type Props = Record<string, string | number | boolean | null | undefined>;

const HOST = process.env.NEXT_PUBLIC_ANALYTICS_HOST;
const KEY = process.env.NEXT_PUBLIC_ANALYTICS_KEY;

const ANON_KEY = "polaris.anon_id";

function anonId(): string {
  try {
    let id = window.localStorage.getItem(ANON_KEY);
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    // Private mode or blocked storage - a per-session id is still useful.
    return "anon";
  }
}

let distinctId: string | null = null;

/** Attach the signed-in user so pre- and post-signup events can be joined. */
export function identify(userId: string): void {
  distinctId = userId;
}

export function track(event: AnalyticsEvent, props: Props = {}): void {
  if (typeof window === "undefined") return;

  const payload = {
    event,
    properties: {
      ...props,
      distinct_id: distinctId ?? anonId(),
      $current_url: window.location.pathname, // path only - never query strings
    },
  };

  if (!HOST || !KEY) {
    if (process.env.NODE_ENV === "development") {
      console.debug("[analytics]", event, payload.properties);
    }
    return;
  }

  // keepalive so an event fired during navigation still leaves the page.
  fetch(`${HOST}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: KEY, ...payload }),
    keepalive: true,
  }).catch(() => {
    // Analytics must never surface an error to a student.
  });
}
