import { getDb } from "@/lib/db/mongodb";
import type { GenerationStageName, GenerationStageState } from "./planning-types";

export type RoadmapStageTelemetry = {
  generationId: string;
  userId?: string;
  roadmapId?: string;
  stage: GenerationStageName;
  state: GenerationStageState;
  startedAt?: Date;
  completedAt?: Date;
  latencyMs?: number;
  retryCount?: number;
  model?: string;
  validation?: "valid" | "fallback" | "invalid";
  error?: string;
  durationMs?: number;
  success?: boolean;
  tokensIn?: number;
  tokensOut?: number;
};

/**
 * Telemetry is deliberately best-effort. A metrics outage must never make a
 * roadmap unavailable, and the stored record contains no prompt or profile
 * contents.
 */
export async function recordRoadmapStage(event: RoadmapStageTelemetry): Promise<void> {
  try {
    const db = await getDb();
    await db.collection("roadmap_generation_events").insertOne({
      ...event,
      durationMs: event.durationMs ?? event.latencyMs,
      success: event.success ?? event.state === "complete",
      createdAt: new Date(),
    });
  } catch {
    // Observability must not become a product dependency.
  }
}
