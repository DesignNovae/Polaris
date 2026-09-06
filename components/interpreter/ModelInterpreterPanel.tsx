"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Card } from "@/components/app/ui";
import { useInterpreterSettings } from "@/lib/interpreter/hooks/useInterpreterSettings";
import { useInterpreterSync } from "@/lib/interpreter/hooks/useInterpreterSync";
import type { PlaybackClockSource } from "@/lib/interpreter/synchronization/clocks/types";
import { SIGN_LANGUAGES } from "@/lib/interpreter/types/gestures";
import { SIZE_TRACKS } from "@/lib/interpreter/types/interpreter";
import type { PreparedSigningTrack } from "@/lib/interpreter/model/manifest";
import { signingPlayback } from "@/lib/interpreter/model/playback";
import { INTERPRETER_COPY, type Lang } from "./copy";
import { LiveSigningPlayer } from "./LiveSigningPlayer";
import type { LiveSigningInput } from "@/lib/interpreter/model/live";

export type ModelPanelProps = {
  mediaId: string | null;
  source: PlaybackClockSource | null;
  lang: Lang;
  duration?: number;
  className?: string;
  /** Exam panels never run transcript/gloss providers or reveal written answers. */
  examSessionId?: string;
  onTrackReady?: () => void;
  onTrackError?: () => void;
  liveInput?: LiveSigningInput;
  onLiveRetry?: () => void;
};

export function ModelInterpreterPanel({ children, ...props }: ModelPanelProps & { children: ReactNode }) {
  const [settings] = useInterpreterSettings();
  if (!settings.enabled) return null;
  // Reset requests, errors, the video and any preview choice on source/language changes.
  return <PreparedPanel key={`${props.mediaId}:${settings.language}:${props.examSessionId ?? "lesson"}`} {...props}>{children}</PreparedPanel>;
}

