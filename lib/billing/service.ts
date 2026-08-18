/**
 * Billing service - saved payment methods + billing summary.
 *
 * Sandbox-mode storage: we keep only display-safe data (type, label, last4,
 * brand) - never full card numbers or wallet PINs. The shape mirrors what a
 * Stripe/SSLCommerz/bKash-gateway integration would persist, so swapping in
 * a real processor later only changes where tokens come from.
 */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import {
  getUserById, setUserPlan, listTransactions,
  type Plan, type Subscription, type DbTransaction,
} from "@/lib/db/collections";

export type SavedMethodType = "card" | "bkash" | "nagad" | "rocket";

export type DbPaymentMethod = {
  _id?: ObjectId;
  userId: string;
  type: SavedMethodType;
  /** "Visa •••• 4242" / "bKash •••• 7831" */
  label: string;
  last4: string;
  brand?: string;
  isDefault: boolean;
  createdAt: Date;
};

export async function listPaymentMethods(userId: string): Promise<DbPaymentMethod[]> {
  const db = await getDb();
  return db.collection<DbPaymentMethod>("payment_methods")
    .find({ userId }).sort({ isDefault: -1, createdAt: -1 }).toArray();
}

export async function addPaymentMethod(
  userId: string,
  row: { type: SavedMethodType; last4: string; brand?: string },
): Promise<DbPaymentMethod> {
  const db = await getDb();
  const col = db.collection<DbPaymentMethod>("payment_methods");
  const count = await col.countDocuments({ userId });
  const name = row.type === "card"
    ? `${(row.brand ?? "Card")[0].toUpperCase()}${(row.brand ?? "Card").slice(1)}`
    : row.type === "bkash" ? "bKash" : row.type[0].toUpperCase() + row.type.slice(1);
  const doc: DbPaymentMethod = {
    userId,
    type: row.type,
    label: `${name} •••• ${row.last4}`,
    last4: row.last4,
    brand: row.brand,
    isDefault: count === 0,
    createdAt: new Date(),
  };
  // Avoid duplicate saves of the same instrument.
  const dupe = await col.findOne({ userId, type: row.type, last4: row.last4 });
  if (dupe) return dupe;
  const res = await col.insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function setDefaultPaymentMethod(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const col = db.collection<DbPaymentMethod>("payment_methods");
  const target = await col.findOne({ _id: new ObjectId(id), userId });
  if (!target) return false;
  await col.updateMany({ userId }, { $set: { isDefault: false } });
  await col.updateOne({ _id: target._id }, { $set: { isDefault: true } });
  return true;
}

export async function removePaymentMethod(userId: string, id: string): Promise<boolean> {
  if (!ObjectId.isValid(id)) return false;
  const db = await getDb();
  const col = db.collection<DbPaymentMethod>("payment_methods");
  const target = await col.findOne({ _id: new ObjectId(id), userId });
  if (!target) return false;
  await col.deleteOne({ _id: target._id });
  if (target.isDefault) {
    const next = await col.findOne({ userId }, { sort: { createdAt: -1 } });
    if (next) await col.updateOne({ _id: next._id }, { $set: { isDefault: true } });
  }
  return true;
}

/* ─── Subscription state ─── */

export async function cancelSubscription(userId: string): Promise<Subscription | null> {
  const u = await getUserById(userId);
  if (!u?.subscription || u.plan === "free") return null;
  const sub: Subscription = {
    ...u.subscription,
    status: "canceled",
    canceledAt: new Date().toISOString(),
  };
  // Access continues until renewsAt - plan stays; renewal simply won't happen.
  await setUserPlan(userId, u.plan, sub);
  return sub;
}

export async function resumeSubscription(userId: string): Promise<Subscription | null> {
  const u = await getUserById(userId);
  if (!u?.subscription || u.plan === "free") return null;
  const sub: Subscription = { ...u.subscription, status: "active" };
  delete sub.canceledAt;
  await setUserPlan(userId, u.plan, sub);
  return sub;
}

/* ─── Summary ─── */

export type BillingSummary = {
  plan: Plan;
  subscription: Subscription | null;
  lifetimeSpend: Array<{ currency: string; minor: number }>;
  succeededCount: number;
  lastTransaction: { description: string; createdAt: string } | null;
};

export async function billingSummary(userId: string): Promise<BillingSummary> {
  const [u, txs] = await Promise.all([getUserById(userId), listTransactions(userId, 500)]);
  const spend = new Map<string, number>();
  let succeeded = 0;
  let last: DbTransaction | null = null;
  for (const t of txs) {
    if (t.status !== "succeeded") continue;
    succeeded += 1;
    spend.set(t.currency, (spend.get(t.currency) ?? 0) + t.amount);
    if (!last) last = t;
  }
  return {
    plan: u?.plan ?? "free",
    subscription: u?.subscription ?? null,
    lifetimeSpend: [...spend.entries()].map(([currency, minor]) => ({ currency, minor })),
    succeededCount: succeeded,
    lastTransaction: last ? { description: last.description, createdAt: last.createdAt.toISOString() } : null,
  };
}
