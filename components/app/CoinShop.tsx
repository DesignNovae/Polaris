"use client";

/**
 * Coins and the shop.
 *
 * The balance is a struck coin rather than a number with an icon beside it -
 * same reason the achievements are stamps. It flips on its vertical axis when
 * the balance changes, which is the one moment worth animating.
 *
 * The shop deliberately reads as a short list of two things, not a store. Two
 * kinds of item exist and both are argued in lib/coins/catalog: relief from a
 * missed day, and how the student's own record looks to the people they send
 * it to. Anything that touched a gated feature or an outcome would be worth
 * more revenue and much less trust.
 */

import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";
import { Card } from "./ui";
import { PolarisCoin, CoinGlyph } from "./PolarisCoin";

export type ShopItemDto = {
  id: string;
  kind: "freeze" | "accent";
  name: string;
  description: string;
  cost: number;
  repeatable: boolean;
  owned: boolean;
  blocked: string | null;
  accent?: { ink: string; wash: string; label: string };
};

export type WalletDto = {
  balance: number;
  lifetime: number;
  owned: string[];
  activeAccent: string | null;
  purchasedFreezes: number;
  toNextCoin: number;
  shop: ShopItemDto[];
};

export function CoinShop({ initial, demo = false }: { initial: WalletDto; demo?: boolean }) {
  const reduce = useReducedMotion();
  const [wallet, setWallet] = useState<WalletDto>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState<string | null>(null);

  const act = useCallback(
    async (body: Record<string, unknown>, id: string) => {
      if (demo) {
        setError("This is a demo - purchases are disabled here.");
        return;
      }
      setBusy(id);
      setError("");
      try {
        const res = await fetch("/api/coins", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d.error || "That did not go through");
        setWallet(d.wallet ?? d);
        // The top bar shows this balance too, and nothing navigated.
        window.dispatchEvent(new CustomEvent("polaris:progressEarned"));
        setFlash(id);
        window.setTimeout(() => setFlash(null), 1400);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setBusy(null);
      }
    },
    [demo],
  );

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center gap-5">
        <PolarisCoin value={wallet.balance} size={80} />
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-ink">Coins</h3>
          <p className="mt-1 max-w-md text-[12.5px] leading-relaxed text-ink-dim">
            One coin per 25 points, earned automatically. Coins never buy a
            feature you would otherwise pay for, and never buy an achievement
            &mdash; only a missed day back, or how your passport looks.
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-ink-muted">
            {wallet.toNextCoin} points to the next coin &middot; {wallet.lifetime} earned all
            time
          </p>
        </div>
      </div>

      <ul className="mt-6 space-y-2.5">
        {wallet.shop.map((item) => {
          const isFlashing = flash === item.id;
          const disabled = Boolean(item.blocked) || busy !== null;
          return (
            <li key={item.id}>
              <motion.div
                animate={
                  isFlashing && !reduce
                    ? { backgroundColor: ["rgba(91,140,109,0.18)", "rgba(0,0,0,0)"] }
                    : {}
                }
                transition={{ duration: 1.3 }}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-paper-soft px-4 py-3"
              >
                <span
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                  style={{
                    background: item.accent ? item.accent.wash : "rgba(139,94,60,0.10)",
                    color: item.accent ? item.accent.ink : "#8B5E3C",
                  }}
                  aria-hidden
                >
                  {item.kind === "freeze" ? <Snowflake /> : <Swatch />}
                </span>

                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{item.name}</span>
                  <span className="block text-[11.5px] leading-relaxed text-ink-dim">
                    {item.description}
                  </span>
                </span>

                {item.kind === "accent" && item.owned ? (
                  <button
                    type="button"
                    disabled={busy !== null || wallet.activeAccent === item.id}
                    onClick={() => void act({ action: "equip", itemId: item.id }, item.id)}
                    className={cn(
                      "h-8 shrink-0 rounded-full px-3.5 text-[11.5px] font-semibold transition-colors",
                      wallet.activeAccent === item.id
                        ? "bg-aurora-100 text-aurora-700 dark:bg-aurora-400/15 dark:text-aurora-100"
                        : "bg-ink text-paper hover:bg-polaris-700",
                    )}
                  >
                    {wallet.activeAccent === item.id ? "Applied" : "Apply"}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    title={item.blocked ?? undefined}
                    onClick={() => void act({ action: "buy", itemId: item.id }, item.id)}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-semibold transition-colors",
                      disabled
                        ? "cursor-not-allowed bg-paper-deep text-ink-muted dark:bg-white/[0.07]"
                        : "bg-ink text-paper hover:bg-polaris-700",
                    )}
                  >
                    <CoinGlyph />
                    <span className="tabular-nums">{item.cost}</span>
                  </button>
                )}
              </motion.div>
              {item.blocked && (
                <p className="mt-1 pl-[52px] text-[11px] text-ink-muted">{item.blocked}</p>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-[12px] font-medium text-rose-600 dark:text-rose-300">
          {error}
        </p>
      )}
    </Card>
  );
}

function Snowflake() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 2v20M4.2 6.5l15.6 9M19.8 6.5l-15.6 9" />
      <path d="M9 4.2 12 7l3-2.8M9 19.8 12 17l3 2.8" />
    </svg>
  );
}

function Swatch() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H13a2 2 0 0 1 0-4h2a6 6 0 0 0-3-9z" />
      <circle cx="8.5" cy="10.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  );
}
