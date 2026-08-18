/**
 * Interpreter feature state.
 *
 * Split into four flat modules that never nest inside each other:
 *
 *   VideoState       - what the media is doing. Owned by the clock source.
 *   InterpreterState - what the interpreter is doing right now. Owned by PlaybackSync.
 *   TranslationState - what the pipeline has produced. Owned by the pipeline hook.
 *   SettingsState    - what the user chose. Persisted, owned by the settings store.
 *
 * Keeping them flat is what allows the 60fps path (InterpreterState) to bypass
 * React entirely while the other three re-render at human speed.
 */

import type { SignLanguageCode, SignSequence, CertificationRecord } from "./gestures";
import type { TranscriptTrack } from "./transcript";

/* ── VideoState ─────────────────────────────────────────────────────────── */

/** Immutable snapshot of the media clock. The single source of truth. */
export type VideoState = {
  /** Authoritative media position in seconds, as reported by the player. */
  currentTime: number;
  /** True while the media is actively advancing. */
  playing: boolean;
  /** Playback rate multiplier. 1 is normal speed. */
  rate: number;
  /** Total duration in seconds, or 0 when not yet known. */
  duration: number;
  /** True while the player is buffering and the clock is not advancing reliably. */
  buffering: boolean;
  /** Increments on every seek, so consumers can distinguish a jump from normal drift. */
  seekGeneration: number;
};

export const IDLE_VIDEO_STATE: VideoState = {
  currentTime: 0,
  playing: false,
  rate: 1,
  duration: 0,
  buffering: false,
  seekGeneration: 0,
};

/* ── InterpreterState ───────────────────────────────────────────────────── */

/** Lock quality of the interpreter against the media clock. */
export type SyncQuality =
  /** Within tolerance. Normal state. */
  | "locked"
  /** Outside tolerance; a correction is being applied this frame. */
  | "correcting"
  /** Clock unreadable (player gone, tab throttled). Renderer holds its last pose. */
  | "lost";

/** Coarse, throttled sync snapshot. Safe to put in React state. */
export type InterpreterSyncState = {
  quality: SyncQuality;
  /** Signed drift in milliseconds: predicted minus authoritative. */
  driftMs: number;
  /** Count of hard resyncs since attach. Surfaced in the diagnostics readout. */
  resyncCount: number;
  /** Id of the gesture currently being articulated, or null between sequences. */
  activeGestureId: string | null;
  /** Id of the transcript segment currently being interpreted. */
  activeSegmentId: string | null;
};

export const IDLE_SYNC_STATE: InterpreterSyncState = {
  quality: "lost",
  driftMs: 0,
  resyncCount: 0,
  activeGestureId: null,
  activeSegmentId: null,
};

/**
 * Per-frame payload delivered to imperative subscribers at display refresh rate.
 * This never enters React state - the renderer writes it straight to the DOM.
 */
export type SyncFrame = {
  /** Smoothed, interpolated media time in seconds. */
  mediaTime: number;
  rate: number;
  playing: boolean;
  driftMs: number;
  quality: SyncQuality;
  /** Milliseconds since the previous frame, already clamped for tab-switch gaps. */
  deltaMs: number;
};

/* ── TranslationState ───────────────────────────────────────────────────── */

/** What the pipeline is doing. Each value has a designed fallback in the panel. */
export type InterpreterStatus =
  | "disabled"
  | "loading-transcript"
  | "no-transcript"
  | "translating"
  | "ready"
  | "unsupported-language"
  | "renderer-error"
  | "error";

export type TranslationState = {
  status: InterpreterStatus;
  track: TranscriptTrack | null;
  sequences: SignSequence[];
  /** Highest certification tier present across the loaded sequences. */
  certification: CertificationRecord | null;
  /** User-facing message for the current status. Already localised. */
  message: string | null;
  /** Fraction 0-1 of segments translated so far. Drives the translating state. */
  progress: number;
};

export const IDLE_TRANSLATION_STATE: TranslationState = {
  status: "disabled",
  track: null,
  sequences: [],
  certification: null,
  message: null,
  progress: 0,
};

/* ── SettingsState ──────────────────────────────────────────────────────── */

export type InterpreterSize = "small" | "medium" | "large";
export type InterpreterSide = "left" | "right";

/**
 * How the interpreter sits relative to the lesson.
 *
 * `beside` is the default and suits a hearing viewer using the interpreter as a
 * support. `focus` inverts the emphasis for a viewer who reads the interpreter
 * first and treats the video as secondary - which is the actual usage scene for
 * a Deaf student, and the reason this is a real setting rather than a preference
 * about tidiness. `overlay` keeps the interpreter on top of a full-width video,
 * for narrow screens and full-attention viewing.
 */
export type InterpreterLayout = "beside" | "focus" | "overlay";

export type SettingsState = {
  enabled: boolean;
  language: SignLanguageCode;
  size: InterpreterSize;
  /** Which side of the video the panel sits on at desktop widths. */
  side: InterpreterSide;
  layout: InterpreterLayout;
  /** Renderer id from the avatar registry. Lets a WebGL or recorded track replace SVG. */
  rendererId: string;
  /** Stronger strokes and a maximum-contrast palette for low-vision users. */
  highContrast: boolean;
  /** Snap between poses instead of interpolating. Defaults from prefers-reduced-motion. */
  reducedMotion: boolean;
  /** Show the gloss text track under the avatar. On by default - it is the text alternative. */
  showGloss: boolean;
  /** Show the drift/quality diagnostics readout. */
  showDiagnostics: boolean;
};

export const DEFAULT_SETTINGS: SettingsState = {
  enabled: false,
  language: "ase",
  size: "medium",
  side: "right",
  layout: "beside",
  rendererId: "svg-skeletal",
  highContrast: false,
  reducedMotion: false,
  showGloss: true,
  showDiagnostics: false,
};

/** Pixel widths the panel targets at desktop. Mobile always goes full width. */
export const SIZE_TRACKS: Record<InterpreterSize, { column: string; minHeight: number }> = {
  small: { column: "16rem", minHeight: 200 },
  medium: { column: "21rem", minHeight: 268 },
  large: { column: "27rem", minHeight: 340 },
};
