import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { setUserPlan, type Plan } from "@/lib/db/collections";
import type { BillingCycle, PlanId } from "@/lib/billing/plans";
import { termEnd, type ValidationResult } from "./sslcommerz";

/**
 * Payment orders.
 *
 * The order is written *before* the payer leaves for the gateway, which is what
 * makes the callbacks safe to expose: when SSLCommerz posts back, the amount,
 * plan and cycle are compared against a row we authored, so a tampered form or
 * a replayed callback cannot buy a plan cheaply.
 *
 * `tranId` carries a unique index, and the status transition to "paid" is a
 * conditional update - so the IPN and the browser return URL racing each other
 * (which they routinely do) results in exactly one activation.
 */

export type OrderStatus = "pending" | "paid" | "failed" | "cancelled";

export type PaymentOrder = {
  _id?: ObjectId;
  tranId: string;
  userId: string;
  planId: Exclude<PlanId, "free">;
  cycle: BillingCycle;
  /** Major units, BDT - the amount we quoted and will verify against. */
  amountBdt: number;
  currency: "BDT";
  status: OrderStatus;
  valId?: string;
  bankTranId?: string;
  cardType?: string;
  failureReason?: string;
  createdAt: Date;
  paidAt?: Date;
};

async function orders() {
  const db = await getDb();
  return db.collection<PaymentOrder>("payment_orders");
}

export async function createOrder(input: {
  tranId: string;
  userId: string;
  planId: Exclude<PlanId, "free">;
  cycle: BillingCycle;
  amountBdt: number;
}): Promise<PaymentOrder> {
  const col = await orders();
  const doc: PaymentOrder = {
    ...input,
    currency: "BDT",
    status: "pending",
    createdAt: new Date(),
  };
  const res = await col.insertOne(doc);
  return { ...doc, _id: res.insertedId };
}

export async function getOrder(tranId: string): Promise<PaymentOrder | null> {
  const col = await orders();
  return col.findOne({ tranId });
}

export type SettleOutcome =
  | { outcome: "activated"; order: PaymentOrder; plan: Plan; expiresAt: Date }
  | { outcome: "already-processed"; order: PaymentOrder }
  | { outcome: "rejected"; reason: string; order?: PaymentOrder };

/**
 * Apply a validated payment to the user's plan. Safe to call repeatedly and
 * from both callbacks concurrently.
 */
export async function settleValidatedPayment(
  validation: ValidationResult,
): Promise<SettleOutcome> {
  const col = await orders();
  const order = await col.findOne({ tranId: validation.tranId });

  if (!order) {
    // A transaction id we never issued. Never provision from a callback alone.
    return { outcome: "rejected", reason: "unknown-transaction" };
  }
  if (order.status === "paid") {
    return { outcome: "already-processed", order };
  }
  if (!validation.valid) {
    await col.updateOne(
      { _id: order._id, status: "pending" },
      { $set: { status: "failed", failureReason: validation.status } },
    );
    return { outcome: "rejected", reason: `gateway-status:${validation.status}`, order };
  }
  if (validation.currency !== order.currency) {
    return { outcome: "rejected", reason: "currency-mismatch", order };
  }
  if (Math.abs(validation.amount - order.amountBdt) >= 0.01) {
    // Underpayment or a replayed callback from a cheaper order.
    console.error(
      `[payments] amount mismatch on ${order.tranId}: quoted ${order.amountBdt}, paid ${validation.amount}`,
    );
    return { outcome: "rejected", reason: "amount-mismatch", order };
  }

  // Claim the order. Only the update that actually flips pending -> paid gets
  // to grant the plan; a concurrent caller sees matchedCount 0 and stops.
  const claim = await col.updateOne(
    { _id: order._id, status: "pending" },
    {
      $set: {
        status: "paid",
        valId: validation.valId,
        bankTranId: validation.bankTranId,
        cardType: validation.cardType,
        paidAt: new Date(),
      },
    },
  );
  if (claim.modifiedCount === 0) {
    const current = await col.findOne({ _id: order._id });
    return { outcome: "already-processed", order: current ?? order };
  }

  const expiresAt = termEnd(order.cycle);
  await setUserPlan(order.userId, order.planId, {
    provider: "sslcommerz",
    tranId: order.tranId,
    valId: validation.valId,
    bankTranId: validation.bankTranId,
    status: "active",
    planId: order.planId,
    billingCycle: order.cycle,
    startedAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    renewsAt: expiresAt.toISOString(),
    priceMinor: Math.round(order.amountBdt * 100),
    currency: "BDT",
  });

  return {
    outcome: "activated",
    order: { ...order, status: "paid" },
    plan: order.planId,
    expiresAt,
  };
}

export async function markOrderTerminal(
  tranId: string,
  status: Extract<OrderStatus, "failed" | "cancelled">,
  reason?: string,
): Promise<void> {
  const col = await orders();
  // Never move an already-paid order backwards - a late "cancel" callback
  // after a successful validation must not revoke a paid plan.
  await col.updateOne(
    { tranId, status: "pending" },
    { $set: { status, failureReason: reason } },
  );
}

export async function listOrders(userId: string, limit = 20): Promise<PaymentOrder[]> {
  const col = await orders();
  return col.find({ userId }).sort({ createdAt: -1 }).limit(limit).toArray();
}

/**
 * Record that a gateway event id has been handled.
 * Returns false when it was already recorded, so callers can skip the work.
 */
export async function claimWebhookEvent(eventId: string): Promise<boolean> {
  const db = await getDb();
  try {
    await db
      .collection("webhook_events")
      .insertOne({ eventId, createdAt: new Date() });
    return true;
  } catch {
    return false; // unique index rejected it - already seen
  }
}
