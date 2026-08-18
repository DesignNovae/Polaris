/** GET /api/billing - plan, subscription state, saved methods, lifetime spend. */

import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { billingSummary, listPaymentMethods } from "@/lib/billing/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const [summary, methods] = await Promise.all([
    billingSummary(user.id),
    listPaymentMethods(user.id),
  ]);
  return ok({
    ...summary,
    paymentMethods: methods.map((m) => ({
      id: m._id?.toString(),
      type: m.type,
      label: m.label,
      last4: m.last4,
      brand: m.brand,
      isDefault: m.isDefault,
    })),
  });
});
