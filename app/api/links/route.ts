/**
 * GET    /api/links            - list invites for the signed-in student
 * POST   /api/links            - invite a parent / partner
 * PATCH  /api/links?id=<oid>   - change a viewer relationship
 * DELETE /api/links?id=<oid>   - revoke an invite
 *
 * Accepts BOTH the legacy JSON body ({ viewerEmail, relationship }) and the
 * form-encoded body the new (app)/family InviteForm posts ({ email,
 * relationship }). Native form posts are redirected back to /family; API
 * (JSON) callers get JSON. Auth + Zod on every method.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { ObjectId } from "mongodb";
import { requireSession } from "@/lib/authz";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import {
  createLink,
  getLinksForStudent,
  getUserById,
  deleteLink,
  updateLinkRelationship,
} from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InviteSchema = z
  .object({
    email: z.string().email().max(254).optional(),
    viewerEmail: z.string().email().max(254).optional(),
    relationship: z.enum(["parent", "partner"]),
  })
  .refine((v) => !!(v.email || v.viewerEmail), {
    message: "An invitee email is required",
    path: ["email"],
  });

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const links = await getLinksForStudent(user.id);
  return ok({ links });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();

  const ct = req.headers.get("content-type") ?? "";
  const isForm =
    ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data");
  const raw = isForm ? Object.fromEntries(await req.formData()) : await parseJson(req);

  const parsed = InviteSchema.parse(raw);
  const email = (parsed.email ?? parsed.viewerEmail)!.toLowerCase();

  // Self-invite guard.
  const owner = await getUserById(user.id);
  if (owner?.email.toLowerCase() === email) {
    throw new HttpError(400, "You can't invite yourself.");
  }

  const link = await createLink(user.id, user.name ?? undefined, email, parsed.relationship);

  // TODO(email): enqueue the invite email here. The repo has no mail helper
  // yet - add lib/mail/send.ts (Resend/SES/etc.) and send `link.inviteToken`
  // as an /monitor?accept=<token> link. Until then, the student shares the
  // token from the Family page.

  if (isForm) {
    return NextResponse.redirect(new URL("/family", req.url), { status: 303 });
  }
  return ok({ link, inviteToken: link.inviteToken }, 201);
});

export const DELETE = withErrorHandling(async (req) => {
  const user = await requireSession();
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) throw new HttpError(400, "Missing or invalid id");
  await deleteLink(user.id, id);
  return new NextResponse(null, { status: 204 });
});

export const PATCH = withErrorHandling(async (req) => {
  const user = await requireSession();
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !ObjectId.isValid(id)) throw new HttpError(400, "Missing or invalid id");
  const { relationship } = z
    .object({ relationship: z.enum(["parent", "partner"]) })
    .parse(await parseJson(req));
  const updated = await updateLinkRelationship(user.id, id, relationship);
  if (!updated) throw new HttpError(404, "Viewer link not found");
  return ok({ relationship });
});
