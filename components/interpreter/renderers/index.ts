/**
 * Renderer registrations.
 *
 * Import once, from the panel. Each descriptor declares what it can do and how to
 * load it; nothing here imports the renderer itself, so turning the interpreter on
 * is the only thing that downloads any rendering code.
 *
 * A new rendering technology - Three.js, a motion-capture clip library, a
 * different illustration style - is a new entry in this file and nothing else.
 */

import { registerAvatarRenderer } from "@/lib/interpreter/render/registry";

registerAvatarRenderer({
  id: "svg-skeletal",
  label: "Skeletal avatar",
  description: "Vector signer with articulated handshapes and facial grammar.",
  technology: "svg",
  capabilities: {
    handshapes: true,
    nonManualMarkers: true,
    continuousTransitions: true,
    humanLikeness: "stylised",
  },
  // Synthetic tracks only. A filmed track is never re-drawn as an avatar.
  supports: (track) => track.kind === "synthetic",
  load: async () => (await import("./SvgAvatarRenderer")).default,
});

registerAvatarRenderer({
  id: "recorded-human",
  label: "Filmed interpreter",
  description: "Plays a credentialed interpreter recording locked to the lesson clock.",
  technology: "video",
  capabilities: {
    handshapes: true,
    nonManualMarkers: true,
    continuousTransitions: true,
    humanLikeness: "filmed",
  },
  supports: (track) => track.kind === "recorded",
  load: async () => (await import("./RecordedInterpreterRenderer")).default,
});
