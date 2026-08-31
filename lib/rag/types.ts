export type DocSource =
  | "university"
  | "scholarship"
  | "case-study"
  | "admissions"
  | "cost"
  | "practice"
  | "resource"
  | "document";

export type RagDoc = {
  id: string;
  source: DocSource;
  title: string;
  text: string;
  metadata: Record<string, unknown>;
};

/**
 * A retrievable unit: a document split into one or more overlapping windows.
 * `chunkId` is the primary key of both the lexical and the vector index, so
 * BM25 ranks and cosine ranks can be fused without a join.
 */
export type RagChunk = RagDoc & {
  /** Stable id, `${docId}#${chunkIndex}`. */
  chunkId: string;
  docId: string;
  chunkIndex: number;
  /** Hash of the chunk text - drives incremental re-embedding. */
  hash: string;
};

export type EmbeddedChunk = RagChunk & { embedding: number[] };

/** Legacy alias kept for callers written against the pre-chunk index. */
export type EmbeddedDoc = RagDoc & { vector: number[] };

/* ─── Per-student index ─────────────────────────────────────────────────── */

export type UserChunkKind = "roadmap" | "milestone" | "memory" | "chat";

export type UserChunk = {
  chunkId: string;
  userId: string;
  kind: UserChunkKind;
  title: string;
  text: string;
  hash: string;
  metadata: Record<string, unknown>;
};

export type EmbeddedUserChunk = UserChunk & { embedding: number[] };
