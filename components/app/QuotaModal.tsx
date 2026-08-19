"use client";

/**
 * Quota pop-up for the Strategist. Two variants:
 *  - "plan": the user exhausted their per-plan message budget (HTTP 429 from
 *    /api/strategist's plan-aware rate limiter) - offers an upgrade.
 *  - "ai": the underlying model is temporarily rate-limited / over quota
 *    (e.g. provider 429) - it's not the user's fault, just retry.
 */

import { Btn, Icon } from "./ui";

export type QuotaState = { kind: "plan" | "ai"; resetHint?: string };

export function QuotaModal({ quota, onClose }: { quota: QuotaState; onClose: () => void }) {
  const isPlan = quota.kind === "plan";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6" onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-paper-card rounded-2xl shadow-pop max-w-[420px] w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className={`h-10 w-10 rounded-xl inline-flex items-center justify-center mb-3 ${isPlan ? "bg-polaris-100 text-polaris-600" : "bg-[#FBEFE2] text-nova-600"}`}>
          <Icon.bolt size={18} />
        </div>
        <div className="font-serif text-[20px] font-bold tracking-tight text-ink leading-tight">
          {isPlan ? "You've reached your message limit" : "Strategist is over capacity"}
        </div>
        <p className="text-[13px] text-ink-dim mt-2 leading-relaxed">
          {isPlan ? (
            <>You&apos;ve used all your Strategist messages for now{quota.resetHint ? <> - your limit resets {quota.resetHint}</> : ""}. Upgrade your plan for a higher limit and priority access.</>
          ) : (
            <>The Strategist&apos;s AI is temporarily rate-limited{quota.resetHint ? <> - try again {quota.resetHint}</> : " - please try again in a moment"}. Your messages and roadmap are unaffected.</>
          )}
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          {isPlan && (
            <a href="/billing" className="inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-100 h-9 px-3.5 text-[13px] bg-ink text-paper hover:bg-polaris-700">
              Upgrade plan
            </a>
          )}
          <Btn variant={isPlan ? "ghost" : "primary"} onClick={onClose}>{isPlan ? "Not now" : "Got it"}</Btn>
        </div>
      </div>
    </div>
  );
}

/** Build a human "in ~N min" hint from an X-RateLimit-Reset header (unix seconds). */
export function resetHintFrom(header: string | null): string | undefined {
  if (!header) return undefined;
  const resetMs = parseInt(header, 10) * 1000;
  if (!Number.isFinite(resetMs)) return undefined;
  const mins = Math.max(1, Math.ceil((resetMs - Date.now()) / 60000));
  return `in ~${mins} min`;
}
