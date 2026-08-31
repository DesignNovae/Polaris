/**
 * SettingsState store.
 *
 * A module-level store rather than React context, for two reasons. It survives
 * navigation between the learn tab and the exam tab, so a student who turned the
 * interpreter on does not have to turn it on again on the next surface. And it
 * exposes a `useSyncExternalStore` contract, so components subscribe to the slice
 * they read instead of re-rendering on every unrelated settings change.
 *
 * Flat by construction. Nothing here nests.
 */

import { DEFAULT_SETTINGS, type SettingsState } from "../types/interpreter";

const STORAGE_KEY = "polaris.interpreter.settings.v1";

let state: SettingsState = DEFAULT_SETTINGS;
let hydrated = false;
const listeners = new Set<() => void>();

/** Narrow the persisted blob back to a valid state, field by field. */
function coerce(raw: unknown): SettingsState {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const value = raw as Partial<SettingsState>;
  const pick = <K extends keyof SettingsState>(key: K, allowed: readonly SettingsState[K][]): SettingsState[K] =>
    allowed.includes(value[key] as SettingsState[K]) ? (value[key] as SettingsState[K]) : DEFAULT_SETTINGS[key];

  return {
    enabled: typeof value.enabled === "boolean" ? value.enabled : DEFAULT_SETTINGS.enabled,
    language: pick("language", ["ase", "bfi", "ins"]),
    size: pick("size", ["small", "medium", "large"]),
    side: pick("side", ["left", "right"]),
    layout: pick("layout", ["beside", "focus", "overlay"]),
    rendererId: typeof value.rendererId === "string" ? value.rendererId : DEFAULT_SETTINGS.rendererId,
    highContrast: typeof value.highContrast === "boolean" ? value.highContrast : DEFAULT_SETTINGS.highContrast,
    reducedMotion: typeof value.reducedMotion === "boolean" ? value.reducedMotion : DEFAULT_SETTINGS.reducedMotion,
    showGloss: typeof value.showGloss === "boolean" ? value.showGloss : DEFAULT_SETTINGS.showGloss,
    showDiagnostics: typeof value.showDiagnostics === "boolean" ? value.showDiagnostics : DEFAULT_SETTINGS.showDiagnostics,
  };
}

/**
 * Reads storage and the OS motion preference.
 *
 * Called from an effect, never during render: touching localStorage or
 * matchMedia while rendering would produce a server/client mismatch.
 */
export function hydrateSettings(): void {
  if (hydrated || typeof window === "undefined") return;
  hydrated = true;

  let stored: SettingsState = DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) stored = coerce(JSON.parse(raw));
  } catch {
    // Private mode, quota, or corrupt JSON. Defaults are a fine outcome.
  }

  // The OS preference seeds the setting but never overrides an explicit choice,
  // so a user who deliberately enabled motion keeps it across sessions.
  const prefersReduced =
    typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasExplicitChoice = (() => {
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  })();

  state = hasExplicitChoice ? stored : { ...stored, reducedMotion: prefersReduced };
  emit();
}

function persist(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal: the session still works, it just will not be remembered.
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function getSettings(): SettingsState {
  return state;
}

/** Stable server snapshot, so SSR never reads storage. */
export function getServerSettings(): SettingsState {
  return DEFAULT_SETTINGS;
}

export function subscribeSettings(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function updateSettings(patch: Partial<SettingsState>): void {
  const next = { ...state, ...patch };
  const changed = (Object.keys(patch) as Array<keyof SettingsState>).some((key) => state[key] !== next[key]);
  if (!changed) return;
  state = next;
  persist();
  emit();
}

export function resetSettings(): void {
  state = DEFAULT_SETTINGS;
  persist();
  emit();
}
