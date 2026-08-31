/**
 * Avatar renderer registry.
 *
 * The brief's hardest constraint is that nothing locks the project into a single
 * rendering technology. This is where that is enforced: a renderer is a lazily
 * loaded component plus a capability declaration, and the panel picks one at
 * runtime. Adding a Three.js avatar, a motion-capture clip player, or a different
 * illustration style means registering a descriptor - no change to translation,
 * synchronisation, state, or UI.
 *
 * Renderers are loaded on demand rather than imported eagerly, so a user who never
 * turns the interpreter on never downloads any of it.
 */

import type { ComponentType } from "react";
import type { SettingsState } from "../types/interpreter";
import type { PlaybackSync } from "../synchronization/PlaybackSync";
import type { GestureTimeline } from "./GestureTimeline";
import type { InterpreterTrack } from "../tracks/InterpreterTrack";

export type AvatarRendererProps = {
  /**
   * The sync engine. Renderers subscribe to frames imperatively and write to
   * refs - they must not put frame data into React state.
   */
  sync: PlaybackSync;
  timeline: GestureTimeline;
  track: InterpreterTrack;
  settings: SettingsState;
  /** Reported when the renderer cannot continue, so the panel can fall back. */
  onError: (message: string) => void;
  /** Label announced to assistive technology. */
  ariaLabel: string;
};

export type AvatarRendererComponent = ComponentType<AvatarRendererProps>;

export type RendererCapabilities = {
  /** Can articulate distinct handshapes rather than a generic hand. */
  handshapes: boolean;
  /** Can express brows, head movement and mouth morphemes - i.e. sign grammar. */
  nonManualMarkers: boolean;
  /** Blends continuously between signs instead of snapping. */
  continuousTransitions: boolean;
  /** Shows a filmed human rather than a synthesised figure. */
  humanLikeness: "abstract" | "stylised" | "photoreal" | "filmed";
};

export type AvatarRendererDescriptor = {
  id: string;
  label: string;
  /** Short description shown in the renderer control. */
  description: string;
  technology: "svg" | "canvas" | "webgl" | "video" | "custom";
  capabilities: RendererCapabilities;
  /** True when this renderer can present the given track. */
  supports: (track: InterpreterTrack) => boolean;
  /** Lazy loader. Called the first time the renderer is actually needed. */
  load: () => Promise<AvatarRendererComponent>;
};

const registry = new Map<string, AvatarRendererDescriptor>();
const loaded = new Map<string, AvatarRendererComponent>();

export function registerAvatarRenderer(descriptor: AvatarRendererDescriptor): void {
  registry.set(descriptor.id, descriptor);
}

export function listAvatarRenderers(): AvatarRendererDescriptor[] {
  return [...registry.values()];
}

export function getAvatarRenderer(id: string): AvatarRendererDescriptor | undefined {
  return registry.get(id);
}

/** Renderers that can present this track, for the renderer control. */
export function renderersFor(track: InterpreterTrack): AvatarRendererDescriptor[] {
  return listAvatarRenderers().filter((descriptor) => descriptor.supports(track));
}

/**
 * Chooses a renderer for a track.
 *
 * A filmed track always wins over a synthetic one when both could be shown - it
 * is the higher-fidelity artefact and the only one that can carry a credential.
 * The user's preference is honoured only among renderers that actually support
 * the resolved track.
 */
export function selectRenderer(track: InterpreterTrack, preferredId: string): AvatarRendererDescriptor | null {
  const candidates = renderersFor(track);
  if (candidates.length === 0) return null;
  if (track.kind === "recorded") {
    const filmed = candidates.find((descriptor) => descriptor.technology === "video");
    if (filmed) return filmed;
  }
  return candidates.find((descriptor) => descriptor.id === preferredId) ?? candidates[0];
}

/** Loads a renderer once and caches the component. */
export async function loadRenderer(id: string): Promise<AvatarRendererComponent> {
  const cached = loaded.get(id);
  if (cached) return cached;

  const descriptor = registry.get(id);
  if (!descriptor) throw new Error(`No avatar renderer registered with id "${id}"`);

  const component = await descriptor.load();
  loaded.set(id, component);
  return component;
}
