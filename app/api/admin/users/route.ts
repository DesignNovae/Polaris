import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { adminUserUpdateSchema } from "@/lib/validation/schemas";
import {
  listUsers,
  setUserRole,
  setUserPlan,
  deleteUserCascade,
} from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  const users = await listUsers();
  return ok({ users });
});

export const PATCH = withErrorHandling(async (req) => {
  await requireRole("admin");
  const { userId, role, plan } = adminUserUpdateSchema.parse(await parseJson(req));
  if (!role && !plan) throw new HttpError(400, "Nothing to update");
  if (role) await setUserRole(userId, role);
  if (plan) await setUserPlan(userId, plan);
  return ok({ ok: true });
});

export const DELETE = withErrorHandling(async (req) => {
  const admin = await requireRole("admin");
  const { userId } = (await parseJson(req)) as { userId?: string };
  if (!userId) throw new HttpError(400, "Missing userId");
  if (userId === admin.id) {
    throw new HttpError(400, "You can't delete your own admin account");
  }
  await deleteUserCascade(userId);
  return ok({ ok: true });
});

