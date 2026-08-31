import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { checkoutSchema } from "@/lib/validation/schemas";
import { requireSession } from "@/lib/authz";
import { createCheckoutUrl } from "@/lib/payments/lemonsqueezy";
import { variantForTier } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const { tier } = checkoutSchema.parse(await parseJson(req));

  const variantId = variantForTier(tier);
  if (!variantId) {
    throw new HttpError(503, "This plan is not available for purchase yet");
  }

  const url = await createCheckoutUrl(user.id, user.email, variantId);
  return ok({ url });
});

