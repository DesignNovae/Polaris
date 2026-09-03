/**
 * Index registration for the app-shell and retrieval collections.
 * Invoked by `ensureIndexes()` in lib/db/indexes.ts, which is in turn awaited
 * by `getDb()`.
 *
 * Errors deliberately propagate: the caller owns the single catch/log/retry so
 * a failure here can't be silently swallowed while the parent reports success.
 */

import type { Db } from "mongodb";

export async function ensureAppIndexes(db: Db): Promise<void> {
  await Promise.all([
    db.collection("deadlines").createIndex({ userId: 1, date: 1 }),
    db.collection("deadlines").createIndex({ userId: 1, milestoneId: 1 }),
    db.collection("task_audit").createIndex({ userId: 1, milestoneId: 1, at: -1 }),
    db.collection("strategist_messages").createIndex({ userId: 1, threadId: 1, createdAt: 1 }),
    db.collection("strategist_messages").createIndex({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 90 }), // 90-day TTL
    db.collection("connections").createIndex({ userId: 1, provider: 1 }, { unique: true }),
    db.collection("integration_tokens").createIndex({ userId: 1, provider: 1 }, { unique: true }),

    // ── Community ──
    db.collection("community_messages").createIndex({ channel: 1, createdAt: -1 }),
    db.collection("community_reports").createIndex({ createdAt: -1 }),
    db.collection("community_blocks").createIndex({ userId: 1, blockedUserId: 1 }, { unique: true }),

    // ── Marketplace ──
    db.collection("consultants").createIndex({ slug: 1 }, { unique: true, sparse: true }),
    db.collection("consultant_bookings").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("consultant_bookings").createIndex({ consultantId: 1, startsAt: 1 }),
    db.collection("consultant_reviews").createIndex({ consultantId: 1, createdAt: -1 }),

    // Retrieval indexes (lib/rag). kb_chunks is global; user_chunks is always
    // queried with userId first so a scan can never cross accounts.
    db.collection("kb_chunks").createIndex({ chunkId: 1 }, { unique: true }),
    db.collection("kb_chunks").createIndex({ source: 1 }),
    db.collection("user_chunks").createIndex({ userId: 1, chunkId: 1 }, { unique: true }),
    db.collection("user_chunks").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("kb_documents").createIndex({ slug: 1 }, { unique: true }),
    db.collection("kb_documents").createIndex({ updatedAt: -1 }),
  ]);
}
