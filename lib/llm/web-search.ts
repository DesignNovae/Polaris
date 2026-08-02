/**
 * Non-generative web retrieval for the Strategist. Retrieval supplies
 * evidence; Gemma 4 remains the only model that synthesizes an answer.
 */

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/\s+/g, " ")
    .trim();
}

function directResultUrl(rawHref: string): string | null {
  try {
    const decoded = decodeHtml(rawHref);
    const href = decoded.startsWith("//") ? `https:${decoded}` : decoded;
    const url = new URL(href);
    if (url.hostname.endsWith("duckduckgo.com")) {
      const target = url.searchParams.get("uddg");
      if (!target) return null;
      const targetUrl = new URL(target);
      return ["http:", "https:"].includes(targetUrl.protocol) ? targetUrl.toString() : null;
    }
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * No-key fallback used when Tavily is not configured. DuckDuckGo provides
 * ordinary search-result retrieval only; it does not generate or summarize
 * content. Gemma 4 still performs every relevance and credibility decision.
 */
async function publicHtmlSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const endpoint = new URL("https://html.duckduckgo.com/html/");
    endpoint.searchParams.set("q", query);
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PolarisStudentResearch/1.0)",
        "accept-language": "en-US,en;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const html = await response.text();
    const links = [...html.matchAll(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)];
    const snippets = [...html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/gi)];
    const results: WebSearchResult[] = [];
    const seen = new Set<string>();
    for (let index = 0; index < links.length && results.length < maxResults; index += 1) {
      const url = directResultUrl(links[index][1]);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: decodeHtml(links[index][2]),
        url,
        snippet: decodeHtml(snippets[index]?.[1] ?? ""),
      });
    }
    return results;
  } catch {
    return [];
  }
}

async function publicRssSearch(query: string, maxResults: number): Promise<WebSearchResult[]> {
  try {
    const endpoint = new URL("https://www.bing.com/search");
    endpoint.searchParams.set("format", "rss");
    endpoint.searchParams.set("q", query);
    const response = await fetch(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PolarisStudentResearch/1.0)",
        "accept-language": "en-US,en;q=0.8",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return [];
    const xml = await response.text();
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)];
    const results: WebSearchResult[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (results.length >= maxResults) break;
      const title = item[1].match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "";
      const rawUrl = item[1].match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? "";
      const snippet = item[1].match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? "";
      const url = directResultUrl(rawUrl);
      if (!url || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: decodeHtml(title),
        url,
        snippet: decodeHtml(snippet),
      });
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Best-effort retrieval. Tavily is preferred when configured; the public
 * HTML fallback keeps live evidence available in a zero-setup judge demo.
 */
export async function tavilySearch(
  query: string,
  opts: { maxResults?: number; depth?: "basic" | "advanced" } = {},
): Promise<WebSearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: opts.depth ?? "basic",
          max_results: opts.maxResults ?? 5,
          include_answer: false,
        }),
      });
      if (!res.ok) throw new Error("Tavily request failed");
      const data = (await res.json()) as {
        results?: Array<{ title: string; url: string; content: string }>;
      };
      return (data.results ?? []).map((result) => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
      }));
    } catch {
      // Fall through to the no-key public retrieval path.
    }
  }
  const maxResults = opts.maxResults ?? 5;
  const publicResults = await publicHtmlSearch(query, maxResults);
  return publicResults.length > 0
    ? publicResults
    : publicRssSearch(query, maxResults);
}

/** Returns a short, citation-friendly label for a URL (just the bare host). */
export function shortDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 32);
  }
}

/** True when the preferred Tavily backend is configured. */
export function hasWebSearchKey(): boolean {
  return !!process.env.TAVILY_API_KEY;
}
