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

/**
 * Profile fields only. Passwords, email changes and MFA are Clerk's - the app
 * no longer stores a credential to change, so those flows live in Clerk's own
 * account UI rather than being proxied through here.
 */
export const PATCH = withErrorHandling(async (req) => {
  const session = await requireSession();
  const { name, phone, avatarUrl } = accountUpdateSchema.parse(
    await parseJson(req),
  );

  const fields: { name?: string; phone?: string; avatarUrl?: string } = {};
  if (name !== undefined) fields.name = name;
  if (phone !== undefined) fields.phone = phone;
  if (avatarUrl !== undefined) fields.avatarUrl = avatarUrl; // "" clears it

  if (Object.keys(fields).length === 0) {
    throw new HttpError(400, "Nothing to update");
  }

  await updateUser(session.id, fields);
  return ok({ ok: true });
});
