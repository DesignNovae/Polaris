import type { NextRequest } from "next/server";
import { z } from "zod";
import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { generateGemmaText, getGemmaModelId, hasGemmaKey } from "@/lib/llm/gemma";
import { getPublicExamResult, saveExamCoachFeedback } from "@/lib/exams/service";
import type { ExamCoachFeedback } from "@/lib/exams/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };
const outputSchema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    strengths: { type: "array", items: { type: "string" } },
    priorities: { type: "array", items: { type: "string" } },
    nextPractice: { type: "string" },
  },
  required: ["summary", "strengths", "priorities", "nextPractice"],
};
const parsedSchema = z.object({
  summary: z.string().min(10).max(700),
  strengths: z.array(z.string().min(2).max(180)).min(1).max(3),
  priorities: z.array(z.string().min(2).max(180)).min(1).max(3),
  nextPractice: z.string().min(5).max(400),
});

function fallback(result: Awaited<ReturnType<typeof getPublicExamResult>>): ExamCoachFeedback {
  const sorted = [...result.domains].sort((a, b) => b.accuracy - a.accuracy);
  const completed = result.review.filter((item) => item.submittedAnswer?.trim()).length;
  const underMinimum = result.writtenMetrics?.filter((metric) => !metric.metMinimum).map((metric) => metric.label) ?? [];
  return {
    summary: result.total
      ? `You answered ${result.correct} of ${result.total} objective questions correctly and completed ${completed} of ${result.review.length} responses.`
      : `You completed ${completed} of ${result.review.length} production tasks. Use the saved responses for deliberate review.`,
    strengths: sorted[0]
      ? [`${sorted[0].domain}: ${sorted[0].accuracy}% on this form`]
      : ["You completed and preserved a timed response for review."],
    priorities: underMinimum.length
      ? underMinimum.map((label) => `Bring ${label} to its recommended minimum length.`).slice(0, 3)
      : sorted.at(-1)
        ? [`Review ${sorted.at(-1)!.domain}, the lowest-accuracy domain on this form.`]
        : ["Review structure, clarity, language range, and delivery against the task requirements."],
    nextPractice: "Review one weak response, write down the cause of each error, then complete one focused untimed set before another mock.",
    source: "deterministic-fallback",
    model: "none",
  };
}

export const POST = withErrorHandling(async (req: NextRequest, { params }: Context) => {
  const user = await requireSession();
  const { id } = await params;
  const result = await getPublicExamResult(user.id, id);
  if (result.coachFeedback?.source === "gemma-4") return Response.json(result.coachFeedback);
  const apiKey = req.headers.get("x-polaris-gemma-key");
  let feedback = fallback(result);

  if (hasGemmaKey(apiKey)) {
    const evidence = {
      exam: result.exam,
      mode: result.mode,
      objective: { correct: result.correct, total: result.total, accuracy: result.accuracy },
      domains: result.domains,
      routes: result.routes,
      writtenMetrics: result.writtenMetrics,
      responses: result.review.map((item) => ({
        section: item.section,
        domain: item.domain,
        prompt: item.prompt,
        response: item.submittedAnswer,
        correct: item.correct,
      })),
    };
    try {
      const raw = await generateGemmaText({
        system: "You are the post-exam coach in Polaris. Use only the supplied exam evidence. Give concise, specific, actionable feedback. Never claim an official SAT score or IELTS band. Do not invent pronunciation observations when only a transcript is available. Return only the requested JSON.",
        contents: `Analyze this completed unofficial practice exam:\n${JSON.stringify(evidence)}`,
        responseJsonSchema: outputSchema,
        temperature: 0.25,
        maxOutputTokens: 1000,
        thinkingLevel: "minimal",
        apiKey,
      });
      if (raw) {
        const parsed = parsedSchema.safeParse(JSON.parse(raw));
        if (parsed.success) feedback = {
          ...parsed.data,
          source: "gemma-4",
          model: getGemmaModelId(),
        };
      }
    } catch (error) {
      console.warn("[exams] Gemma coaching unavailable; using deterministic feedback:", error instanceof Error ? error.message : String(error));
    }
  }
  if (feedback.source === "gemma-4") {
    return Response.json(await saveExamCoachFeedback(user.id, id, feedback));
  }
  return Response.json(feedback);
});
