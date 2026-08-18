/**
 * Skeletal pose model.
 *
 * Turns the phonological description of a sign - handshape, location, movement,
 * palm orientation, non-manual marker - into joint positions and finger curls.
 *
 * Deliberately renderer-agnostic: this module produces numbers, not SVG. The SVG
 * renderer draws them, and a WebGL or motion-capture renderer would consume the
 * same output. That is the seam that keeps the project from being locked into one
 * rendering technology.
 *
 * Geometry notes. The avatar faces the viewer, so it is mirrored: the signer's
 * dominant hand appears on the viewer's LEFT. Signing space is a 240x260 box with
 * the body centred on x=120. All coordinates below are given for the dominant
 * hand and mirrored for the other.
 */

import type {
  Gesture,
  HandShapeId,
  MovementType,
  NonManualMarker,
  PalmOrientation,
  SignLocation,
} from "../types/gestures";
import { clamp, easeInOut, lerp } from "../utils/timeline";

export type Vec2 = { x: number; y: number };

/* ── Body proportions ───────────────────────────────────────────────────── */

export const CANVAS = { width: 240, height: 260 } as const;

export const SKELETON = {
  headCenter: { x: 120, y: 58 } as Vec2,
  headRadius: 27,
  /** Neck span. Drawn as a column between the head and the shoulder line - without
   *  it the head reads as detached, which is the first thing the eye notices. */
  neckTop: { x: 120, y: 74 } as Vec2,
  neckBottom: { x: 120, y: 126 } as Vec2,
  neckWidth: 17,
  /** Dominant shoulder, on the viewer's left. */
  shoulderDominant: { x: 84, y: 122 } as Vec2,
  shoulderWeak: { x: 156, y: 122 } as Vec2,
  upperArm: 44,
  forearm: 42,
  waist: { x: 120, y: 232 } as Vec2,
} as const;

/**
 * Where each sign location sits in signing space, for the dominant hand.
 *
 * These are the articulation targets the lexicon refers to. Getting them roughly
 * right is what makes a sign readable: the difference between MOTHER and FATHER
 * in ASL is chin versus forehead and nothing else.
 */
const LOCATION_POINTS: Record<SignLocation, Vec2> = {
  neutral: { x: 106, y: 172 },
  chest: { x: 100, y: 150 },
  chin: { x: 110, y: 84 },
  mouth: { x: 111, y: 76 },
  nose: { x: 113, y: 68 },
  forehead: { x: 108, y: 42 },
  temple: { x: 86, y: 48 },
  cheek: { x: 92, y: 68 },
  shoulder: { x: 94, y: 120 },
  ear: { x: 84, y: 58 },
  /** The weak hand acts as the place of articulation for two-handed signs. */
  "weak-hand": { x: 142, y: 166 },
  "side-high": { x: 64, y: 118 },
  "side-low": { x: 70, y: 186 },
  waist: { x: 100, y: 206 },
};

/**
 * Rest positions sit just outside the torso outline. Placed any further in, the
 * hands render inside the body and the figure reads as broken rather than idle.
 */
const WEAK_REST: Vec2 = { x: 176, y: 198 };
const DOMINANT_REST: Vec2 = { x: 64, y: 198 };

export const mirror = (point: Vec2): Vec2 => ({ x: CANVAS.width - point.x, y: point.y });

/* ── Handshapes ─────────────────────────────────────────────────────────── */

/**
 * A handshape as continuous parameters rather than a fixed path, so any two
 * shapes can be blended. Sign transitions are continuous in real signing; snapping
 * between drawn shapes is the single most obvious tell of machine output.
 */
export type FingerPose = {
  /** Curl per finger, index to pinky. 0 extended, 1 fully closed. */
  fingers: [number, number, number, number];
  /** 0 tucked across the palm, 1 fully extended. */
  thumb: number;
  /** 0 fingers together, 1 fully splayed. */
  spread: number;
};

