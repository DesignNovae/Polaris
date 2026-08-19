"use client";

/**
 * Skeletal SVG interpreter.
 *
 * Renders gestures. It does not translate, does not fetch, and does not own a
 * clock - it subscribes to the sync engine and draws whatever pose the media time
 * implies. Every piece of linguistic knowledge lives upstream in the lexicon and
 * the grammar; this file knows only geometry.
 *
 * The performance contract from the brief - "the interpreter should never
 * noticeably reduce video playback performance" - is met by never re-rendering.
 * React mounts this SVG exactly once. The frame loop then writes attributes on
 * held refs directly, so a signing avatar running at display refresh rate costs
 * zero React renders and no reconciliation. Frame data must never enter state.
 */

import { useEffect, useRef } from "react";
import type { AvatarRendererProps } from "@/lib/interpreter/render/registry";
import {
  CANVAS,
  SKELETON,
  blendPose,
  idlePose,
  poseForGesture,
  type BodyPose,
  type FingerPose,
} from "@/lib/interpreter/render/poses";
import { clamp } from "@/lib/interpreter/utils/timeline";

/** Fraction of a gesture spent travelling into the next one. */
const TRANSITION_TAIL = 0.18;

/* ── Local hand geometry ────────────────────────────────────────────────── */

const FINGER_BASE_Y = -18;
const FINGER_BASE_X = [-5.6, -1.9, 1.8, 5.4];
const PHALANX = [7.4, 5.8, 4.2];

