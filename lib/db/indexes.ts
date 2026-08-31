import type { Db } from "mongodb";
import { ensureAppIndexes } from "./indexes-app";

/**
 * Idempotent index creation. Runs once per process (guarded by a global flag).
 * createIndex is a no-op if the index already exists, so this is safe to call
 * on every cold start.
 */

let ensured = false;

export async function ensureIndexes(db: Db): Promise<void> {
  if (ensured) return;
  ensured = true;

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("profiles").createIndex({ userId: 1 }, { unique: true }),
    db.collection("roadmaps").createIndex({ userId: 1, version: -1 }),
    db.collection("links").createIndex({ studentId: 1 }),
    db.collection("links").createIndex({ viewerEmail: 1 }),
    db.collection("links").createIndex({ inviteToken: 1 }, { unique: true }),
    db.collection("user_memory").createIndex({ userId: 1 }, { unique: true }),
    db.collection("llm_usage").createIndex({ userId: 1, createdAt: -1 }),
    db.collection("chat_threads").createIndex({ userId: 1, lastMessageAt: -1 }),
    db.collection("chat_messages").createIndex({ userId: 1, threadId: 1, createdAt: 1 }),
    db.collection("transactions").createIndex({ userId: 1, createdAt: -1 }),
    // New app-shell collections (deadlines, task_audit, strategist_messages, connections).
    ensureAppIndexes(db),
  ]).catch((err) => {
    // Don't crash the app if index creation races; log and continue.
    console.error("[db] ensureIndexes failed:", err);
    ensured = false;
  });
}

