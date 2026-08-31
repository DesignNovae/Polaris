"use client";

/**
 * Interpreter panel.
 *
 * Composition only. It wires the pipeline hook to the sync engine to the renderer
 * and renders the right state - it contains no translation logic, no timing logic
 * and no drawing. Every failure mode from the brief has a designed state here
 * rather than an exception: missing transcript, unsupported language, renderer
 * failure, and lost synchronisation each say what happened and what to do.
 */

import { useCallback, useMemo, useState } from "react";
import { Card } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import { useGestureTimeline } from "@/lib/interpreter/hooks/useGestureTimeline";
import { useInterpreterSettings } from "@/lib/interpreter/hooks/useInterpreterSettings";
import { useInterpreterSync } from "@/lib/interpreter/hooks/useInterpreterSync";
import type { PlaybackClockSource } from "@/lib/interpreter/synchronization/clocks/types";
import { MACHINE_SYNTHETIC } from "@/lib/interpreter/types/gestures";
import { SIZE_TRACKS } from "@/lib/interpreter/types/interpreter";
import {
  describeCertification,
  recordedLanguagesFor,
  resolveInterpreterTrack,
} from "@/lib/interpreter/tracks/InterpreterTrack";
import { AvatarRenderer } from "./AvatarRenderer";
import { GlossTrack } from "./GlossTrack";
import { InterpreterControls } from "./InterpreterControls";
import { SyncIndicator } from "./SyncIndicator";
import { INTERPRETER_COPY, type Lang } from "./copy";

// Registers the transcript and translation providers, and the renderers. The
// renderer modules themselves stay unloaded until one is actually selected.
import "@/lib/interpreter/bootstrap";
import "./renderers";

export function InterpreterPanel({
  mediaId,
  source,
  lang,
  duration,
  className,
}: {
  /** Stable id of the media being interpreted, or null while none is selected. */
  mediaId: string | null;
  /** The clock to follow. Null while the player is still constructing. */
  source: PlaybackClockSource | null;
  lang: Lang;
  duration?: number;
  className?: string;
}) {
  const copy = INTERPRETER_COPY[lang];
  const [settings, update] = useInterpreterSettings();
  const [rendererError, setRendererError] = useState<string | null>(null);

  const { sync, status: syncStatus } = useInterpreterSync(source);

  const messages = useMemo(
    () => ({
      "loading-transcript": copy.statusLoading,
      "no-transcript": copy.statusNoTranscript,
      translating: copy.statusTranslating,
      "unsupported-language": copy.statusUnsupported,
      "renderer-error": copy.statusRendererError,
      error: copy.statusError,
    }),
    [copy],
  );

  const pipeline = useGestureTimeline({
    mediaId,
    language: settings.language,
    enabled: settings.enabled,
    duration,
    messages,
  });

  const track = useMemo(
    () => resolveInterpreterTrack(mediaId ?? "", settings.language, pipeline.certification ?? MACHINE_SYNTHETIC),
    [mediaId, settings.language, pipeline.certification],
  );

  const recordedLanguages = useMemo(() => recordedLanguagesFor(mediaId ?? ""), [mediaId]);
  const certification = useMemo(() => describeCertification(track.certification), [track.certification]);

  const onRendererError = useCallback((message: string) => setRendererError(message), []);

  if (!settings.enabled) return null;

  const sizing = SIZE_TRACKS[settings.size];
  const status = rendererError ? "renderer-error" : pipeline.status;
  const isReady = status === "ready" && !pipeline.timeline.isEmpty;

  const sourceNote = pipeline.track ? copy.sourceNote[pipeline.track.origin] : null;

  return (
    <Card
      className={cn("flex flex-col overflow-hidden", className)}
      role="region"
      aria-label={copy.panelLabel}
    >
      <header className="flex items-start justify-between gap-2 px-3 pb-2 pt-3">
        <div className="min-w-0">
          <h3 className="font-serif text-[15px] font-bold leading-tight text-ink">{copy.title}</h3>
          <p className="mt-0.5 text-[10px] leading-snug text-ink-muted">{certification.detail}</p>
        </div>
        <SyncIndicator status={syncStatus} copy={copy} toleranceMs={sync.toleranceMs} />
      </header>

      <div
        className="relative mx-3 overflow-hidden rounded-xl bg-paper-deep/45 dark:bg-white/[0.04]"
        style={{ minHeight: sizing.minHeight }}
      >
        {isReady ? (
          <AvatarRenderer
            sync={sync}
            timeline={pipeline.timeline}
            track={track}
            settings={settings}
            ariaLabel={copy.avatarLabel}
            onError={onRendererError}
            loadingLabel={copy.statusTranslating}
            fallback={<StatusPane message={copy.statusRendererError} onRetry={pipeline.retry} retryLabel={copy.retry} />}
          />
        ) : (
          <StatusPane
            message={rendererError ?? pipeline.message ?? copy.statusLoading}
            busy={status === "loading-transcript" || status === "translating"}
            onRetry={status === "no-transcript" || status === "unsupported-language" ? undefined : pipeline.retry}
            retryLabel={copy.retry}
          />
        )}
      </div>

      {settings.showGloss && (
        <div className="mt-2 border-t border-ink-faint/12">
          <GlossTrack
            sequences={pipeline.sequences}
            track={pipeline.track}
            activeSegmentId={syncStatus.activeSegmentId}
            activeGestureId={syncStatus.activeGestureId}
            copy={copy}
            compact={settings.size === "small"}
          />
        </div>
      )}

      <div className="mt-auto border-t border-ink-faint/12 px-3 py-3">
        <InterpreterControls settings={settings} update={update} copy={copy} recordedLanguages={recordedLanguages} />

        {(settings.showDiagnostics || sourceNote) && (
          <div className="mt-3 space-y-1.5 border-t border-ink-faint/12 pt-2.5">
            {sourceNote && (
              <p className="text-[10px] leading-relaxed text-ink-muted">
                <span className="font-semibold text-ink-dim">{certification.label}.</span> {sourceNote}
              </p>
            )}
            {settings.showDiagnostics && (
              <div className="flex flex-wrap items-center gap-1.5">
                <SyncIndicator status={syncStatus} copy={copy} toleranceMs={sync.toleranceMs} detailed />
                <span className="font-mono text-[9.5px] text-ink-muted">
                  {pipeline.timeline.size} signs · {pipeline.sequences.length} phrases
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

/** Every non-ready state: loading, empty, and each error. */
function StatusPane({
  message,
  busy,
  onRetry,
  retryLabel,
}: {
  message: string;
  busy?: boolean;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-2.5 p-5 text-center" role="status" aria-live="polite">
      {busy && (
        <span
          className="h-4 w-4 rounded-full border-2 border-ink-faint/30 border-t-polaris-500 motion-safe:animate-spin"
          aria-hidden="true"
        />
      )}
      <p className="max-w-[26ch] text-[11px] leading-relaxed text-ink-dim">{message}</p>
      {onRetry && retryLabel && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-ink-faint/25 px-2.5 py-1 text-[10.5px] font-semibold text-ink-dim transition-colors hover:border-polaris-500/40 hover:text-ink"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
