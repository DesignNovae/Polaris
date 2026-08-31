import { z } from "zod";
import { requireSession } from "@/lib/authz";
import { getProfile, updateAccountPreferences } from "@/lib/db/collections";
import { ok, parseJson, withErrorHandling } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NotificationsSchema = z.object({
  weeklyDigest: z.boolean(),
  deadlineReminders: z.boolean(),
  strategistInsights: z.boolean(),
  familyDigest: z.boolean(),
});

const PreferencesSchema = z
  .object({
    notifications: NotificationsSchema.optional(),
    hidePartnerOffers: z.boolean().optional(),
  })
  .refine(
    (value) => value.notifications !== undefined || value.hidePartnerOffers !== undefined,
    "At least one preference is required",
  );

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const profile = await getProfile(user.id);
  return ok({ preferences: profile?.preferences ?? {} });
});

export const PATCH = withErrorHandling(async (req) => {
  const user = await requireSession();
  const preferences = PreferencesSchema.parse(await parseJson(req));
  return ok({ preferences: await updateAccountPreferences(user.id, preferences) });
});
