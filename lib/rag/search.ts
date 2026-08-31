/**
 * Hybrid retrieval: BM25 + dense vectors, fused with Reciprocal Rank Fusion.
 *
 * Why both. BM25 nails the queries that name a thing ("Chevening eligibility",
 * "BUET admission test") and is fully deterministic. Vectors catch the ones
 * that describe it instead ("how do I study abroad if my family can't pay") -
 * exactly the questions a chat agent gets and a keyword index misses. RRF
 * merges the two rank lists without needing calibrated scores on either side,
 * so a missing vector index degrades to plain BM25 instead of breaking.
 *
 * Everything here is non-generative. Gemma 4 remains the only model that
 * writes an answer.
 */

import { buildKbChunks } from "./flatten";
import { embedQueries, similarity } from "./embed";
import { loadKbVectors, loadUserVectors } from "./store";
import { ragCacheVersion, RAG_CACHE_TTL_MS } from "./cache";
import type { EmbeddedUserChunk, RagChunk, RagDoc, UserChunkKind } from "./types";

/* ─── Tokenizer + BM25 index ────────────────────────────────────────────── */

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (token) => token.length > 1,
  );
}

type Indexable = { chunkId: string; title: string; text: string };

type LexicalIndex<T extends Indexable> = {
  rows: T[];
  frequencies: Array<Map<string, number>>;
  titleTerms: Array<Set<string>>;
  lengths: number[];
  averageLength: number;
  /** Document frequency for every term in the corpus, computed once. */
  documentFrequency: Map<string, number>;
};

function buildLexicalIndex<T extends Indexable>(rows: T[]): LexicalIndex<T> {
  const frequencies: Array<Map<string, number>> = [];
  const titleTerms: Array<Set<string>> = [];
  const lengths: number[] = [];
  const documentFrequency = new Map<string, number>();

  for (const row of rows) {
    const titleTokens = tokenize(row.title);
    const tokens = [...titleTokens, ...tokenize(row.text)];
    const counts = new Map<string, number>();
    for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    frequencies.push(counts);
    titleTerms.push(new Set(titleTokens));
    lengths.push(tokens.length);
  }

  const total = lengths.reduce((sum, value) => sum + value, 0);
  return {
    rows,
    frequencies,
    titleTerms,
    lengths,
    averageLength: total / Math.max(rows.length, 1),
    documentFrequency,
  };
}

const K1 = 1.5;
const B = 0.75;
/** Title hits are a strong signal in a corpus of named entities. */
const TITLE_BOOST = 0.75;

function bm25<T extends Indexable>(
  index: LexicalIndex<T>,
  query: string,
  topK: number,
): Array<{ chunkId: string; score: number }> {
  const terms = [...new Set(tokenize(query))];
  if (terms.length === 0) return [];
  const total = index.rows.length;
  const scored: Array<{ chunkId: string; score: number }> = [];

  for (let i = 0; i < total; i++) {
    const counts = index.frequencies[i];
    let score = 0;
    for (const term of terms) {
      const tf = counts.get(term) ?? 0;
      if (tf === 0) continue;
      const df = index.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      const norm =
        tf + K1 * (1 - B + B * (index.lengths[i] / Math.max(index.averageLength, 1)));
      score += idf * ((tf * (K1 + 1)) / norm);
      if (index.titleTerms[i].has(term)) score += idf * TITLE_BOOST;
    }
    if (score > 0) scored.push({ chunkId: index.rows[i].chunkId, score });
  }

  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, topK);
}

/* ─── Cached indexes ────────────────────────────────────────────────────── */

let kbLexical: { at: number; version: number; index: LexicalIndex<RagChunk> } | null = null;

async function kbLexicalIndex(): Promise<LexicalIndex<RagChunk>> {
  const version = ragCacheVersion();
  if (
    kbLexical &&
    kbLexical.version === version &&
    Date.now() - kbLexical.at < RAG_CACHE_TTL_MS
  ) {
    return kbLexical.index;
  }
  const index = buildLexicalIndex(await buildKbChunks());
  kbLexical = { at: Date.now(), version, index };
  return index;
}

/** Memoized on the cached row array itself - rebuilt only when the store is. */
const userLexical = new WeakMap<object, LexicalIndex<EmbeddedUserChunk>>();

function userLexicalIndex(rows: EmbeddedUserChunk[]): LexicalIndex<EmbeddedUserChunk> {
  const cached = userLexical.get(rows);
  if (cached) return cached;
  const index = buildLexicalIndex(rows);
  userLexical.set(rows, index);
  return index;
}

/* ─── Reciprocal Rank Fusion ────────────────────────────────────────────── */

/**
 * RRF constant. 60 is the value from the original Cormack et al. paper; it
 * flattens the contribution of deep ranks, which is what we want here -
 * agreement between the lexical and dense lists should count for more than
 * either list's absolute score.
 */
const RRF_K = 60;

