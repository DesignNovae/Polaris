"use client";

/**
 * Gloss track.
 *
 * The written form of what the avatar is signing, in the small-caps convention
 * sign linguistics uses, with the current sign marked and the source sentence
 * underneath.
 *
 * This is not a debug readout. It is the text alternative for the interpreter,
 * and it is the only part of the panel a screen reader user can consume at all -
 * so it carries the live region rather than the avatar. It also lets a signer
 * check the machine's reading against the English, which is the honest thing to
 * offer when the signing is generated rather than certified.
 *
 * Re-renders only when the active sign changes, because the sync engine
 * publishes that transition rather than every frame.
 */

import { useMemo } from "react";
import { cn } from "@/lib/cn";
import type { SignSequence } from "@/lib/interpreter/types/gestures";
import type { TranscriptTrack } from "@/lib/interpreter/types/transcript";
import type { InterpreterCopy } from "./copy";

export function GlossTrack({
  sequences,
  track,
  activeSegmentId,
  activeGestureId,
  copy,
  compact,
}: {
  sequences: SignSequence[];
  track: TranscriptTrack | null;
  activeSegmentId: string | null;
  activeGestureId: string | null;
  copy: InterpreterCopy;
  compact?: boolean;
}) {
  const active = useMemo(
    () => sequences.find((sequence) => sequence.segmentId === activeSegmentId) ?? null,
    [sequences, activeSegmentId],
  );

  const sourceText = useMemo(
    () => track?.segments.find((segment) => segment.id === activeSegmentId)?.text ?? null,
    [track, activeSegmentId],
  );

  if (!active) {
    return (
      <p className="px-3 py-2.5 text-[11px] leading-relaxed text-ink-muted">{copy.glossEmpty}</p>
    );
  }

  return (
    <div className="px-3 py-2.5">
      <div className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.glossHeading}</div>

      {/*
        One live region for the whole track. Announcing each sign separately would
        interrupt a screen reader several times a second; announcing the phrase as
        it changes is readable.
      */}
      <p className="mt-1.5 flex flex-wrap gap-x-1.5 gap-y-1" aria-live="polite" aria-atomic="true">
        <span className="sr-only">{copy.signing}: </span>
        {active.gestures.map((gesture) => {
          const isActive = gesture.id === activeGestureId;
          const spelled = gesture.metadata.fingerspelled;
          // Continuation letters inside a spelled word carry no label of their own.
          if (spelled && !gesture.name.startsWith("fs-")) return null;
          const label = gesture.name.replace(/^fs-/, "");
          return (
            <span
              key={gesture.id}
              className={cn(
                "rounded px-1 py-px font-mono text-[10.5px] uppercase tracking-wide transition-colors duration-100",
                isActive ? "bg-polaris-500 text-white" : "text-ink-dim",
                spelled && !isActive && "text-nova-600 dark:text-nova-100",
              )}
            >
              {/*
                Fingerspelled words are written letter-by-letter with hyphens,
                which is the convention sign linguistics actually uses and is
                self-explanatory without a legend. An appended badge read as part
                of the word instead ("THIS" + "abc" -> "THISABC").
              */}
              {spelled ? label.split("").join("-") : label}
            </span>
          );
        })}
      </p>

      {!compact && sourceText && (
        <p className="mt-2 border-t border-ink-faint/12 pt-2 text-[11px] leading-relaxed text-ink-dim">{sourceText}</p>
      )}
    </div>
  );
}
