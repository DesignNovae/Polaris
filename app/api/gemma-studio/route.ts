import type { NextRequest } from "next/server";
import { z } from "zod";
import { generateGemmaText, generateGemmaVisionText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { LEARNING_VIDEOS } from "@/lib/action-lab/data";
import { searchDocs } from "@/lib/rag/search";
import { rateLimit, rateLimitHeaders } from "@/lib/ratelimit";
import { fail, parseJson, withErrorHandling } from "@/lib/api/respond";
import {
  finalizeGeneratedLanguage,
  generationLanguageInstruction,
  requestLanguage,
} from "@/lib/i18n/server";
import {
  hasDegenerateRepetition,
  hasUniqueChoices,
  stabilizeGeneratedText,
} from "@/lib/gemma/output-quality";
import { saveMockQuestions, saveMockAttempt } from "@/lib/db/collections";
import { requireSession } from "@/lib/authz";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const questionSchema = z.object({
  id: z.string(),
  exam: z.enum(["IELTS", "SAT"]),
  section: z.string(),
  skill: z.string(),
  passage: z.string().optional(),
  prompt: z.string(),
  options: z.array(z.string()).length(4),
  answer: z.number().int().min(0).max(3),
  explanation: z.string(),
  difficulty: z.enum(["Foundation", "Medium", "Advanced"]),
});

const writingTaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  prompt: z.string(),
  requirements: z.array(z.string()).min(2).max(4),
  timeLimitMinutes: z.number().int().min(10).max(60),
  minimumWords: z.number().int().min(100).max(400),
  difficulty: z.enum(["Foundation", "Medium", "Advanced"]),
});

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("exam-generate"),
    exam: z.enum(["IELTS", "SAT"]),
    section: z.string().min(2).max(50),
    difficulty: z.enum(["Foundation", "Medium", "Advanced"]),
    count: z.number().int().min(3).max(8).default(5),
  }),
  z.object({
    kind: z.literal("exam-grade"),
    exam: z.enum(["IELTS", "SAT"]),
    questions: z.array(questionSchema).min(1).max(8),
    answers: z.record(z.string(), z.number().int().min(0).max(3)),
  }),
  z.object({
    kind: z.literal("writing-generate"),
    difficulty: z.enum(["Foundation", "Medium", "Advanced"]),
  }),
  z.object({
    kind: z.literal("writing-grade"),
    task: writingTaskSchema,
    response: z.string().min(20).max(12000),
    elapsedSeconds: z.number().int().min(0).max(7200),
  }),
  z.object({
    kind: z.literal("videos"),
    exam: z.enum(["IELTS", "SAT"]),
    section: z.string().min(2).max(50),
  }),
  z.object({
    kind: z.literal("essay-ocr"),
    imageBase64: z.string().min(100).max(3_800_000),
    mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  }),
  z.object({
    kind: z.literal("essay-translate"),
    text: z.string().min(5).max(12000),
    fromLanguage: z.enum(["bn", "en", "mixed"]),
  }),  z.object({
    kind: z.literal("essay"),
    prompt: z.string().min(2).max(500),
    draft: z.string().min(20).max(12000),
    mode: z.enum(["feedback", "refine", "outline"]),
    notes: z.array(z.string().max(1200)).max(20).default([]),
  }),
  z.object({
    kind: z.literal("note"),
    title: z.string().min(2).max(120),
    content: z.string().min(5).max(5000),
    feedback: z.string().max(4000).optional(),
  }),
  z.object({
    kind: z.literal("discover"),
    surface: z.enum(["universities", "resources", "case-studies"]),
    query: z.string().min(2).max(300),
  }),
]);

type Body = z.infer<typeof bodySchema>;

const QUESTION_FIELDS = ["skill", "passage", "prompt", "o1", "o2", "o3", "o4", "answer", "explanation"] as const;
function questionJson(index: number) {
  return {
    type: "object",
    properties: Object.fromEntries(
      QUESTION_FIELDS.map((field) => [
        `q${index}_${field}`,
        { type: field === "answer" ? "integer" : "string" },
      ]),
    ),
    required: QUESTION_FIELDS.map((field) => `q${index}_${field}`),
  } as const;
}

