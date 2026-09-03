import type { Db } from "mongodb";
import { ensureAppIndexes } from "./indexes-app";

/**
 * Idempotent index creation - the single source of truth for every index in
 * the database. `getDb()` awaits this once per process on the first query.
 *
 * There used to be a second, private `ensureIndexes` inside mongodb.ts that
 * shadowed this file entirely: nothing imported this module, so the retrieval
 * indexes (kb_chunks / user_chunks), the uniqueness constraints on profiles and
 * connections, and the strategist_messages TTL were declared here and never
 * created. mongodb.ts now imports this function and the duplicate is gone; the
 * exam / monitor indexes it used to own are folded in below.
 *
 * createIndex is a no-op when an equivalent index already exists, so calling
 * this on every cold start is safe.
 */

let ensured: Promise<void> | null = null;

export function ensureIndexes(db: Db): Promise<void> {
  // Cache the promise, not a boolean: concurrent first-requests must await the
  // same run instead of racing past a flag that is set before the work starts.
  ensured ??= run(db).catch((err) => {
    console.error("[db] ensureIndexes failed:", err);
    ensured = null; // let the next request retry
  });
  return ensured;
}

async function run(db: Db): Promise<void> {
  await Promise.all([
    // ── Identity ──
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    // Clerk is the identity provider; clerkId is how a session resolves to a
    // row. Sparse because rows created before the migration have no clerkId
    // until their owner next signs in.
    db.collection("users").createIndex(
      { clerkId: 1 },
      { unique: true, sparse: true },
    ),

    // ── Student record ──
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("roadmaps").createIndex({ userId: 1, version: -1 }),
    db.collection("user_memory").createIndex({ userId: 1 }, { unique: true }),
    db.collection("weekly_tasks").createIndex({ userId: 1, weekStart: 1 }),
    db.collection("weekly_tasks").createIndex({ userId: 1, week: 1 }),
    // Idempotency for exam-driven task creation; sparse because only those rows
    // carry the key.
    db.collection("weekly_tasks").createIndex(
      { userId: 1, sourceExamChangeId: 1 },
      { unique: true, sparse: true },
    ),
    db.collection("streaks").createIndex({ userId: 1 }, { unique: true }),

    // ── Sharing / monitoring ──
    db.collection("links").createIndex({ studentId: 1 }),
    db.collection("links").createIndex({ viewerEmail: 1 }),
    db.collection("links").createIndex({ inviteToken: 1 }, { unique: true }),
    db.collection("monitorInvites").createIndex({ token: 1 }, { unique: true }),
    db.collection("monitorInvites").createIndex({ studentId: 1 }),
    db.collection("monitorInvites").createIndex({ viewerId: 1 }),
    db.collection("monitorInvites").createIndex({ email: 1 }),

    // ── Chat / usage ──
    db.collection("llm_usage").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("chat_threads").createIndex({ userId: 1, lastMessageAt: -1 }),
    db.collection("chat_messages").createIndex({ userId: 1, threadId: 1, createdAt: 1 }),

    // ── Billing ──
    db.collection("transactions").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("payment_methods").createIndex({ userId: 1, isDefault: -1 }),
    // SSLCommerz orders. tran_id is the idempotency key for the IPN.
    db.collection("payment_orders").createIndex({ tranId: 1 }, { unique: true }),
    db.collection("payment_orders").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("payment_orders").createIndex({ status: 1, createdAt: -1 }),
    // Gateway callbacks are retried; a processed id must never apply twice.
    db.collection("webhook_events").createIndex({ eventId: 1 }, { unique: true }),
    db.collection("webhook_events").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 90 },
    ),

    // ── Exams ──
    db.collection("exam_items").createIndex({ id: 1, version: 1 }, { unique: true }),
    db.collection("exam_items").createIndex({ exam: 1, section: 1, status: 1, domain: 1, difficulty: 1 }),
    db.collection("exam_items").createIndex({ eligibleStageIds: 1, status: 1, stimulusGroupId: 1 }),
    db.collection("exam_stimuli").createIndex({ id: 1, version: 1 }, { unique: true }),
    db.collection("exam_blueprints").createIndex({ id: 1, version: 1 }, { unique: true }),
    db.collection("exam_sessions").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("exam_sessions").createIndex({ userId: 1, status: 1, expiresAt: 1 }),
    db.collection("exam_review_later").createIndex({ userId: 1 }, { unique: true }),
    db.collection("exam_responses").createIndex({ sessionId: 1, userId: 1, itemId: 1 }, { unique: true }),
    db.collection("exam_results").createIndex({ sessionId: 1, userId: 1 }, { unique: true }),
    db.collection("exam_session_events").createIndex({ sessionId: 1, createdAt: 1 }),
    db.collection("exam_exposures").createIndex({ userId: 1, questionId: 1 }, { unique: true }),
    db.collection("exam_exposures").createIndex({ userId: 1, lastSeenAt: -1 }),

    // ── Passport ──
    // One passport per student; the slug is the public URL segment and must be
    // unique across the platform.
    db.collection("passports").createIndex({ userId: 1 }, { unique: true }),
    db.collection("passports").createIndex({ slug: 1 }, { unique: true }),
    db.collection("passports").createIndex({ published: 1, updatedAt: -1 }),

    // ── Cohort benchmarking ──
    // Aggregations filter on target tier and country, then bucket by metric.
    db.collection("profiles").createIndex({ targetTier: 1, country: 1 }),

    // ── Notifications ──
    db.collection("notification_log").createIndex(
      { userId: 1, deadlineId: 1, channel: 1, dayBucket: 1 },
      { unique: true },
    ),
    db.collection("notification_log").createIndex(
      { createdAt: 1 },
      { expireAfterSeconds: 60 * 60 * 24 * 180 },
    ),
    db.collection("notification_prefs").createIndex({ userId: 1 }, { unique: true }),

    // ── Discovery ──
    db.collection("discovery_notes").createIndex(
      { userId: 1, entityType: 1, entityId: 1 },
      { unique: true },
    ),

    // App-shell + retrieval collections.
    ensureAppIndexes(db),
  ]);
}
