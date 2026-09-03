import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { linkAcceptSchema } from "@/lib/validation/schemas";
import { acceptLink } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  if (!user.email) throw new HttpError(400, "Your account has no email");

  const { token } = linkAcceptSchema.parse(await parseJson(req));
  const accepted = await acceptLink(token, user.id, user.email);
  if (!accepted) {
    throw new HttpError(
      404,
      "Invite not found, already accepted, or not addressed to your email",
    );
  }
  // A viewer's role is deliberately not rewritten here: the same person can be
  // a student and someone else's parent or teacher. The portal is reachable by
  // link instead, which keeps both hats working.
  return ok({ ok: true, redirectTo: "/portal" });
});

