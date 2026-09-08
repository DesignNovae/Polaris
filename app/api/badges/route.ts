/**
 * GET /api/badges - the whole catalogue with this student's state against it.
 *
 * Locked badges are returned too, with how far along the student is. A shelf
 * that only shows what you already have motivates nobody; the progress number
 * is the part that pulls.
 *
 * Read-only. Badges are awarded server-side by the action that earns them.
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getBadgeShelf } from "@/lib/badges/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  return ok({ badges: await getBadgeShelf(user.id) });
});
