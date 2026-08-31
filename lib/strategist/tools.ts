/**
 * Strategist tool registry. Each tool is a typed declaration the model
 * can request via function-calling. Handlers run server-side, return JSON
 * that we feed back into the next round trip.
 *
 * Tools are deliberately small and orthogonal - composition happens in
 * the model, not here.
 */

import { z } from "zod";
import { searchKb } from "@/lib/rag/search";
import { listMilestones } from "@/lib/tasks/service";
import { getUniversities } from "@/lib/content";
import {
  scoreProbability,
  profileToInputs,
  type UniversityForModel,
} from "@/lib/ml/probability";
import type { StudentProfile } from "@/lib/profile";

// ─── Schemas ────────────────────────────────────────────────────────────────

const SearchKbArgs = z.object({ query: z.string().min(2).max(200) });
const ReadMilestoneArgs = z.object({ milestoneId: z.string().regex(/^[a-z0-9]{6,12}$/) });
const ComputeProbabilityArgs = z.object({ universityId: z.string().regex(/^[a-z0-9-]{2,40}$/) });

export const TOOL_SCHEMAS = {
  search_kb: SearchKbArgs,
  read_milestone: ReadMilestoneArgs,
  compute_probability: ComputeProbabilityArgs,
} as const;

export type ToolName = keyof typeof TOOL_SCHEMAS;

// ─── Tool declarations for Gemma 4 ──────────────────────────────────────────

export const GEMMA_TOOLS = [
  {
    functionDeclarations: [
      {
        name: "search_kb",
        description: "BM25 search over Polaris's curated knowledge base.",
        parameters: {
          type: "object",
          properties: { query: { type: "string", description: "Plain-English question" } },
          required: ["query"],
        },
      },
      {
        name: "read_milestone",
        description: "Fetch the full body of a roadmap milestone by id.",
        parameters: {
          type: "object",
          properties: { milestoneId: { type: "string" } },
          required: ["milestoneId"],
        },
      },
      {
        name: "compute_probability",
        description: "Re-run the probability engine for a specific university id.",
        parameters: {
          type: "object",
          properties: { universityId: { type: "string" } },
          required: ["universityId"],
        },
      },
    ],
  },
] as const;

// ─── Handlers ───────────────────────────────────────────────────────────────

export async function runTool(
  name: ToolName,
  rawArgs: unknown,
  ctx: { userId: string; profile: StudentProfile },
): Promise<unknown> {
  switch (name) {
    case "search_kb": {
      const { query } = SearchKbArgs.parse(rawArgs);
      return await searchKb(query, 6);
    }
    case "read_milestone": {
      const { milestoneId } = ReadMilestoneArgs.parse(rawArgs);
      const ms = await listMilestones(ctx.userId);
      const m = ms.find(x => x.id === milestoneId);
      return m
        ? { id: m.id, title: m.title, description: m.description, metric: m.metric, rationale: m.rationale, status: m.status }
        : { error: "Milestone not found" };
    }
    case "compute_probability": {
      const { universityId } = ComputeProbabilityArgs.parse(rawArgs);
      // Wired to the repo's transparent logistic engine (lib/ml/probability.ts).
      // No demographic features - inputs are GPA / test / EC / research only.
      const universities = (await getUniversities()) as unknown as Array<{
        id: string;
        name?: string;
        tier: UniversityForModel["tier"];
        acceptanceRate: number;
      }>;
      const uni = universities.find((u) => u.id === universityId);
      if (!uni) return { error: "Unknown university id", universityId };

      const inputs = profileToInputs(ctx.profile);
      const result = scoreProbability(inputs, {
        id: uni.id,
        tier: uni.tier,
        acceptanceRate: uni.acceptanceRate,
      });

      return {
        universityId: uni.id,
        name: uni.name ?? uni.id,
        probability: Math.round(result.probability * 1000) / 1000,
        baseline: result.baseline,
        factors: result.factors.map((f) => ({
          name: f.name,
          contribution: Math.round(f.contribution * 1000) / 1000,
        })),
      };
    }
  }
}