/** Builds a three-phalanx finger path in hand-local coordinates. */
function fingerPath(baseX: number, angleDeg: number, curl: number): string {
  const c = clamp(curl, 0, 1);
  let angle = (angleDeg * Math.PI) / 180;
  let x = baseX;
  let y = FINGER_BASE_Y;
  let path = `M${x.toFixed(1)},${y.toFixed(1)}`;

  for (let joint = 0; joint < PHALANX.length; joint += 1) {
    if (joint > 0) angle += c * (joint === 1 ? 1.15 : 0.85);
    x += Math.cos(angle) * PHALANX[joint];
    y += Math.sin(angle) * PHALANX[joint];
    path += ` L${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return path;
}

function thumbPath(extension: number): string {
  const t = clamp(extension, 0, 1);
  // Fully extended points out and up; tucked lies across the palm.
  const angle = ((-72 - t * 84) * Math.PI) / 180;
  const baseX = -8.2;
  const baseY = -5.5;
  const midX = baseX + Math.cos(angle) * 8.2;
  const midY = baseY + Math.sin(angle) * 8.2;
  const tipAngle = angle - (1 - t) * 0.9;
  const tipX = midX + Math.cos(tipAngle) * 6;
  const tipY = midY + Math.sin(tipAngle) * 6;
  return `M${baseX},${baseY} L${midX.toFixed(1)},${midY.toFixed(1)} L${tipX.toFixed(1)},${tipY.toFixed(1)}`;
}

/* ── Face geometry ──────────────────────────────────────────────────────── */

function browPath(side: -1 | 1, raise: number): string {
  const cx = SKELETON.headCenter.x + side * 11;
  // Raised brows sit higher and flatten; furrowed brows drop and angle inward.
  const cy = SKELETON.headCenter.y - 9 - raise * 3.5;
  const inner = raise < 0 ? 1.6 : -1.2;
  return `M${(cx - side * 7).toFixed(1)},${(cy - inner * side * side).toFixed(1)} Q${cx.toFixed(1)},${(cy - 2.4 - raise * 1.2).toFixed(1)} ${(cx + side * 7).toFixed(1)},${(cy + inner).toFixed(1)}`;
}

const MOUTH_PATHS: Record<BodyPose["mouth"], string> = {
  neutral: "M111,71 Q120,74 129,71",
  open: "M111,69 Q120,80 129,69 Q120,75 111,69 Z",
  pursed: "M115,70 Q120,67 125,70 Q120,76 115,70 Z",
  cs: "M113,71 Q120,68 127,71",
  mm: "M112,71 L128,71",
  th: "M112,70 Q120,76 128,70 Q120,73 112,70 Z",
  puffed: "M109,70 Q120,79 131,70 Q120,76 109,70 Z",
};

/* ── Renderer ───────────────────────────────────────────────────────────── */

type HandRefs = {
  group: SVGGElement | null;
  palm: SVGRectElement | null;
  fingers: Array<SVGPathElement | null>;
  thumb: SVGPathElement | null;
};

const emptyHandRefs = (): HandRefs => ({ group: null, palm: null, fingers: [null, null, null, null], thumb: null });

export default function SvgAvatarRenderer({ sync, timeline, settings, ariaLabel, onError }: AvatarRendererProps) {
  const upperArmDom = useRef<SVGPathElement | null>(null);
  const forearmDom = useRef<SVGPathElement | null>(null);
  const elbowDom = useRef<SVGCircleElement | null>(null);
  const upperArmWeak = useRef<SVGPathElement | null>(null);
  const forearmWeak = useRef<SVGPathElement | null>(null);
  const elbowWeak = useRef<SVGCircleElement | null>(null);

  const handDom = useRef<HandRefs>(emptyHandRefs());
  const handWeak = useRef<HandRefs>(emptyHandRefs());

  const headGroup = useRef<SVGGElement | null>(null);
  const browLeft = useRef<SVGPathElement | null>(null);
  const browRight = useRef<SVGPathElement | null>(null);
  const eyeLeft = useRef<SVGEllipseElement | null>(null);
  const eyeRight = useRef<SVGEllipseElement | null>(null);
  const mouth = useRef<SVGPathElement | null>(null);
  const torsoGroup = useRef<SVGGElement | null>(null);

  useEffect(() => {
    let lastGestureId: string | null = null;
    let lastSegmentId: string | null = null;

    const applyHand = (refs: HandRefs, pose: { shape: FingerPose; rotation: number }, wrist: { x: number; y: number }, flip: boolean) => {
      const { group, palm, fingers, thumb } = refs;
      if (group) {
        group.setAttribute(
          "transform",
          `translate(${wrist.x.toFixed(1)},${wrist.y.toFixed(1)}) ${flip ? "scale(-1,1) " : ""}rotate(${pose.rotation.toFixed(1)})`,
        );
      }
      if (palm) palm.setAttribute("opacity", "1");
      for (let index = 0; index < 4; index += 1) {
        const finger = fingers[index];
        if (!finger) continue;
        const angle = -90 + (index - 1.5) * pose.shape.spread * 13;
        finger.setAttribute("d", fingerPath(FINGER_BASE_X[index], angle, pose.shape.fingers[index]));
      }
      if (thumb) thumb.setAttribute("d", thumbPath(pose.shape.thumb));
    };

    const draw = (pose: BodyPose) => {
      const { dominant, weak } = pose;

      upperArmDom.current?.setAttribute(
        "d",
        `M${dominant.arm.shoulder.x},${dominant.arm.shoulder.y} L${dominant.arm.elbow.x.toFixed(1)},${dominant.arm.elbow.y.toFixed(1)}`,
      );
      forearmDom.current?.setAttribute(
        "d",
        `M${dominant.arm.elbow.x.toFixed(1)},${dominant.arm.elbow.y.toFixed(1)} L${dominant.arm.wrist.x.toFixed(1)},${dominant.arm.wrist.y.toFixed(1)}`,
      );
      elbowDom.current?.setAttribute("cx", dominant.arm.elbow.x.toFixed(1));
      elbowDom.current?.setAttribute("cy", dominant.arm.elbow.y.toFixed(1));

      upperArmWeak.current?.setAttribute(
        "d",
        `M${weak.arm.shoulder.x},${weak.arm.shoulder.y} L${weak.arm.elbow.x.toFixed(1)},${weak.arm.elbow.y.toFixed(1)}`,
      );
      forearmWeak.current?.setAttribute(
        "d",
        `M${weak.arm.elbow.x.toFixed(1)},${weak.arm.elbow.y.toFixed(1)} L${weak.arm.wrist.x.toFixed(1)},${weak.arm.wrist.y.toFixed(1)}`,
      );
      elbowWeak.current?.setAttribute("cx", weak.arm.elbow.x.toFixed(1));
      elbowWeak.current?.setAttribute("cy", weak.arm.elbow.y.toFixed(1));

      applyHand(handDom.current, dominant, dominant.arm.wrist, false);
      applyHand(handWeak.current, weak, weak.arm.wrist, true);

      headGroup.current?.setAttribute(
        "transform",
        `translate(${(pose.head.turn + pose.torso * 0.5).toFixed(1)},${pose.head.nod.toFixed(1)}) rotate(${pose.head.tilt.toFixed(1)} ${SKELETON.headCenter.x} ${SKELETON.headCenter.y})`,
      );
      torsoGroup.current?.setAttribute("transform", `translate(${pose.torso.toFixed(1)},0)`);

      browLeft.current?.setAttribute("d", browPath(-1, pose.brows));
      browRight.current?.setAttribute("d", browPath(1, pose.brows));

      const eyeScale = pose.eyes === "wide" ? 1.32 : pose.eyes === "squint" ? 0.5 : 1;
      eyeLeft.current?.setAttribute("ry", (2.6 * eyeScale).toFixed(2));
      eyeRight.current?.setAttribute("ry", (2.6 * eyeScale).toFixed(2));

      mouth.current?.setAttribute("d", MOUTH_PATHS[pose.mouth] ?? MOUTH_PATHS.neutral);
    };

    const unsubscribe = sync.subscribeFrames((frame) => {
      try {
        const cursor = timeline.at(frame.mediaTime);

        if (!cursor.gesture) {
          draw(idlePose({ time: frame.mediaTime, reducedMotion: settings.reducedMotion }));
          if (lastGestureId !== null || lastSegmentId !== null) {
            lastGestureId = null;
            lastSegmentId = null;
            sync.reportActive(null, null);
          }
          return;
        }

        const options = { time: frame.mediaTime, reducedMotion: settings.reducedMotion };
        let pose = poseForGesture(cursor.gesture, cursor.progress, options);

        // Travel into the next sign rather than teleporting. Real signing has no
        // discontinuities, and a snap between positions is the fastest way to
        // make an avatar unreadable.
        if (!settings.reducedMotion && cursor.next && cursor.progress > 1 - TRANSITION_TAIL) {
          const blend = (cursor.progress - (1 - TRANSITION_TAIL)) / TRANSITION_TAIL;
          pose = blendPose(pose, poseForGesture(cursor.next, 0, options), blend);
        }

        draw(pose);

        if (cursor.gesture.id !== lastGestureId || cursor.segmentId !== lastSegmentId) {
          lastGestureId = cursor.gesture.id;
          lastSegmentId = cursor.segmentId;
          sync.reportActive(lastGestureId, lastSegmentId);
        }
      } catch (error) {
        onError(error instanceof Error ? error.message : "The interpreter could not draw this frame.");
      }
    });

    // Paint an initial pose so the panel is never blank before playback starts.
    draw(idlePose({ time: 0, reducedMotion: settings.reducedMotion }));

    return unsubscribe;
  }, [sync, timeline, settings.reducedMotion, onError]);

  const contrast = settings.highContrast;
  const skin = contrast ? "rgb(var(--c-ink) / 0.92)" : "rgb(var(--c-ink) / 0.66)";
  const limb = contrast ? "rgb(var(--c-ink) / 0.95)" : "#8B5E3C";
  const hand = contrast ? "rgb(var(--c-ink))" : "#C47D4E";
  const lineWidth = contrast ? 1.9 : 1.4;

  return (
    <svg
      viewBox={`0 0 ${CANVAS.width} ${CANVAS.height}`}
      className="h-full w-full"
      role="img"
      aria-label={ariaLabel}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="polaris-interp-stage" cx="50%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#C47D4E" stopOpacity={contrast ? 0.04 : 0.14} />
          <stop offset="100%" stopColor="#C47D4E" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={CANVAS.width} height={CANVAS.height} fill="url(#polaris-interp-stage)" />

      <g ref={torsoGroup}>
        {/* Neck, drawn before the torso and head so both overlap it cleanly. Without
            it the head reads as a detached circle - the first thing the eye catches
            and the fastest way to lose a viewer's trust in the figure. */}
        <rect
          x={SKELETON.neckTop.x - SKELETON.neckWidth / 2}
          y={SKELETON.neckTop.y}
          width={SKELETON.neckWidth}
          height={SKELETON.neckBottom.y - SKELETON.neckTop.y}
          rx={SKELETON.neckWidth / 2}
          fill={skin}
          stroke={limb}
          strokeWidth={lineWidth}
        />

        {/* Torso. Kept quiet so the eye goes to the hands, where the language is. */}
        <path
          d={`M${SKELETON.shoulderDominant.x - 6},${SKELETON.shoulderDominant.y + 2}
              Q120,108 ${SKELETON.shoulderWeak.x + 6},${SKELETON.shoulderWeak.y + 2}
              L${SKELETON.shoulderWeak.x + 14},${SKELETON.waist.y}
              L${SKELETON.shoulderDominant.x - 14},${SKELETON.waist.y} Z`}
          fill={skin}
          opacity={contrast ? 0.3 : 0.22}
          stroke={limb}
          strokeWidth={lineWidth}
          strokeLinejoin="round"
        />

        {/* Weak-side arm is drawn first so the dominant hand always reads on top. */}
        <path ref={upperArmWeak} fill="none" stroke={limb} strokeWidth="12" strokeLinecap="round" opacity="0.82" />
        <path ref={forearmWeak} fill="none" stroke={limb} strokeWidth="9.5" strokeLinecap="round" opacity="0.82" />
        <circle ref={elbowWeak} r="4.6" fill={limb} opacity="0.82" />
        <g ref={(node) => { handWeak.current.group = node; }}>
          <rect
            ref={(node) => { handWeak.current.palm = node; }}
            x="-8" y="-18" width="16" height="19" rx="6"
            fill={hand} opacity="0.9"
          />
          {[0, 1, 2, 3].map((index) => (
            <path
              key={index}
              ref={(node) => { handWeak.current.fingers[index] = node; }}
              fill="none" stroke={hand} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
            />
          ))}
          <path
            ref={(node) => { handWeak.current.thumb = node; }}
            fill="none" stroke={hand} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" opacity="0.9"
          />
        </g>

        <path ref={upperArmDom} fill="none" stroke={limb} strokeWidth="12.5" strokeLinecap="round" />
        <path ref={forearmDom} fill="none" stroke={limb} strokeWidth="10" strokeLinecap="round" />
        <circle ref={elbowDom} r="4.8" fill={limb} />
        <g ref={(node) => { handDom.current.group = node; }}>
          <rect
            ref={(node) => { handDom.current.palm = node; }}
            x="-8" y="-18" width="16" height="19" rx="6"
            fill={hand}
          />
          {[0, 1, 2, 3].map((index) => (
            <path
              key={index}
              ref={(node) => { handDom.current.fingers[index] = node; }}
              fill="none" stroke={hand} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round"
            />
          ))}
          <path
            ref={(node) => { handDom.current.thumb = node; }}
            fill="none" stroke={hand} strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round"
          />
        </g>
      </g>

      {/* Head last: non-manual markers carry grammar and must never be occluded. */}
      <g ref={headGroup}>
        <circle
          cx={SKELETON.headCenter.x}
          cy={SKELETON.headCenter.y}
          r={SKELETON.headRadius}
          fill={skin}
          stroke={limb}
          strokeWidth={lineWidth}
        />
        <ellipse ref={eyeLeft} cx={SKELETON.headCenter.x - 10} cy={SKELETON.headCenter.y + 1} rx="3.1" ry="2.6" fill="rgb(var(--c-paper))" />
        <ellipse ref={eyeRight} cx={SKELETON.headCenter.x + 10} cy={SKELETON.headCenter.y + 1} rx="3.1" ry="2.6" fill="rgb(var(--c-paper))" />
        <path ref={browLeft} fill="none" stroke="rgb(var(--c-paper))" strokeWidth="2.4" strokeLinecap="round" />
        <path ref={browRight} fill="none" stroke="rgb(var(--c-paper))" strokeWidth="2.4" strokeLinecap="round" />
        <path ref={mouth} d={MOUTH_PATHS.neutral} fill="rgb(var(--c-paper))" stroke="rgb(var(--c-paper))" strokeWidth="1.9" strokeLinecap="round" />
      </g>
    </svg>
  );
}
