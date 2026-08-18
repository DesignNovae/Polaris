import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateGemmaText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import { stabilizeGeneratedText } from "@/lib/gemma/output-quality";

/**
 * Model-backed stages of the interpreter pipeline.
 *
 *   outline - a study outline for a lesson with no transcript. Explicitly not a
 *             transcript: Gemma has not heard the audio, and the client tags the
 *             result `ai-generated` so it is never presented as the speaker's words.
 *
 *   gloss   - sign language gloss and word order for a batch of segments. The
 *             model reorders and selects; it never invents handshapes. Phonology
 *             comes from the curated lexicon on the client, which is what stops a
 *             hallucinated sign from reaching a Deaf viewer looking authoritative.
 *
 * Both degrade to null rather than erroring, because the client has a working
 * deterministic path for each and a failed upgrade must never break playback.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_CUES = 12;
const MAX_SEGMENTS = 8;

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("captions"),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{6,20}$/),
    language: z.string().min(2).max(12).default("en"),
  }),
  z.object({
    kind: z.literal("outline"),
    mediaId: z.string().min(1).max(120),
    title: z.string().min(2).max(300),
    topic: z.string().min(1).max(120),
    exam: z.string().min(1).max(40),
    source: z.string().min(1).max(160),
    duration: z.number().int().min(60).max(7200),
  }),
  z.object({
    kind: z.literal("gloss"),
    language: z.string().min(2).max(8),
    languageName: z.string().min(2).max(80),
    /** Glosses the client's renderer can articulate. Anything else gets spelled. */
    vocabulary: z.array(z.string().min(1).max(40)).max(400).default([]),
    segments: z
      .array(z.object({ id: z.string().min(1).max(120), text: z.string().min(1).max(600) }))
      .min(1)
      .max(MAX_SEGMENTS),
  }),
]);

type Body = z.infer<typeof bodySchema>;

function clientId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "public-interpreter";
}

function userKey(req: NextRequest): string | null {
  const value = req.headers.get("x-polaris-gemma-key")?.trim() || "";
  return value.length >= 20 && value.length <= 300 ? value : null;
}

function parseObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Gemma returned invalid JSON");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

/** Flat key schemas: the generation path in this codebase is most reliable with them. */
function flatSchema(prefix: string, count: number) {
  return {
    type: "object",
    properties: Object.fromEntries(
      Array.from({ length: count }, (_, index) => [`${prefix}${index + 1}`, { type: "string" }]),
    ),
    required: Array.from({ length: count }, (_, index) => `${prefix}${index + 1}`),
  } as const;
}

/* ── YouTube captions ─────────────────────────────────────────────────────
   Server-side because the caption endpoint sends no CORS headers, so a page
   cannot read it directly.

   MEASURED BEHAVIOUR, August 2026: both strategies below currently return HTTP
   200 with an empty body from a server fetch, including for videos that plainly
   have caption tracks. YouTube gates the timedtext endpoint behind bot
   attestation now, and the signed URLs lifted from the watch page are refused
   the same way. This is not a parsing bug - it was checked against known-
   captioned lessons at both entry points.

   The provider is kept because it is the correct seam and it fails cleanly:
   an empty result is not an error, the client chain simply falls through to the
   Polaris companion track. If captions become reachable again - a residential
   egress, an attestation token service, or a licensed caption API - this is the
   one function that changes, and the interpreter starts running on the real
   words with no other edit anywhere.

   Two strategies, cheapest first. Neither retries. */

const CAPTION_TIMEOUT_MS = 8_000;

/** Cue merging targets. YouTube emits fragments; signing needs propositions. */
const MERGE_MAX_SECONDS = 9;
const MERGE_MAX_CHARS = 140;

type CaptionTrackRef = { lang: string; name: string; generated: boolean };

async function fetchText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(CAPTION_TIMEOUT_MS),
      headers: { "accept-language": "en" },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

/** Reads the track list, preferring a human track in the requested language. */
function pickTrack(listXml: string, language: string): CaptionTrackRef | null {
  const tracks: CaptionTrackRef[] = [];
  for (const match of listXml.matchAll(/<track\b[^>]*>/g)) {
    const tag = match[0];
    const lang = /lang_code="([^"]*)"/.exec(tag)?.[1] ?? "";
    if (!lang) continue;
    tracks.push({
      lang,
      name: /name="([^"]*)"/.exec(tag)?.[1] ?? "",
      generated: /kind="asr"/.test(tag),
    });
  }
  if (tracks.length === 0) return null;

  const base = language.split("-")[0].toLowerCase();
  const sameLanguage = tracks.filter((track) => track.lang.split("-")[0].toLowerCase() === base);
  const pool = sameLanguage.length > 0 ? sameLanguage : tracks;
  // A human-authored track beats an auto-generated one at the same language.
  return pool.find((track) => !track.generated) ?? pool[0];
}