/**
 * Relative weight of a dense rank list against a lexical one. Measured, not
 * guessed: on the golden set plain RRF put a weak keyword match at rank 1 on
 * several semantic queries, which cost R@1 against vector-only. Weighting the
 * dense list keeps the fused top slot while retaining BM25's exact-name
 * recall deeper in the list. Tune with RAG_VECTOR_WEIGHT and re-run the eval.
 */
const VECTOR_WEIGHT = Number(process.env.RAG_VECTOR_WEIGHT || 1.6);

type RankList = { hits: Array<{ chunkId: string; score: number }>; weight: number };

function fuse(lists: RankList[]): Map<string, number> {
  const fused = new Map<string, number>();
  for (const { hits, weight } of lists) {
    hits.forEach((hit, rank) => {
      fused.set(
        hit.chunkId,
        (fused.get(hit.chunkId) ?? 0) + weight / (RRF_K + rank + 1),
      );
    });
  }
  return fused;
}

/** Keeps a hit only if it scored within this fraction of the best hit. */
const MIN_RELATIVE_SCORE = 0.35;
/** At most this many chunks from any one source document. */
const MAX_CHUNKS_PER_DOC = 2;

function applyFloor<T extends { score: number }>(hits: T[]): T[] {
  if (hits.length === 0) return hits;
  const best = hits[0].score;
  if (best <= 0) return [];
  return hits.filter((hit) => hit.score >= best * MIN_RELATIVE_SCORE);
}

/* ─── Public API ────────────────────────────────────────────────────────── */

export type SearchHit = {
  /** Chunk id - equal to the document id for single-chunk documents. */
  id: string;
  docId: string;
  title: string;
  source: RagDoc["source"];
  score: number;
  text: string;
  metadata: Record<string, unknown>;
  /** Which retrievers surfaced this hit - surfaced in the eval report. */
  matchedBy: Array<"lexical" | "vector">;
  /**
   * Best raw cosine similarity for this chunk across the query set, or null
   * when no vector index was consulted. Unlike the fused score this is
   * absolutely calibrated, so it is the only number here that can answer
   * "is anything we found actually relevant?".
   */
  similarity: number | null;
};

function toQueryList(query: string | string[]): string[] {
  const list = (Array.isArray(query) ? query : [query])
    .map((q) => q.trim())
    .filter((q) => q.length > 1);
  return [...new Set(list)].slice(0, 4);
}

/**
 * Hybrid search over the shared KB. Accepts several queries (the rewriter
 * emits sub-queries) and fuses every resulting rank list in one pass.
 */
export async function hybridSearch(
  query: string | string[],
  topK = 6,
  options: { signal?: AbortSignal } = {},
): Promise<SearchHit[]> {
  const queries = toQueryList(query);
  if (queries.length === 0) return [];

  // Retrieve deeper than we return, so fusion has something to agree on.
  const depth = Math.max(topK * 3, 12);
  const index = await kbLexicalIndex();
  const lexicalLists = queries.map((q) => bm25(index, q, depth));

  const [vectors, rows] = await Promise.all([
    embedQueries(queries, options.signal),
    loadKbVectors(),
  ]);

  const vectorLists: Array<Array<{ chunkId: string; score: number }>> = [];
  // Best cosine per chunk across the whole query set, kept so callers can see
  // a calibrated relevance number rather than only the fused rank score.
  const bestSimilarity = new Map<string, number>();
  if (vectors && rows.length > 0) {
    for (const vector of vectors) {
      const scored = rows
        .map((row) => ({
          chunkId: row.chunkId,
          score: similarity(vector, row.embedding),
        }))
        .sort((left, right) => right.score - left.score);
      for (const hit of scored) {
        const previous = bestSimilarity.get(hit.chunkId);
        if (previous === undefined || hit.score > previous) {
          bestSimilarity.set(hit.chunkId, hit.score);
        }
      }
      vectorLists.push(scored.slice(0, depth));
    }
  }

  const lexicalIds = new Set(lexicalLists.flat().map((hit) => hit.chunkId));
  const vectorIds = new Set(vectorLists.flat().map((hit) => hit.chunkId));
  const fused = fuse([
    ...lexicalLists.map((hits) => ({ hits, weight: 1 })),
    ...vectorLists.map((hits) => ({ hits, weight: VECTOR_WEIGHT })),
  ]);
  if (fused.size === 0) return [];

  const byChunkId = new Map(index.rows.map((row) => [row.chunkId, row]));
  const ranked = [...fused.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((left, right) => right.score - left.score);

  const out: SearchHit[] = [];
  const perDoc = new Map<string, number>();
  for (const { chunkId, score } of applyFloor(ranked)) {
    const chunk = byChunkId.get(chunkId);
    if (!chunk) continue; // Stale vector row - the source doc has changed since.
    const seen = perDoc.get(chunk.docId) ?? 0;
    if (seen >= MAX_CHUNKS_PER_DOC) continue;
    perDoc.set(chunk.docId, seen + 1);
    const matchedBy: Array<"lexical" | "vector"> = [];
    if (lexicalIds.has(chunkId)) matchedBy.push("lexical");
    if (vectorIds.has(chunkId)) matchedBy.push("vector");
    out.push({
      id: chunk.chunkId,
      docId: chunk.docId,
      title: chunk.title,
      source: chunk.source,
      score,
      text: chunk.text,
      metadata: chunk.metadata,
      matchedBy,
      similarity: bestSimilarity.get(chunkId) ?? null,
    });
    if (out.length >= topK) break;
  }
  return out;
}

/**
 * Backwards-compatible entry point. The second parameter used to carry a
 * precomputed query vector; the pipeline embeds its own queries now, so it is
 * ignored and kept only so existing callers keep type-checking.
 */
export async function searchDocs(
  queryText: string,
  _queryVector: number[] | null = null,
  topK = 6,
): Promise<SearchHit[]> {
  return hybridSearch(queryText, topK);
}

export type KbHit = {
  id: string;
  title: string;
  snippet: string;
  source: RagDoc["source"];
  score: number;
  /** Calibrated cosine similarity - null when retrieval was lexical-only. */
  similarity: number | null;
};

/** Word-safe truncation - never cuts a cited snippet mid-word. */
function snippet(text: string, max = 320): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const boundary = cut.lastIndexOf(" ");
  return `${cut.slice(0, boundary > max * 0.6 ? boundary : max)}...`;
}

