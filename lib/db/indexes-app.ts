/**
 * Index registration for the new collections introduced by the app shell.
 * Imported and invoked by `ensureIndexes()` in lib/db/indexes.ts so these
 * run during the existing first-request index pass.
 *
 * Collections: deadlines, task_audit, strategist_messages, connections.
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
    // Retrieval indexes (lib/rag). kb_chunks is global; user_chunks is always
    // queried with userId first so a scan can never cross accounts.
    db.collection("kb_chunks").createIndex({ chunkId: 1 }, { unique: true }),
    db.collection("kb_chunks").createIndex({ source: 1 }),
    db.collection("user_chunks").createIndex({ userId: 1, chunkId: 1 }, { unique: true }),
    db.collection("user_chunks").createIndex({ userId: 1, updatedAt: -1 }),
    db.collection("kb_documents").createIndex({ slug: 1 }, { unique: true }),
    db.collection("kb_documents").createIndex({ updatedAt: -1 }),
  ]).catch((err) => console.error("[db] ensureAppIndexes failed:", err));
}

