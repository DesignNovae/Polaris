"use client";

/**
 * Client island for the (app)/billing page. Reuses the existing
 * LemonSqueezy helpers already wired in the repo: `startCheckout` from
 * components/PlanGate and the POST /api/portal customer-portal route.
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
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/portal", { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not open billing portal");
      }
      const { url } = await res.json();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
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
            Manage billing
          </Btn>
        )}
      </div>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}

