/**
 * Cache generation counter for the retrieval layer.
 *
 * A leaf module on purpose: content mutations (lib/content.ts) bump the
 * version without importing anything from the RAG pipeline, so there is no
 * import cycle between the content store and the index that reads it.
 *
 * In-process only. Other instances pick changes up via the TTL below.
 */

let version = 0;

export const RAG_CACHE_TTL_MS = 5 * 60 * 1000;

export function ragCacheVersion(): number {
  return version;
}

/** Call after any KB content write so the next search re-reads the source. */
export function invalidateRagCaches(): void {
  version++;
}