export const HAND_SHAPES: Record<HandShapeId, FingerPose> = {
  "flat-b": { fingers: [0, 0, 0, 0], thumb: 0.12, spread: 0.05 },
  five: { fingers: [0, 0, 0, 0], thumb: 1, spread: 1 },
  one: { fingers: [0, 1, 1, 1], thumb: 0.1, spread: 0 },
  "s-fist": { fingers: [1, 1, 1, 1], thumb: 0.28, spread: 0 },
  c: { fingers: [0.42, 0.42, 0.42, 0.42], thumb: 0.62, spread: 0.14 },
  o: { fingers: [0.66, 0.66, 0.66, 0.66], thumb: 0.78, spread: 0.05 },
  claw: { fingers: [0.46, 0.46, 0.46, 0.46], thumb: 0.7, spread: 0.78 },
  "bent-v": { fingers: [0.42, 0.42, 1, 1], thumb: 0.16, spread: 0.5 },
  y: { fingers: [1, 1, 1, 0], thumb: 1, spread: 0.62 },
  ily: { fingers: [0, 1, 1, 0], thumb: 1, spread: 0.92 },
  "open-8": { fingers: [0, 0.85, 0, 0], thumb: 0.52, spread: 0.32 },
  horns: { fingers: [0, 1, 1, 0], thumb: 0.05, spread: 0.7 },
  a: { fingers: [1, 1, 1, 1], thumb: 0.92, spread: 0 },
  d: { fingers: [0, 0.72, 0.72, 0.72], thumb: 0.58, spread: 0.08 },
  f: { fingers: [0.74, 0, 0, 0], thumb: 0.8, spread: 0.3 },
  four: { fingers: [0, 0, 0, 0], thumb: 0, spread: 0.4 },
  g: { fingers: [0, 1, 1, 1], thumb: 0.88, spread: 0 },
  i: { fingers: [1, 1, 1, 0], thumb: 0.2, spread: 0.1 },
  l: { fingers: [0, 1, 1, 1], thumb: 1, spread: 0.45 },
  n: { fingers: [0.78, 0.78, 1, 1], thumb: 0.42, spread: 0.06 },
  r: { fingers: [0.06, 0.06, 1, 1], thumb: 0.18, spread: 0 },
  u: { fingers: [0, 0, 1, 1], thumb: 0.2, spread: 0.04 },
  v: { fingers: [0, 0, 1, 1], thumb: 0.2, spread: 0.62 },
  w: { fingers: [0, 0, 0, 1], thumb: 0.3, spread: 0.68 },
};

export const REST_SHAPE: FingerPose = { fingers: [0.22, 0.22, 0.24, 0.26], thumb: 0.3, spread: 0.16 };

export function blendShape(from: FingerPose, to: FingerPose, t: number): FingerPose {
  const k = clamp(t, 0, 1);
  return {
    fingers: [
      lerp(from.fingers[0], to.fingers[0], k),
      lerp(from.fingers[1], to.fingers[1], k),
      lerp(from.fingers[2], to.fingers[2], k),
      lerp(from.fingers[3], to.fingers[3], k),
    ],
    thumb: lerp(from.thumb, to.thumb, k),
    spread: lerp(from.spread, to.spread, k),
  };
}

/* ── Inverse kinematics ─────────────────────────────────────────────────── */

export type ArmPose = { shoulder: Vec2; elbow: Vec2; wrist: Vec2 };

/**
 * Two-bone IK: places the elbow given a shoulder and a wrist target.
 *
 * Standard circle intersection. The `side` argument picks which of the two
 * solutions to take, so elbows bend outward and downward like a human's rather
 * than inverting through the torso.
 */
export function solveArm(shoulder: Vec2, target: Vec2, side: "dominant" | "weak"): ArmPose {
  const l1 = SKELETON.upperArm;
  const l2 = SKELETON.forearm;

  let dx = target.x - shoulder.x;
  let dy = target.y - shoulder.y;
  let distance = Math.hypot(dx, dy);

  // Unreachable targets are pulled onto the edge of the reachable annulus rather
  // than left to produce a NaN elbow.
  const maxReach = l1 + l2 - 0.5;
  const minReach = Math.abs(l1 - l2) + 0.5;
  if (distance > maxReach) {
    const scale = maxReach / distance;
    dx *= scale;
    dy *= scale;
    distance = maxReach;
  } else if (distance < minReach) {
    const scale = distance > 0.001 ? minReach / distance : 0;
    dx = distance > 0.001 ? dx * scale : minReach;
    dy = distance > 0.001 ? dy * scale : 0;
    distance = minReach;
  }

  const wrist = { x: shoulder.x + dx, y: shoulder.y + dy };
  const a = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));

  const mid = { x: shoulder.x + (a * dx) / distance, y: shoulder.y + (a * dy) / distance };
  // Perpendicular chosen per side so both elbows swing away from the body.
  const sign = side === "dominant" ? 1 : -1;
  const elbow = {
    x: mid.x + sign * h * (-dy / distance),
    y: mid.y + sign * h * (dx / distance),
  };

  return { shoulder, elbow, wrist };
}

