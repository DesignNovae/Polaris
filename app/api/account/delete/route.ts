/**
 * DELETE /api/account/delete - permanently delete the signed-in user and
 * all associated data (profile, roadmaps, links). Auth-guarded; a user can
 * only delete their own account. Wraps the existing deleteUserCascade().
 */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { deleteUserCascade } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const DELETE = withErrorHandling(async () => {
  const session = await requireSession();
  await deleteUserCascade(session.id);
  return ok({ ok: true });
});

