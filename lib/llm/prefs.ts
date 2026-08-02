/**
 * Per-user AI model preference - the server-side source of truth.
 *
 * The picker UI mirrors this to localStorage for instant boot, but the
 * saved document here is what survives devices/sessions and what server
 * jobs (roadmap generation, weekly replans, submission feedback) consult
 * when no explicit pick arrives with the request.
 *
 * Stored in its own `ai_prefs` collection keyed by userId so the users
 * collection stays lean. Never contains API keys - only ids/labels.
 */

import { z } from "zod";
import { getDb } from "@/lib/db/mongodb";
import type { RouteMode } from "./providers/types";

export const AiPrefSchema = z.object({
  /** "auto" = smart routing; otherwise an explicit provider+model pick. */
  choice: z.union([
    z.literal("auto"),
    z.object({
      providerId: z.string().min(1).max(40),
      modelId: z.string().min(1).max(120),
    }),
  ]),
  /** Speed/quality preset. */
  mode: z.enum(["fast", "balanced", "advanced", "reasoning"]),
  allowPaid: z.boolean(),
  offline: z.boolean(),
});

export type AiPreference = z.infer<typeof AiPrefSchema>;

export const DEFAULT_AI_PREF: AiPreference = {
  choice: "auto",
  mode: "balanced",
  allowPaid: false,
  offline: false,
};

type DbAiPref = AiPreference & { userId: string; updatedAt: Date };

export async function getAiPref(userId: string): Promise<AiPreference> {
  try {
    const db = await getDb();
    const row = await db.collection<DbAiPref>("ai_prefs").findOne({ userId });
    if (!row) return DEFAULT_AI_PREF;
    const parsed = AiPrefSchema.safeParse(row);
    return parsed.success ? parsed.data : DEFAULT_AI_PREF;
  } catch {
    return DEFAULT_AI_PREF; // prefs are never worth failing a request over
  }
}

export async function saveAiPref(userId: string, pref: AiPreference): Promise<void> {
  const db = await getDb();
  await db.collection<DbAiPref>("ai_prefs").updateOne(
    { userId },
    { $set: { ...pref, userId, updatedAt: new Date() } },
    { upsert: true },
  );
}

/** Translate a saved preference into router arguments. */
export function prefToRoute(pref: AiPreference): {
  preferred?: { providerId: string; modelId: string };
  autoSelect: boolean;
  mode: RouteMode;
  allowPaid: boolean;
  offline: boolean;
} {
  return {
    preferred: pref.choice === "auto" ? undefined : pref.choice,
    autoSelect: pref.choice === "auto",
    mode: pref.mode,
    allowPaid: pref.allowPaid,
    offline: pref.offline,
  };
}
