import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateGemmaText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import { finalizeGeneratedLanguage, generationLanguageInstruction, requestLanguage } from "@/lib/i18n/server";
import type { DecisionResult, EvidenceResult, RoutineCategory, RoutineSuggestion } from "@/lib/action-lab/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  kind: z.literal("decision"),
  event: z.string().trim().min(3).max(500),
  currentScore: z.number().min(400).max(1600),
  targetScore: z.number().min(400).max(1600),
  weeklyHours: z.number().min(1).max(80),
  budgetBdt: z.number().min(0).max(10_000_000),
  targetCountry: z.string().trim().min(2).max(60),
});

const evidenceSchema = z.object({
  kind: z.literal("evidence"),
  claim: z.string().trim().min(3).max(500),
  proofType: z.string().trim().min(2).max(80),
  proofDetail: z.string().trim().max(700).default(""),
});

const routineSchema = z.object({
  kind: z.literal("routine"),
  instruction: z.string().trim().min(3).max(500),
  existing: z.array(z.object({
    day: z.string().max(20),
    start: z.string().max(8),
    end: z.string().max(8),
    title: z.string().max(100),
  })).max(40).default([]),
});

const examSchema = z.object({
  kind: z.literal("exam-review"),
  exam: z.enum(["IELTS", "SAT"]),
  score: z.number().int().min(0).max(50),
  total: z.number().int().min(1).max(50),
  weakSkills: z.array(z.string().max(80)).max(12),
});

const bodySchema = z.discriminatedUnion("kind", [decisionSchema, evidenceSchema, routineSchema, examSchema]);

const decisionOutputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    probability_after: { type: "number" },
    risk: { type: "string", enum: ["lower", "steady", "higher"] },
    focus1: { type: "string" },
    focus2: { type: "string" },
    focus3: { type: "string" },
    next_action: { type: "string" },
    evidence_to_collect: { type: "string" },
  },
  required: ["summary", "probability_after", "risk", "focus1", "focus2", "focus3", "next_action", "evidence_to_collect"],
} as const;

const evidenceOutputSchema = {
  type: "object",
  properties: {
    signal: { type: "string" },
    gap: { type: "string" },
    next_action: { type: "string" },
    verification: { type: "string" },
  },
  required: ["signal", "gap", "next_action", "verification"],
} as const;

const routineOutputSchema = {
  type: "object",
  properties: {
    day: { type: "string", enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] },
    start: { type: "string" },
    end: { type: "string" },
    title: { type: "string" },
    category: { type: "string", enum: ["study", "exam", "project", "wellbeing", "application"] },
  },
  required: ["day", "start", "end", "title", "category"],
} as const;

function clientId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "public-action-lab";
}

function parseObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("JSON object missing");
  return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
}

function localize(value: unknown, lang: "en" | "bn"): string {
  return finalizeGeneratedLanguage(String(value ?? ""), lang);
}

async function safeGemmaText(
  request: Parameters<typeof generateGemmaText>[0],
): Promise<string | null> {
  try {
    return await generateGemmaText(request);
  } catch (error) {
    console.warn(
      "[action-lab] Gemma request failed; using deterministic fallback:",
      error instanceof Error ? error.message : String(error),
    );
    return null;
  }
}

function decisionChanges(body: z.infer<typeof decisionSchema>, focuses: string[], lang: "en" | "bn") {
  const bn = lang === "bn";
  return [
    {
      area: bn ? "পরীক্ষা প্রস্তুতি" : "Test preparation",
      before: bn ? "সপ্তাহে ২টি সাধারণ অনুশীলন" : "Two mixed blocks each week",
      after: bn ? "১টি ডায়াগনস্টিক ও ৩টি লক্ষ্যভিত্তিক ব্লক" : "One diagnostic plus three targeted blocks",
      reason: focuses[0] || body.event,
    },
    {
      area: bn ? "প্রকল্পের প্রমাণ" : "Project evidence",
      before: bn ? "দুটি সমান্তরাল কাজ" : "Two parallel deliverables",
      after: bn ? "একটি যাচাইযোগ্য প্রধান ফলাফল" : "One verifiable flagship outcome",
      reason: focuses[1] || (bn ? "পরীক্ষার চাপ বাড়লেও মান ধরে রাখা" : "Protect quality while test pressure rises"),
    },
    {
      area: bn ? "পর্যালোচনার গতি" : "Review cadence",
      before: bn ? "মাসিক অগ্রগতি পরীক্ষা" : "Monthly progress check",
      after: bn ? "প্রতি শুক্রবার স্কোর ও সময় পুনর্মূল্যায়ন" : "Recalculate score and time every Friday",
      reason: focuses[2] || (bn ? "পরিকল্পনাকে নতুন তথ্যের সঙ্গে মানিয়ে রাখা" : "Keep the roadmap responsive to new evidence"),
    },
  ];
}

