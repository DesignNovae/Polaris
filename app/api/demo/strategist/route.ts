import type { NextRequest } from "next/server";
import { generateGemmaText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { searchDocs } from "@/lib/rag/search";
import { rateLimit, rateLimitHeaders, clientKey } from "@/lib/ratelimit";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import type { Lang } from "@/lib/i18n/strings";
import {
  BN_ERRORS,
  finalizeGeneratedLanguage,
  generationLanguageInstruction,
  requestLanguage,
} from "@/lib/i18n/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DemoStrategistBody = {
  message?: unknown;
  section?: unknown;
  profile?: unknown;
  roadmapSummary?: unknown;
  knowledgeNotes?: unknown;
};

function fallbackReply(message: string, section: string, lang: Lang): string {
  const lower = message.toLowerCase();
  if (lang === "bn") {
    if (lower.includes("week") || lower.includes("next") || lower.includes("সপ্তাহ") || lower.includes("পরবর্তী")) {
      return "এই সপ্তাহে একটি সময়বদ্ধ একাডেমিক ডায়াগনস্টিকের জন্য ৯০ মিনিট রাখুন, একটি প্রধান প্রকল্পের ফলাফল নির্ধারণ করুন এবং একজন সম্ভাব্য মেন্টরকে ইমেইল করুন। শেষে প্রমাণ রাখুন-একটি স্কোর, প্রকাশ্য কাজ বা নিশ্চিত বৈঠক।";
    }
    if (lower.includes("research") || lower.includes("গবেষণা")) {
      return "ছয় সপ্তাহে পরীক্ষা করা যায় এমন একটি ছোট প্রশ্ন দিয়ে শুরু করুন। সাম্প্রতিক পাঁচটি গবেষণাপত্র পড়ুন, এক পাতার প্রস্তাব লিখুন এবং আপনি যে ডেটাসেট, পদ্ধতি ও ফলাফল নিজে পরিচালনা করতে পারবেন তা উল্লেখ করে স্থানীয় শিক্ষকের সঙ্গে যোগাযোগ করুন।";
    }
    if (lower.includes("scholar") || lower.includes("fund") || lower.includes("স্কলার") || lower.includes("অর্থায়ন")) {
      return "এখনই বিশ্ববিদ্যালয় তালিকার সঙ্গে অর্থায়নের পরিকল্পনা যুক্ত করুন। যোগ্যতা, প্রয়োজনীয় প্রবন্ধ, আবেদনের সময়সীমা এবং সহায়তার পর মোট খরচ ট্র্যাক করুন। বাংলাদেশি আবেদনকারীদের জন্য উন্মুক্ত বৃত্তিকে অগ্রাধিকার দিন এবং উচ্চাকাঙ্ক্ষী বিশ্ববিদ্যালয়ের পাশাপাশি আর্থিকভাবে নিরাপদ বিকল্প রাখুন।";
    }
    return `${section} অংশের লক্ষ্যকে একটি কাজ, একটি সময়সীমা এবং একটি পরিমাপযোগ্য সমাপ্তির শর্তে রূপ দিন। সবচেয়ে গুরুত্বপূর্ণ ঘাটতি দিয়ে শুরু করুন এবং নতুন কার্যক্রম যোগ করার আগে ফলাফলের প্রমাণ সংগ্রহ করুন।`;
  }
  if (lower.includes("week") || lower.includes("next")) {
    return "This week, protect one 90-minute block for a timed academic diagnostic, choose one flagship project outcome, and email one potential mentor. Finish with evidence: a score, a public artifact, or a confirmed meeting.";
  }
  if (lower.includes("research")) {
    return "Start with a question small enough to test in six weeks. Read five recent papers, write a one-page proposal, and approach local faculty with the exact dataset, method, and output you can own.";
  }
  if (lower.includes("scholar") || lower.includes("fund")) {
    return "Build funding into the university list now. Track eligibility, required essays, typical windows, and full cost after aid. Prioritize awards open to Bangladeshi applicants and keep financial-safety options beside reach schools.";
  }
  return `For the ${section} area, turn the goal into one action, one deadline, and one measurable finish line. Start with the highest-leverage gap, then collect evidence before adding another activity.`;
}

export const POST = withErrorHandling(async (req) => {
  const language = requestLanguage(req);
  const limit = await rateLimit(clientKey(req), "free", "public-demo");
  if (!limit.allowed) {
    const response = fail(429, language === "bn" ? BN_ERRORS.demoLimit : "Public Strategist limit reached. Please retry in a few minutes.");
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  const body = (await parseJson(req)) as DemoStrategistBody;
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const section = typeof body.section === "string" ? body.section.slice(0, 40) : "roadmap";
  const roadmapSummary = typeof body.roadmapSummary === "string" ? body.roadmapSummary.slice(0, 900) : "";
  const knowledgeNotes = typeof body.knowledgeNotes === "string" ? body.knowledgeNotes.slice(0, 5000) : "";
  if (message.length < 2 || message.length > 1200) {
    return fail(400, language === "bn" ? "বার্তাটি ২ থেকে ১২০০ অক্ষরের মধ্যে হতে হবে।" : "Message must be between 2 and 1200 characters.");
  }

  const hits = await searchDocs(`${section} ${message}`, null, 4);
  const evidence = hits.map((hit, index) => `[${index + 1}] ${hit.title}: ${hit.text.slice(0, 650)}`).join("\n\n");
  let text: string | null = null;
  const overrideKey = req.headers.get("x-polaris-gemma-key");

  if (hasGemmaKey(overrideKey)) {
    text = await generateGemmaText({
      system: `You are Polaris, an academic strategist for ambitious students in Bangladesh. ${generationLanguageInstruction(language)} Give a direct, realistic answer grounded in the supplied evidence. Use clean Markdown with 2-4 short paragraphs or bullets. Use tables only when they make a comparison clearer. For math, use valid LaTeX inside \\(...\\) for inline formulas or \\[...\\] for display formulas, and explain every formula in plain language. Never output raw LaTeX commands without delimiters. Be specific, budget-aware, and measurable. Never promise admission. Gemma 4 is the only generative model in this application.`,
      contents: `CURRENT WORKSPACE: ${section}\nROADMAP CONTEXT: ${roadmapSummary || "Starter demo roadmap"}\nLEARNER KNOWLEDGE NOTES:\n${knowledgeNotes || "None saved"}\n\nEVIDENCE\n${evidence}\n\nSTUDENT QUESTION\n${message}`,
      temperature: 0.35,
      maxOutputTokens: 850,
      thinkingLevel: "minimal",
      apiKey: overrideKey,
    });
  }

  const response = Response.json({
    text: finalizeGeneratedLanguage(
      text || fallbackReply(message, section, language),
      language,
    ),
    sources: hits.map(({ id, title, source }) => ({ id, title, source })),
    trace: {
      source: text ? "gemma4" : "deterministic-fallback",
      model: text ? getGemmaModelId() : "none",
      thinking: text ? "minimal" : "not-applicable",
    },
  });
  for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
  return response;
});
