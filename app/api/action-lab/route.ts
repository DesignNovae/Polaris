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

function routineFallback(body: z.infer<typeof routineSchema>): RoutineSuggestion {
  const instruction = body.instruction.toLowerCase();
  const timeMatch = instruction.match(/(?:from\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:to|-)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  const dayMatch = instruction.match(/monday|tuesday|wednesday|thursday|friday|saturday|sunday/i);
  const day = dayMatch ? dayMatch[0][0].toUpperCase() + dayMatch[0].slice(1).toLowerCase() : "Monday";
  const to24 = (hour: number, minute: string | undefined, meridiem: string | undefined) => {
    let h = hour;
    if (meridiem?.toLowerCase() === "pm" && h < 12) h += 12;
    if (meridiem?.toLowerCase() === "am" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${minute || "00"}`;
  };
  const start = timeMatch ? to24(Number(timeMatch[1]), timeMatch[2], timeMatch[3]) : "21:00";
  const end = timeMatch ? to24(Number(timeMatch[4]), timeMatch[5], timeMatch[6] || timeMatch[3]) : "22:00";
  const category: RoutineCategory = /sat|ielts|exam|mock|math/.test(instruction) ? "exam" : "study";
  return {
    day,
    start,
    end,
    title: /math/.test(instruction) ? "Math practice" : /ielts/.test(instruction) ? "IELTS practice" : /sat/.test(instruction) ? "SAT practice" : "Focused study",
    category,
    rationale: "Converted the instruction into an editable schedule block.",
    source: "deterministic-fallback",
    model: "none",
  };
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const lang = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "public-action-lab");
  if (!limit.allowed) {
    const response = fail(429, lang === "bn" ? "অ্যাকশন ল্যাবের সীমা পূর্ণ হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।" : "Action Lab limit reached. Please retry in a few minutes.");
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }
  const parsed = bodySchema.safeParse(await parseJson(req));
  if (!parsed.success) return fail(400, lang === "bn" ? "অনুরোধের তথ্য সঠিক নয়।" : "Invalid Action Lab request.");
  const body = parsed.data;
  const overrideKey = req.headers.get("x-polaris-gemma-key");

  if (body.kind === "decision") {
    let result = decisionFallback(body, lang);
    if (hasGemmaKey(overrideKey)) {
      const text = await generateGemmaText({
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
        } catch {}
      }
    }
    const response = Response.json(result);
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  if (body.kind === "evidence") {
    let result = evidenceFallback(body, lang);
    if (hasGemmaKey(overrideKey)) {
      const text = await generateGemmaText({
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
        } catch {}
      }
    }
    const response = Response.json(result);
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  if (body.kind === "routine") {
    let result = routineFallback(body);
    if (hasGemmaKey(overrideKey)) {
      const text = await generateGemmaText({
        system: "Convert one instruction into one weekly schedule block. Use 24-hour HH:MM time. Keep the title under five English words. Gemma 4 is the only generative model used.",
        contents: `Instruction: ${body.instruction}\nExisting:\n${body.existing.map((item) => `${item.day} ${item.start}-${item.end}: ${item.title}`).join("\n") || "None"}`,
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
          if (/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/.test(day) && /^(study|exam|project|wellbeing|application)$/.test(category)) {
            result = {
              day,
              start: String(data.start).slice(0, 5),
              end: String(data.end).slice(0, 5),
              title: String(data.title).slice(0, 80),
              category,
              rationale: "Polaris converted the request into an editable block.",
              source: "gemma4",
              model: getGemmaModelId(),
            };
          }
        } catch {}
      }
    }
    const response = Response.json(result);
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  let feedback = body.exam === "SAT"
    ? "Review each missed skill, then complete one untimed set before repeating it under time pressure."
    : "Review the missed skill, record why each distractor was wrong, and repeat a short timed set tomorrow.";
  let source: "gemma4" | "deterministic-fallback" = "deterministic-fallback";
  if (hasGemmaKey(overrideKey)) {
    const generated = await generateGemmaText({
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
  const response = Response.json({ feedback, source, model: source === "gemma4" ? getGemmaModelId() : "none" });
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
  return response;
});