/** Compact evidence search used by the Strategist. */
export async function searchKb(
  query: string | string[],
  topK = 6,
): Promise<KbHit[]> {
  const hits = await hybridSearch(query, topK);
  return hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    snippet: snippet(hit.text),
    source: hit.source,
    score: hit.score,
    similarity: hit.similarity,
  }));
}

/* ─── Per-student retrieval ─────────────────────────────────────────────── */

export type UserHit = {
  id: string;
  kind: UserChunkKind;
  title: string;
  snippet: string;
  score: number;
};

/**
 * Searches one student's own material: roadmap nodes, milestones, saved
 * memories and past conversation. `userId` is applied in the store query and
 * re-checked on every row, so a search can only ever see that user's rows.
 */
export async function searchUserDocs(
  userId: string,
  query: string | string[],
  topK = 4,
  options: { signal?: AbortSignal } = {},
): Promise<UserHit[]> {
  if (!userId) return [];
  const queries = toQueryList(query);
  if (queries.length === 0) return [];

  const rows = await loadUserVectors(userId);
  if (rows.length === 0) return [];

  const depth = Math.max(topK * 3, 10);
  const index = userLexicalIndex(rows);
  const lexicalLists = queries.map((q) => bm25(index, q, depth));

  const vectors = await embedQueries(queries, options.signal);
  const vectorLists: Array<Array<{ chunkId: string; score: number }>> = [];
  if (vectors) {
    for (const vector of vectors) {
      vectorLists.push(
        rows
          .map((row) => ({
            chunkId: row.chunkId,
            score: similarity(vector, row.embedding),
          }))
          .sort((left, right) => right.score - left.score)
          .slice(0, depth),
      );
    }
  }

  const fused = fuse([
    ...lexicalLists.map((hits) => ({ hits, weight: 1 })),
    ...vectorLists.map((hits) => ({ hits, weight: VECTOR_WEIGHT })),
  ]);
  const byChunkId = new Map(rows.map((row) => [row.chunkId, row]));
  const ranked = [...fused.entries()]
    .map(([chunkId, score]) => ({ chunkId, score }))
    .sort((left, right) => right.score - left.score);

  const out: UserHit[] = [];
  for (const { chunkId, score } of applyFloor(ranked)) {
    const row = byChunkId.get(chunkId);
    if (!row || row.userId !== userId) continue;
    out.push({
      id: row.chunkId,
      kind: row.kind,
      title: row.title,
      snippet: snippet(row.text, 260),
      score,
    });
    if (out.length >= topK) break;
  }
  return out;
}

/* ─── Single-retriever variants (eval harness only) ─────────────────────── */

export async function lexicalOnlySearch(query: string, topK = 6): Promise<SearchHit[]> {
  const index = await kbLexicalIndex();
  const byChunkId = new Map(index.rows.map((row) => [row.chunkId, row]));
  return bm25(index, query, topK).flatMap(({ chunkId, score }) => {
    const chunk = byChunkId.get(chunkId);
    if (!chunk) return [];
    return [{
      id: chunk.chunkId,
      docId: chunk.docId,
      title: chunk.title,
      source: chunk.source,
      score,
      text: chunk.text,
      metadata: chunk.metadata,
      matchedBy: ["lexical" as const],
      similarity: null,
    }];
  });
}

export async function vectorOnlySearch(query: string, topK = 6): Promise<SearchHit[]> {
  const [vectors, rows] = await Promise.all([embedQueries([query]), loadKbVectors()]);
  if (!vectors?.length || rows.length === 0) return [];
  return rows
    .map((row) => ({ row, score: similarity(vectors[0], row.embedding) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, topK)
    .map(({ row, score }) => ({
      id: row.chunkId,
      docId: row.docId,
      title: row.title,
      source: row.source,
      score,
      text: row.text,
      metadata: row.metadata,
      matchedBy: ["vector" as const],
      similarity: score,
    }));
}
