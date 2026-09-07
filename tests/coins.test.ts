import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SHOP,
  SHOP_BY_ID,
  POINTS_PER_COIN,
  MAX_PURCHASED_FREEZE_TOTAL,
  DEFAULT_ACCENT,
  accentFor,
  coinsForPoints,
  purchaseBlocker,
} from "@/lib/coins/catalog";
import { DAILY_CAP } from "@/lib/xp/rules";

/**
 * The economy's failure modes are commercial, not arithmetic: a shop that
 * cannibalises the paid plan, or a currency that buys something a reader of
 * the passport would mistake for evidence. Those get tested first.
 */

test("nothing in the shop buys a gated feature", () => {
  // Coins must never substitute for Pro, or the plan becomes optional and the
  // revenue that funds the product goes with it.
  const gated = /strategist|unlimited|pro\b|elite|model|credit|token|deep.dive|consultant|priority/i;
  for (const item of SHOP) {
    assert.ok(!gated.test(item.name), `${item.id} name touches a paid feature: "${item.name}"`);
    assert.ok(
      !gated.test(item.description),
      `${item.id} description touches a paid feature: "${item.description}"`,
    );
  }
});

test("nothing in the shop buys an outcome or an achievement", () => {
  const outcome = /badge|achievement|attest|verified|score|percentile|chance|odds|admission|rank/i;
  for (const item of SHOP) {
    assert.ok(!outcome.test(item.name), `${item.id} sells credibility: "${item.name}"`);
  }
  assert.deepEqual(
    [...new Set(SHOP.map((i) => i.kind))].sort(),
    ["accent", "freeze"],
    "a new kind of purchasable thing appeared - check it against both rules above",
  );
});

test("every shop item costs something and is uniquely identified", () => {
  const ids = SHOP.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(SHOP_BY_ID.size, SHOP.length);
  for (const item of SHOP) {
    assert.ok(item.cost > 0, `${item.id} is free`);
    assert.ok(item.description.length > 20, `${item.id} does not say what you get`);
  }
});

/* ── Earning ── */

test("coins are earned per whole block of points, never fractionally", () => {
  assert.equal(coinsForPoints(0), 0);
  assert.equal(coinsForPoints(POINTS_PER_COIN - 1), 0);
  assert.equal(coinsForPoints(POINTS_PER_COIN), 1);
  assert.equal(coinsForPoints(POINTS_PER_COIN * 4 + 3), 4);
  assert.equal(coinsForPoints(-500), 0, "a negative total cannot mint coins");
});

test("the earn rate keeps the cheapest item meaningfully out of reach", () => {
  // If a full day of effort bought a freeze, the freeze would stop meaning
  // anything and the streak would stop meaning anything with it.
  const perFullDay = coinsForPoints(DAILY_CAP);
  const cheapest = Math.min(...SHOP.map((i) => i.cost));
  const daysToCheapest = cheapest / perFullDay;
  assert.ok(
    daysToCheapest >= 4,
    `${perFullDay} coins per capped day buys the cheapest item in ${daysToCheapest} days - too fast`,
  );
});

/* ── Spending guards ── */

const base = { balance: 1000, owned: [] as string[], heldFreezes: 0 };

test("a purchase is refused when the balance will not cover it", () => {
  const item = SHOP_BY_ID.get("freeze")!;
  const blocked = purchaseBlocker(item, { ...base, balance: item.cost - 1 });
  assert.match(blocked ?? "", /more coins/);
  assert.equal(purchaseBlocker(item, { ...base, balance: item.cost }), null, "exact balance is enough");
});

test("a one-time item cannot be bought twice", () => {
  const accent = SHOP.find((i) => !i.repeatable)!;
  assert.equal(purchaseBlocker(accent, base), null);
  assert.match(
    purchaseBlocker(accent, { ...base, owned: [accent.id] }) ?? "",
    /already own/,
  );
});

test("a permanent reason beats a temporary one in the message", () => {
  // Owning something and being short of coins are both true; the student needs
  // to be told the one that will not change by tomorrow.
  const accent = SHOP.find((i) => !i.repeatable)!;
  assert.match(
    purchaseBlocker(accent, { balance: 0, owned: [accent.id], heldFreezes: 0 }) ?? "",
    /already own/,
    "an owned item must not report as unaffordable",
  );
  const freeze = SHOP_BY_ID.get("freeze")!;
  assert.match(
    purchaseBlocker(freeze, { balance: 0, owned: [], heldFreezes: MAX_PURCHASED_FREEZE_TOTAL }) ?? "",
    /at once/,
    "being at the freeze cap must not report as unaffordable",
  );
});

test("a repeatable item stays buyable after it is bought", () => {
  const freeze = SHOP_BY_ID.get("freeze")!;
  assert.equal(purchaseBlocker(freeze, { ...base, owned: ["freeze"] }), null);
});

test("freezes are capped even when the student can afford more", () => {
  // Stockpiling freezes would turn "studied on 30 consecutive days" into a
  // claim Polaris cannot honestly make.
  const freeze = SHOP_BY_ID.get("freeze")!;
  assert.equal(purchaseBlocker(freeze, { ...base, heldFreezes: MAX_PURCHASED_FREEZE_TOTAL - 1 }), null);
  assert.match(
    purchaseBlocker(freeze, { ...base, heldFreezes: MAX_PURCHASED_FREEZE_TOTAL }) ?? "",
    /at once/,
  );
  assert.match(
    purchaseBlocker(freeze, { ...base, heldFreezes: 99 }) ?? "",
    /at once/,
  );
});

test("the cap is low enough that a streak still means consecutive days", () => {
  assert.ok(
    MAX_PURCHASED_FREEZE_TOTAL <= 4,
    "more than four banked freezes and a 30-day streak stops describing 30 days",
  );
});

/* ── Accents ── */

test("an unknown or absent accent falls back to the default", () => {
  assert.deepEqual(accentFor(null), DEFAULT_ACCENT);
  assert.deepEqual(accentFor(undefined), DEFAULT_ACCENT);
  assert.deepEqual(accentFor("accent-does-not-exist"), DEFAULT_ACCENT);
});

test("every accent item actually carries a colour", () => {
  for (const item of SHOP.filter((i) => i.kind === "accent")) {
    assert.ok(item.accent, `${item.id} is an accent with no colour`);
    assert.match(item.accent!.ink, /^#[0-9a-f]{6}$/i, `${item.id} ink is not a hex colour`);
    assert.ok(item.accent!.label.length > 0);
    const resolved = accentFor(item.id);
    assert.equal(resolved.ink, item.accent!.ink, `${item.id} does not resolve to its own colour`);
  }
});
