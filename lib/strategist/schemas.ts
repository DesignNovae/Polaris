import { z } from "zod";

export const StrategistRequestSchema = z.object({
  threadId: z.string().min(1).max(64).optional(),
  pathId: z.string().min(1).max(64).optional(),
  message: z.string().min(1).max(4000),
  tools: z.object({
    replanRoadmap: z.boolean().default(true),
    searchKb: z.boolean().default(true),
    fetchUrl: z.boolean().default(false),
  }).optional(),
  mode: z.enum(["general", "research", "study", "coding"]).default("general"),
  routeMode: z.enum(["fast", "balanced", "advanced", "reasoning"]).optional(),
  model: z.object({
    providerId: z.string().min(1).max(40),
    modelId: z.string().min(1).max(120),
  }).optional(),
  autoSelect: z.boolean().optional(),
  offline: z.boolean().optional(),
  allowPaid: z.boolean().optional(),
  roadmapContext: z.object({
    selectedNodeId: z.string().max(80).optional(),
    recentEvents: z.array(z.string().max(220)).max(10).optional(),
  }).optional(),
});

export type StrategistRequest = z.infer<typeof StrategistRequestSchema>;

export const ChunkSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), delta: z.string() }),
  z.object({
    kind: z.literal("source"),
    label: z.string(),
    uri: z.string(),
    source: z.enum(["kb", "case", "web", "profile", "roadmap"]),
  }),
  z.object({
    kind: z.literal("tool"),
    name: z.string(),
    status: z.enum(["start", "done", "error"]),
    result: z.unknown().optional(),
  }),
  z.object({
    kind: z.literal("done"),
    messageId: z.string(),
    tokensIn: z.number().nonnegative(),
    tokensOut: z.number().nonnegative(),
  }),
  z.object({
    kind: z.literal("verification"),
    /** Figures in the answer that appear nowhere in what the model was given. */
    figures: z.array(z.string()),
    message: z.string(),
  }),
  z.object({ kind: z.literal("error"), message: z.string(), code: z.string().optional() }),
]);

export type StrategistChunk = z.infer<typeof ChunkSchema>;
