/**
 * /transactions - payment ledger. Server loads the user's real transaction
 * records; the client renders the overview, filters, and receipt modals.
 */

import { requireSession } from "@/lib/authz";
import { listTransactions } from "@/lib/db/collections";
import { TransactionsClient, type TxDto } from "@/components/app/TransactionsClient";

export const dynamic = "force-dynamic";

export default async function TransactionsPage() {
  const user = await requireSession();
  const rows = await listTransactions(user.id, 200);

  const dto: TxDto[] = rows.map((t) => ({
    id: t._id?.toString() ?? "",
    reference: t.reference,
    method: t.method,
    amount: t.amount,
    currency: t.currency,
    description: t.description,
    status: t.status,
    maskedAccount: t.maskedAccount,
    cardBrand: t.cardBrand,
    failureReason: t.failureReason,
    createdAt: t.createdAt.toISOString(),
  }));

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1000px] mx-auto">
      <header className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Account</div>
        <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
          <span className="grad-text">Transactions</span>
        </h1>
        <p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
          Every payment with its live status, reference id, and printable receipt.
        </p>
      </header>

      <TransactionsClient rows={dto} userName={user.name ?? "Polaris student"} userEmail={user.email ?? ""} />
    </div>
  );
}