const ESSAY_OCR_JSON = {
  type: "object",
  properties: {
    detectedLanguage: { type: "string" },
    title: { type: "string" },
    transcription: { type: "string" },
    uncertainText: { type: "string" },
  },
  required: ["detectedLanguage", "title", "transcription", "uncertainText"],
} as const;

const WRITING_TASK_JSON = {
  type: "object",
  properties: {
    title: { type: "string" },
    prompt: { type: "string" },
    requirement1: { type: "string" },
    requirement2: { type: "string" },
    requirement3: { type: "string" },
  },
  required: ["title", "prompt", "requirement1", "requirement2", "requirement3"],
} as const;
const VIDEO_FIELDS = ["reason"] as const;
const VIDEO_JSON = {
  type: "object",
  properties: Object.fromEntries(Array.from({ length: 3 }, (_, i) => i + 1).flatMap((index) => VIDEO_FIELDS.map((field) => [`v${index}_${field}`, { type: "string" }]))),
  required: Array.from({ length: 3 }, (_, i) => i + 1).flatMap((index) => VIDEO_FIELDS.map((field) => `v${index}_${field}`)),
} as const;

const DISCOVERY_FIELDS = ["title", "subtitle", "why", "action", "sourceLabel"] as const;
const DISCOVERY_JSON = {
  type: "object",
  properties: Object.fromEntries(Array.from({ length: 3 }, (_, i) => i + 1).flatMap((index) => DISCOVERY_FIELDS.map((field) => [`d${index}_${field}`, { type: "string" }]))),
  required: Array.from({ length: 3 }, (_, i) => i + 1).flatMap((index) => DISCOVERY_FIELDS.map((field) => `d${index}_${field}`)),
} as const;

