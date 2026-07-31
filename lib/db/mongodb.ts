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
  ]).catch((err) => {
    console.error("[db] ensureIndexes failed:", err);
    ensured = false;
  });
}
