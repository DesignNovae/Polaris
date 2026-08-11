import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { AiPrefSchema, getAiPref, saveAiPref } from "@/lib/llm/prefs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  return ok({ pref: await getAiPref(session.id) });
});

export const PUT = withErrorHandling(async (req) => {
  const session = await requireSession();
  const pref = AiPrefSchema.parse(await parseJson(req));
  await saveAiPref(session.id, pref);
  return ok({ pref });
});
