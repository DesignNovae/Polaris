/**
 * GET /api/integrations - the full hub state for the signed-in user:
 * registry definitions merged with per-user connection rows and
 * env-credential availability for OAuth providers.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { hubState } from "@/lib/integrations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const entries = await hubState(session.id);
  return ok({ entries });
});

