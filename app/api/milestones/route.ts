import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { milestonePatchSchema } from "@/lib/validation/schemas";
import { updateMilestoneStatus, setMilestoneDeadline } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const PATCH = withErrorHandling(async (req) => {
  // Milestone tracking is part of the Free plan (matches the catalog).
  const user = await requireSession();
  const { milestoneId, status, deadline } = milestonePatchSchema.parse(
    await parseJson(req),
  );

  if (status) {
    await updateMilestoneStatus(user.id, milestoneId, status);
  }
  if (deadline !== undefined) {
    await setMilestoneDeadline(user.id, milestoneId, deadline);
  }

  return ok({ ok: true });
});