/* ── Movement ───────────────────────────────────────────────────────────── */

/**
 * Applies the movement path to a target position.
 *
 * Movement is the parameter that distinguishes otherwise identical signs, so this
 * is not decoration - CHAIR and SIT share a handshape and a location and differ
 * only in whether the movement repeats.
 */
function applyMovement(
  base: Vec2,
  destination: Vec2,
  movement: MovementType,
  progress: number,
  repeat: number,
): Vec2 {
  const t = clamp(progress, 0, 1);
  const eased = easeInOut(t);
  const cycles = Math.max(1, repeat);

  switch (movement) {
    case "hold":
      return base;

    case "straight":
      return { x: lerp(base.x, destination.x, eased), y: lerp(base.y, destination.y, eased) };

    case "arc": {
      // Travel to the destination along a raised path, the way a real arc sign moves.
      const x = lerp(base.x, destination.x, eased);
      const y = lerp(base.y, destination.y, eased) - Math.sin(Math.PI * t) * 16;
      return { x, y };
    }

    case "circular": {
      const angle = 2 * Math.PI * cycles * t;
      return { x: base.x + Math.cos(angle) * 11, y: base.y + Math.sin(angle) * 11 };
    }

    case "tap": {
      // Two crisp contacts rather than one smooth travel.
      const phase = Math.abs(Math.sin(Math.PI * cycles * t));
      return { x: base.x, y: base.y - phase * 9 };
    }

    case "contact": {
      const phase = Math.sin(Math.PI * t);
      return { x: lerp(base.x, destination.x, eased), y: lerp(base.y, destination.y, eased) - phase * 5 };
    }

    case "wiggle": {
      const phase = Math.sin(2 * Math.PI * 3 * t);
      return { x: base.x + phase * 3.5, y: base.y };
    }

    case "alternating": {
      const phase = Math.sin(2 * Math.PI * cycles * t);
      return { x: base.x + phase * 8, y: base.y - Math.abs(phase) * 4 };
    }

    case "twist": {
      const phase = Math.sin(2 * Math.PI * t);
      return { x: base.x + phase * 5, y: base.y + Math.cos(2 * Math.PI * t) * 3 };
    }

    case "open":
    case "close": {
      // The hand travels little; the handshape carries the sign. A small outward
      // drift keeps it from reading as frozen.
      const drift = movement === "open" ? eased * 10 : -eased * 8;
      return { x: base.x - drift, y: base.y };
    }

    default:
      return base;
  }
}

/** Palm orientation, expressed as the rotation applied to the drawn hand. */
function palmRotation(palm: PalmOrientation, side: "dominant" | "weak"): number {
  const flip = side === "dominant" ? 1 : -1;
  switch (palm) {
    case "in": return 0;
    case "out": return 180;
    case "up": return -90 * flip;
    case "down": return 90 * flip;
    case "left": return -45 * flip;
    case "right": return 45 * flip;
    default: return 0;
  }
}

/* ── Full body pose ─────────────────────────────────────────────────────── */

export type HandPose = { arm: ArmPose; shape: FingerPose; rotation: number };

export type BodyPose = {
  dominant: HandPose;
  weak: HandPose;
  head: { tilt: number; turn: number; nod: number };
  /** -1 fully furrowed, 0 neutral, +1 fully raised. */
  brows: number;
  eyes: "neutral" | "wide" | "squint";
  mouth: "neutral" | "open" | "pursed" | "cs" | "mm" | "th" | "puffed";
  /** Horizontal torso lean in pixels. Marks contrast and comparison. */
  torso: number;
};

