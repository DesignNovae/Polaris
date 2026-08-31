/**
 * GET    /api/deadlines             - list deadlines for the signed-in user
 * POST   /api/deadlines             - create a deadline (user-source)
 * PATCH  /api/deadlines?id=<oid>    - edit a deadline
 * DELETE /api/deadlines?id=<oid>    - delete a deadline
 *
 * All routes require a signed-in user. Zod-validated. The user can only
 * mutate their own rows.
 */

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/authz";
import { withErrorHandling, parseJson, ok, HttpError } from "@/lib/api/respond";
import {
  DeadlineCreateSchema,
  DeadlinePatchSchema,
} from "@/lib/deadlines/schema";
import {
  createDeadline,
  deleteDeadline,
  listDeadlines,
  patchDeadline,
} from "@/lib/deadlines/service";
import { recordStreakActivity } from "@/lib/streak/service";

export const runtime = "nodejs";

export const GET = withErrorHandling(async (req) => {
  const user = await requireSession();
  const url = new URL(req.url);
  const items = await listDeadlines(user.id, {
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });
  return ok({ items });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = DeadlineCreateSchema.parse(await parseJson(req));
  const item = await createDeadline(user.id, body);
  await recordStreakActivity(user.id, "Planned a deadline");
  return ok({ item }, 201);
});

export const PATCH = withErrorHandling(async (req) => {
  const user = await requireSession();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing id");
  const body = DeadlinePatchSchema.parse(await parseJson(req));
  await patchDeadline(user.id, id, body);
  await recordStreakActivity(user.id, "Updated a deadline");
  return new NextResponse(null, { status: 204 });
});

export const DELETE = withErrorHandling(async (req) => {
  const user = await requireSession();
  const id = new URL(req.url).searchParams.get("id");
  if (!id) throw new HttpError(400, "Missing id");
  await deleteDeadline(user.id, id);
  return new NextResponse(null, { status: 204 });
});

