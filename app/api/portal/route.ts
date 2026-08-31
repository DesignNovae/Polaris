import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getUserById } from "@/lib/db/collections";
import { getCustomerPortalUrl } from "@/lib/payments/lemonsqueezy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async () => {
  const user = await requireSession();
  const full = await getUserById(user.id);
  const subId = full?.subscription?.lsSubscriptionId;
  if (!subId) {
    throw new HttpError(404, "No active subscription to manage");
  }
  const url = await getCustomerPortalUrl(subId);
  return ok({ url });
});

