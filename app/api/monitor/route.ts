import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  acceptMonitorInvite,
  getMonitorConnectionsForViewer,
  getMonitorInviteByToken,
} from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (token) {
    const invite = await getMonitorInviteByToken(token);
    if (!invite) {
      throw new HttpError(404, "Invite not found");
    }

    if (invite.expiresAt < new Date()) {
      throw new HttpError(410, "This invite has expired");
    }

    return ok({
      invite: {
        email: invite.email,
        role: invite.role,
        studentName: invite.studentName,
        createdAt: invite.createdAt.toISOString(),
        expiresAt: invite.expiresAt.toISOString(),
        acceptedAt: invite.acceptedAt?.toISOString() ?? null,
        acceptedEmail: invite.acceptedEmail ?? null,
      },
    });
  }

  const session = await requireSession();
  if (session.role !== "parent" && session.role !== "partner") {
    throw new HttpError(403, "Only parents or partners can view the monitor dashboard");
  }

  const connections = await getMonitorConnectionsForViewer(session.id);
  return ok({
    connections: connections.map((invite) => ({
      studentName: invite.studentName,
      studentId: invite.studentId,
      role: invite.role,
      acceptedAt: invite.acceptedAt?.toISOString() ?? null,
      acceptedEmail: invite.acceptedEmail ?? null,
    })),
  });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  if (session.role !== "parent" && session.role !== "partner") {
    throw new HttpError(403, "Only invited parents or partners can accept this invite");
  }

  const body = (await parseJson(req)) as { token?: string };
  if (!body.token || typeof body.token !== "string") {
    throw new HttpError(400, "Missing invite token");
  }

  const invite = await getMonitorInviteByToken(body.token);
  if (!invite) {
    throw new HttpError(404, "Invite not found");
  }

  if (invite.expiresAt < new Date()) {
    throw new HttpError(410, "This invite has expired");
  }

  const userEmail = session.email?.toLowerCase();
  if (!userEmail || userEmail !== invite.email.toLowerCase()) {
    throw new HttpError(403, "Please sign in with the email address this invite was sent to");
  }

  if (invite.acceptedAt) {
    if (invite.acceptedEmail?.toLowerCase() !== userEmail) {
      throw new HttpError(403, "This invite has already been accepted by another account");
    }
    return ok({ accepted: true, invite: { acceptedAt: invite.acceptedAt.toISOString() } });
  }

  const accepted = await acceptMonitorInvite(body.token, session.id, userEmail);
  if (!accepted) {
    throw new HttpError(500, "Failed to accept invite");
  }

  return ok({ accepted: true, invite: { acceptedAt: accepted.acceptedAt?.toISOString() ?? new Date().toISOString() } });
});
