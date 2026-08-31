"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { canUse, type Feature, PLAN_LABELS } from "@/lib/features";
import type { Plan } from "@/lib/db/collections";
import { cn } from "@/lib/cn";

export function usePlan() {
  const { data: session, status } = useSession();
  const plan: Plan = (session?.user?.plan as Plan) ?? "free";
  return {
    plan,
    loading: status === "loading",
    can: (feature: Feature) => canUse(plan, feature),
  };
}

/** Kicks off a LemonSqueezy checkout for the given tier. */
export async function startCheckout(tier: "pro" | "elite") {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tier }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Checkout failed");
  }
  const { url } = await res.json();
  window.location.href = url;
}

export function UpgradeCard({
  tier = "pro",
  title,
  description,
  className,
}: {
  tier?: "pro" | "elite";
  title?: string;
  description?: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function upgrade() {
    setError("");
    setLoading(true);
    try {
      await startCheckout(tier);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "glass rounded-2xl p-6 text-center border border-polaris-300/40",
        className,
      )}
    >
      <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-polaris-100">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-polaris-500">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>
      <div className="font-semibold text-ink">
        {title ?? `Unlock with ${PLAN_LABELS[tier]}`}
      </div>
      <p className="mt-1 text-sm text-ink-dim max-w-sm mx-auto">
        {description ??
          `This is a ${PLAN_LABELS[tier]} feature. Upgrade to access it.`}
      </p>
      {error && <p className="mt-2 text-xs text-nova-500">{error}</p>}
      <button
        onClick={upgrade}
        disabled={loading}
        className={cn(
          "mt-4 rounded-full px-6 py-2.5 text-sm font-semibold transition-colors duration-150",
          loading
            ? "bg-polaris-200 text-ink-dim cursor-wait"
            : "bg-polaris-500 text-white hover:bg-polaris-600 active:bg-polaris-700",
        )}
      >
        {loading ? "Redirecting…" : `Upgrade to ${PLAN_LABELS[tier]}`}
      </button>
    </div>
  );
}

