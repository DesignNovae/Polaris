import type { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/respond";
import { dispatchDueReminders } from "@/lib/notifications/deadlines";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled reminder dispatch. Run once a day.
 *
 * Authenticated by a shared secret rather than a session, because the caller is
 * a scheduler and not a person. Compared in constant time, and the route refuses
 * to run at all when no secret is configured - an open endpoint that sends real
 * SMS to real students is not something to leave to a default.
 *
 * Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = req.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : header;
  if (provided.length !== secret.length) return false;

  let diff = 0;
  for (let i = 0; i < secret.length; i++) {
    diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return fail(401, "Unauthorised");
  }
  try {
    const summary = await dispatchDueReminders();
    console.log("[cron] deadline reminders:", {
      scanned: summary.scanned, due: summary.due,
      sent: summary.sent, skipped: summary.skipped, failed: summary.failed,
    });
    // Outcomes carry addresses; the response reports counts only.
    const { outcomes: _outcomes, ...counts } = summary;
    return ok(counts);
  } catch (err) {
    console.error("[cron] deadline reminders failed:", err);
    return fail(500, "Dispatch failed");
  }
}