function clientId(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || req.headers.get("x-real-ip")
    || "public-gemma-studio";
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

function fallbackWritingTask(difficulty: "Foundation" | "Medium" | "Advanced") {
  const prompts = {
    Foundation: {
      title: "Public spaces and community life",
      prompt: "Some people believe that cities should invest more in public parks and community spaces, while others think this money should be spent on transport and roads. Discuss both views and give your own opinion.",
    },
    Medium: {
      title: "Technology and independent learning",
      prompt: "Online learning tools give students greater control over what and when they study. Some people believe this makes learners more independent, while others think it reduces the guidance they need. Discuss both views and give your own opinion.",
    },
    Advanced: {
      title: "Measuring educational success",
      prompt: "Governments often judge education systems mainly through examination results. To what extent do examination scores provide a fair measure of educational success? Support your answer with reasons and relevant examples.",
    },
  } as const;
  const selected = prompts[difficulty];
  return {
    id: `writing-${difficulty.toLowerCase()}-${Date.now()}`,
    ...selected,
    requirements: [
      "Write at least 250 words.",
      "Present a clear position and support it with relevant reasons or examples.",
      "Use an introduction, logically organised body paragraphs, and a conclusion.",
    ],
    timeLimitMinutes: 40,
    minimumWords: 250,
    difficulty,
  };
}

function flatWritingTask(value: Record<string, unknown> | null, difficulty: "Foundation" | "Medium" | "Advanced") {
  if (!value) return null;
  const title = stabilizeGeneratedText(String(value.title || ""));
  const prompt = stabilizeGeneratedText(String(value.prompt || ""));
  const requirements = [1, 2, 3].map((index) => stabilizeGeneratedText(String(value[`requirement${index}`] || "")));
  if (title.length < 5 || prompt.length < 60 || hasDegenerateRepetition(prompt) || requirements.some((item) => item.length < 8)) return null;
  return {
    id: `writing-gemma-${Date.now()}`,
    title,
    prompt,
    requirements,
    timeLimitMinutes: 40,
    minimumWords: 250,
    difficulty,
  };
}

function fallbackQuestions(exam: "IELTS" | "SAT", section: string, difficulty: "Foundation" | "Medium" | "Advanced") {
  if (exam === "IELTS" && section === "Listening") {
    const items = [
      {
        skill: "Listening for specific information",
        passage: "Good morning. The science workshop begins at nine fifteen in Room 204, not the main hall. Please bring a pencil and your student identification card. Bags can be left beside the reception desk.",
        prompt: "Where will the science workshop take place?",
        options: ["Room 204", "The main hall", "The library", "The reception area"],
        answer: 0,
        explanation: "The speaker corrects the venue and says Room 204.",
      },
      {
        skill: "Listening for times and changes",
        passage: "The campus tour was planned for Tuesday afternoon, but the guide is unavailable. It will now leave the student centre at ten thirty on Wednesday morning. Please arrive ten minutes early.",
        prompt: "When will the campus tour leave?",
        options: ["Tuesday at 10:30", "Wednesday at 10:20", "Wednesday at 10:30", "Wednesday afternoon"],
        answer: 2,
        explanation: "The changed departure is Wednesday at 10:30.",
      },
      {
        skill: "Listening for purpose",
        passage: "Students using the media room must reserve a computer online. Headphones are available at the help desk, but you should bring your own storage device if you want to save your work.",
        prompt: "Why should students bring a storage device?",
        options: ["To reserve a computer", "To save their work", "To borrow headphones", "To enter the media room"],
        answer: 1,
        explanation: "The storage device is needed to save completed work.",
      },
    ];
    return items.map((item, index) => ({
      id: `preview-ielts-listening-${index + 1}`,
      exam,
      section,
      ...item,
      difficulty,
    }));
  }
  const math = exam === "SAT" && section === "Math";
  const readingPrompts = [
    "Which conclusion is best supported by the passage?",
    "What was held constant in the comparison?",
    "Which result did the spaced plan produce?",
  ];
  const readingOptions = [
    ["Study time never matters", "Spacing can support longer recall", "All students learn identically", "Tests should be removed"],
    ["Total study time", "Student age", "Classroom size", "Exam difficulty"],
    ["Stronger recall after one month", "Less total study time", "Identical immediate scores", "No measurable difference"],
  ];
  const readingAnswers = [1, 0, 0];
  return Array.from({ length: 3 }, (_, index) => ({
    id: `preview-${exam.toLowerCase()}-${section.toLowerCase().replace(/\W+/g, "-")}-${index + 1}`,
    exam,
    section,
    skill: math ? "Problem solving" : "Evidence and meaning",
    passage: math ? undefined : `Practice passage ${index + 1}: A student team compared two study plans using the same total study time. The spaced plan produced stronger recall after one month.`,
    prompt: math ? `If ${index + 2}x + ${index + 4} = ${(index + 2) * 5 + index + 4}, what is x?` : readingPrompts[index],
    options: math
      ? ["3", "4", "5", "6"]
      : readingOptions[index],
    answer: math ? 2 : readingAnswers[index],
    explanation: math ? "Subtract the constant, then divide by the coefficient to get x = 5." : "The comparison holds total time constant and finds stronger later recall for spaced study.",
    difficulty,
  }));
}

function flatQuestions(value: Record<string, unknown> | null, exam: "IELTS" | "SAT", section: string, difficulty: "Foundation" | "Medium" | "Advanced") {
  if (!value) return [];
  const seenPrompts = new Set<string>();
  return Array.from({ length: 3 }, (_, i) => i + 1).flatMap((index) => {
    const rawAnswer = Number(value[`q${index}_answer`]);
    const passage = stabilizeGeneratedText(String(value[`q${index}_passage`] || ""));
    const prompt = stabilizeGeneratedText(String(value[`q${index}_prompt`] || ""));
    const options = [1, 2, 3, 4].map((option) => stabilizeGeneratedText(String(value[`q${index}_o${option}`] || "")));
    const explanation = stabilizeGeneratedText(String(value[`q${index}_explanation`] || ""));
    const promptKey = prompt.toLocaleLowerCase().replace(/\W+/g, " ").trim();
    const valid = prompt.length >= 8
      && explanation.length >= 8
      && Number.isInteger(rawAnswer)
      && rawAnswer >= 0
      && rawAnswer <= 3
      && hasUniqueChoices(options)
      && (!passage || !hasDegenerateRepetition(passage))
      && !hasDegenerateRepetition(prompt)
      && !seenPrompts.has(promptKey)
      && (section !== "Listening" || passage.length >= 45);
    if (!valid) return [];
    seenPrompts.add(promptKey);
    return [{
      id: `gemma-${exam.toLowerCase()}-${Date.now()}-${index}`,
      exam,
      section,
      skill: stabilizeGeneratedText(String(value[`q${index}_skill`] || "Core skill")),
      passage: passage || undefined,
      prompt,
      options,
      answer: rawAnswer,
      explanation,
      difficulty,
    }];
  });
}

function flatVideos(value: Record<string, unknown> | null, candidates: typeof LEARNING_VIDEOS) {
  if (!value) return [];
  return candidates.slice(0, 3).flatMap((video, index) => {
    const reason = stabilizeGeneratedText(String(value[`v${index + 1}_reason`] || ""));
    return reason ? [{ ...video, reason }] : [];
  });
}

function flatDiscovery(value: Record<string, unknown> | null) {
  if (!value) return [];
  return Array.from({ length: 3 }, (_, i) => i + 1).map((index) => ({
    title: stabilizeGeneratedText(String(value[`d${index}_title`] || "")),
    subtitle: stabilizeGeneratedText(String(value[`d${index}_subtitle`] || "")),
    why: stabilizeGeneratedText(String(value[`d${index}_why`] || "")),
    action: stabilizeGeneratedText(String(value[`d${index}_action`] || "")),
    sourceLabel: stabilizeGeneratedText(String(value[`d${index}_sourceLabel`] || "")),
  })).filter((item) => item.title && item.why && item.action);
}
async function gemmaJson(
  req: NextRequest,
  system: string,
  contents: string,
  schema: unknown,
  maxOutputTokens = 2600,
): Promise<Record<string, unknown> | null> {
  const apiKey = userKey(req);
  if (!hasGemmaKey(apiKey)) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 18_000);
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
    console.warn("[gemma-studio] structured generation fell back", error instanceof Error ? error.message : "unknown error");
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export const POST = withErrorHandling(async (req: NextRequest) => {
  const lang = requestLanguage(req);
  const limit = await rateLimit(clientId(req), "free", "gemma-studio");
  if (!limit.allowed) {
    const response = fail(429, lang === "bn" ? "অনুরোধের সীমা শেষ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।" : "Request limit reached. Please retry shortly.");
    for (const [key, value] of Object.entries(rateLimitHeaders(limit))) response.headers.set(key, value);
    return response;
  }

  const body = bodySchema.parse(await parseJson(req)) as Body;
  const languageRule = generationLanguageInstruction(lang);
  const apiKey = userKey(req);
  const live = hasGemmaKey(apiKey);

  if (body.kind === "writing-generate") {
    const generated = await gemmaJson(
      req,
      "You create original, unofficial IELTS Academic Writing Task 2 practice prompts. Gemma 4 is the only generative model. The task itself must be entirely in English. It must feel realistic without reproducing an official copyrighted question. Ask for an argument, discussion, problem-solution response, or an opinion. Never include multiple-choice answers. Never repeat a sentence or idea.",
      `Create one ${body.difficulty} IELTS Academic Writing Task 2 prompt. The candidate has 40 minutes and should write at least 250 words. Return a short topic title, one complete exam prompt, and three concise requirements.`,
      WRITING_TASK_JSON,
      950,
    );
    const liveTask = flatWritingTask(generated, body.difficulty);
    return Response.json({
      task: liveTask || fallbackWritingTask(body.difficulty),
      source: liveTask ? "gemma4" : "deterministic-fallback",
      model: liveTask ? getGemmaModelId() : "none",
    });
  }

  if (body.kind === "writing-grade") {
    const wordCount = body.response.trim().split(/\s+/).filter(Boolean).length;
    const generated = live
      ? await generateGemmaText({
          system: `You are a constructive IELTS Academic Writing Task 2 practice examiner. ${languageRule} Gemma 4 is the only generative model. Evaluate only the learner's submitted response against Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. Give a clearly labelled unofficial practice band range, evidence from the response, the two highest-impact corrections, and a short practice task. Do not claim to issue an official IELTS score. Keep quoted examples from the essay in English. Use clean Markdown and stay under 420 words.`,
          contents: `TASK:\n${body.task.prompt}\n\nREQUIREMENTS:\n${body.task.requirements.join("\n")}\n\nTIME USED: ${Math.round(body.elapsedSeconds / 60)} minutes\nWORD COUNT: ${wordCount}\n\nCANDIDATE RESPONSE:\n${body.response}`,
          temperature: 0.25,
          maxOutputTokens: 1500,
          thinkingLevel: "minimal",
          abortSignal: AbortSignal.timeout(30000),
          apiKey,
        }).catch(() => null)
      : null;
    const fallback = lang === "bn"
      ? `### অনানুষ্ঠানিক অনুশীলন মূল্যায়ন\n\nআপনি ${wordCount}টি শব্দ লিখেছেন। Task Response, Coherence and Cohesion, Lexical Resource এবং Grammatical Range and Accuracy অনুযায়ী আরও নির্দিষ্ট প্রতিক্রিয়ার জন্য Gemma API key ব্যবহার করুন। এখন আপনার অবস্থানটি প্রথম অনুচ্ছেদে স্পষ্ট করুন, প্রতিটি মূল ধারণাকে একটি প্রাসঙ্গিক উদাহরণ দিয়ে সমর্থন করুন এবং শেষে নিজের যুক্তির সঙ্গে সামঞ্জস্যপূর্ণ উপসংহার দিন।`
      : `### Unofficial practice review\n\nYou wrote ${wordCount} words. Connect a Gemma API key for detailed evidence across Task Response, Coherence and Cohesion, Lexical Resource, and Grammatical Range and Accuracy. For now, state your position clearly in the introduction, support each main idea with a relevant example, and make the conclusion consistent with your argument.`;
    return Response.json({
      wordCount,
      feedback: finalizeGeneratedLanguage(generated || fallback, lang),
      source: generated ? "gemma4" : "deterministic-fallback",
      model: generated ? getGemmaModelId() : "none",
    });
  }

  if (body.kind === "exam-generate") {
    const sectionRules = body.exam === "IELTS"
      ? "IELTS sections are Listening, Reading, Writing, and Speaking."
      : "Digital SAT sections are Reading and Writing, or Math.";
    const listeningRule = body.exam === "IELTS" && body.section === "Listening"
      ? "For Listening, passage is a natural 55-90 word spoken script for text-to-speech. Use an announcement, conversation, or short monologue with realistic names, times, corrections, and signposting. Never repeat a sentence. The prompt and answer must test information heard in that script."
      : "Keep each reading passage under 55 words.";
    const system = `You create original, unofficial practice questions. ${languageRule} Keep IELTS and SAT names in English. ${sectionRules} ${listeningRule} Never reproduce copyrighted official questions. answer is a zero-based index from 0 to 3. Every option must be meaningfully different; never duplicate or paraphrase the same choice. Never repeat a sentence, clause, or paragraph. All question prompts, passages, options, skill names, and explanations must stay in English because IELTS and SAT are English-language tests. The surrounding interface and later coaching feedback may follow the selected language. Gemma 4 is the only generative model.`;
    const createQuestion = (index: number) => gemmaJson(
      req,
      system,
      `Create question ${index} of a three-question ${body.difficulty} ${body.exam} diagnostic for ${body.section}. Use a distinct skill focus. Fill every q${index}_ field exactly once and close the JSON object. Every option must be unique and under 12 words. Keep the explanation under 22 words.`,
      questionJson(index),
      1400,
    );
    const generatedParts = await Promise.all([1, 2, 3].map((index) => createQuestion(index)));
    const generated = generatedParts.reduce<Record<string, unknown>>(
      (combined, part) => part ? Object.assign(combined, part) : combined,
      {},
    );
    const liveQuestions = flatQuestions(generated, body.exam, body.section, body.difficulty);
    const questions = liveQuestions.length === 3 ? liveQuestions : fallbackQuestions(body.exam, body.section, body.difficulty).slice(0, 3);
    const source = liveQuestions.length === 3 ? "gemma4" : "deterministic-fallback";
    const modelId = source === "gemma4" ? getGemmaModelId() : "none";
    let questionsPersisted = true;
    try {
      await saveMockQuestions(questions.map((q) => ({ ...q, source, model: modelId })));
    } catch (error) {
      questionsPersisted = false;
      console.warn("[gemma-studio] failed to save mock questions", error);
    }
    return Response.json({ questions, source, model: modelId, questionsPersisted });
  }

  if (body.kind === "exam-grade") {
    const session = await requireSession();
    const score = body.questions.filter((item) => body.answers[item.id] === item.answer).length;
    const misses = body.questions
      .filter((item) => body.answers[item.id] !== item.answer)
      .map((item) => `${item.skill}: selected ${body.answers[item.id] ?? "blank"}, correct ${item.answer}. ${item.explanation}`)
      .join("\n");
    const generated = live
      ? await generateGemmaText({
          system: `You are a fast, constructive exam coach. ${languageRule} Keep IELTS, SAT, and official skill names in English. Give: result summary, two diagnosed skill gaps, why the distractors were tempting, and a three-step practice plan. Use clean Markdown and under 220 words. Gemma 4 is the only generative model.`,
          contents: `EXAM: ${body.exam}\nSCORE: ${score}/${body.questions.length}\nMISSED ITEMS:\n${misses || "None"}`,
          temperature: 0.3,
          maxOutputTokens: 850,
          thinkingLevel: "minimal",
          abortSignal: AbortSignal.timeout(30000),
          apiKey,
        }).catch(() => null)
      : null;
    const fallback = lang === "bn"
      ? `আপনার স্কোর ${score}/${body.questions.length}। ভুল প্রশ্নগুলোর skill ও distractor আবার দেখুন, নিজের ভাষায় সঠিক যুক্তি লিখুন, তারপর আগামীকাল একই skill-এর একটি ছোট timed set দিন।`
      : `You scored ${score}/${body.questions.length}. Revisit each missed skill and distractor, explain the correct reasoning in your own words, then repeat a short timed set tomorrow.`;
    const gradeSource = generated ? "gemma4" as const : "deterministic-fallback" as const;
    const gradeModel = generated ? getGemmaModelId() : "none";
    const feedbackText = finalizeGeneratedLanguage(generated || fallback, lang);
    let attemptPersisted = true;
    try {
      await saveMockAttempt({
        userId: session.id,
        exam: body.exam,
        section: body.questions[0]?.section ?? "unknown",
        difficulty: body.questions[0]?.difficulty ?? "Foundation",
        questionIds: body.questions.map((q) => q.id),
        answers: body.answers,
        score,
        total: body.questions.length,
        feedback: feedbackText,
        source: gradeSource,
        model: gradeModel,
      });
    } catch (error) {
      attemptPersisted = false;
      console.warn("[gemma-studio] failed to save mock attempt", error);
    }
    return Response.json({ score, feedback: feedbackText, source: gradeSource, model: gradeModel, attemptPersisted });
  }

  if (body.kind === "videos") {
    const candidates = LEARNING_VIDEOS.filter((video) => video.exam === body.exam && video.topic === body.section);
    if (!candidates.length) return fail(422, lang === "bn" ? "এই বিভাগের জন্য কোনো যাচাই করা ভিডিও নেই।" : "No verified videos are available for this section.");
    const hits = await searchDocs(`${body.exam} ${body.section} official lesson video practice`, null, 8);
    const evidence = hits.map((item, index) => `[${index + 1}] ${item.title}: ${item.text.slice(0, 350)} (${item.source})`).join("\n");
    const catalog = candidates.map((video) => `${video.id} | ${video.title} | ${video.source}`).join("\n");
    const generated = await gemmaJson(
      req,
      `You are a credible learning-content curator. ${languageRule} Use only the verified candidate catalog. Explain why each listed lesson fits the requested exam skill. Gemma 4 is the only generative model.`,
      `Review the first three verified videos for ${body.exam} ${body.section}. Return one concise, specific reason for each in v1_reason, v2_reason, and v3_reason, in the same order as the catalog.\nVERIFIED CATALOG:\n${catalog}\nEVIDENCE:\n${evidence.slice(0, 2200)}`,
      VIDEO_JSON,
      800,
    );
    const liveRecommendations = flatVideos(generated, candidates);
    const recommendations = liveRecommendations.length === 3
      ? liveRecommendations
      : candidates.slice(0, 3).map((video) => ({ ...video, reason: lang === "bn" ? "এই বিভাগের জন্য আগে থেকে যাচাই করা পাঠ।" : "A verified lesson for the selected section." }));
    const source = liveRecommendations.length === 3 ? "gemma4" : "deterministic-fallback";
    return Response.json({ recommendations, source, model: source === "gemma4" ? getGemmaModelId() : "none" });
  }

  if (body.kind === "essay-ocr") {
    if (!live) {
      return fail(503, lang === "bn" ? "হাতের লেখা পড়তে একটি Gemma API key প্রয়োজন।" : "A Gemma API key is required to read handwriting.");
    }
    const generated = await generateGemmaVisionText({
      system: "You are the handwriting transcription layer in Polaris. Gemma 4 is the only generative model. Transcribe the student's essay faithfully. Preserve the original language, paragraph breaks, punctuation, spelling, and wording. Support Bengali, English, and mixed Bengali-English handwriting. Never translate, improve, summarize, or invent missing words. Mark unreadable fragments as [অস্পষ্ট] for Bengali text or [unclear] for English text.",
      prompt: "Read the handwritten essay in this image. Return detectedLanguage as bn, en, or mixed; a short title based only on visible text; the complete verbatim transcription; and a concise uncertainText note listing any unclear fragments. Return only the requested JSON object.",
      imageBase64: body.imageBase64,
      mimeType: body.mimeType,
      responseJsonSchema: ESSAY_OCR_JSON,
      maxOutputTokens: 5000,
      abortSignal: AbortSignal.timeout(50000),
      apiKey,
    }).catch((error) => {
      console.warn("[gemma-studio] handwriting extraction failed", error instanceof Error ? error.message : "unknown error");
      return null;
    });
    if (!generated) {
      return fail(502, lang === "bn" ? "Gemma ছবিটি পড়তে পারেনি। পরিষ্কার আলোতে আবার ছবি তুলুন।" : "Gemma could not read the image. Retake it in clear light and try again.");
    }
    let parsed: Record<string, unknown>;
    try {
      parsed = parseObject(generated);
    } catch {
      return fail(502, lang === "bn" ? "Gemma-এর লেখা সম্পূর্ণ পাওয়া যায়নি। আবার চেষ্টা করুন।" : "Gemma returned an incomplete transcription. Please try again.");
    }
    const transcription = String(parsed.transcription || "").trim();
    if (transcription.length < 5) {
      return fail(422, lang === "bn" ? "ছবিতে পাঠযোগ্য রচনা পাওয়া যায়নি।" : "No readable essay was found in the image.");
    }
    const rawLanguage = String(parsed.detectedLanguage || "").toLowerCase();
    const detectedLanguage = rawLanguage.includes("mix")
      ? "mixed"
      : rawLanguage.includes("bn") || rawLanguage.includes("bangla") || rawLanguage.includes("bengali")
        ? "bn"
        : "en";
    return Response.json({
      text: transcription,
      title: String(parsed.title || (detectedLanguage === "bn" ? "হাতের লেখা রচনা" : "Handwritten essay")),
      detectedLanguage,
      uncertainText: String(parsed.uncertainText || ""),
      source: "gemma4",
      model: getGemmaModelId(),
    });
  }

  if (body.kind === "essay-translate") {
    if (!live) {
      return fail(503, lang === "bn" ? "অনুবাদের জন্য একটি Gemma API key প্রয়োজন।" : "A Gemma API key is required for translation.");
    }
    const generated = await generateGemmaText({
      system: "You are a faithful academic translator. Gemma 4 is the only generative model. Translate the student's Bengali or mixed-language essay into natural English. Preserve meaning, paragraph breaks, names, facts, uncertainty markers, and the student's voice. Do not improve arguments, add achievements, summarize, or remove content. Return only the English translation.",
      contents: `SOURCE LANGUAGE: ${body.fromLanguage}\n\nESSAY:\n${body.text}`,
      temperature: 0.15,
      maxOutputTokens: 5000,
      thinkingLevel: "minimal",
      abortSignal: AbortSignal.timeout(45000),
      apiKey,
    }).catch(() => null);
    if (!generated) {
      return fail(502, lang === "bn" ? "Gemma এখন অনুবাদ সম্পন্ন করতে পারেনি। আবার চেষ্টা করুন।" : "Gemma could not complete the translation. Please try again.");
    }
    return Response.json({ text: generated, source: "gemma4", model: getGemmaModelId() });
  }
  if (body.kind === "essay") {
    const generated = live
      ? await generateGemmaText({
          system: `You are an ethical admissions writing coach. ${languageRule} Preserve the student's voice and facts. Never fabricate achievements. Do not write a deceptive final essay for submission. For feedback, diagnose specificity, structure, reflection, and voice. For refine, return an improved draft followed by a short change log. For outline, return a scene-based outline. Use clean Markdown. Gemma 4 is the only generative model.`,
          contents: `MODE: ${body.mode}\nPROMPT: ${body.prompt}\nLEARNER NOTES:\n${body.notes.join("\n") || "None"}\n\nDRAFT:\n${body.draft}`,
          temperature: 0.35,
          maxOutputTokens: 2600,
          thinkingLevel: "minimal",
          abortSignal: AbortSignal.timeout(30000),
          apiKey,
        }).catch(() => null)
      : null;
    const fallback = lang === "bn"
      ? "Gemma চালু হলে এখানে আপনার কণ্ঠ বজায় রেখে কাঠামো, নির্দিষ্টতা, প্রতিফলন ও ভাষার উপর বিস্তারিত পরামর্শ দেখা যাবে। এখন প্রথম অনুচ্ছেদে একটি নির্দিষ্ট দৃশ্য, আপনার সিদ্ধান্ত এবং শেখার ফল যোগ করুন।"
      : "When Gemma is available, this panel gives detailed feedback on structure, specificity, reflection, and voice. For now, add one concrete scene, the decision you made, and what changed in your thinking.";
    return Response.json({ text: finalizeGeneratedLanguage(generated || fallback, lang), source: generated ? "gemma4" : "deterministic-fallback", model: generated ? getGemmaModelId() : "none" });
  }

  if (body.kind === "note") {
    const generated = live
      ? await generateGemmaText({
          system: `Turn a learner note and optional feedback into a compact reusable knowledge card. ${languageRule} Return: a one-sentence summary, key concepts, and two next actions. Use clean Markdown. Gemma 4 is the only generative model.`,
          contents: `TITLE: ${body.title}\nNOTE:\n${body.content}\n\nFEEDBACK:\n${body.feedback || "None"}`,
          temperature: 0.25,
          maxOutputTokens: 700,
          thinkingLevel: "minimal",
          abortSignal: AbortSignal.timeout(30000),
          apiKey,
        }).catch(() => null)
      : null;
    return Response.json({
      text: finalizeGeneratedLanguage(generated || (lang === "bn" ? "নোটটি সংরক্ষিত হয়েছে। একটি মূল ধারণা, একটি প্রমাণ এবং একটি পরবর্তী কাজ যোগ করলে এটি আরও কার্যকর হবে।" : "Note saved. Add one key idea, one piece of evidence, and one next action to make it more useful."), lang),
      source: generated ? "gemma4" : "deterministic-fallback",
      model: generated ? getGemmaModelId() : "none",
    });
  }

  const hits = await searchDocs(`${body.surface} ${body.query}`, null, 8);
  const evidence = hits.map((item, index) => `[${index + 1}] ${item.title}: ${item.text.slice(0, 550)} (${item.source})`).join("\n");
  const generated = await gemmaJson(
    req,
    `You are the evidence-grounded discovery layer in Polaris. ${languageRule} Never invent rankings, costs, offers, admission rates, or outcomes. Keep official names unchanged. Gemma 4 is the only generative model.`,
    `Return exactly 3 distinct recommendations for ${body.surface}. Fill every d1, d2, and d3 field. Learner query: ${body.query}. Evidence:\n${evidence.slice(0, 3600)}`,
    DISCOVERY_JSON,
    1250,
  );
  const liveItems = flatDiscovery(generated);
  const items = liveItems.length === 3 ? liveItems : hits.slice(0, 4).map((item) => ({
    title: item.title,
    subtitle: body.surface,
    why: lang === "bn" ? "আপনার অনুসন্ধানের সঙ্গে প্রাসঙ্গিক প্রমাণ পাওয়া গেছে।" : "Relevant evidence was found for your search.",
    action: lang === "bn" ? "অফিসিয়াল উৎস যাচাই করে roadmap-এ যোগ করুন।" : "Verify the official source, then add it to your roadmap.",
    sourceLabel: item.source,
  }));
  const source = liveItems.length === 3 ? "gemma4" : "deterministic-fallback";
  return Response.json({ items, source, model: source === "gemma4" ? getGemmaModelId() : "none" });
});
