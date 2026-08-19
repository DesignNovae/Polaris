"use client";

/**
 * Playback synchronisation indicator.
 *
 * Reports real measured drift, not a decorative "live" badge. A student relying
 * on the interpreter needs to know when it has fallen behind the lesson, because
 * signing that lags the video is worse than signing that stops - it looks correct
 * while telling you the wrong thing.
 *
 * Values come from the engine's throttled status stream, so this re-renders a few
 * times a second rather than every frame.
 */

import { cn } from "@/lib/cn";
import type { InterpreterSyncState } from "@/lib/interpreter/types/interpreter";
import type { InterpreterCopy } from "./copy";

export function SyncIndicator({
  status,
  copy,
  toleranceMs,
  detailed,
}: {
  status: InterpreterSyncState;
  copy: InterpreterCopy;
  toleranceMs: number;
  detailed?: boolean;
}) {
  const tone =
    status.quality === "locked"
      ? { dot: "bg-aurora-500", text: "text-aurora-700 dark:text-aurora-100", ring: "ring-aurora-400/40 bg-aurora-100/70 dark:bg-aurora-400/15" }
      : status.quality === "correcting"
        ? { dot: "bg-nova-500", text: "text-nova-600 dark:text-nova-100", ring: "ring-[#F2D9BE] bg-[#FBEFE2] dark:bg-nova-400/15 dark:ring-nova-400/40" }
        : { dot: "bg-ink-muted", text: "text-ink-dim", ring: "ring-ink-faint/40 bg-paper-deep dark:bg-white/[0.08] dark:ring-white/[0.18]" };

  const label =
    status.quality === "locked" ? copy.syncLocked : status.quality === "correcting" ? copy.syncCorrecting : copy.syncLost;

  const drift = Math.abs(status.driftMs);

  return (
    <div
      className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", tone.ring, tone.text)}
      // The whole indicator is one announcement; polite so it never interrupts
      // a screen reader mid-sentence while the lesson is playing.
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          tone.dot,
          // Only the correcting state animates, and only when the user allows it.
          status.quality === "correcting" && "motion-safe:animate-pulse",
        )}
      />
      <span>{label}</span>
      {status.quality !== "lost" && (
        <span className="font-mono tabular-nums opacity-70">{drift < 1 ? "<1" : Math.round(drift)}ms</span>
      )}
      {detailed && status.quality !== "lost" && (
        <span className="font-mono tabular-nums opacity-60">
          · {status.resyncCount} {copy.syncResyncs} · ±{toleranceMs}ms {copy.syncTolerance}
        </span>
      )}
    </div>
  );
}
