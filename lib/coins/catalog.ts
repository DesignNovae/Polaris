/**
 * Coins - what they are and what they buy.
 *
 * A currency is a promise that something is worth having. Ship the coin before
 * the shop and you have taught students to collect something worthless, which
 * is harder to recover from than never having shipped it. So the catalogue is
 * defined here first and the wallet exists to serve it.
 *
 * Two hard rules, both about not poisoning the product:
 *
 *   1. Coins never buy what Pro sells. A soft currency that substitutes for
 *      the paid plan cannibalises the revenue that funds the product, and a
 *      student who grinds for a week to get something they could have paid for
 *      has been taught the plan is optional. Nothing here touches Strategist
 *      access, model usage, or any gated feature.
 *
 *   2. Coins never buy an outcome. Not a better predicted chance, not a better
 *      cohort position, not a badge. Anything that a reader of the passport
 *      would take as evidence has to be earned by doing the work, or the
 *      passport is worthless - which would cost far more than a shop is worth.
 *
 * What is left is genuinely valuable and costs nothing to serve: relief from a
 * missed day, and how the student's own record looks to the people they send
 * it to.
 */

/** Points needed per coin. Tuned in `coinsForPoints` below. */
export const POINTS_PER_COIN = 25;

/**
 * Coins earned from a lifetime points total.
 *
 * Derived rather than incremented: the wallet stores how many have already
 * been granted, so re-running this can never double-pay, and a lost award is
 * recovered on the next read instead of vanishing.
 */
export function coinsForPoints(totalPoints: number): number {
  return Math.floor(Math.max(0, totalPoints) / POINTS_PER_COIN);
}

export type ShopKind = "freeze" | "accent";

export type ShopItem = {
  id: string;
  kind: ShopKind;
  name: string;
  /** What the student actually gets, in their terms. */
  description: string;
  cost: number;
  /** Repeatable items can be bought again; one-time ones are owned forever. */
  repeatable: boolean;
  /** Accent items carry the colour they apply to the public passport. */
  accent?: { ink: string; wash: string; label: string };
};

/**
 * Held freezes are capped even with coins.
 *
 * The freeze exists so one bad week does not end a forty-day run. Letting a
 * student stockpile ten of them turns "consecutive days" into a phrase that
 * means nothing, and the badge that reports it into a false claim.
 */
export const MAX_PURCHASED_FREEZE_TOTAL = 4;

export const SHOP: ShopItem[] = [
  {
    id: "freeze",
    kind: "freeze",
    name: "Streak freeze",
    description:
      "Banks one more freeze. A missed day spends it instead of resetting your streak.",
    cost: 30,
    repeatable: true,
  },
  {
    id: "accent-oxblood",
    kind: "accent",
    name: "Oxblood passport",
    description:
      "Changes the accent on your public passport - the page a recommender opens.",
    cost: 60,
    repeatable: false,
    accent: { ink: "#7C2B2B", wash: "rgba(124,43,43,0.08)", label: "Oxblood" },
  },
  {
    id: "accent-verdigris",
    kind: "accent",
    name: "Verdigris passport",
    description:
      "Changes the accent on your public passport - the page a recommender opens.",
    cost: 60,
    repeatable: false,
    accent: { ink: "#2F5E55", wash: "rgba(47,94,85,0.08)", label: "Verdigris" },
  },
  {
    id: "accent-indigo",
    kind: "accent",
    name: "Indigo passport",
    description:
      "Changes the accent on your public passport - the page a recommender opens.",
    cost: 60,
    repeatable: false,
    accent: { ink: "#2E3D6B", wash: "rgba(46,61,107,0.08)", label: "Indigo" },
  },
];

export const SHOP_BY_ID = new Map(SHOP.map((i) => [i.id, i]));

/** The default look, used when nothing has been bought or equipped. */
export const DEFAULT_ACCENT = { ink: "#8B5E3C", wash: "rgba(139,94,60,0.08)", label: "Polaris" };

export function accentFor(itemId: string | null | undefined) {
  if (!itemId) return DEFAULT_ACCENT;
  return SHOP_BY_ID.get(itemId)?.accent ?? DEFAULT_ACCENT;
}

/**
 * Why a purchase cannot go through, or null when it can.
 *
 * Order matters, and it is not the obvious one. The permanent reasons are
 * checked first and affordability last, because affordability is the only one
 * that changes by the hour: a student who already owns an accent and happens
 * to be short on coins should be told they own it, not sent off to earn 44
 * more coins for something they already have.
 */
export function purchaseBlocker(
  item: ShopItem,
  state: { balance: number; owned: string[]; heldFreezes: number },
): string | null {
  if (!item.repeatable && state.owned.includes(item.id)) {
    return "You already own this.";
  }
  if (item.kind === "freeze" && state.heldFreezes >= MAX_PURCHASED_FREEZE_TOTAL) {
    return `You can hold ${MAX_PURCHASED_FREEZE_TOTAL} freezes at once. Spend one before buying another.`;
  }
  if (state.balance < item.cost) {
    return `You need ${item.cost - state.balance} more coins.`;
  }
  return null;
}
