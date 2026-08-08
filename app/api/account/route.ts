import bcrypt from "bcryptjs";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { accountUpdateSchema } from "@/lib/validation/schemas";
import { getUserById, updateUser } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const user = await getUserById(session.id);
  if (!user) throw new HttpError(404, "Account not found");
  return ok({
    account: {
      name: user.name,
      email: user.email,
      role: user.role ?? "student",
      plan: user.plan ?? "free",
      phone: user.phone ?? "",
      avatarUrl: user.avatarUrl ?? "",
      createdAt: user.createdAt,
    },
  });
});

export const PATCH = withErrorHandling(async (req) => {
  const session = await requireSession();
  const { name, currentPassword, newPassword, phone, avatarUrl } =
    accountUpdateSchema.parse(await parseJson(req));

  const fields: {
    name?: string;
    password?: string;
    phone?: string;
    avatarUrl?: string;
  } = {};

  if (name !== undefined) fields.name = name;
  if (phone !== undefined) fields.phone = phone;
  if (avatarUrl !== undefined) {
    // empty string clears the avatar
    fields.avatarUrl = avatarUrl;
  }

  if (newPassword) {
    if (!currentPassword) {
      throw new HttpError(400, "Current password is required to set a new one");
    }
    const user = await getUserById(session.id);
    if (!user) throw new HttpError(404, "Account not found");
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new HttpError(403, "Current password is incorrect");
    fields.password = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "Nothing to update");
  }

  await updateUser(session.id, fields);
  return ok({ ok: true });
});
