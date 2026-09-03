import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getPrefs, setPrefs } from "@/lib/notifications/deadlines";
import { isChannelConfigured, normaliseBdPhone } from "@/lib/notifications/channels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  email: z.boolean().optional(),
  sms: z.boolean().optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  defaultOffsets: z.array(z.number().int().min(0).max(90)).max(6).optional(),
});

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const prefs = await getPrefs(user.id);
  return ok({
    prefs,
    // The UI must be able to say "SMS is not available yet" rather than
    // silently accepting a preference that can never deliver.
    available: {
      email: isChannelConfigured("email"),
      sms: isChannelConfigured("sms"),
    },
  });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = bodySchema.parse(await parseJson(req));

  const patch: Parameters<typeof setPrefs>[1] = {};
  if (body.email !== undefined) patch.email = body.email;
  if (body.sms !== undefined) patch.sms = body.sms;
  if (body.defaultOffsets) {
    // Descending and de-duplicated, so "14, 7, 3, 1" reads as a countdown.
    patch.defaultOffsets = [...new Set(body.defaultOffsets)].sort((a, b) => b - a);
  }
  if (body.phone !== undefined) {
    patch.phone = body.phone ? (normaliseBdPhone(body.phone) ?? undefined) : undefined;
  }

  const prefs = await setPrefs(user.id, patch);
  return ok({ prefs });
});