export const REST_POSE: BodyPose = {
  dominant: { arm: solveArm(SKELETON.shoulderDominant, DOMINANT_REST, "dominant"), shape: REST_SHAPE, rotation: 0 },
  weak: { arm: solveArm(SKELETON.shoulderWeak, WEAK_REST, "weak"), shape: REST_SHAPE, rotation: 0 },
  head: { tilt: 0, turn: 0, nod: 0 },
  brows: 0,
  eyes: "neutral",
  mouth: "neutral",
  torso: 0,
};

/**
 * Non-manual markers are grammar carried on the face and body.
 *
 * `phase` drives the oscillating ones: a negation headshake and an affirmation
 * nod are movements, not static positions, and a still face signing NOT is simply
 * missing the negation.
 */
function facePose(marker: NonManualMarker | undefined, phase: number) {
  const brows = marker?.brows === "raised" ? 1 : marker?.brows === "furrowed" ? -1 : 0;
  const eyes = marker?.eyes === "wide" ? "wide" : marker?.eyes === "squint" ? "squint" : "neutral";
  const mouth = marker?.mouth && marker.mouth !== "neutral" ? marker.mouth : "neutral";

  let tilt = 0;
  let turn = 0;
  let nod = 0;
  switch (marker?.head) {
    case "shake": turn = Math.sin(phase * Math.PI * 4) * 7; break;
    case "nod": nod = Math.sin(phase * Math.PI * 3) * 5; break;
    case "tilt-left": tilt = -6; break;
    case "tilt-right": tilt = 6; break;
    case "forward": nod = 3; break;
    default: break;
  }

  let torso = 0;
  switch (marker?.torso) {
    case "lean-forward": torso = 0; break;
    case "shift-left": torso = -7; break;
    case "shift-right": torso = 7; break;
    default: break;
  }

  return { head: { tilt, turn, nod }, brows, eyes, mouth, torso } as const;
}

/** Idle sway so the avatar reads as present rather than frozen between signs. */
function breathe(time: number): Vec2 {
  return { x: Math.sin(time * 0.7) * 1.6, y: Math.cos(time * 0.9) * 1.2 };
}

export type PoseOptions = {
  /** Media time in seconds, used for idle motion and oscillating markers. */
  time: number;
  /** Suppresses idle sway and oscillation for prefers-reduced-motion. */
  reducedMotion?: boolean;
};

/**
 * The pose for one gesture at one moment.
 *
 * `progress` is 0-1 through the gesture. The caller owns the clock; this function
 * is pure, which is what makes the whole render path testable without a browser.
 */
export function poseForGesture(gesture: Gesture, progress: number, options: PoseOptions): BodyPose {
  const meta = gesture.metadata;
  const reduced = options.reducedMotion ?? false;

  const baseTarget = LOCATION_POINTS[meta.location] ?? LOCATION_POINTS.neutral;
  const endTarget = meta.endLocation ? LOCATION_POINTS[meta.endLocation] : baseTarget;
  const repeat = meta.repeat ?? 1;

  // Reduced motion holds the articulated position instead of travelling through
  // the path. The sign stays identifiable; the movement stops being animation.
  const t = reduced ? 1 : progress;
  const moved = reduced
    ? { x: lerp(baseTarget.x, endTarget.x, 1), y: lerp(baseTarget.y, endTarget.y, 1) }
    : applyMovement(baseTarget, endTarget, meta.movement, t, repeat);

  const sway = reduced ? { x: 0, y: 0 } : breathe(options.time);
  const dominantTarget = { x: moved.x + sway.x, y: moved.y + sway.y };

  const startShape = HAND_SHAPES[meta.handShape] ?? REST_SHAPE;
  const endShape = meta.endHandShape ? HAND_SHAPES[meta.endHandShape] ?? startShape : startShape;
  const shape = reduced ? endShape : blendShape(startShape, endShape, easeInOut(progress));

  const rotation = palmRotation(meta.palm, "dominant");
  const face = facePose(meta.nonManual, reduced ? 0.25 : progress);

  // How the non-dominant hand behaves is a real parameter of the sign, not a
  // rendering choice: two-handed signs are a distinct class in every sign language.
  let weakTarget: Vec2;
  let weakShape = REST_SHAPE;
  let weakRotation = 0;

  switch (meta.handedness) {
    case "both-same":
      weakTarget = mirror(baseTarget);
      weakShape = shape;
      weakRotation = palmRotation(meta.palm, "weak");
      break;
    case "both-mirror":
      weakTarget = mirror(dominantTarget);
      weakShape = shape;
      weakRotation = palmRotation(meta.palm, "weak");
      break;
    case "both-alternating": {
      // Half a cycle out of phase, which is what alternating means.
      const offset = reduced ? 0 : Math.sin(2 * Math.PI * Math.max(1, repeat) * progress + Math.PI) * 8;
      weakTarget = { x: mirror(baseTarget).x - offset, y: baseTarget.y + Math.abs(offset) * 0.35 };
      weakShape = shape;
      weakRotation = palmRotation(meta.palm, "weak");
      break;
    }
    case "non-dominant":
      weakTarget = mirror(dominantTarget);
      weakShape = shape;
      weakRotation = palmRotation(meta.palm, "weak");
      break;
    case "dominant":
    default:
      // The weak hand holds a low base position, or becomes the place of
      // articulation when the sign is made against it.
      weakTarget = meta.location === "weak-hand"
        ? { x: LOCATION_POINTS["weak-hand"].x + 12, y: LOCATION_POINTS["weak-hand"].y + 4 }
        : WEAK_REST;
      weakShape = meta.location === "weak-hand" ? HAND_SHAPES["flat-b"] : REST_SHAPE;
      break;
  }

  return {
    dominant: {
      arm: solveArm(SKELETON.shoulderDominant, dominantTarget, "dominant"),
      shape,
      rotation,
    },
    weak: {
      arm: solveArm(SKELETON.shoulderWeak, weakTarget, "weak"),
      shape: weakShape,
      rotation: weakRotation,
    },
    head: face.head,
    brows: face.brows,
    eyes: face.eyes,
    mouth: face.mouth,
    torso: face.torso,
  };
}

