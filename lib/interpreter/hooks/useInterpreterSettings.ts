"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  getServerSettings,
  getSettings,
  hydrateSettings,
  subscribeSettings,
  updateSettings,
} from "../state/settings";
import type { SettingsState } from "../types/interpreter";

/**
 * Subscribes to the interpreter settings store.
 *
 * Hydration runs in an effect rather than at module load so the server and the
 * first client render agree; the stored values arrive on the next commit.
 */
export function useInterpreterSettings(): [SettingsState, (patch: Partial<SettingsState>) => void] {
  useEffect(() => {
    hydrateSettings();
  }, []);

  const settings = useSyncExternalStore(subscribeSettings, getSettings, getServerSettings);
  const update = useCallback((patch: Partial<SettingsState>) => updateSettings(patch), []);
  return [settings, update];
}

/**
 * Live OS motion preference.
 *
 * Separate from the stored setting: this reports what the system asks for, and
 * the panel uses it to keep the toggle honest when a user changes the preference
 * mid-session without ever having touched the in-app control.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (listener) => {
      if (typeof window === "undefined" || typeof window.matchMedia !== "function") return () => {};
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () =>
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
