import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { inviteSchema } from "@/lib/validation/schemas";
import {
  createMonitorInvite,
  getMonitorInvitesByStudent,
} from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  if (user.role !== "student") {
    throw new HttpError(403, "Only students can view monitor invites");
  }

  const invites = await getMonitorInvitesByStudent(user.id);
  return ok({
    invites: invites.map((invite) => ({
      token: invite.token,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    })),
  });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  if (user.role !== "student") {
    throw new HttpError(403, "Only students can create monitor invites");
  }

  const body = inviteSchema.parse(await parseJson(req));
  const invite = await createMonitorInvite(user.id, user.name ?? "Student", body.email, body.role);

  return ok({
    invite: {
      token: invite.token,
      email: invite.email,
      role: invite.role,
      createdAt: invite.createdAt.toISOString(),
      expiresAt: invite.expiresAt.toISOString(),
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    },
  });
});