type RawCue = { at: number; until: number; text: string };

/** Parses the JSON3 caption format into plain timed cues. */
function parseJson3(raw: string): RawCue[] {
  let payload: { events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }> };
  try {
    payload = JSON.parse(raw);
  } catch {
    return [];
  }

  const cues: RawCue[] = [];
  for (const event of payload.events ?? []) {
    if (typeof event.tStartMs !== "number" || !event.segs) continue;
    const text = event.segs
      .map((seg) => seg.utf8 ?? "")
      .join("")
      // Auto-captions carry newlines mid-phrase and bracketed sound events that
      // are not speech and must not be signed as words.
      .replace(/\s*\n\s*/g, " ")
      .replace(/\[[^\]]*\]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) continue;
    const at = event.tStartMs / 1000;
    cues.push({ at, until: at + Math.max(0.4, (event.dDurationMs ?? 2000) / 1000), text });
  }
  return cues.sort((a, b) => a.at - b.at);
}

/**
 * Merges caption fragments into whole propositions.
 *
 * This matters more than it looks. YouTube emits two- and three-word fragments,
 * and a fragment cannot be reordered into sign syntax - you cannot move a time
 * marker to the front of a clause you only have half of. Merging to sentence
 * boundaries is what lets the translation stage do its job at all.
 */
function mergeCues(cues: RawCue[]): RawCue[] {
  const merged: RawCue[] = [];
  let open: RawCue | null = null;

  for (const cue of cues) {
    if (!open) {
      open = { ...cue };
      continue;
    }
    const wouldRun = cue.until - open.at > MERGE_MAX_SECONDS;
    const wouldOverflow = open.text.length + cue.text.length > MERGE_MAX_CHARS;
    const closed = /[.!?]$/.test(open.text);

    if (closed || wouldRun || wouldOverflow) {
      merged.push(open);
      open = { ...cue };
      continue;
    }
    open = { at: open.at, until: cue.until, text: `${open.text} ${cue.text}`.replace(/\s+/g, " ") };
  }
  if (open) merged.push(open);
  return merged;
}

/** Strategy 1: the public track list, then a plain track fetch. */
async function fetchViaTrackList(videoId: string, language: string) {
  const listXml = await fetchText(`https://www.youtube.com/api/timedtext?type=list&v=${encodeURIComponent(videoId)}`);
  if (!listXml) return null;

  const track = pickTrack(listXml, language);
  if (!track) return null;

  const params = new URLSearchParams({ v: videoId, lang: track.lang, fmt: "json3" });
  if (track.name) params.set("name", track.name);
  if (track.generated) params.set("kind", "asr");

  const raw = await fetchText(`https://www.youtube.com/api/timedtext?${params.toString()}`);
  if (!raw) return null;

  const cues = parseJson3(raw);
  return cues.length ? { cues, language: track.lang, generated: track.generated } : null;
}

/**
 * Strategy 2: the signed caption URLs embedded in the watch page.
 *
 * The player response carries a `captionTracks` array whose `baseUrl` values are
 * pre-signed. This is the route that works whenever any route works, because the
 * signature is issued alongside the page rather than requested cold.
 */
