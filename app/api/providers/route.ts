import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { listAvailableProviders } from "@/lib/llm/providers/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await requireSession();
  return ok({ providers: await listAvailableProviders() });
});
