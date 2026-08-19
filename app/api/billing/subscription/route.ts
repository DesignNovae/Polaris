/** POST /api/billing/subscription - { action: "cancel" | "resume" }. */

import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { cancelSubscription, resumeSubscription } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({ action: z.enum(["cancel", "resume"]) });

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const { action } = schema.parse(await parseJson(req));
  const sub = action === "cancel"
    ? await cancelSubscription(user.id)
    : await resumeSubscription(user.id);
  if (!sub) throw new HttpError(409, "No active paid subscription to modify");
  return ok({ subscription: sub });
});
