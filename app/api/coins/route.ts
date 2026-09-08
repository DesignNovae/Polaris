/**
 * GET  /api/coins - wallet balance and the shop.
 * POST /api/coins - buy an item, or equip an accent already owned.
 *
 * No endpoint grants coins. They are derived from points, which are earned by
 * the server inside the action that earned them - the same rule the streak and
 * the points themselves follow.
 */

import { z } from "zod";
import { ok, fail, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getWalletView, purchase, setAccent } from "@/lib/coins/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  return ok(await getWalletView(user.id));
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("buy"), itemId: z.string().min(1).max(64) }),
  z.object({ action: z.literal("equip"), itemId: z.string().min(1).max(64).nullable() }),
]);

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  const body = bodySchema.parse(await parseJson(req));

  if (body.action === "equip") {
    const done = await setAccent(user.id, body.itemId);
    if (!done) return fail(400, "You do not own that.");
    return ok(await getWalletView(user.id));
  }

  const result = await purchase(user.id, body.itemId);
  // A refusal is a normal outcome here - not enough coins, already owned, at
  // the freeze cap - so it carries the reason rather than a bare 400.
  if (!result.ok) return fail(400, result.reason);

  return ok({ bought: result.item.id, wallet: await getWalletView(user.id) });
});