function decisionFallback(body: z.infer<typeof decisionSchema>, lang: "en" | "bn"): DecisionResult {
  const pressure = body.targetScore - body.currentScore;
  const probabilityAfter = Math.max(12, Math.min(74, 41 + (body.weeklyHours >= 12 ? 4 : -3) - Math.round(Math.max(0, pressure - 150) / 60)));
  const bn = lang === "bn";
  return {
    summary: bn ? "পরিবর্তনটি পরীক্ষার প্রস্তুতিকে তাৎক্ষণিক অগ্রাধিকার দিচ্ছে, তবে প্রকল্প ও আবেদন-প্রমাণের ধারাবাহিকতা বজায় রাখতে হবে।" : "The change makes test preparation the immediate priority while protecting continuity in projects and application evidence.",
    probabilityBefore: 41,
    probabilityAfter,
    risk: probabilityAfter > 41 ? "lower" : probabilityAfter < 38 ? "higher" : "steady",
    changes: decisionChanges(body, [], lang),
    nextAction: bn ? "আজই ৪৫ মিনিটের একটি ডায়াগনস্টিক পরীক্ষা দিন এবং তিনটি দুর্বল দক্ষতা লিখে রাখুন।" : "Take a 45-minute diagnostic today and record the three weakest skills.",
    evidenceToCollect: bn ? "ডায়াগনস্টিক স্কোর, ভুলের তালিকা এবং পরবর্তী সাত দিনের সম্পন্ন অনুশীলন।" : "Diagnostic score, error log, and completed practice from the next seven days.",
    source: "deterministic-fallback",
    model: "none",
  };
}

function evidenceFallback(body: z.infer<typeof evidenceSchema>, lang: "en" | "bn"): EvidenceResult {
  const bn = lang === "bn";
  return {
    claim: body.claim,
    proof: body.proofDetail || `${body.proofType}: ${bn ? "প্রমাণ এখনও যোগ করা হয়নি" : "evidence not attached yet"}`,
    verifiedSignal: bn ? "দাবিটি আংশিকভাবে সমর্থিত" : "Claim is partially supported",
    gap: bn ? "স্বাধীন যাচাই, তারিখ এবং পরিমাপযোগ্য ফলাফল অনুপস্থিত।" : "Independent verification, date, and measurable outcome are missing.",
    nextAction: bn ? "একটি প্রকাশ্য লিংক বা স্বাক্ষরিত প্রমাণ যোগ করুন এবং ফলাফলকে একটি সংখ্যায় প্রকাশ করুন।" : "Add a public link or signed proof and express the outcome with one measurable number.",
    verification: bn ? "লিংক, মেটাডেটা ও ফলাফল ম্যানুয়ালি যাচাই করুন।" : "Manually verify the link, metadata, and claimed outcome.",
    source: "deterministic-fallback",
    model: "none",
  };
}

