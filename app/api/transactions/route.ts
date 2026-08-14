/**
 * /api/transactions
 *
 * GET  - list the user's transaction history.
 * POST - create a NEW transaction (status: pending). Body:
 *        { method, amount, currency?, description, maskedAccount?, cardBrand? }
 *
 * Simulated payment: no real money moves. Treat as a fake-money sandbox.
 */

import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { createTransaction, listTransactions, type PaymentMethod } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  method: z.enum(["card", "bkash", "nagad", "rocket"]),
  amount: z.number().int().positive().max(50_000_00), // up to $50k for sanity
  currency: z.string().length(3).optional(),
  description: z.string().min(1).max(200),
  maskedAccount: z.string().max(40).optional(),
  cardBrand: z.string().max(40).optional(),
});

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const rows = await listTransactions(session.id, 100);
  return ok({
    transactions: rows.map((t) => ({
      id: t._id?.toString(),
      reference: t.reference,
      method: t.method,
      amount: t.amount,
      currency: t.currency,
      description: t.description,
      status: t.status,
      maskedAccount: t.maskedAccount,
      cardBrand: t.cardBrand,
      failureReason: t.failureReason,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = createSchema.parse(await parseJson(req));
  const method = body.method as PaymentMethod;
  const isBd = method === "bkash" || method === "nagad" || method === "rocket";
  const tx = await createTransaction({
    userId: session.id,
    method,
    amount: body.amount,
    currency: body.currency ?? (isBd ? "BDT" : "USD"),
    description: body.description,
    maskedAccount: body.maskedAccount,
    cardBrand: body.cardBrand,
  });
  return ok({
    transaction: {
      id: tx._id?.toString(),
      reference: tx.reference,
      method: tx.method,
      amount: tx.amount,
      currency: tx.currency,
      description: tx.description,
      status: tx.status,
      createdAt: tx.createdAt,
    },
  });
});


