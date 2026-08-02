import { createPartFromBase64, GoogleGenAI, ThinkingLevel } from "@google/genai";

/**
 * Competition compliance boundary.
 *
 * Polaris uses Gemma 4 for every generative-AI feature. The Google API is
 * only the hosting surface; these are open-weight Gemma model identifiers.
 * No caller can select a non-Gemma model.
 */
export const GEMMA_MODEL_IDS = [
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
] as const;

export type GemmaModelId = (typeof GEMMA_MODEL_IDS)[number];
export const DEFAULT_GEMMA_MODEL: GemmaModelId = "gemma-4-26b-a4b-it";
export const GEMMA_PROVIDER_ID = "gemma";

export function getGemmaModelId(): GemmaModelId {
  const requested = process.env.GEMMA_MODEL;
  return GEMMA_MODEL_IDS.includes(requested as GemmaModelId)
    ? (requested as GemmaModelId)
    : DEFAULT_GEMMA_MODEL;
}

function getKey(override?: string | null): string | null {
  if (override?.trim()) return override.trim();
  // GEMINI_API_KEY remains a compatibility alias because Google AI Studio
  // issues the credential. It serves Gemma 4 exclusively in Polaris.
  return (
    process.env.GEMMA_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    null
  );
}

export function gemmaClient(override?: string | null): GoogleGenAI | null {
  const apiKey = getKey(override);
  return apiKey ? new GoogleGenAI({ apiKey }) : null;
}

export function hasGemmaKey(override?: string | null): boolean {
  return !!getKey(override);
}

export type GemmaTextRequest = {
  system: string;
  contents: string;
  temperature?: number;
  maxOutputTokens?: number;
  responseJsonSchema?: unknown;
  thinkingLevel?: "minimal" | "high";
  abortSignal?: AbortSignal;
  apiKey?: string | null;
};

/** One audited non-streaming entry point used by roadmap and memory jobs. */
export async function generateGemmaText(
  request: GemmaTextRequest,
): Promise<string | null> {
  const client = gemmaClient(request.apiKey);
  if (!client) return null;

  const response = await client.models.generateContent({
    model: getGemmaModelId(),
    contents: request.contents,
    config: {
      systemInstruction: request.system,
      temperature: request.temperature ?? 0.4,
      maxOutputTokens: request.maxOutputTokens ?? 4096,
      thinkingConfig: {
        thinkingLevel:
          request.thinkingLevel === "minimal"
            ? ThinkingLevel.MINIMAL : ThinkingLevel.HIGH,
        includeThoughts: false,
      },
      ...(request.responseJsonSchema
        ? {
            responseMimeType: "application/json",
            responseJsonSchema: request.responseJsonSchema,
          }
        : {}),
      ...(request.abortSignal ? { abortSignal: request.abortSignal } : {}),
    },
  });

  return response.text?.trim() || null;
}

export type GemmaVisionRequest = {
  system: string;
  prompt: string;
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  maxOutputTokens?: number;
  responseJsonSchema?: unknown;
  abortSignal?: AbortSignal;
  apiKey?: string | null;
};

/** Audited multimodal entry point for Gemma 4 handwriting extraction. */
export async function generateGemmaVisionText(
  request: GemmaVisionRequest,
): Promise<string | null> {
  const client = gemmaClient(request.apiKey);
  if (!client) return null;

  const response = await client.models.generateContent({
    model: getGemmaModelId(),
    contents: [
      createPartFromBase64(request.imageBase64, request.mimeType),
      { text: request.prompt },
    ],
    config: {
      systemInstruction: request.system,
      temperature: 0.1,
      maxOutputTokens: request.maxOutputTokens ?? 4096,
      thinkingConfig: {
        thinkingLevel: ThinkingLevel.MINIMAL,
        includeThoughts: false,
      },
      ...(request.responseJsonSchema
        ? {
            responseMimeType: "application/json",
            responseJsonSchema: request.responseJsonSchema,
          }
        : {}),
      ...(request.abortSignal ? { abortSignal: request.abortSignal } : {}),
    },
  });

  return response.text?.trim() || null;
}
export type RoadmapMilestone = {
  quarter: string;
  category: "Academics" | "Testing" | "Extracurriculars" | "Skills" | "Applications";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  rationale: string;
  metric: string;
};

export type RoadmapResponse = {
  summary: string;
  gaps: string[];
  milestones: RoadmapMilestone[];
};

const STEP_KEYS = ["m1"] as const;
const STEP_FIELDS = ["quarter", "category", "title", "description", "priority", "rationale", "metric"] as const;

/** Flat fields prevent runaway nested-array output on the hosted endpoint. */
const STEP_SCHEMA = {
  type: "object",
  properties: Object.fromEntries(
    STEP_KEYS.flatMap((key) => STEP_FIELDS.map((field) => [key + "_" + field, { type: "string" }])),
  ),
  required: STEP_KEYS.flatMap((key) => STEP_FIELDS.map((field) => key + "_" + field)),
} as const;

