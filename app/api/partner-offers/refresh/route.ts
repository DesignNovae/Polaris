import type { NextRequest } from "next/server";
import { z } from "zod";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import { finalizeGeneratedLanguage, generationLanguageInstruction, requestLanguage } from "@/lib/i18n/server";
import { generateGemmaText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { tavilySearch, shortDomain, type WebSearchResult } from "@/lib/llm/web-search";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  level: z.string().trim().max(40),
  roadmapTopics: z.array(z.string().trim().max(80)).max(24).default([]),
  weakScores: z.array(z.object({
    key: z.string().trim().max(60),
    label: z.string().trim().max(100),
    ratio: z.number().min(0).max(2),
  })).max(12).default([]),
  deadlineTypesSoon: z.array(z.string().trim().max(80)).max(12).default([]),
});

const outputSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    offers: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          provider: { type: "string" },
          summary: { type: "string" },
          eligibility: { type: "string" },
          match_reason: { type: "string" },
          source_url: { type: "string" },
        },
        required: ["title", "provider", "summary", "eligibility", "match_reason", "source_url"],
      },
    },
  },
  required: ["message", "offers"],
} as const;

function clientId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "public-partner-refresh";
}

function parseObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON object missing");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function dedupeResults(results: WebSearchResult[]): WebSearchResult[] {
  const seen = new Set<string>();
  return results.filter((result) => {
    const url = normalizedUrl(result.url);
    if (!url || seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

const OFFICIAL_OFFER_SOURCES = [
  { title: "GitHub Student Developer Pack", url: "https://education.github.com/pack" },
  { title: "JetBrains student licenses", url: "https://www.jetbrains.com/community/education/#students" },
  { title: "Microsoft student offers", url: "https://www.microsoft.com/en-us/education/students" },
  { title: "Autodesk Education access", url: "https://www.autodesk.com/education/edu-software/overview" },
  { title: "AWS Educate", url: "https://aws.amazon.com/education/awseducate/" },
  { title: "Foreign Fulbright Program", url: "https://foreign.fulbrightonline.org/apply" },
  { title: "BRAC University scholarship and financial aid", url: "https://www.bracu.ac.bd/admissions/international-applicants/scholarship-financial-aid" },
  { title: "Coursera financial aid", url: "https://www.coursera.support/s/article/learner-000001046" },
] as const;

function readablePageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

async function readOfficialSource(source: typeof OFFICIAL_OFFER_SOURCES[number]): Promise<WebSearchResult | null> {
  try {
    const response = await fetch(source.url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; PolarisStudentResearch/1.0)",
        "accept-language": "en-US,en;q=0.8",
      },
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(9_000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return null;
    const html = await response.text();
    const description =
      html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["'](?:description|og:description)["']/i)?.[1]
      ?? "";
    const pageText = readablePageText(html);
    const snippet = readablePageText(`${description} ${pageText}`).slice(0, 1800);
    if (snippet.length < 80) return null;
    return { title: source.title, url: source.url, snippet };
  } catch {
    return null;
  }
}

async function officialOfferEvidence(): Promise<WebSearchResult[]> {
  const results = await Promise.all(OFFICIAL_OFFER_SOURCES.map(readOfficialSource));
  return results.filter((result): result is WebSearchResult => result !== null);
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const lang = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "public-partner-refresh");
  if (!limit.allowed) {
    const response = fail(
      429,
      lang === "bn"
        ? "লাইভ অফার যাচাইয়ের সীমা পূর্ণ হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।"
        : "The live offer check limit has been reached. Please retry in a few minutes.",
    );
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  const parsed = bodySchema.safeParse(await parseJson(req));
  if (!parsed.success) return fail(400, lang === "bn" ? "অনুরোধের তথ্য সঠিক নয়।" : "Invalid offer refresh request.");
  const body = parsed.data;

  const contextTerms = [
    ...body.roadmapTopics.slice(0, 5),
    ...body.weakScores.filter((score) => score.ratio < 0.8).map((score) => score.label).slice(0, 3),
    ...body.deadlineTypesSoon.slice(0, 3),
  ].filter(Boolean);
  const context = contextTerms.join(" ") || "university application IELTS SAT coding scholarships";

  const [officialBenefits, learningOffers, officialSources] = await Promise.all([
    tavilySearch(
      `official current student benefit free education offer Bangladesh international students ${context}`,
      { maxResults: 7, depth: "advanced" },
    ),
    tavilySearch(
      `official IELTS SAT scholarship developer student program offer 2026 ${context}`,
      { maxResults: 7, depth: "advanced" },
    ),
    officialOfferEvidence(),
  ]);
  const evidence = dedupeResults([
    ...officialBenefits,
    ...learningOffers,
    ...officialSources,
  ]).slice(0, 16);

  if (evidence.length === 0) {
    const response = Response.json({
      offers: [],
      checkedAt: new Date().toISOString(),
      source: "no-search-results",
      model: "none",
      message: lang === "bn"
        ? "লাইভ উৎসে যাচাইযোগ্য নতুন অফার পাওয়া যায়নি। বিদ্যমান অফিসিয়াল অফারগুলো অপরিবর্তিত রাখা হয়েছে।"
        : "No new verifiable offer was found in the live sources. The existing official offers were left unchanged.",
    });
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  if (!hasGemmaKey()) {
    const response = Response.json({
      offers: [],
      checkedAt: new Date().toISOString(),
      source: "gemma-unavailable",
      model: "none",
      message: lang === "bn"
        ? "লাইভ উৎস পাওয়া গেছে, তবে Polaris যাচাই এখন সাময়িকভাবে অনুপলব্ধ। কোনো অফার পরিবর্তন করা হয়নি।"
        : "Live sources were found, but Polaris verification is temporarily unavailable. No offer was changed.",
    });
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  const allowedUrls = new Map(
    evidence.map((item) => [normalizedUrl(item.url)!, item]),
  );
  const evidenceText = evidence.map((item, index) =>
    `[${index + 1}] ${item.title}\nURL: ${normalizedUrl(item.url)}\nExcerpt: ${item.snippet.slice(0, 900)}`,
  ).join("\n\n");

  const generated = await generateGemmaText({
    system: [
      "You are the live student-offer verifier inside Polaris.",
      generationLanguageInstruction(lang),
      "Select at most four genuinely useful, current student benefits from the supplied retrieval evidence.",
      "Never invent a price, discount, code, deadline, eligibility rule, provider, or URL.",
      "source_url must exactly equal one supplied URL.",
      "Prefer official provider pages. Omit ambiguous, expired, duplicated, paid-only, or weakly supported claims.",
      "Titles and provider names must remain in their official language and spelling.",
      "Keep each summary and match reason under 28 words.",
      "Gemma 4 is the only generative model used.",
    ].join(" "),
    contents: [
      `Student level: ${body.level}`,
      `Roadmap topics: ${body.roadmapTopics.join(", ") || "not supplied"}`,
      `Weak scores: ${body.weakScores.map((score) => `${score.label} ${Math.round(score.ratio * 100)}%`).join(", ") || "not supplied"}`,
      `Upcoming deadline types: ${body.deadlineTypesSoon.join(", ") || "not supplied"}`,
      "",
      "Retrieved evidence:",
      evidenceText,
    ].join("\n"),
    responseJsonSchema: outputSchema,
    temperature: 0.1,
    maxOutputTokens: 1100,
    thinkingLevel: "minimal",
  });

  let offers: Array<{
    id: string;
    title: string;
    provider: string;
    summary: string;
    eligibility: string;
    matchReason: string;
    sourceUrl: string;
    sourceLabel: string;
  }> = [];
  let message = lang === "bn" ? "Polaris লাইভ উৎস যাচাই সম্পন্ন করেছে।" : "Polaris completed the live source check.";

  if (generated) {
    try {
      const output = parseObject(generated);
      const candidates = Array.isArray(output.offers) ? output.offers : [];
      const seen = new Set<string>();
      offers = candidates.flatMap((candidate, index) => {
        if (!candidate || typeof candidate !== "object") return [];
        const record = candidate as Record<string, unknown>;
        const sourceUrl = normalizedUrl(String(record.source_url ?? ""));
        if (!sourceUrl || !allowedUrls.has(sourceUrl) || seen.has(sourceUrl)) return [];
        seen.add(sourceUrl);
        const source = allowedUrls.get(sourceUrl)!;
        return [{
          id: `live-${index}-${Buffer.from(sourceUrl).toString("base64url").slice(0, 12)}`,
          title: String(record.title ?? source.title).slice(0, 140),
          provider: String(record.provider ?? shortDomain(sourceUrl)).slice(0, 80),
          summary: finalizeGeneratedLanguage(String(record.summary ?? ""), lang),
          eligibility: finalizeGeneratedLanguage(String(record.eligibility ?? ""), lang),
          matchReason: finalizeGeneratedLanguage(String(record.match_reason ?? ""), lang),
          sourceUrl,
          sourceLabel: shortDomain(sourceUrl),
        }];
      }).slice(0, 4);
      if (typeof output.message === "string" && output.message.trim()) {
        message = finalizeGeneratedLanguage(output.message, lang);
      }
    } catch {
      offers = [];
    }
  }

  if (offers.length === 0) {
    message = lang === "bn"
      ? "Polaris লাইভ উৎসগুলো যাচাই করেছে, কিন্তু যথেষ্ট প্রমাণসহ নতুন অফার পায়নি।"
      : "Polaris checked the live sources but found no new offer with enough supporting evidence.";
  }

  const response = Response.json({
    offers,
    checkedAt: new Date().toISOString(),
    source: "gemma4-live-web",
    model: getGemmaModelId(),
    message,
  });
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
  return response;
});
