import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { studentProfileSchema } from "@/lib/validation/schemas";
import { upsertProfile, getProfile } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const profile = await getProfile(user.id);
  return ok({ profile });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = (await parseJson(req)) as { profile?: unknown };
  const profile = studentProfileSchema.parse(body.profile);
  await upsertProfile(user.id, profile);
  return ok({ ok: true });
});
