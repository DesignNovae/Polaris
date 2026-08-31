/**
 * Ingestion: source content -> chunks -> vectors -> Mongo.
 *
 * Incremental by content hash. A re-index costs one embedding call per chunk
 * that actually changed, so it is cheap to run on every admin content edit and
 * after every Strategist turn.
 *
 * Two scopes:
 *   • KB    - shared, rebuilt from the content collections (admin-triggered)
 *   • user  - one student's roadmap, milestones, memories and conversation,
 *             refreshed in the background after each turn
 */

import { getDb } from "@/lib/db/mongodb";
import {
  getLatestRoadmap,
  getRoadmapV2,
  getUserMemory,
  type DbChatMessage,
} from "@/lib/db/collections";
import { hashText, splitText } from "./chunk";
import { buildKbChunks } from "./flatten";
import { embedDocuments, isEmbeddingEnabled } from "./embed";
import {
  pruneKbChunks,
  pruneUserChunks,
  storedKbHashes,
  storedUserHashes,
  upsertKbChunks,
  upsertUserChunks,
  USER_CHUNK_LIMIT,
} from "./store";
import { invalidateRagCaches } from "./cache";
import type { EmbeddedChunk, EmbeddedUserChunk, UserChunk } from "./types";

export type IngestReport = {
  scope: "kb" | "user";
  /** Chunks the source currently produces. */
  chunks: number;
  /** Chunks whose hash changed (or that are new) - the ones we embedded. */
  embedded: number;
  /** Chunks left untouched because their hash matched. */
  skipped: number;
  upserted: number;
  pruned: number;
  embeddingsEnabled: boolean;
  ms: number;
  error?: string;
};

/* ─── Shared knowledge base ─────────────────────────────────────────────── */

