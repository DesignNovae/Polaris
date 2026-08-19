/**
 * /billing - the subscription console.
 *
 * Server loads the real billing state (plan, subscription record, saved
 * payment methods, lifetime spend from the transaction ledger) and hands it
 * to BillingClient: current-plan hero, monthly/yearly toggle, 3D pricing
 * cards, billing summary, payment-method management, sandbox checkout.
 */

import { requireSession } from "@/lib/authz";
import { billingSummary, listPaymentMethods } from "@/lib/billing/service";
import { BillingClient, type MethodDto, type SubscriptionDto } from "@/components/app/BillingClient";
import type { PlanId } from "@/lib/billing/plans";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await requireSession();
  const [summary, methods] = await Promise.all([
    billingSummary(user.id),
    listPaymentMethods(user.id),
  ]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1080px] mx-auto">
      <header className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Account</div>
        <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
          <span className="grad-text">Billing</span> & plan
        </h1>
        <p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
          Manage your subscription, payment methods, and invoices - Card, bKash, Nagad, and Rocket supported.
        </p>
      </header>

      <BillingClient
        plan={(summary.plan ?? "free") as PlanId}
        subscription={(summary.subscription ?? null) as SubscriptionDto}
        methods={methods.map((m) => ({
          id: m._id?.toString() ?? "",
          type: m.type,
          label: m.label,
          last4: m.last4,
          brand: m.brand,
          isDefault: m.isDefault,
        })) satisfies MethodDto[]}
        lifetimeSpend={summary.lifetimeSpend}
        succeededCount={summary.succeededCount}
      />
    </div>
  );
}