/* ── Routine instruction parser (deterministic fallback) ──────────────────
 * Handles: explicit ranges ("9 to 10 pm", "14:00-16:00", "7:30 to 9:00 am"),
 * single times with optional duration ("at 7pm", "5 pm for 1 hour"),
 * part-of-day words, full + abbreviated day names, and "today"/"tomorrow".
 * Meridiem is inherited in BOTH directions, so "9 to 10 pm" is 21:00-22:00.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAY_ABBR: Record<string, string> = {
  sun: "Sunday", mon: "Monday", tue: "Tuesday", tues: "Tuesday", wed: "Wednesday",
  weds: "Wednesday", thu: "Thursday", thur: "Thursday", thurs: "Thursday", fri: "Friday", sat: "Saturday",
};
const PART_OF_DAY: Record<string, number> = { morning: 8, noon: 12, afternoon: 15, evening: 19, night: 21 };

const asMinutes = (hour: number, minute: number) => hour * 60 + minute;
const asClock = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;

function withMeridiem(hour: number, meridiem?: string): number {
  if (!meridiem) return hour;
  if (meridiem === "pm" && hour < 12) return hour + 12;
  if (meridiem === "am" && hour === 12) return 0;
  return hour;
}

function routineFallback(body: z.infer<typeof routineSchema>): RoutineSuggestion {
  const raw = body.instruction;
  const text = ` ${raw.toLowerCase().replace(/[.,!?]/g, " ")} `;
  const examSat = /\bSAT\b/.test(raw); // uppercase only, so "sat" stays a weekday

  /* Day */
  let day: string | null = null;
  const fullDay = text.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (fullDay) day = fullDay[1][0].toUpperCase() + fullDay[1].slice(1);
  if (!day) {
    const abbr = text.match(/\b(sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/);
    if (abbr && !(abbr[1] === "sat" && examSat)) day = DAY_ABBR[abbr[1]];
  }
  const todayIndex = new Date().getDay();
  if (!day && /\btomorrow\b/.test(text)) day = DAY_NAMES[(todayIndex + 1) % 7];
  if (!day && /\btoday\b/.test(text)) day = DAY_NAMES[todayIndex];
  if (!day && /\bweekend\b/.test(text)) day = "Saturday";
  if (!day) day = "Monday";

  /* Explicit duration ("for 90 minutes", "for 2 hours") */
  let durationMin: number | null = null;
  const durMatch = text.match(/\bfor\s+(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/);
  if (durMatch) {
    const n = parseFloat(durMatch[1]);
    durationMin = /^(h|hr|hrs|hour|hours)$/.test(durMatch[2]) ? Math.round(n * 60) : Math.round(n);
  }

  /* Time range */
  let startMin: number | null = null;
  let endMin: number | null = null;
  const range = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|till|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/,
  );
  if (range) {
    const h1 = Number(range[1]);
    const h2 = Number(range[4]);
    let mer1 = range[3];
    let mer2 = range[6];
    const explicit24 = h1 > 12 || h2 > 12;
    if (!mer1 && mer2) mer1 = mer2;        // "9 to 10 pm"  -> both pm
    else if (mer1 && !mer2) mer2 = mer1;   // "7 pm to 9"   -> both pm
    let a = asMinutes(withMeridiem(h1, mer1), range[2] ? Number(range[2]) : 0);
    let b = asMinutes(withMeridiem(h2, mer2), range[5] ? Number(range[5]) : 0);
    if (b <= a && !explicit24) b += b + 720 > a ? 720 : 1440;
    if (b <= a) b = a + 60;
    startMin = a;
    endMin = b;
  }

  /* Single time */
  if (startMin === null) {
    const one =
      text.match(/\b(?:at|by|around|from)?\s*(\d{1,2}):(\d{2})\s*(am|pm)?\b/) ||
      text.match(/\b(?:at|by|around|from)\s*(\d{1,2})()\s*(am|pm)?\b/) ||
      text.match(/\b(\d{1,2})()\s*(am|pm)\b/);
    if (one) {
      startMin = asMinutes(withMeridiem(Number(one[1]), one[3]), one[2] ? Number(one[2]) : 0);
      endMin = startMin + (durationMin ?? 60);
    }
  }

  /* Part of day */
  if (startMin === null) {
    for (const [word, hour] of Object.entries(PART_OF_DAY)) {
      if (new RegExp(`\\b${word}\\b`).test(text)) {
        startMin = asMinutes(hour, 0);
        endMin = startMin + (durationMin ?? 60);
        break;
      }
    }
  }

  /* Nothing parsed - a neutral evening block, not a fixed 21:00 */
  if (startMin === null) {
    startMin = asMinutes(19, 0);
    endMin = startMin + (durationMin ?? 60);
  }
  if (endMin === null || endMin <= startMin) endMin = startMin + 60;
  if (endMin >= 1440) endMin = 1439;

  /* Category */
  const category: RoutineCategory =
    examSat || /\b(ielts|toefl|gre|gmat|exam|mock|quiz|midterm|final)\b/i.test(raw) ? "exam"
    : /\b(gym|workout|run|walk|swim|sleep|nap|rest|meditat\w*|yoga|break|meal|breakfast|lunch|dinner|prayer|namaz)\b/.test(text) ? "wellbeing"
    : /\b(essay|application|apply|sop|statement|recommendation|scholarship|visa|interview|deadline)\b/.test(text) ? "application"
    : /\b(project|portfolio|build|code|coding|research|lab|thesis|assignment)\b/.test(text) ? "project"
    : "study";

  /* Title - strip day, time and command words, keep the activity */
  const GUARD = "\u0001"; // protects the uppercase exam name from the day strip
  let title = raw.replace(/[.,!?]/g, " ").replace(/\bSAT\b/g, GUARD)
    .replace(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tues|tue|weds|wed|thurs|thur|thu|fri|sat)\b/gi, "")
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)?\s*(?:-|–|—|to|till|until)\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, "")
    .replace(/\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, "")
    .replace(/\b\d{1,2}:\d{2}\b/g, "")
    .replace(/\bfor\s+\d+(\.\d+)?\s*(hours?|hrs?|h|minutes?|mins?|m)\b/gi, "")
    .replace(/^\s*(add|schedule|put|create|set|make|move|plan|block)\b/i, "")
    .replace(/\b(on|at|from|to|the|a|an|my|every ?day|everyday|daily|each|please|tomorrow|today|weekend|morning|afternoon|evening|night|noon|around|by)\b/gi, "")
    .replace(/\s+/g, " ").trim();
  if (!title) title = category === "exam" ? "Exam practice" : "Focused study";
  title = title.split(" ").slice(0, 5)
    .map((w) => (/^[A-Z]{2,}$/.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join(" ")
    .replace(new RegExp(GUARD, "g"), "SAT");

  return {
    day,
    start: asClock(startMin),
    end: asClock(endMin),
    title,
    category,
    rationale: "Converted the instruction into an editable schedule block.",
    source: "deterministic-fallback",
    model: "none",
  };
}

function applyRateLimitHeaders(response: Response, limit: Awaited<ReturnType<typeof rateLimit>>): Response {
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
  return response;
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const lang = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "public-action-lab");
  if (!limit.allowed) {
    return applyRateLimitHeaders(
      fail(429, lang === "bn" ? "অ্যাকশন ল্যাবের সীমা পূর্ণ হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।" : "Action Lab limit reached. Please retry in a few minutes."),
      limit,
    );
  }

  const parsed = bodySchema.safeParse(await parseJson(req));
  if (!parsed.success) return fail(400, lang === "bn" ? "অনুরোধের তথ্য সঠিক নয়।" : "Invalid Action Lab request.");
  const body = parsed.data;
  const overrideKey = req.headers.get("x-polaris-gemma-key");

  if (body.kind === "decision") {
    let result = decisionFallback(body, lang);
    if (hasGemmaKey(overrideKey)) {
      const text = await safeGemmaText({
        system: `You are the compact decision engine inside Polaris. ${generationLanguageInstruction(lang)} Return short fields only. Each focus field must be under 14 words. Never promise admission. Gemma 4 is the only generative model used.`,
        contents: `Baseline: SAT ${body.currentScore}, target ${body.targetScore}, ${body.weeklyHours} hours/week, budget BDT ${body.budgetBdt}, country ${body.targetCountry}. Change: ${body.event}. Current planning indicator: 41. Give three terse planning focuses.`,
        responseJsonSchema: decisionOutputSchema,
        temperature: 0.2,
        maxOutputTokens: 650,
        thinkingLevel: "minimal",
        apiKey: overrideKey,
      });
      if (text) {
        try {
          const data = parseObject(text);
          const rawAfter = Number(data.probability_after);
          const normalizedAfter = rawAfter > 0 && rawAfter <= 1 ? rawAfter * 100 : rawAfter;
          const after = Math.max(1, Math.min(99, normalizedAfter || 41));
          result = {
            summary: localize(data.summary, lang),
            probabilityBefore: 41,
            probabilityAfter: after,
            risk: ["lower", "steady", "higher"].includes(String(data.risk)) ? String(data.risk) as DecisionResult["risk"] : "steady",
            changes: decisionChanges(body, [1, 2, 3].map((n) => localize(data[`focus${n}`], lang)), lang),
            nextAction: localize(data.next_action, lang),
            evidenceToCollect: localize(data.evidence_to_collect, lang),
            source: "gemma4",
            model: getGemmaModelId(),
          };
        } catch {
          // Keep the deterministic result if Gemma returns malformed JSON.
        }
      }
    }
    return applyRateLimitHeaders(Response.json(result), limit);
  }

  if (body.kind === "evidence") {
    let result = evidenceFallback(body, lang);
    if (hasGemmaKey(overrideKey)) {
      const text = await safeGemmaText({
        system: `You are the evidence auditor inside Polaris. ${generationLanguageInstruction(lang)} Return short fields only. Do not mark an unsupported claim as verified. Gemma 4 is the only generative model used.`,
        contents: `Claim: ${body.claim}\nProof type: ${body.proofType}\nProof detail: ${body.proofDetail || "Not supplied"}`,
        responseJsonSchema: evidenceOutputSchema,
        temperature: 0.15,
        maxOutputTokens: 450,
        thinkingLevel: "minimal",
        apiKey: overrideKey,
      });
      if (text) {
        try {
          const data = parseObject(text);
          result = {
            claim: body.claim,
            proof: body.proofDetail || body.proofType,
            verifiedSignal: localize(data.signal, lang),
            gap: localize(data.gap, lang),
            nextAction: localize(data.next_action, lang),
            verification: localize(data.verification, lang),
            source: "gemma4",
            model: getGemmaModelId(),
          };
        } catch {
          // Keep the deterministic result if Gemma returns malformed JSON.
        }
      }
    }
    return applyRateLimitHeaders(Response.json(result), limit);
  }

  if (body.kind === "routine") {
    let result = routineFallback(body);
    if (hasGemmaKey(overrideKey)) {
      const text = await safeGemmaText({
        system: [
          "You convert ONE instruction into ONE new weekly schedule block.",
          "The EXISTING list is background context only - it shows slots that are already taken.",
          "Never copy a day, time, or title from EXISTING. Every field you return must come from the INSTRUCTION.",
          "Use 24-hour HH:MM times. The title must describe the activity in the instruction, under five English words.",
          "If the instruction gives no explicit time, pick one that suits the activity and make the block 60 minutes.",
          "Map vague words like this: morning 08:00, noon 12:00, afternoon 15:00, evening 19:00, night 21:00.",
          "If the instruction gives no day, use Monday.",
          "Gemma 4 is the only generative model used.",
        ].join(" "),
        contents: [
          `INSTRUCTION (this is what you must convert): ${body.instruction}`,
          "",
          "EXISTING BLOCKS (context only - do not copy, do not repeat):",
          body.existing.map((item) => `- ${item.day} ${item.start}-${item.end}: ${item.title}`).join("\n") || "- None",
        ].join("\n"),
        responseJsonSchema: routineOutputSchema,
        temperature: 0.05,
        maxOutputTokens: 300,
        thinkingLevel: "minimal",
        apiKey: overrideKey,
      });
      if (text) {
        try {
          const data = parseObject(text);
          const day = String(data.day);
          const category = String(data.category) as RoutineCategory;
          const start = String(data.start).slice(0, 5);
          const end = String(data.end).slice(0, 5);
          const title = String(data.title).slice(0, 80);

          // Reject a suggestion that just echoes a block the user already has -
          // Gemma does this when the instruction is vague. Fall back to the parser.
          const echoesExisting = body.existing.some(
            (item) => item.day === day && item.start === start && item.end === end,
          );
          const validShape =
            /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(day) &&
            /^(study|exam|project|wellbeing|application)$/.test(category) &&
            /^\d{2}:\d{2}$/.test(start) && /^\d{2}:\d{2}$/.test(end) &&
            start < end && title.trim().length > 0;

          if (validShape && !echoesExisting) {
            result = {
              day,
              start,
              end,
              title,
              category,
              rationale: "Polaris AI converted the request into an editable block.",
              source: "gemma4",
              model: getGemmaModelId(),
            };
          }
        } catch {
          // Keep the deterministic result if Gemma returns malformed JSON.
        }
      }
    }
    return applyRateLimitHeaders(Response.json(result), limit);
  }

  let feedback = body.exam === "SAT"
    ? "Review each missed skill, then complete one untimed set before repeating it under time pressure."
    : "Review the missed skill, record why each distractor was wrong, and repeat a short timed set tomorrow.";
  let source: "gemma4" | "deterministic-fallback" = "deterministic-fallback";
  if (hasGemmaKey(overrideKey)) {
    const generated = await safeGemmaText({
      system: "You are a precise exam coach. Respond in clear English in under 80 words with a three-step prescription. This is unofficial practice. Gemma 4 is the only generative model used.",
      contents: `${body.exam} practice: ${body.score}/${body.total}. Weak skills: ${body.weakSkills.join(", ") || "none"}.`,
      temperature: 0.2,
      maxOutputTokens: 220,
      thinkingLevel: "minimal",
      apiKey: overrideKey,
    });
    if (generated) {
      feedback = generated;
      source = "gemma4";
    }
  }
  return applyRateLimitHeaders(Response.json({ feedback, source, model: source === "gemma4" ? getGemmaModelId() : "none" }), limit);
});
