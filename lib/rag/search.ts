import type { RagDoc } from "./types";
import { flattenAllDocs } from "./flatten";

/**
 * Deterministic BM25 retrieval.
 *
 * The competition allows non-generative retrieval techniques. BM25 keeps the
 * evidence pipeline transparent and guarantees that Gemma 4 is the only
 * foundation model involved in producing an answer.
 */
function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter(
    (token) => token.length > 1,
  );
}

function termFrequency(tokens: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

export type SearchHit = {
  id: string;
  title: string;
  source: RagDoc["source"];
  score: number;
  text: string;
  metadata: Record<string, unknown>;
};

export type SearchConstraints = {
  source?: RagDoc["source"];
  country?: string;
  degreeLevel?: "undergrad" | "masters" | "phd" | "general";
  program?: string;
};

export async function searchDocs(
  queryText: string,
  _queryVector: number[] | null = null,
  topK = 6,
  constraints: SearchConstraints = {},
): Promise<SearchHit[]> {
  const docs = flattenAllDocs().filter((doc) => {
    if (constraints.source && doc.source !== constraints.source) return false;
    const metadata = doc.metadata;
    if (constraints.country && typeof metadata.country === "string" && metadata.country.toLowerCase() !== constraints.country.toLowerCase()) return false;
    if (constraints.degreeLevel) {
      const levels = Array.isArray(metadata.degreeLevels) ? metadata.degreeLevels.map(String).map((value) => value.toLowerCase()) : [];
      if (levels.length && !levels.includes(constraints.degreeLevel.toLowerCase()) && !levels.includes("general")) return false;
    }
    if (constraints.program) {
      const programs = Array.isArray(metadata.programs) ? metadata.programs.map(String).join(" ").toLowerCase() : "";
      const query = constraints.program.toLowerCase();
      if (programs && !query.split(/\W+/).filter((word) => word.length > 2).some((word) => programs.includes(word))) return false;
    }
    return true;
  });
  const queryTerms = [...new Set(tokenize(queryText))];
  if (queryTerms.length === 0) return [];

  const prepared = docs.map((doc) => {
    const titleTokens = tokenize(doc.title);
    const bodyTokens = tokenize(doc.text);
    return {
      doc,
      tokens: [...titleTokens, ...bodyTokens],
      titleTerms: new Set(titleTokens),
    };
  });

  const averageLength =
    prepared.reduce((sum, row) => sum + row.tokens.length, 0) /
    Math.max(prepared.length, 1);
  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(
      term,
      prepared.reduce(
        (count, row) => count + (row.tokens.includes(term) ? 1 : 0),
        0,
      ),
    );
  }

  const k1 = 1.5;
  const b = 0.75;
  const totalDocuments = prepared.length;
  const scored = prepared.map(({ doc, tokens, titleTerms }) => {
    const frequencies = termFrequency(tokens);
    let score = 0;
    for (const term of queryTerms) {
      const tf = frequencies.get(term) ?? 0;
      if (tf === 0) continue;
      const df = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(
        1 + (totalDocuments - df + 0.5) / (df + 0.5),
      );
      const lengthNormalization =
        tf + k1 * (1 - b + b * (tokens.length / Math.max(averageLength, 1)));
      score += inverseDocumentFrequency * ((tf * (k1 + 1)) / lengthNormalization);
      if (titleTerms.has(term)) score += inverseDocumentFrequency * 0.75;
    }
    return {
      id: doc.id,
      title: doc.title,
      source: doc.source,
      text: doc.text,
      metadata: doc.metadata,
      score,
    };
  });

  scored.sort((left, right) => right.score - left.score);
  return scored.filter((hit) => hit.score > 0).slice(0, topK);
}

export type KbHit = {
  id: string;
  title: string;
  snippet: string;
  source: RagDoc["source"];
  score: number;
};

/** Compact evidence search used by the Gemma 4 Strategist. */
export async function searchKb(query: string, topK = 6): Promise<KbHit[]> {
  const hits = await searchDocs(query, null, topK);
  return hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    snippet: hit.text.length > 280 ? `${hit.text.slice(0, 280)}...` : hit.text,
    source: hit.source,
    score: hit.score,
  }));
}