/** Pose between signs: rest, with breathing so the figure stays alive. */
export function idlePose(options: PoseOptions): BodyPose {
  if (options.reducedMotion) return REST_POSE;
  const sway = breathe(options.time);
  return {
    ...REST_POSE,
    dominant: {
      ...REST_POSE.dominant,
      arm: solveArm(SKELETON.shoulderDominant, { x: DOMINANT_REST.x + sway.x, y: DOMINANT_REST.y + sway.y }, "dominant"),
    },
    weak: {
      ...REST_POSE.weak,
      arm: solveArm(SKELETON.shoulderWeak, { x: WEAK_REST.x - sway.x, y: WEAK_REST.y + sway.y }, "weak"),
    },
  };
}

/**
 * Blends two poses.
 *
 * Used for the transition between consecutive signs. Real signing has no
 * discontinuities - the hand travels from one sign into the next - so without
 * this the avatar teleports between positions and becomes hard to read.
 */
export function blendPose(from: BodyPose, to: BodyPose, t: number): BodyPose {
  const k = easeInOut(clamp(t, 0, 1));
  const blendArm = (a: ArmPose, b: ArmPose): ArmPose => ({
    shoulder: a.shoulder,
    elbow: { x: lerp(a.elbow.x, b.elbow.x, k), y: lerp(a.elbow.y, b.elbow.y, k) },
    wrist: { x: lerp(a.wrist.x, b.wrist.x, k), y: lerp(a.wrist.y, b.wrist.y, k) },
  });

  return {
    dominant: {
      arm: blendArm(from.dominant.arm, to.dominant.arm),
      shape: blendShape(from.dominant.shape, to.dominant.shape, k),
      rotation: lerp(from.dominant.rotation, to.dominant.rotation, k),
    },
    weak: {
      arm: blendArm(from.weak.arm, to.weak.arm),
      shape: blendShape(from.weak.shape, to.weak.shape, k),
      rotation: lerp(from.weak.rotation, to.weak.rotation, k),
    },
    head: {
      tilt: lerp(from.head.tilt, to.head.tilt, k),
      turn: lerp(from.head.turn, to.head.turn, k),
      nod: lerp(from.head.nod, to.head.nod, k),
    },
    brows: lerp(from.brows, to.brows, k),
    eyes: k > 0.5 ? to.eyes : from.eyes,
    mouth: k > 0.5 ? to.mouth : from.mouth,
    torso: lerp(from.torso, to.torso, k),
  };
}