export async function ingestKb(
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<IngestReport> {
  const startedAt = Date.now();
  const base: IngestReport = {
    scope: "kb",
    chunks: 0,
    embedded: 0,
    skipped: 0,
    upserted: 0,
    pruned: 0,
    embeddingsEnabled: isEmbeddingEnabled(),
    ms: 0,
  };

  // Always re-read the source, even when embeddings are off - the lexical
  // index is rebuilt from the same call and benefits from the refresh.
  invalidateRagCaches();
  const chunks = await buildKbChunks();
  base.chunks = chunks.length;

  if (!base.embeddingsEnabled) {
    return { ...base, ms: Date.now() - startedAt, error: "Embeddings are not configured" };
  }

  try {
    const stored = options.force ? new Map<string, string>() : await storedKbHashes();
    const stale = chunks.filter((chunk) => stored.get(chunk.chunkId) !== chunk.hash);
    base.skipped = chunks.length - stale.length;

    if (stale.length > 0) {
      const vectors = await embedDocuments(
        stale.map((chunk) => `${chunk.title}\n${chunk.text}`),
        options.signal,
      );
      if (!vectors) throw new Error("Embedding call returned nothing");
      const embedded: EmbeddedChunk[] = stale.map((chunk, i) => ({
        ...chunk,
        embedding: vectors[i],
      }));
      base.embedded = embedded.length;
      base.upserted = await upsertKbChunks(embedded);
    }

    base.pruned = await pruneKbChunks(chunks.map((chunk) => chunk.chunkId));
    invalidateRagCaches();
    return { ...base, ms: Date.now() - startedAt };
  } catch (err) {
    return { ...base, ms: Date.now() - startedAt, error: (err as Error).message };
  }
}

/* ─── Per-student index ─────────────────────────────────────────────────── */

/** How many recent chat messages stay in the rolling conversation window. */
const CHAT_WINDOW = 40;
/** Assistant answers are long; the opening is where the decision lives. */
const CHAT_TEXT_CAP = 1200;
const MIN_CHAT_CHARS = 40;

function userChunksFrom(
  userId: string,
  kind: UserChunk["kind"],
  idPrefix: string,
  sourceId: string,
  title: string,
  text: string,
  metadata: Record<string, unknown> = {},
): UserChunk[] {
  return splitText(text).map((window, index) => ({
    userId,
    kind,
    chunkId: index === 0 ? `${idPrefix}:${sourceId}` : `${idPrefix}:${sourceId}#${index}`,
    title,
    text: window,
    hash: hashText(window),
    metadata,
  }));
}

async function recentChatMessages(userId: string): Promise<DbChatMessage[]> {
  const db = await getDb();
  return db
    .collection<DbChatMessage>("chat_messages")
    .find({ userId })
    .sort({ createdAt: -1 })
    .limit(CHAT_WINDOW)
    .toArray();
}

/**
 * Builds every chunk that represents this student. Cheap and side-effect free
 * so the caller can hash-diff it against what is already indexed.
 */
export async function buildUserChunks(userId: string): Promise<UserChunk[]> {
  const [roadmapV2, legacy, memory, messages] = await Promise.all([
    getRoadmapV2(userId).catch(() => null),
    getLatestRoadmap(userId).catch(() => null),
    getUserMemory(userId).catch(() => null),
    recentChatMessages(userId).catch(() => [] as DbChatMessage[]),
  ]);

  const chunks: UserChunk[] = [];

  for (const branch of roadmapV2?.branches ?? []) {
    for (const node of branch.nodes) {
      chunks.push(
        ...userChunksFrom(
          userId,
          "roadmap",
          "rm",
          node.id,
          `${branch.title} - ${node.title}`,
          [
            `Roadmap node "${node.title}" in the ${branch.category} branch.`,
            `Status: ${node.status}, ${node.progress}% complete, priority ${node.priority}, about ${node.estimatedHoursPerWeek}h per week.`,
            `What: ${node.description}`,
            `Why it matters: ${node.why}`,
            `How: ${node.how}`,
            `Done when: ${node.completionCriteria}`,
            node.topics?.length ? `Topics: ${node.topics.join(", ")}.` : "",
          ]
            .filter(Boolean)
            .join(" "),
          { nodeId: node.id, branch: branch.category, status: node.status },
        ),
      );
    }
  }

  for (const milestone of legacy?.roadmap.milestones ?? []) {
    chunks.push(
      ...userChunksFrom(
        userId,
        "milestone",
        "ms",
        milestone.id,
        milestone.title,
        [
          `Milestone "${milestone.title}" (${milestone.status}, priority ${milestone.priority}).`,
          milestone.description ? `Detail: ${milestone.description}` : "",
          milestone.metric ? `Success metric: ${milestone.metric}` : "",
          milestone.rationale ? `Rationale: ${milestone.rationale}` : "",
        ]
          .filter(Boolean)
          .join(" "),
        { milestoneId: milestone.id, status: milestone.status },
      ),
    );
  }

  for (const fact of memory?.facts ?? []) {
    chunks.push(
      ...userChunksFrom(
        userId,
        "memory",
        "mem",
        fact.id,
        `Remembered: ${fact.category}`,
        `${fact.text} (category ${fact.category}, ${fact.source}, confidence ${fact.confidence}).`,
        { factId: fact.id, category: fact.category },
      ),
    );
  }

  for (const message of messages) {
    const id = message._id?.toString();
    const text = message.text?.trim() ?? "";
    if (!id || text.length < MIN_CHAT_CHARS) continue;
    const when = message.createdAt?.toISOString().slice(0, 10) ?? "";
    chunks.push(
      ...userChunksFrom(
        userId,
        "chat",
        "chat",
        id,
        message.role === "user" ? `You asked (${when})` : `Polaris answered (${when})`,
        `${message.role === "user" ? "Student asked" : "Polaris replied"} on ${when}: ${text.slice(0, CHAT_TEXT_CAP)}`,
        { threadId: message.threadId, role: message.role },
      ),
    );
  }

  return chunks.slice(0, USER_CHUNK_LIMIT);
}

/**
 * Refreshes one student's index. Runs after a turn rather than before it, so
 * retrieval latency never includes an embedding pass over the whole profile -
 * the first turn of a brand-new account retrieves nothing, the second onward
 * has a warm index.
 */
export async function ingestUserDocs(
  userId: string,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<IngestReport> {
  const startedAt = Date.now();
  const base: IngestReport = {
    scope: "user",
    chunks: 0,
    embedded: 0,
    skipped: 0,
    upserted: 0,
    pruned: 0,
    embeddingsEnabled: isEmbeddingEnabled(),
    ms: 0,
  };
  if (!userId) return { ...base, ms: 0, error: "Missing userId" };
  if (!base.embeddingsEnabled) {
    return { ...base, ms: Date.now() - startedAt, error: "Embeddings are not configured" };
  }

  try {
    const chunks = await buildUserChunks(userId);
    base.chunks = chunks.length;

    const stored = options.force ? new Map<string, string>() : await storedUserHashes(userId);
    const stale = chunks.filter((chunk) => stored.get(chunk.chunkId) !== chunk.hash);
    base.skipped = chunks.length - stale.length;

    if (stale.length > 0) {
      const vectors = await embedDocuments(
        stale.map((chunk) => `${chunk.title}\n${chunk.text}`),
        options.signal,
      );
      if (!vectors) throw new Error("Embedding call returned nothing");
      const embedded: EmbeddedUserChunk[] = stale.map((chunk, i) => ({
        ...chunk,
        embedding: vectors[i],
      }));
      base.embedded = embedded.length;
      base.upserted = await upsertUserChunks(userId, embedded);
    }

    // The chat window rolls: anything outside the most recent messages is
    // dropped here. Durable facts survive in long-term memory, not in this index.
    base.pruned = await pruneUserChunks(userId, chunks.map((chunk) => chunk.chunkId));
    return { ...base, ms: Date.now() - startedAt };
  } catch (err) {
    return { ...base, ms: Date.now() - startedAt, error: (err as Error).message };
  }
}
