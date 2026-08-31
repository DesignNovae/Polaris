/**
 * Vector persistence for the retrieval layer.
 *
 * Two collections:
 *   • kb_chunks   - the shared knowledge base, one row per chunk
 *   • user_chunks - per-student memory, roadmap and conversation history,
 *                   always scoped by userId at query time
 *
 * Scoring is brute-force cosine in Node rather than an Atlas vector index.
 * At this corpus size (hundreds of chunks) a full scan is ~1ms and it keeps
 * the feature independent of cluster tier; swapping in $vectorSearch later
 * only changes `loadKbVectors` / `loadUserVectors`.
 */

import type { AnyBulkWriteOperation } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { EMBED_DIM, EMBED_MODEL } from "./embed";
import { ragCacheVersion, RAG_CACHE_TTL_MS } from "./cache";
import type { EmbeddedChunk, EmbeddedUserChunk } from "./types";

const KB = "kb_chunks";
const USER = "user_chunks";

/** Hard ceiling on a single student's index, newest first. */
export const USER_CHUNK_LIMIT = 600;

type Stored = { dim: number; model: string; updatedAt: Date };
type KbRow = EmbeddedChunk & Stored;
type UserRow = EmbeddedUserChunk & Stored;

/* ─── Shared KB ─────────────────────────────────────────────────────────── */

/** chunkId -> hash, for deciding what actually needs re-embedding. */
export async function storedKbHashes(): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db
    .collection<KbRow>(KB)
    .find({ dim: EMBED_DIM, model: EMBED_MODEL }, { projection: { chunkId: 1, hash: 1 } })
    .toArray();
  return new Map(rows.map((row) => [row.chunkId, row.hash]));
}

export async function upsertKbChunks(chunks: EmbeddedChunk[]): Promise<number> {
  if (chunks.length === 0) return 0;
  const db = await getDb();
  const now = new Date();
  const ops: AnyBulkWriteOperation<KbRow>[] = chunks.map((chunk) => ({
    updateOne: {
      filter: { chunkId: chunk.chunkId },
      update: { $set: { ...chunk, dim: EMBED_DIM, model: EMBED_MODEL, updatedAt: now } },
      upsert: true,
    },
  }));
  const result = await db.collection<KbRow>(KB).bulkWrite(ops, { ordered: false });
  return result.upsertedCount + result.modifiedCount;
}

/** Drops rows whose source document no longer exists (or was re-chunked). */
export async function pruneKbChunks(validChunkIds: string[]): Promise<number> {
  const db = await getDb();
  const result = await db
    .collection<KbRow>(KB)
    .deleteMany({ chunkId: { $nin: validChunkIds } });
  return result.deletedCount ?? 0;
}

let kbCache: { at: number; version: number; rows: EmbeddedChunk[] } | null = null;

export async function loadKbVectors(): Promise<EmbeddedChunk[]> {
  const version = ragCacheVersion();
  if (kbCache && kbCache.version === version && Date.now() - kbCache.at < RAG_CACHE_TTL_MS) {
    return kbCache.rows;
  }
  try {
    const db = await getDb();
    const rows = await db
      .collection<KbRow>(KB)
      .find({ dim: EMBED_DIM, model: EMBED_MODEL }, { projection: { _id: 0 } })
      .toArray();
    const clean = rows.filter((row) => row.embedding?.length === EMBED_DIM);
    kbCache = { at: Date.now(), version, rows: clean };
    return clean;
  } catch (err) {
    console.error("[rag] vector index unavailable:", (err as Error).message);
    // Negative-cache the failure: without this every search would retry the
    // connection, turning a database outage into per-query latency.
    kbCache = { at: Date.now(), version, rows: [] };
    return [];
  }
}

export async function kbIndexStats() {
  try {
    const db = await getDb();
    const collection = db.collection<KbRow>(KB);
    const [total, current, newest] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ dim: EMBED_DIM, model: EMBED_MODEL }),
      collection.find({}).sort({ updatedAt: -1 }).limit(1).toArray(),
    ]);
    const bySource = await collection
      .aggregate<{ _id: string; count: number }>([
        { $group: { _id: "$source", count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ])
      .toArray();
    return {
      total,
      usable: current,
      model: EMBED_MODEL,
      dim: EMBED_DIM,
      lastIndexedAt: newest[0]?.updatedAt ?? null,
      bySource: Object.fromEntries(bySource.map((row) => [row._id, row.count])),
    };
  } catch (err) {
    return { total: 0, usable: 0, model: EMBED_MODEL, dim: EMBED_DIM, lastIndexedAt: null, bySource: {}, error: (err as Error).message };
  }
}

/* ─── Per-student index ─────────────────────────────────────────────────── */

export async function storedUserHashes(userId: string): Promise<Map<string, string>> {
  const db = await getDb();
  const rows = await db
    .collection<UserRow>(USER)
    .find({ userId, dim: EMBED_DIM, model: EMBED_MODEL }, { projection: { chunkId: 1, hash: 1 } })
    .toArray();
  return new Map(rows.map((row) => [row.chunkId, row.hash]));
}

export async function upsertUserChunks(
  userId: string,
  chunks: EmbeddedUserChunk[],
): Promise<number> {
  if (chunks.length === 0) return 0;
  const db = await getDb();
  const now = new Date();
  const ops: AnyBulkWriteOperation<UserRow>[] = chunks.map((chunk) => ({
    updateOne: {
      // userId is part of the filter so a forged chunkId can never write
      // into another student's index.
      filter: { userId, chunkId: chunk.chunkId },
      update: {
        $set: { ...chunk, userId, dim: EMBED_DIM, model: EMBED_MODEL, updatedAt: now },
      },
      upsert: true,
    },
  }));
  const result = await db.collection<UserRow>(USER).bulkWrite(ops, { ordered: false });
  userCache.delete(userId);
  return result.upsertedCount + result.modifiedCount;
}

export async function pruneUserChunks(
  userId: string,
  validChunkIds: string[],
): Promise<number> {
  const db = await getDb();
  const result = await db
    .collection<UserRow>(USER)
    .deleteMany({ userId, chunkId: { $nin: validChunkIds } });
  userCache.delete(userId);
  return result.deletedCount ?? 0;
}

const userCache = new Map<string, { at: number; rows: EmbeddedUserChunk[] }>();
const USER_CACHE_TTL_MS = 60 * 1000;

export async function loadUserVectors(userId: string): Promise<EmbeddedUserChunk[]> {
  const hit = userCache.get(userId);
  if (hit && Date.now() - hit.at < USER_CACHE_TTL_MS) return hit.rows;
  try {
    const db = await getDb();
    const rows = await db
      .collection<UserRow>(USER)
      .find({ userId, dim: EMBED_DIM, model: EMBED_MODEL }, { projection: { _id: 0 } })
      .sort({ updatedAt: -1 })
      .limit(USER_CHUNK_LIMIT)
      .toArray();
    const clean = rows.filter(
      (row) => row.userId === userId && row.embedding?.length === EMBED_DIM,
    );
    // Bounded: one entry per active user, cleared on write.
    if (userCache.size > 200) userCache.clear();
    userCache.set(userId, { at: Date.now(), rows: clean });
    return clean;
  } catch (err) {
    console.error("[rag] user index unavailable:", (err as Error).message);
    return [];
  }
}
