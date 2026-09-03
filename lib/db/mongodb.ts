import { MongoClient } from "mongodb";

let clientPromise: Promise<MongoClient> | undefined;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

/**
 * Lazily create (and cache) the Mongo connection on first use.
 */
function getClientPromise(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.local.example).",
    );
  }

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      global._mongoClientPromise = new MongoClient(uri).connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    clientPromise = new MongoClient(uri).connect();
  }
  return clientPromise;
}

export async function getDb() {
  const client = await getClientPromise();
  const db = client.db("Polaris");
  await ensureIndexes(db);
  return db;
}

/* ─── Indexes ─── */

import type { Db } from "mongodb";

let ensured = false;

async function ensureIndexes(db: Db): Promise<void> {
  if (ensured) return;
  ensured = true;

  await Promise.all([
    db.collection("users").createIndex({ email: 1 }, { unique: true }),
    db.collection("monitorInvites").createIndex({ token: 1 }, { unique: true }),
    db.collection("monitorInvites").createIndex({ studentId: 1 }),
    db.collection("monitorInvites").createIndex({ viewerId: 1 }),
    db.collection("monitorInvites").createIndex({ email: 1 }),
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
    db.collection("discovery_notes").createIndex(
      { userId: 1, entityType: 1, entityId: 1 },
      { unique: true },
    ),
  ]).catch((err) => {
    console.error("[db] ensureIndexes failed:", err);
    ensured = false;
  });
}
