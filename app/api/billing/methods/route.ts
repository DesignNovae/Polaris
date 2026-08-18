/**
 * /api/billing/methods
 *   GET  - saved payment methods
 *   POST - save a method { type, last4, brand? } (display-safe data only -
 *          never full numbers; sandbox mirror of a gateway token store)
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { listPaymentMethods, addPaymentMethod } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  type: z.enum(["card", "bkash", "nagad", "rocket"]),
  last4: z.string().regex(/^\d{4}$/),
  brand: z.string().max(20).optional(),
});

const dto = (m: Awaited<ReturnType<typeof listPaymentMethods>>[number]) => ({
  id: m._id?.toString(),
  type: m.type,
  label: m.label,
  last4: m.last4,
  brand: m.brand,
  isDefault: m.isDefault,
});

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const methods = await listPaymentMethods(user.id);
  return ok({ methods: methods.map(dto) });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = schema.parse(await parseJson(req));
  const m = await addPaymentMethod(user.id, body);
  return ok({ method: dto(m) });
});
