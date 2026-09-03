"use client";

/**
 * Client island for the (app)/billing page.
 *
 * SSLCommerz has no hosted customer portal to link out to - a plan is a fixed
 * paid term rather than a recurring mandate - so "manage" is renewal: it opens
 * a fresh checkout for the same tier, which extends the term on success.
 */

import { useState } from "react";
import { startCheckout } from "@/components/PlanGate";
import { Btn } from "./ui";
import type { Plan } from "@/lib/db/collections";

export function BillingActions({ plan }: { plan: Plan }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upgrade(tier: "pro" | "elite") {
    setError("");
    setBusy(true);
    try {
      await startCheckout(tier);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  async function manage() {
    if (plan === "free") return;
    await upgrade(plan as "pro" | "elite");
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {plan === "free" && (
          <Btn variant="primary" disabled={busy} onClick={() => upgrade("pro")}>
            Upgrade to Pro
          </Btn>
        )}
        {plan !== "elite" && (
          <Btn
            variant={plan === "free" ? "outline" : "primary"}
            disabled={busy}
            onClick={() => upgrade("elite")}
          >
            Upgrade to Elite
          </Btn>
        )}
        {plan !== "free" && (
          <Btn variant="outline" disabled={busy} onClick={manage}>
            Renew {plan}
          </Btn>
        )}
      </div>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}

