/**
 * Coins - wallet and purchases.
 *
 * One document per student. Coins are *derived* from lifetime points rather
 * than incremented alongside them: the wallet records how many have already
 * been granted, and a read tops up the difference. That makes granting
 * idempotent by construction - a retried award, a half-landed write, or a
 * double-fired event can never mint a coin twice, and a grant that failed is
 * recovered on the next read instead of being lost.
 *
 * Spending is the opposite problem and gets the opposite treatment: a
 * conditional update that only matches when the balance still covers the cost,
 * so two purchases racing on the last 30 coins cannot both succeed.
 */

import { getDb } from "@/lib/db/mongodb";
import { getXpTotal } from "@/lib/xp/service";
import { getStreak } from "@/lib/streak/service";
import {
  SHOP,
  SHOP_BY_ID,
  accentFor,
  coinsForPoints,
  purchaseBlocker,
  type ShopItem,
} from "./catalog";

export type DbWallet = {
  userId: string;
  /** Spendable coins. */
  balance: number;
  /** Every coin ever granted, for the record. */
  lifetime: number;
  /** Lifetime points already converted, so a top-up never double-pays. */
  grantedThroughPoints: number;
  /** One-time items bought. */
  owned: string[];
  /** The accent currently applied to the public passport. */
  activeAccent: string | null;
  /** Freezes bought with coins, on top of the ones consistency earns. */
  purchasedFreezes: number;
  updatedAt: Date;
};

async function wallets() {
  const db = await getDb();
  return db.collection<DbWallet>("coin_wallets");
}

const EMPTY: Omit<DbWallet, "userId" | "updatedAt"> = {
  balance: 0,
  lifetime: 0,
  grantedThroughPoints: 0,
  owned: [],
  activeAccent: null,
  purchasedFreezes: 0,
};

/**
 * Read the wallet, granting any coins the student's points have earned since
 * last time. Safe to call on every read - that is the point of deriving.
 */
export async function getWallet(userId: string): Promise<DbWallet> {
  const col = await wallets();
  const totalPoints = await getXpTotal(userId);
  const due = coinsForPoints(totalPoints);

  const existing = await col.findOne({ userId });
  const granted = existing?.grantedThroughPoints ?? 0;
  const owed = Math.max(0, due - granted);

  if (!existing) {
    const doc: DbWallet = {
      userId,
      ...EMPTY,
      balance: owed,
      lifetime: owed,
      grantedThroughPoints: due,
      updatedAt: new Date(),
    };
    try {
      await col.insertOne(doc);
      return doc;
    } catch {
      // Unique index rejected a concurrent create - read the winner.
      return (await col.findOne({ userId })) ?? doc;
    }
  }

  if (owed === 0) return existing;

  // Guarded on the value we read, so a concurrent top-up cannot pay twice.
  const res = await col.findOneAndUpdate(
    { userId, grantedThroughPoints: granted },
    {
      $inc: { balance: owed, lifetime: owed },
      $set: { grantedThroughPoints: due, updatedAt: new Date() },
    },
    { returnDocument: "after" },
  );
  return res ?? (await col.findOne({ userId })) ?? { userId, ...EMPTY, updatedAt: new Date() };
}

export type WalletView = {
  balance: number;
  lifetime: number;
  owned: string[];
  activeAccent: string | null;
  purchasedFreezes: number;
  /** Points still to earn before the next coin lands. */
  toNextCoin: number;
  shop: Array<ShopItem & { owned: boolean; blocked: string | null }>;
};

export async function getWalletView(userId: string): Promise<WalletView> {
  const [wallet, totalPoints, streak] = await Promise.all([
    getWallet(userId),
    getXpTotal(userId),
    getStreak(userId),
  ]);

  const heldFreezes = streak.freezes;
  const state = { balance: wallet.balance, owned: wallet.owned, heldFreezes };

  return {
    balance: wallet.balance,
    lifetime: wallet.lifetime,
    owned: wallet.owned,
    activeAccent: wallet.activeAccent,
    purchasedFreezes: wallet.purchasedFreezes,
    toNextCoin: 25 - (totalPoints % 25),
    shop: SHOP.map((item) => ({
      ...item,
      owned: wallet.owned.includes(item.id),
      blocked: purchaseBlocker(item, state),
    })),
  };
}

export type PurchaseOutcome =
  | { ok: true; item: ShopItem; balance: number }
  | { ok: false; reason: string };

/**
 * Buy one item.
 *
 * The debit is a conditional update matching on a balance that still covers
 * the cost, so the last thirty coins cannot be spent twice. The item is only
 * granted after the debit is confirmed to have matched - never before, or a
 * failed debit hands out a free freeze.
 */
export async function purchase(userId: string, itemId: string): Promise<PurchaseOutcome> {
  const item = SHOP_BY_ID.get(itemId);
  if (!item) return { ok: false, reason: "That item does not exist." };

  const [wallet, streak] = await Promise.all([getWallet(userId), getStreak(userId)]);
  const blocked = purchaseBlocker(item, {
    balance: wallet.balance,
    owned: wallet.owned,
    heldFreezes: streak.freezes,
  });
  if (blocked) return { ok: false, reason: blocked };

  const col = await wallets();

  // Everything the purchase changes, applied in the same guarded write.
  const set: Record<string, unknown> = { updatedAt: new Date() };
  const inc: Record<string, number> = { balance: -item.cost };
  const push: Record<string, unknown> = {};

  if (item.kind === "freeze") inc.purchasedFreezes = 1;
  if (!item.repeatable) push.owned = item.id;
  if (item.kind === "accent") set.activeAccent = item.id;

  const res = await col.findOneAndUpdate(
    { userId, balance: { $gte: item.cost } },
    {
      $inc: inc,
      $set: set,
      ...(Object.keys(push).length ? { $addToSet: push } : {}),
    },
    { returnDocument: "after" },
  );

  if (!res) {
    // The guard did not match: someone spent the balance between the check and
    // the write. Correct outcome is to refuse, not to retry into an overdraft.
    return { ok: false, reason: "Your balance changed. Try again." };
  }

  // A bought freeze is only useful once the streak actually holds it.
  if (item.kind === "freeze") {
    const db = await getDb();
    await db
      .collection("streaks")
      .updateOne({ userId }, { $inc: { freezes: 1 }, $set: { updatedAt: new Date() } });
  }

  return { ok: true, item, balance: res.balance };
}

/** Equip an accent the student already owns. */
export async function setAccent(userId: string, itemId: string | null): Promise<boolean> {
  if (itemId !== null) {
    const item = SHOP_BY_ID.get(itemId);
    if (!item || item.kind !== "accent") return false;
    const wallet = await getWallet(userId);
    if (!wallet.owned.includes(itemId)) return false;
  }
  const col = await wallets();
  await col.updateOne(
    { userId },
    { $set: { activeAccent: itemId, updatedAt: new Date() } },
  );
  return true;
}

/** The accent to paint a public passport with. Never throws. */
export async function accentForUser(userId: string) {
  try {
    const col = await wallets();
    const wallet = await col.findOne({ userId });
    return accentFor(wallet?.activeAccent);
  } catch {
    return accentFor(null);
  }
}