function parseFirstJsonObject<T>(text: string): T {
  const start = text.indexOf("{");
  if (start < 0) throw new Error("JSON object missing");
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const char = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) {
      return JSON.parse(text.slice(start, i + 1)) as T;
    }
  }
  throw new Error("Incomplete JSON object");
}

function parseStepBatch(text: string): RoadmapMilestone[] {
  const parsed = parseFirstJsonObject<Record<string, string>>(text);
  return STEP_KEYS.map((key) => {
    const category = parsed[key + "_category"];
    const priority = parsed[key + "_priority"];
    if (!["Academics", "Testing", "Extracurriculars", "Skills", "Applications"].includes(category)) {
      throw new Error("Invalid roadmap category");
    }
    if (!["high", "medium", "low"].includes(priority)) {
      throw new Error("Invalid roadmap priority");
    }
    return {
      quarter: parsed[key + "_quarter"],
      category: category as RoadmapMilestone["category"],
      title: parsed[key + "_title"],
      description: parsed[key + "_description"],
      priority: priority as RoadmapMilestone["priority"],
      rationale: parsed[key + "_rationale"],
      metric: parsed[key + "_metric"],
    };
  });
}

export async function generateRoadmap(
  systemPrompt: string,
  userPrompt: string,
): Promise<RoadmapResponse | null> {
  const stepRules = [
    "Create exactly one milestone for the requested focus.",
    "Keep every field concise and use original wording.",
    "Category must be exactly one of: Academics, Testing, Extracurriculars, Skills, Applications.",
    "Priority must be exactly high, medium, or low.",
    "Description and rationale must each be one short sentence. Metric must be measurable.",
  ].join("\n");
  const stepPrompts = [
    "Months 1-3: the single highest-leverage academic foundation.",
    "Months 1-3: the single highest-leverage testing foundation.",
    "Months 3-6: one realistic research, leadership, or community milestone.",
    "Months 3-6: one shipped-project or durable skill milestone.",
    "Months 6-9: one measurable competitive distinction milestone.",
    "Months 6-12: one testing outcome or balanced university-list milestone.",
    "Months 9-15: one essays, recommendations, or portfolio milestone.",
    "Months 12-18: one scholarship and application-submission milestone.",
  ];

  try {
    // Use the complete retrieved context once for diagnosis. Repeating it in
    // every stage would exceed Gemma's free-tier input-token budget.
    const diagnosisText = await generateGemmaText({
      system: systemPrompt,
      contents: [
        userPrompt.slice(0, 3500),
        "In under 55 words, write one original strategic diagnosis. Return only the diagnosis paragraph.",
      ].join("\n\n"),
      temperature: 0.3,
      maxOutputTokens: 260,
      thinkingLevel: "minimal",
    });
    if (!diagnosisText) return null;
    const diagnosis = diagnosisText.replace(/^\s*#+\s*/, "").trim();

    // A compact evidence prefix + Gemma's diagnosis keeps all eight parallel
    // planning stages well below the hosted free-tier token-per-minute cap.
    const compactContext = [
      userPrompt.slice(0, 2400),
      "GEMMA 4 DIAGNOSIS:",
      diagnosis,
    ].join("\n");
    const settled = await Promise.allSettled(
      stepPrompts.map((focus) => generateGemmaText({
        system: systemPrompt,
        contents: [compactContext, stepRules, focus].join("\n\n"),
        responseJsonSchema: STEP_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 550,
        thinkingLevel: "minimal",
      })),
    );
    const milestones: RoadmapMilestone[] = [];
    const retryIndexes: number[] = [];
    settled.forEach((result, index) => {
      try {
        if (result.status !== "fulfilled" || !result.value) throw new Error("stage missing");
        milestones.push(...parseStepBatch(result.value));
      } catch {
        retryIndexes.push(index);
      }
    });

    // Retry only malformed/limited stages with a tiny context. The public
    // trace still reports any deterministic fills if a retry also fails.
    if (retryIndexes.length) {
      const retried = await Promise.allSettled(
        retryIndexes.map((index) => generateGemmaText({
          system: systemPrompt,
          contents: [diagnosis, stepRules, stepPrompts[index]].join("\n\n"),
          responseJsonSchema: STEP_SCHEMA,
          temperature: 0.25,
          maxOutputTokens: 700,
          thinkingLevel: "minimal",
        })),
      );
      for (const result of retried) {
        try {
          if (result.status === "fulfilled" && result.value) {
            milestones.push(...parseStepBatch(result.value));
          }
        } catch {
          // The caller transparently fills this one deterministic slot.
        }
      }
    }
    if (!diagnosis || milestones.length === 0 || milestones.some((item) => Object.values(item).some((value) => !value))) return null;
    return { summary: diagnosis.slice(0, 700), gaps: [], milestones };
  } catch (error) {
    console.error("[gemma] staged roadmap generation failed", error);
    return null;
  }
}