async function fetchViaWatchPage(videoId: string, language: string) {
  const html = await fetchText(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}&hl=en`);
  if (!html) return null;

  const match = /"captionTracks":(\[.*?\}\])/.exec(html);
  if (!match) return null;

  let tracks: Array<{ baseUrl?: string; languageCode?: string; kind?: string }>;
  try {
    tracks = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const base = language.split("-")[0].toLowerCase();
  const sameLanguage = tracks.filter((track) => (track.languageCode ?? "").split("-")[0].toLowerCase() === base);
  const pool = sameLanguage.length > 0 ? sameLanguage : tracks;
  const chosen = pool.find((track) => track.kind !== "asr") ?? pool[0];
  if (!chosen?.baseUrl) return null;

  const url = `${chosen.baseUrl.replace(/\\u0026/g, "&")}&fmt=json3`;
  const raw = await fetchText(url);
  if (!raw) return null;

  const cues = parseJson3(raw);
  return cues.length
    ? { cues, language: chosen.languageCode ?? language, generated: chosen.kind === "asr" }
    : null;
}

async function fetchYouTubeCaptions(videoId: string, language: string) {
  const result = (await fetchViaTrackList(videoId, language)) ?? (await fetchViaWatchPage(videoId, language));
  if (!result) return { cues: [], language, generated: false, available: false };

  return {
    cues: mergeCues(result.cues),
    language: result.language,
    generated: result.generated,
    available: true,
  };
}

async function gemmaJson(
  req: NextRequest,
  system: string,
  contents: string,
  schema: unknown,
  maxOutputTokens: number,
): Promise<Record<string, unknown> | null> {
  const apiKey = userKey(req);
  if (!hasGemmaKey(apiKey)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 16_000);
  try {
    const text = await generateGemmaText({
      system,
      contents,
      responseJsonSchema: schema,
      temperature: 0.2,
      maxOutputTokens,
      thinkingLevel: "minimal",
      abortSignal: controller.signal,
      apiKey,
    });
    return text ? parseObject(text) : null;
  } catch (error) {
    console.warn("[interpreter] generation fell back", error instanceof Error ? error.message : "unknown error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const limit = await rateLimit(clientId(req), "free", "interpreter");
  if (!limit.allowed) {
    const response = fail(429, "Request limit reached. Please retry shortly.");
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  const body = bodySchema.parse(await parseJson(req)) as Body;

  if (body.kind === "captions") {
    const cues = await fetchYouTubeCaptions(body.videoId, body.language);
    return Response.json(cues);
  }

  if (body.kind === "outline") {
    const generated = await gemmaJson(
      req,
      [
        "You write short study outlines for exam preparation lessons in Polaris.",
        "You have NOT heard the lesson audio. Write what a learner should take away from this topic, never a claim about what the speaker said.",
        "Write in English. Every line must be a short, complete declarative sentence of at most 14 words.",
        "Use plain vocabulary. No lists, no numbering, no markdown, no quotation marks.",
        "Short declaratives are required because each line is translated into a sign language, and long subordinate clauses do not translate readably.",
        "Gemma 4 is the only generative model.",
      ].join(" "),
      `Lesson: ${body.title}\nExam: ${body.exam}\nTopic: ${body.topic}\nPublisher: ${body.source}\n\nWrite ${MAX_CUES} lines covering this topic in a sensible teaching order.`,
      flatSchema("line", MAX_CUES),
      900,
    );

    if (!generated) return Response.json({ cues: [], source: "unavailable", model: "none" });

    const lines = Array.from({ length: MAX_CUES }, (_, index) =>
      stabilizeGeneratedText(String(generated[`line${index + 1}`] ?? "")).trim(),
    ).filter((line) => line.length > 3);

    if (lines.length === 0) return Response.json({ cues: [], source: "unavailable", model: "none" });

    // Spread evenly across the lesson. The model has no timing information, and
    // an even spread is honestly approximate rather than falsely precise.
    const span = body.duration / lines.length;
    const cues = lines.map((text, index) => ({
      at: Number((index * span).toFixed(2)),
      until: Number(((index + 1) * span).toFixed(2)),
      text,
    }));

    return Response.json({ cues, source: "gemma4", model: getGemmaModelId() });
  }

  const generated = await gemmaJson(
    req,
    [
      `You translate English into ${body.languageName} (${body.language}) gloss notation.`,
      "Gloss notation writes each sign as an upper-case word in the order it is signed.",
      "Translate meaning, never word by word. Reorder into the target syntax: time expressions first, then topic, then comment. Move question words to the end.",
      "Drop articles, copulas, and prepositions that the target language does not sign.",
      "Mark negation with NOT after the verb it scopes.",
      "For proper nouns and technical terms with no sign, write fs-WORD to indicate fingerspelling.",
      "Return only upper-case gloss tokens separated by single spaces. No punctuation, no explanation, no English sentences.",
      "Gemma 4 is the only generative model.",
    ].join(" "),
    body.segments.map((segment, index) => `${index + 1}. ${segment.text}`).join("\n"),
    flatSchema("g", body.segments.length),
    700,
  );

  if (!generated) return Response.json({ glosses: [], source: "unavailable", model: "none" });

  const glosses = body.segments
    .map((segment, index) => {
      const raw = String(generated[`g${index + 1}`] ?? "").trim();
      // Guard the contract: gloss is upper-case tokens and fs- prefixes only.
      const cleaned = raw
        .replace(/[^A-Za-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .map((token) => (token.toLowerCase().startsWith("fs-") ? `fs-${token.slice(3).toUpperCase()}` : token.toUpperCase()))
        .join(" ");
      return { segmentId: segment.id, gloss: cleaned };
    })
    .filter((item) => item.gloss.length > 0);

  return Response.json({ glosses, source: "gemma4", model: getGemmaModelId() });
});
