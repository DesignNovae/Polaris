/**
 * GET /api/usage?days=30
 *
 * Returns the signed-in student's LLM usage summary for the last N days:
 *   • totals (calls, tokensIn, tokensOut)
 *   • by provider/model (calls, tokens, avg latency, errors)
 *   • last 25 calls
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getUsageSummary } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const session = await requireSession();
  const url = new URL(req.url);
  const daysRaw = url.searchParams.get("days");
  const days = Math.max(
    1,
    Math.min(180, daysRaw ? parseInt(daysRaw, 10) || 30 : 30),
  );
  const summary = await getUsageSummary(session.id, days);
  return ok({ days, ...summary });
});

