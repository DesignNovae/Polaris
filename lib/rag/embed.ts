/**
 * Embedding layer for retrieval.
 *
 * Competition boundary: an embedding model is a non-generative retrieval
 * technique - the same category as the BM25 scorer next door. It ranks
 * evidence; it never writes a word of the answer. Gemma 4 remains the only
 * model that produces language in Polaris.
 *
 * Vectors are L2-normalized on the way in, so cosine similarity is a plain
 * dot product at query time.
 */

import { gemmaClient, hasGemmaKey } from "@/lib/llm/gemma";

export const EMBED_MODEL = process.env.RAG_EMBED_MODEL || "gemini-embedding-001";

/**
 * Truncated dimensionality. 768 keeps a chunk document ~3KB instead of ~12KB
 * at full width, which matters because the whole index is loaded into memory
 * for brute-force scoring. Google truncates from the end, so the vector must
 * be re-normalized afterwards (we always do).
 */
export const EMBED_DIM = Number(process.env.RAG_EMBED_DIM || 768);

/** Batch size per embedContent call. */
const BATCH = 32;

/** Retrieval asymmetry: documents and queries are embedded with different
 *  task types, which measurably improves recall on short questions. */
type TaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export function isEmbeddingEnabled(): boolean {
  return process.env.RAG_EMBEDDINGS !== "off" && hasGemmaKey();
}

export function normalize(vector: number[]): number[] {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const magnitude = Math.sqrt(sum);
  if (!magnitude || !Number.isFinite(magnitude)) return vector;
  return vector.map((value) => value / magnitude);
}

/** Dot product of two normalized vectors == cosine similarity. */
export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  return (
    e?.status === 429 ||
    e?.status === 503 ||
    /quota|rate.?limit|unavailable|overloaded|\b(429|503)\b/i.test(e?.message ?? "")
  );
}

async function embedBatch(
  texts: string[],
  taskType: TaskType,
  signal?: AbortSignal,
): Promise<number[][]> {
  const client = gemmaClient();
  if (!client) throw new Error("Embeddings are not configured");

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.models.embedContent({
        model: EMBED_MODEL,
        contents: texts,
        config: {
          taskType,
          outputDimensionality: EMBED_DIM,
          ...(signal ? { abortSignal: signal } : {}),
        },
      });
      const rows = response.embeddings ?? [];
      if (rows.length !== texts.length) {
        throw new Error(
          `Embedding count mismatch: got ${rows.length} for ${texts.length} inputs`,
        );
      }
      return rows.map((row) => normalize(row.values ?? []));
    } catch (err) {
      if (attempt === 0 && isRetryable(err)) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        continue;
      }
      throw err;
    }
  }
  throw new Error("Embedding failed");
}

/**
 * Embeds documents for indexing. Returns null when embeddings are disabled or
 * unavailable, which every caller treats as "fall back to lexical only".
 */
export async function embedDocuments(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][] | null> {
  if (!isEmbeddingEnabled() || texts.length === 0) return null;
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const slice = texts.slice(i, i + BATCH);
    out.push(...(await embedBatch(slice, "RETRIEVAL_DOCUMENT", signal)));
  }
  return out;
}

/** Embeds a single query. Never throws - retrieval degrades to BM25 instead. */
export async function embedQuery(
  text: string,
  signal?: AbortSignal,
): Promise<number[] | null> {
  const vectors = await embedQueries([text], signal);
  return vectors?.[0] ?? null;
}

/**
 * Bounded cache of query vectors. Students ask the same things ("MIT
 * deadline"), a multi-query plan repeats the raw message across sub-queries,
 * and the eval harness runs each query through several retrievers - all of
 * which would otherwise pay for the same embedding more than once.
 */
const queryCache = new Map<string, number[]>();
const QUERY_CACHE_MAX = 500;

function cacheQuery(text: string, vector: number[]): void {
  if (queryCache.size >= QUERY_CACHE_MAX) {
    // Cheap FIFO eviction - insertion order is iteration order.
    const oldest = queryCache.keys().next().value;
    if (oldest !== undefined) queryCache.delete(oldest);
  }
  queryCache.set(text, vector);
}

/** Batch variant of `embedQuery` for multi-query retrieval. */
export async function embedQueries(
  texts: string[],
  signal?: AbortSignal,
): Promise<number[][] | null> {
  const clean = texts.map((text) => text.trim()).filter(Boolean);
  if (!isEmbeddingEnabled() || clean.length === 0) return null;

  const missing = [...new Set(clean.filter((text) => !queryCache.has(text)))];
  if (missing.length > 0) {
    try {
      const fresh = await embedBatch(missing, "RETRIEVAL_QUERY", signal);
      missing.forEach((text, i) => cacheQuery(text, fresh[i]));
    } catch (err) {
      console.error("[rag] query embedding failed:", (err as Error).message);
      return null;
    }
  }
  const out = clean.map((text) => queryCache.get(text));
  return out.every((vector): vector is number[] => Array.isArray(vector))
    ? out
    : null;
}
