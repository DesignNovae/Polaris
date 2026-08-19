/**
 * GET /api/integrations - Returns overall integration hub state for signed-in user.
 * 
 * VIVA NOTE: Serves the full list of platform integrations merged with the user's
 * current connection status and imported statistics from MongoDB.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { hubState } from "@/lib/integrations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  // VIVA NOTE: Authenticates user session
  const session = await requireSession();
  
  // VIVA NOTE: Assembles catalog + connection status
  const entries = await hubState(session.id);
  
  return ok({ entries });
});
