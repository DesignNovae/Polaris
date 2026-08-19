/**
 * /api/billing/methods/[id]
 *   PUT    - make this the default method
 *   DELETE - remove the method (default falls to the next newest)
 */

import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { setDefaultPaymentMethod, removePaymentMethod } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PUT = withErrorHandling(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  const done = await setDefaultPaymentMethod(user.id, id);
  if (!done) throw new HttpError(404, "Payment method not found");
  return ok({ default: id });
});

export const DELETE = withErrorHandling(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireSession();
  const { id } = await ctx.params;
  const done = await removePaymentMethod(user.id, id);
  if (!done) throw new HttpError(404, "Payment method not found");
  return ok({ removed: id });
});
