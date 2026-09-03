import { getDb } from "@/lib/db/mongodb";
import { getUserById } from "@/lib/db/collections";
import { appOrigin } from "@/lib/env";
import { send, isChannelConfigured, type Channel, type SendOutcome } from "./channels";
import { daysUntil } from "./schedule";
import type { DbDeadline } from "@/lib/deadlines/service";

// Re-exported so callers have one import for the scheduling surface.
export { daysUntil, isDueToday } from "./schedule";

/**
 * Deadline reminder dispatch.
 *
 * Runs from a scheduled request rather than a per-user timer, so a student who
 * never opens the app still gets the text. Idempotency is the whole design:
 *
 *   • Each (user, deadline, channel, day-offset) may fire exactly once, enforced
 *     by a unique index on `notification_log` - not by a "sent" flag we hope to
 *     write correctly. A retried or double-scheduled run is harmless.
 *   • The log row is claimed *before* the send. A duplicate text is worse than a
 *     missed one here: the reminder is also visible in the app, so a lost send
 *     degrades to what the product did before, while a duplicate at 6am does
 *     not.
 */

export type ReminderPrefs = {
  userId: string;
  email: boolean;
  sms: boolean;
  /** Days before a deadline to notify, when the deadline sets none itself. */
  defaultOffsets: number[];
  phone?: string;
  updatedAt: Date;
};

const DEFAULT_PREFS: Omit<ReminderPrefs, "userId" | "updatedAt"> = {
  email: true,
  sms: false, // opt-in: it costs the student nothing but it is still a text
  defaultOffsets: [14, 7, 3, 1],
};

export async function getPrefs(userId: string): Promise<ReminderPrefs> {
  const db = await getDb();
  const row = await db
    .collection<ReminderPrefs>("notification_prefs")
    .findOne({ userId });
  return row ?? { userId, ...DEFAULT_PREFS, updatedAt: new Date() };
}

export async function setPrefs(
  userId: string,
  patch: Partial<Omit<ReminderPrefs, "userId" | "updatedAt">>,
): Promise<ReminderPrefs> {
  const db = await getDb();
  await db.collection<ReminderPrefs>("notification_prefs").updateOne(
    { userId },
    { $set: { ...patch, updatedAt: new Date() }, $setOnInsert: { userId } },
    { upsert: true },
  );
  return getPrefs(userId);
}

/**
 * Claim the right to send exactly one notification.
 * Returns false when this exact reminder has already been claimed.
 */
async function claim(
  userId: string,
  deadlineId: string,
  channel: Channel,
  dayBucket: number,
): Promise<boolean> {
  const db = await getDb();
  try {
    await db.collection("notification_log").insertOne({
      userId, deadlineId, channel, dayBucket, createdAt: new Date(),
    });
    return true;
  } catch {
    return false; // unique index rejected it - already claimed
  }
}

function compose(deadline: DbDeadline, days: number): { subject: string; body: string } {
  const when =
    days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  const subject = `${deadline.title} closes ${when}`;
  const link = `${appOrigin()}/deadlines`;

  const parts = [`${deadline.title} closes ${when}.`];
  if (deadline.universityName) parts.push(deadline.universityName);
  if (deadline.officialLink) parts.push(deadline.officialLink);
  else parts.push(link);

  return { subject, body: parts.join(" ") };
}

export type DispatchSummary = {
  scanned: number;
  due: number;
  sent: number;
  skipped: number;
  failed: number;
  outcomes: SendOutcome[];
};

/**
 * Find every reminder due today and deliver it.
 *
 * `horizonDays` bounds the scan: a deadline further out than the largest offset
 * anyone uses can never be due today.
 */
export async function dispatchDueReminders(
  options: { now?: Date; horizonDays?: number; limit?: number } = {},
): Promise<DispatchSummary> {
  const now = options.now ?? new Date();
  const horizon = options.horizonDays ?? 30;
  const db = await getDb();

  const todayIso = now.toISOString().slice(0, 10);
  const endIso = new Date(now.getTime() + horizon * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const deadlines = await db
    .collection<DbDeadline>("deadlines")
    .find({
      date: { $gte: todayIso, $lte: endIso },
      // A deadline the student has already ticked off needs no reminder.
      status: { $ne: "done" },
    })
    .limit(options.limit ?? 2000)
    .toArray();

  const summary: DispatchSummary = {
    scanned: deadlines.length, due: 0, sent: 0, skipped: 0, failed: 0, outcomes: [],
  };

  // Preferences and contact details are per user; cache across their deadlines.
  const prefsCache = new Map<string, ReminderPrefs>();
  const contactCache = new Map<string, { email?: string; phone?: string }>();

  for (const deadline of deadlines) {
    const days = daysUntil(deadline.date, now);
    if (!Number.isFinite(days) || days < 0) continue;

    let prefs = prefsCache.get(deadline.userId);
    if (!prefs) {
      prefs = await getPrefs(deadline.userId);
      prefsCache.set(deadline.userId, prefs);
    }

    const offsets = deadline.reminderDays?.length
      ? deadline.reminderDays
      : prefs.defaultOffsets;
    if (!offsets.includes(days)) continue;

    summary.due++;

    let contact = contactCache.get(deadline.userId);
    if (!contact) {
      const user = await getUserById(deadline.userId);
      contact = { email: user?.email, phone: prefs.phone ?? user?.phone };
      contactCache.set(deadline.userId, contact);
    }

    const { subject, body } = compose(deadline, days);
    const deadlineId = deadline._id?.toString() ?? `${deadline.userId}:${deadline.date}:${deadline.title}`;

    const channels: { channel: Channel; to?: string; enabled: boolean }[] = [
      { channel: "sms", to: contact.phone, enabled: prefs.sms },
      { channel: "email", to: contact.email, enabled: prefs.email },
    ];

    for (const c of channels) {
      if (!c.enabled || !c.to) continue;
      if (!isChannelConfigured(c.channel)) {
        summary.skipped++;
        summary.outcomes.push({
          status: "skipped", channel: c.channel, reason: "not-configured",
        });
        continue;
      }
      // Claim first: a duplicate reminder is worse than a missed one, because
      // the deadline is visible in the app regardless.
      if (!(await claim(deadline.userId, deadlineId, c.channel, days))) continue;

      const outcome = await send(c.channel, { to: c.to, subject, body });
      summary.outcomes.push(outcome);
      if (outcome.status === "sent") summary.sent++;
      else if (outcome.status === "skipped") summary.skipped++;
      else summary.failed++;
    }
  }

  return summary;
}