function PreparedPanel({ mediaId, source, lang, className, examSessionId, onTrackReady, onTrackError, liveInput, onLiveRetry, children }: ModelPanelProps & { children: ReactNode }) {
  const [settings, update] = useInterpreterSettings();
  const [track, setTrack] = useState<PreparedSigningTrack | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [preview, setPreview] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const copy = INTERPRETER_COPY[lang];
  const bn = lang === "bn";

  useEffect(() => {
    if (liveInput) { setLoading(false); return; }
    if (!mediaId) { setLoading(false); return; }
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const params = new URLSearchParams({ mediaId, language: settings.language });
    if (examSessionId) params.set("sessionId", examSessionId);
    void fetch(`/api/interpreter/tracks?${params}`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Track unavailable");
        return response.json() as Promise<{ track: PreparedSigningTrack | null }>;
      })
      .then((result) => { if (!controller.signal.aborted) setTrack(result.track); })
      .catch(() => { if (!controller.signal.aborted) setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [mediaId, settings.language, examSessionId, attempt, liveInput]);

  if (preview && !examSessionId) return <>{children}</>;

  return (
    <Card className={className} role="region" aria-label={copy.panelLabel}>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-serif text-base font-bold text-ink">{bn ? "থ্রিডি সাংকেতিক ভাষা" : "3D sign language"}</h3>
          <label className="flex items-center gap-2 text-xs text-ink-dim">
            <span>{copy.language}</span>
            <select aria-label={copy.language} value={settings.language}
              onChange={(event) => update({ language: event.target.value as typeof settings.language })}
              className="min-h-10 rounded-lg border border-ink-faint/30 bg-paper-card px-2 text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-polaris-500">
              {SIGN_LANGUAGES.map((language) => <option key={language.code} value={language.code}>{language.abbreviation}</option>)}
            </select>
          </label>
        </div>

        {liveInput ? settings.language === "ase" ? <LiveSigningPlayer input={liveInput} source={source} lang={lang} onReady={onTrackReady} onError={onTrackError} onRetry={onLiveRetry} />
          : <div className="rounded-xl bg-paper-deep/45 p-5 text-sm leading-relaxed text-ink-dim" role="status">{bn ? "লাইভ মডেল এখন ASL সমর্থন করে। শুরু করতে ASL নির্বাচন করুন।" : "The live model currently supports ASL. Select ASL to start signing."}</div>
          : track && !loading && !error ? (
          <>
            <SigningVideo key={`${track.id}:${attempt}`} track={track} source={source} lang={lang} minHeight={SIZE_TRACKS[settings.size].minHeight} onReady={onTrackReady} onError={onTrackError} />
            <p className="text-xs leading-relaxed text-ink-dim">
              {track.model} · {track.review.status === "reviewed"
                ? (bn ? `${track.review.reviewer} যাচাই করেছেন।` : `Reviewed by ${track.review.reviewer}.`)
                : (bn ? "মডেল থেকে তৈরি। ভাষাগত যাচাই এখনো হয়নি।" : "Model generated. Linguistic review pending.")}
            </p>
          </>
        ) : (
          <div className="flex flex-col justify-center gap-3 rounded-xl bg-paper-deep/45 p-5" style={{ minHeight: SIZE_TRACKS[settings.size].minHeight }} role="status">
            <p className="text-sm leading-relaxed text-ink-dim">{loading
              ? (bn ? "সাংকেতিক ভাষার ট্র্যাক খোঁজা হচ্ছে…" : "Checking for a prepared signing track…")
              : error
                ? (bn ? "ট্র্যাকটি লোড করা যায়নি। আবার চেষ্টা করুন।" : "The signing track could not load. Try again.")
                : examSessionId
                  ? (bn ? "ASL নির্বাচন করে রেকর্ডিং চালু করুন। দোভাষী এই অংশটি প্রস্তুত করবে।" : "Select ASL, then start the recording to prepare signing for this part.")
                  : (bn ? "এই বিষয়বস্তু ও ভাষার জন্য থ্রিডি ট্র্যাক এখনো তৈরি হয়নি।" : "A 3D signing track has not been prepared for this content and language.")}</p>
            {!loading && (!examSessionId || error) && <button type="button" onClick={() => setAttempt((value) => value + 1)} className="min-h-10 self-start rounded-lg border border-ink-faint/30 px-3 text-xs font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-polaris-500">{copy.retry}</button>}
            {!loading && !examSessionId && <button type="button" onClick={() => setPreview(true)} className="min-h-10 self-start text-xs font-medium text-ink underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-polaris-500">{bn ? "পরীক্ষামূলক স্কেচ প্রিভিউ দেখান" : "Show experimental sketch preview"}</button>}
          </div>
        )}

        {!examSessionId && <div className="flex flex-wrap items-center gap-2 text-xs text-ink-dim">
          <span>{copy.layout}</span>
          {(["beside", "focus", "overlay"] as const).map((layout) => <button key={layout} type="button" aria-pressed={settings.layout === layout} onClick={() => update({ layout })} className={`min-h-10 rounded-lg px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-polaris-500 ${settings.layout === layout ? "bg-ink text-paper" : "border border-ink-faint/25 text-ink"}`}>{copy.layouts[layout]}</button>)}
        </div>}
      </div>
    </Card>
  );
}

function SigningVideo({ track, source, lang, minHeight, onReady, onError }: {
  track: PreparedSigningTrack; source: PlaybackClockSource | null; lang: Lang; minHeight: number;
  onReady?: () => void; onError?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [failure, setFailure] = useState(false);
  const [buffering, setBuffering] = useState(true);
  const { sync } = useInterpreterSync(source);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => { if (failure) onErrorRef.current?.(); }, [failure]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!source) video.pause();
    let pendingPlay = false;
    let cancelled = false;
    let lastCorrection = 0;
    const unsubscribe = sync.subscribeFrames((frame) => {
      if (video.readyState < 1 || failure) return;
      const action = signingPlayback({ ...frame, offset: track.offset,
        duration: Number.isFinite(video.duration) ? video.duration : track.duration,
        videoTime: video.currentTime, lost: frame.quality === "lost" });
      if (!action.playing) video.pause();
      const now = performance.now();
      if (now - lastCorrection >= 100 || !action.playing) {
        lastCorrection = now;
        if (action.seek && !video.seeking) video.currentTime = action.target;
        video.playbackRate = action.rate;
      }
      if (action.playing && video.paused && !pendingPlay) {
        pendingPlay = true;
        void video.play().catch(() => { if (!cancelled) setFailure(true); }).finally(() => { pendingPlay = false; });
      }
    });
    return () => { cancelled = true; unsubscribe(); video.pause(); };
  }, [sync, source, track.duration, track.offset, failure]);

  return <div className="relative overflow-hidden rounded-xl bg-[#eff2ef]" style={{ minHeight }}>
    <video ref={videoRef} src={source ? track.src : undefined} muted playsInline preload="auto" disablePictureInPicture
      aria-label={INTERPRETER_COPY[lang].avatarLabel} className="aspect-[4/3] w-full object-contain"
      onLoadedMetadata={(event) => {
        if (Math.abs(event.currentTarget.duration - track.duration) > 0.5) setFailure(true);
      }}
      onWaiting={() => setBuffering(true)} onCanPlay={() => { setBuffering(false); if (!failure) onReady?.(); }} onPlaying={() => setBuffering(false)} onError={() => setFailure(true)} />
    {(failure || buffering || !source) && <div className="absolute inset-0 flex items-center justify-center bg-[#eff2ef]/95 p-5 text-center text-sm text-[#2C1810]" role="status">{failure
      ? (lang === "bn" ? "অ্যানিমেশনটি চালানো যায়নি। দোভাষী বন্ধ করে আবার চালু করুন।" : "The animation could not play. Turn the interpreter off and on to retry.")
      : !source
        ? (lang === "bn" ? "রেকর্ডিং চালু হলে সংকেত শুরু হবে।" : "Signing starts with the recording.")
        : (lang === "bn" ? "অ্যানিমেশন লোড হচ্ছে…" : "Loading the signing animation…")}</div>}
  </div>;
}
