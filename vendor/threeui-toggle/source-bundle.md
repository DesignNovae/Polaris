# Skeuomorphic Toggle — Shader — Complete source

Component: `SkeuomorphicToggleCollection`
Variant: **Shader** (`shader`)
Runtime: DOM/CSS + Three.js + Raw WebGL
Source revision: `SHA-256 3e19e7fec9ac`

## Current configured usage

```tsx
import { SkeuomorphicToggleCollection } from "@designcodeio/threeui";
import "@designcodeio/threeui/style.css";

export function Scene() {
  return (
    <div className="shader-frame">
      <SkeuomorphicToggleCollection
        variant="shader"
        mode="auto"
        speed={1.00}
        size={1.00}
        opacity={1.00}
        hue={0}
        saturation={1.00}
        brightness={1.00}
      />
    </div>
  );
}
```

## Required assets

No binary assets are required.

## Full implementation source

This bundle contains all 14 required text source files. Preserve their paths and contents; none are excerpts.

### `src/shaders/skeuomorphic-toggle/SkeuomorphicToggleCollection.tsx`

Role: component · 87 lines · 2333 bytes · SHA-256 `944ee582c2578e470e98f83ea7931018a85b87e44198ef2819613d1a76643150`

```tsx
import { lazy, Suspense, type CSSProperties } from "react";

import type { ToggleModePreference } from "./toggleMode";

export const SKEUOMORPHIC_TOGGLE_VARIANTS = [
  "skeuomorphic-toggle",
  "modern",
  "glass",
  "shader",
] as const;

export type SkeuomorphicToggleVariant = (typeof SKEUOMORPHIC_TOGGLE_VARIANTS)[number];

export type SkeuomorphicToggleCollectionProps = {
  variant?: SkeuomorphicToggleVariant;
  mode?: ToggleModePreference;
  defaultOn?: boolean;
  label?: string;
  speed?: number;
  size?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  onChange?: (on: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

/* The packaged Neuform export stays exactly as it shipped; the three companion
   treatments are first-party React renderers. */
const PackagedToggle = lazy(() =>
  import("../neuform-isolated/NeuformBatchEffects").then((module) => ({ default: module.SkeuomorphicToggle })),
);

const ModernToggle = lazy(() =>
  import("./ModernToggle").then((module) => ({ default: module.ModernToggle })),
);

const GlassToggle = lazy(() =>
  import("./GlassToggle").then((module) => ({ default: module.GlassToggle })),
);

const ShaderToggle = lazy(() =>
  import("./ShaderToggle").then((module) => ({ default: module.ShaderToggle })),
);

const FALLBACK = <div className="threeui-background skeuomorphic-toggle-variant" />;

export function SkeuomorphicToggleCollection({
  variant = "skeuomorphic-toggle",
  onChange,
  defaultOn,
  label,
  speed,
  ...props
}: SkeuomorphicToggleCollectionProps) {
  if (variant === "modern") {
    return (
      <Suspense fallback={FALLBACK}>
        <ModernToggle {...props} defaultOn={defaultOn} label={label} onChange={onChange} />
      </Suspense>
    );
  }

  if (variant === "glass") {
    return (
      <Suspense fallback={FALLBACK}>
        <GlassToggle {...props} defaultOn={defaultOn} label={label} speed={speed} onChange={onChange} />
      </Suspense>
    );
  }

  if (variant === "shader") {
    return (
      <Suspense fallback={FALLBACK}>
        <ShaderToggle {...props} defaultOn={defaultOn} label={label} speed={speed} onChange={onChange} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={FALLBACK}>
      <PackagedToggle {...props} speed={speed} />
    </Suspense>
  );
}
```

### `src/shaders/skeuomorphic-toggle/ModernToggle.tsx`

Role: variant-component · 165 lines · 5394 bytes · SHA-256 `d6545c319a3123ac573756d0d3725e73c279143ea470a48256101222cb37fa16`

```tsx
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import "./modern-toggle.css";
import { clamp, useToggleMode, type ToggleModePreference } from "./toggleMode";

export type ModernToggleProps = {
  mode?: ToggleModePreference;
  defaultOn?: boolean;
  label?: string;
  size?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  onChange?: (on: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

export const MODERN_TOGGLE_DEFAULTS = {
  mode: "auto" as ToggleModePreference,
  defaultOn: true,
  label: "Live Sync",
  size: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

export function ModernToggle({
  mode = MODERN_TOGGLE_DEFAULTS.mode,
  defaultOn = MODERN_TOGGLE_DEFAULTS.defaultOn,
  label = MODERN_TOGGLE_DEFAULTS.label,
  size = MODERN_TOGGLE_DEFAULTS.size,
  opacity = MODERN_TOGGLE_DEFAULTS.opacity,
  hue = MODERN_TOGGLE_DEFAULTS.hue,
  saturation = MODERN_TOGGLE_DEFAULTS.saturation,
  brightness = MODERN_TOGGLE_DEFAULTS.brightness,
  onChange,
  className,
  style,
}: ModernToggleProps) {
  const resolvedMode = useToggleMode(mode);
  const [on, setOn] = useState(defaultOn);
  const switchRef = useRef<HTMLButtonElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);

  /* A light spring rather than an eased transition: the knob leans into the
     travel, trails a little squash behind it, and settles with one small
     overshoot. Damping ratio ~0.67 — enough to read as a spring, well short
     of bouncy. */
  useEffect(() => {
    const control = switchRef.current;
    const thumb = thumbRef.current;
    if (!control || !thumb) return undefined;

    const reduceMotion = typeof window !== "undefined"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const target = on ? 1 : 0;
    let value = Number(thumb.dataset.progress ?? (on ? 1 : 0));
    let velocity = Number(thumb.dataset.velocity ?? 0);
    let handle = 0;
    let last = performance.now();

    const apply = (progress: number, speed: number) => {
      const travel = Math.max(0, control.clientWidth - thumb.offsetLeft * 2 - thumb.offsetWidth);
      /* Squash scales with how fast it is actually moving, and trails the
         direction of travel. */
      const lean = Math.min(1, Math.abs(speed) / 6);
      const scaleX = 1 + lean * 0.16;
      const scaleY = 1 - lean * 0.1;
      thumb.style.transformOrigin = speed >= 0 ? "right center" : "left center";
      thumb.style.transform =
        `translate3d(${(progress * travel).toFixed(2)}px, 0, 0) scale(${scaleX.toFixed(4)}, ${scaleY.toFixed(4)})`;
    };

    if (reduceMotion) {
      thumb.dataset.progress = String(target);
      thumb.dataset.velocity = "0";
      apply(target, 0);
      return undefined;
    }

    const step = (now: number) => {
      const delta = Math.min(0.032, (now - last) / 1000);
      last = now;
      const stiffness = 210;
      const damping = 19.5;
      velocity += ((target - value) * stiffness - velocity * damping) * delta;
      value += velocity * delta;
      thumb.dataset.progress = String(value);
      thumb.dataset.velocity = String(velocity);
      apply(value, velocity);
      if (Math.abs(target - value) < 0.0006 && Math.abs(velocity) < 0.006) {
        value = target;
        velocity = 0;
        thumb.dataset.progress = String(target);
        thumb.dataset.velocity = "0";
        apply(target, 0);
        return;
      }
      handle = window.requestAnimationFrame(step);
    };

    handle = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(handle);
  }, [on]);

  const flip = useCallback(() => {
    setOn((current) => {
      const next = !current;
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const stageStyle = {
    "--modern-toggle-scale": clamp(size, 0.35, 2.5),
    "--modern-toggle-hue": `${clamp(hue, -180, 180)}deg`,
    "--modern-toggle-saturation": clamp(saturation, 0, 2),
    "--modern-toggle-brightness": clamp(brightness, 0.35, 1.65),
    opacity: clamp(opacity, 0.05, 1),
    ...style,
  } as CSSProperties;

  return (
    <div
      className={`modern-toggle${className ? ` ${className}` : ""}`}
      data-mode={resolvedMode}
      data-state={on ? "on" : "off"}
      style={stageStyle}
    >
      <div className="modern-toggle__halo" aria-hidden="true" />
      <div className="modern-toggle__stack">
        <button
          type="button"
          ref={switchRef}
          className="modern-toggle__switch"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={flip}
        >
          <span className="modern-toggle__track" aria-hidden="true" />
          <span ref={thumbRef} className="modern-toggle__thumb" aria-hidden="true">
            <span className="modern-toggle__mark">
              <svg viewBox="0 0 24 24" data-mark="check" aria-hidden="true">
                <path d="M5 12.8 9.6 17.4 19 8" />
              </svg>
              <svg viewBox="0 0 24 24" data-mark="dash" aria-hidden="true">
                <path d="M6.5 12h11" />
              </svg>
            </span>
          </span>
        </button>
        <p className="modern-toggle__caption">
          <span>{label}</span>
          <b>{on ? "On" : "Off"}</b>
        </p>
      </div>
    </div>
  );
}
```

### `src/shaders/skeuomorphic-toggle/modern-toggle.css`

Role: variant-style · 216 lines · 6316 bytes · SHA-256 `2748dc81ffd1f8506c56f6cd316a522df8f5f7bbeda751017a88efb2fc892674`

```css
.modern-toggle,
.modern-toggle *,
.modern-toggle *::before,
.modern-toggle *::after {
  box-sizing: border-box;
}

.modern-toggle {
  --modern-toggle-scale: 1;
  --modern-toggle-hue: 0deg;
  --modern-toggle-saturation: 1;
  --modern-toggle-brightness: 1;
  --modern-toggle-track: #e6e8ec;
  --modern-toggle-track-on: #2f6bff;
  --modern-toggle-edge: rgba(9, 12, 20, 0.09);
  --modern-toggle-edge-on: rgba(9, 12, 20, 0.06);
  --modern-toggle-thumb: #ffffff;
  --modern-toggle-thumb-shadow: 0 1px 1px rgba(9, 12, 20, 0.1), 0 6px 14px -4px rgba(9, 12, 20, 0.28);
  --modern-toggle-mark: #2f6bff;
  --modern-toggle-caption: rgba(15, 20, 32, 0.42);
  --modern-toggle-caption-on: rgba(15, 20, 32, 0.7);
  --modern-toggle-focus: rgba(47, 107, 255, 0.32);
  --modern-toggle-stage: #f7f8fa;
  --modern-toggle-stage-top: #ffffff;
  --modern-toggle-stage-bottom: #eceff4;
  --modern-toggle-halo: rgba(47, 107, 255, 0.1);
  position: relative;
  display: grid;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  place-items: center;
  overflow: hidden;
  isolation: isolate;
  container-type: size;
  background: linear-gradient(180deg, var(--modern-toggle-stage-top) 0%, var(--modern-toggle-stage) 62%, var(--modern-toggle-stage-bottom) 100%);
  color-scheme: light;
  filter: hue-rotate(var(--modern-toggle-hue)) saturate(var(--modern-toggle-saturation)) brightness(var(--modern-toggle-brightness));
  font-family: ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

.modern-toggle[data-mode="dark"] {
  --modern-toggle-track: #22262f;
  --modern-toggle-track-on: #3b7bff;
  --modern-toggle-edge: rgba(255, 255, 255, 0.1);
  --modern-toggle-edge-on: rgba(255, 255, 255, 0.16);
  --modern-toggle-thumb: #f2f4f8;
  --modern-toggle-thumb-shadow: 0 1px 1px rgba(0, 0, 0, 0.5), 0 8px 18px -6px rgba(0, 0, 0, 0.7);
  --modern-toggle-mark: #1f5cf0;
  --modern-toggle-caption: rgba(232, 237, 247, 0.4);
  --modern-toggle-caption-on: rgba(232, 237, 247, 0.74);
  --modern-toggle-focus: rgba(94, 145, 255, 0.4);
  --modern-toggle-stage: #0c0e13;
  --modern-toggle-stage-top: #14171f;
  --modern-toggle-stage-bottom: #06070a;
  --modern-toggle-halo: rgba(59, 123, 255, 0.16);
  color-scheme: dark;
}

/* One soft pool of accent light, so the switch is not floating on a flat fill. */
.modern-toggle__halo {
  position: absolute;
  width: min(72cqw, 620px);
  height: min(72cqh, 380px);
  border-radius: 50%;
  background: radial-gradient(closest-side, var(--modern-toggle-halo), transparent 72%);
  opacity: 0;
  transform: scale(0.86);
  transition: opacity 0.5s ease, transform 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  pointer-events: none;
}

.modern-toggle[data-state="on"] .modern-toggle__halo {
  opacity: 1;
  transform: scale(1);
}

.modern-toggle__stack {
  position: relative;
  display: grid;
  gap: clamp(12px, 2.4cqh, 24px);
  justify-items: center;
  transform: scale(var(--modern-toggle-scale));
}

/* Every measurement below is a share of the switch's own width, so the control
   keeps its proportions at any stage size. */
.modern-toggle__switch {
  position: relative;
  display: block;
  width: clamp(104px, min(18cqw, 33cqh), 330px);
  aspect-ratio: 44 / 25;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  container-type: inline-size;
  -webkit-tap-highlight-color: transparent;
  appearance: none;
}

.modern-toggle__switch:focus-visible {
  outline: none;
}

.modern-toggle__track {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: var(--modern-toggle-track);
  box-shadow: inset 0 0 0 1px var(--modern-toggle-edge);
  transition: background 0.46s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.46s ease;
}

.modern-toggle[data-state="on"] .modern-toggle__track {
  background: var(--modern-toggle-track-on);
  box-shadow: inset 0 0 0 1px var(--modern-toggle-edge-on);
}

.modern-toggle__switch:focus-visible .modern-toggle__track {
  box-shadow: inset 0 0 0 1px var(--modern-toggle-edge), 0 0 0 4px var(--modern-toggle-focus);
}

.modern-toggle[data-state="on"] .modern-toggle__switch:focus-visible .modern-toggle__track {
  box-shadow: inset 0 0 0 1px var(--modern-toggle-edge-on), 0 0 0 4px var(--modern-toggle-focus);
}

/* The knob's transform is driven by a spring in JS, not by a transition —
   a CSS transition cannot squash on the way and settle on arrival, so the
   stretch had to be an :active snap that fought the travel. */
.modern-toggle__thumb {
  position: absolute;
  top: 4.6cqw;
  left: 4.6cqw;
  width: 47.6cqw;
  height: 47.6cqw;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--modern-toggle-thumb);
  box-shadow: var(--modern-toggle-thumb-shadow);
  transform: translate3d(0, 0, 0);
  transform-origin: center;
  will-change: transform;
}

.modern-toggle__mark {
  position: relative;
  width: 36%;
  height: 36%;
  color: var(--modern-toggle-mark);
}

.modern-toggle__mark svg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.6;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: opacity 0.28s ease, transform 0.34s cubic-bezier(0.32, 0.72, 0, 1);
}

.modern-toggle__mark svg[data-mark="check"] {
  opacity: 0;
  transform: scale(0.6) rotate(-18deg);
}

.modern-toggle__mark svg[data-mark="dash"] {
  opacity: 0.34;
  transform: scale(1);
}

.modern-toggle[data-state="on"] .modern-toggle__mark svg[data-mark="check"] {
  opacity: 1;
  transform: scale(1) rotate(0deg);
}

.modern-toggle[data-state="on"] .modern-toggle__mark svg[data-mark="dash"] {
  opacity: 0;
  transform: scale(0.6);
}

.modern-toggle__caption {
  display: flex;
  align-items: baseline;
  gap: 0.55em;
  font-size: clamp(11px, 0.85cqw, 16px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--modern-toggle-caption);
  transition: color 0.4s ease;
}

.modern-toggle[data-state="on"] .modern-toggle__caption {
  color: var(--modern-toggle-caption-on);
}

.modern-toggle__caption b {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .modern-toggle__halo,
  .modern-toggle__track,
  .modern-toggle__mark svg,
  .modern-toggle__caption {
    transition-duration: 0.01ms;
  }
}
```

### `src/shaders/skeuomorphic-toggle/GlassToggle.tsx`

Role: variant-component · 178 lines · 5401 bytes · SHA-256 `406eda34475c2d87b699690097ae50e9e3064dedcacda4cabb3dd8c282122a9b`

```tsx
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import "./glass-toggle.css";
import { createGlassToggleScene, type GlassToggleScene } from "./glassToggleScene";
import { clamp, useToggleMode, type ToggleModePreference } from "./toggleMode";

export type GlassToggleProps = {
  mode?: ToggleModePreference;
  defaultOn?: boolean;
  label?: string;
  speed?: number;
  size?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  onChange?: (on: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

export const GLASS_TOGGLE_DEFAULTS = {
  mode: "auto" as ToggleModePreference,
  defaultOn: true,
  label: "Live Sync",
  speed: 1,
  size: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

export function GlassToggle({
  mode = GLASS_TOGGLE_DEFAULTS.mode,
  defaultOn = GLASS_TOGGLE_DEFAULTS.defaultOn,
  label = GLASS_TOGGLE_DEFAULTS.label,
  speed = GLASS_TOGGLE_DEFAULTS.speed,
  size = GLASS_TOGGLE_DEFAULTS.size,
  opacity = GLASS_TOGGLE_DEFAULTS.opacity,
  hue = GLASS_TOGGLE_DEFAULTS.hue,
  saturation = GLASS_TOGGLE_DEFAULTS.saturation,
  brightness = GLASS_TOGGLE_DEFAULTS.brightness,
  onChange,
  className,
  style,
}: GlassToggleProps) {
  const resolvedMode = useToggleMode(mode);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<GlassToggleScene | null>(null);
  const [on, setOn] = useState(defaultOn);
  const [supported, setSupported] = useState(true);

  const flip = useCallback(() => {
    setOn((current) => {
      const next = !current;
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    let scene: GlassToggleScene;
    try {
      scene = createGlassToggleScene({ canvas, mode: resolvedMode, speed, on: defaultOn });
    } catch {
      setSupported(false);
      return undefined;
    }
    sceneRef.current = scene;

    const syncSwitchFootprint = () => {
      const control = switchRef.current;
      if (!control) return;
      const footprint = scene.measureSwitch();
      control.style.width = `${Math.round(footprint.width)}px`;
      control.style.height = `${Math.round(footprint.height)}px`;
    };

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      scene.resize(box.width, box.height);
      syncSwitchFootprint();
    });
    observer.observe(host);
    scene.resize(host.clientWidth, host.clientHeight);
    syncSwitchFootprint();

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    /* The scene is rebuilt only for the host element; appearance, speed and
       state are pushed through the imperative handles below. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setMode(resolvedMode);
  }, [resolvedMode]);

  useEffect(() => {
    sceneRef.current?.setSpeed(clamp(speed, 0, 3));
  }, [speed]);

  useEffect(() => {
    sceneRef.current?.setSize(clamp(size, 0.35, 2.5));
    const control = switchRef.current;
    const footprint = sceneRef.current?.measureSwitch();
    if (!control || !footprint) return;
    control.style.width = `${Math.round(footprint.width)}px`;
    control.style.height = `${Math.round(footprint.height)}px`;
  }, [size]);

  useEffect(() => {
    sceneRef.current?.setOn(on);
  }, [on]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    sceneRef.current?.setPointer(clamp(x, -1, 1), clamp(-y, -1, 1));
  };

  const stageStyle = {
    "--glass-toggle-hue": `${clamp(hue, -180, 180)}deg`,
    "--glass-toggle-saturation": clamp(saturation, 0, 2),
    "--glass-toggle-brightness": clamp(brightness, 0.35, 1.65),
    opacity: clamp(opacity, 0.05, 1),
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className={`glass-toggle${className ? ` ${className}` : ""}`}
      data-mode={resolvedMode}
      data-state={on ? "on" : "off"}
      style={stageStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
      onClick={flip}
    >
      <canvas ref={canvasRef} className="glass-toggle__canvas" />
      <button
        ref={switchRef}
        type="button"
        className="glass-toggle__switch"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={(event) => {
          /* The whole stage is clickable, so keep the button from toggling twice. */
          event.stopPropagation();
          flip();
        }}
      />
      <p className="glass-toggle__caption">
        <span>{label}</span>
        <b>{on ? "On" : "Off"}</b>
      </p>
      {supported ? null : (
        <p className="glass-toggle__fallback">This variant needs WebGL, which this browser did not provide.</p>
      )}
    </div>
  );
}
```

### `src/shaders/skeuomorphic-toggle/glassToggleScene.ts`

Role: variant-renderer · 662 lines · 23841 bytes · SHA-256 `a708e388eaec0a1feab2b97b59e523eda92c5083202bf0015d7554d9928c4895`

```typescript
import * as THREE from "three";

import type { ToggleMode } from "./toggleMode";

export type GlassToggleSceneOptions = {
  canvas: HTMLCanvasElement;
  mode: ToggleMode;
  speed: number;
  on: boolean;
};

export type GlassToggleScene = {
  setMode: (mode: ToggleMode) => void;
  setSpeed: (speed: number) => void;
  setSize: (size: number) => void;
  setOn: (on: boolean) => void;
  setPointer: (x: number, y: number) => void;
  resize: (width: number, height: number) => void;
  /* Pixel footprint of the rendered pill, so the DOM control can sit on it. */
  measureSwitch: () => { width: number; height: number };
  dispose: () => void;
};

type Palette = {
  /* The stage is a flat sweep, so it carries no light of its own. */
  backdrop: number;
  backdropFloor: number;
  shadow: number;
  glass: number;
  attenuationOff: number;
  attenuationOn: number;
  knob: number;
  knobTransmission: number;
  knobEnv: number;
  shellEmissive: number;
  filamentOn: number;
  filamentOff: number;
  key: number;
  keyIntensity: number;
  ambient: number;
  /* Studio built into the environment map rather than the backdrop. */
  envSkyTop: number;
  envSkyBottom: number;
  envFloor: number;
  envSoftbox: number;
  envIntensity: number;
};

const PALETTES: Record<ToggleMode, Palette> = {
  light: {
    backdrop: 0xe9ecf1,
    backdropFloor: 0xdfe3ea,
    shadow: 0.3,
    glass: 0xf4f8ff,
    attenuationOff: 0xdfe8f5,
    attenuationOn: 0x2f6bff,
    knob: 0xfdfeff,
    knobTransmission: 0.78,
    knobEnv: 1.3,
    shellEmissive: 0.02,
    filamentOn: 0x2f6bff,
    filamentOff: 0xc4ccd8,
    key: 0xffffff,
    keyIntensity: 0.18,
    ambient: 0.015,
    envSkyTop: 0xffffff,
    envSkyBottom: 0x9aa4b4,
    envFloor: 0x2a3040,
    envSoftbox: 0xffffff,
    envIntensity: 1.0,
  },
  dark: {
    backdrop: 0x0a0b0f,
    backdropFloor: 0x06070a,
    shadow: 0.55,
    glass: 0xe8eefb,
    attenuationOff: 0x7f93b8,
    attenuationOn: 0x2f6bff,
    knob: 0xf2f6ff,
    knobTransmission: 0.58,
    knobEnv: 2.3,
    shellEmissive: 0.62,
    filamentOn: 0x3b7bff,
    filamentOff: 0x161a24,
    key: 0xd8e4ff,
    keyIntensity: 0.12,
    ambient: 0.006,
    envSkyTop: 0xdde6f5,
    envSkyBottom: 0x1a2030,
    envFloor: 0x04050a,
    envSoftbox: 0xffffff,
    envIntensity: 0.9,
  },
};

/* Proportioned like a physical switch: the capsule is twice as wide as it is
   tall and the knob clears the wall by a constant seat. */
const TRACK_RADIUS = 0.6;
const TRACK_LENGTH = 1.2;
const THUMB_RADIUS = TRACK_RADIUS - 0.225;
const TRAVEL = (TRACK_LENGTH / 2) * 0.8;
const CONTROL_WIDTH = TRACK_LENGTH + TRACK_RADIUS * 2;
/* The pill keeps ~13% of the stage height and never more than 18% of its
   width, so all four variants read at the same size in the picker. */
const VIEW_HEIGHT = (TRACK_RADIUS * 2) / 0.13;
const WIDTH_SHARE = 0.18;

function srgb(hex: number) {
  return new THREE.Color(hex).convertSRGBToLinear();
}

function hex(value: number) {
  return `#${value.toString(16).padStart(6, "0")}`;
}

/* A studio, not a lamp rig — and an HDR one. A canvas environment tops out at
   1.0, which is why LDR reflections read as dull grey wash; these softboxes run
   12-40x above the sky, so the tone mapper blows them into the hard specular
   streaks that make a surface read as glass. Everything reflected comes from
   here, which is why the stage behind the control can stay flat. */
type Softbox = {
  u: number;
  v: number;
  halfWidth: number;
  halfHeight: number;
  intensity: number;
  feather: number;
  warm: number;
};

const SOFTBOXES: readonly Softbox[] = [
  /* Broad key, high and camera-left. */
  { u: 0.3, v: 0.2, halfWidth: 0.155, halfHeight: 0.135, intensity: 19, feather: 0.86, warm: 0.04 },
  /* Narrow strip: the hard highlight that runs the length of the shoulder. */
  { u: 0.52, v: 0.115, halfWidth: 0.17, halfHeight: 0.04, intensity: 15, feather: 0.9, warm: 0 },
  /* Cool rim from behind camera-right. */
  { u: 0.86, v: 0.31, halfWidth: 0.085, halfHeight: 0.09, intensity: 10, feather: 0.92, warm: -0.06 },
  /* Backlight, directly behind the subject at u=0.25. At the silhouette the
     reflection vector points straight away from the camera, so this is the
     source that draws the clean border all the way round — and it lights the
     transmission through the body at the same time. A ring around the horizon
     instead reflects onto the equator and paints a bar across the middle. */
  { u: 0.25, v: 0.5, halfWidth: 0.1, halfHeight: 0.2, intensity: 6.5, feather: 0.8, warm: 0 },
  /* A small hard source high and camera-left: the crisp catchlight on the
     sphere, which a broad softbox alone can never give. */
  { u: 0.95, v: 0.21, halfWidth: 0.028, halfHeight: 0.032, intensity: 70, feather: 0.45, warm: 0.02 },
  /* Low bounce so the underside is not dead black. */
  { u: 0.5, v: 0.82, halfWidth: 0.5, halfHeight: 0.22, intensity: 0.5, feather: 1, warm: 0.02 },
];

function smoothFalloff(distance: number, extent: number, feather: number) {
  const inner = extent * (1 - feather);
  if (distance <= inner) return 1;
  if (distance >= extent) return 0;
  const t = (distance - inner) / (extent - inner);
  return 1 - t * t * (3 - 2 * t);
}

function buildEnvironmentTexture(palette: Palette) {
  const width = 512;
  const height = 256;
  const data = new Float32Array(width * height * 4);
  const skyTop = srgb(palette.envSkyTop);
  const skyBottom = srgb(palette.envSkyBottom);
  const floor = srgb(palette.envFloor);
  const box = srgb(palette.envSoftbox);

  for (let y = 0; y < height; y += 1) {
    /* three's equirect maps texture V=0 to straight *down*, so the rows have
       to be walked in reverse for `v` to mean what the softbox list says it
       means. Without this the whole studio is upside down and the subject is
       lit from the floor. */
    const v = 1 - y / (height - 1);
    /* Sky above, floor below, blended across a wide band — a hard horizon
       reflects as a seam cutting the capsule in half. */
    const ground = smoothFalloff(Math.max(0, 0.62 - v), 0.34, 1);
    const skyMix = Math.min(1, v / 0.56);
    const skyR = skyTop.r + (skyBottom.r - skyTop.r) * skyMix;
    const skyG = skyTop.g + (skyBottom.g - skyTop.g) * skyMix;
    const skyB = skyTop.b + (skyBottom.b - skyTop.b) * skyMix;
    const fade = 1 - Math.max(0, v - 0.62) * 1.1;
    const baseR = skyR + (floor.r * fade - skyR) * ground;
    const baseG = skyG + (floor.g * fade - skyG) * ground;
    const baseB = skyB + (floor.b * fade - skyB) * ground;

    for (let x = 0; x < width; x += 1) {
      const u = x / (width - 1);
      let r = baseR;
      let g = baseG;
      let b = baseB;

      for (const light of SOFTBOXES) {
        /* Azimuth wraps, so measure the short way round. */
        let du = Math.abs(u - light.u);
        if (du > 0.5) du = 1 - du;
        const dv = Math.abs(v - light.v);
        /* Elliptical, not separable: a product of two 1D falloffs reflects as a
           rectangle with visible corners. */
        const radial = Math.sqrt(
          (du / light.halfWidth) * (du / light.halfWidth)
          + (dv / light.halfHeight) * (dv / light.halfHeight),
        );
        if (radial >= 1) continue;
        const strength = smoothFalloff(radial, 1, light.feather) * light.intensity;
        r += box.r * strength * (1 + light.warm);
        g += box.g * strength;
        b += box.b * strength * (1 - light.warm);
      }

      const index = (y * width + x) * 4;
      data[index] = r;
      data[index + 1] = g;
      data[index + 2] = b;
      data[index + 3] = 1;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat, THREE.FloatType);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/* Micro-surface: real glass is never perfectly smooth, and the tiny variation
   is what stops a reflection from reading as a flat gradient. */
function buildMicroTextures() {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const image = ctx.createImageData(size, size);
  const height = new Float32Array(size * size);
  let seed = 0x9e3779b9;
  const random = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };

  /* Two octaves of blurred value noise plus a faint polishing grain. */
  const coarse = new Float32Array(64 * 64);
  for (let i = 0; i < coarse.length; i += 1) coarse[i] = random();
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = (x / size) * 64;
      const v = (y / size) * 64;
      const x0 = Math.floor(u);
      const y0 = Math.floor(v);
      const fx = u - x0;
      const fy = v - y0;
      const sx = fx * fx * (3 - 2 * fx);
      const sy = fy * fy * (3 - 2 * fy);
      const at = (ax: number, ay: number) => coarse[((ay & 63) * 64) + (ax & 63)];
      const a = at(x0, y0);
      const b = at(x0 + 1, y0);
      const c = at(x0, y0 + 1);
      const d = at(x0 + 1, y0 + 1);
      const value = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
      const grain = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      height[(y * size) + x] = value * 0.86 + (grain - Math.floor(grain)) * 0.14;
    }
  }

  for (let i = 0; i < height.length; i += 1) {
    /* Mostly smooth, with a shallow floor so roughness never reaches zero. */
    const value = 168 + height[i] * 78;
    image.data[i * 4] = value;
    image.data[i * 4 + 1] = value;
    image.data[i * 4 + 2] = value;
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const roughness = new THREE.CanvasTexture(canvas);
  roughness.wrapS = THREE.RepeatWrapping;
  roughness.wrapT = THREE.RepeatWrapping;

  /* Derive a matching normal map so the micro-relief bends highlights too. */
  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  const normalCtx = normalCanvas.getContext("2d");
  if (!normalCtx) return { roughness, normal: null };
  const normalImage = normalCtx.createImageData(size, size);
  const at = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const dx = at(x + 1, y) - at(x - 1, y);
      const dy = at(x, y + 1) - at(x, y - 1);
      const index = (y * size + x) * 4;
      normalImage.data[index] = 128 + dx * 110;
      normalImage.data[index + 1] = 128 - dy * 110;
      normalImage.data[index + 2] = 255;
      normalImage.data[index + 3] = 255;
    }
  }
  normalCtx.putImageData(normalImage, 0, 0);
  const normal = new THREE.CanvasTexture(normalCanvas);
  normal.wrapS = THREE.RepeatWrapping;
  normal.wrapT = THREE.RepeatWrapping;
  return { roughness, normal };
}

const BACKDROP_VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

/* Deliberately featureless: a seamless sweep with one contact shadow. All the
   detail in the render comes off the environment map. */
const BACKDROP_FRAGMENT = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uAspect;
uniform float uShadow;
uniform vec3 uBackdrop;
uniform vec3 uFloor;

void main() {
  vec2 p = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
  vec3 color = mix(uFloor, uBackdrop, smoothstep(-0.42, 0.16, p.y));

  /* Contact shadow, baked into the opaque sweep so the glass refracts it. */
  vec2 core = (p - vec2(0.0, -0.052)) / vec2(0.148, 0.038);
  vec2 spread = (p - vec2(0.0, -0.062)) / vec2(0.28, 0.1);
  float occlusion = exp(-dot(core, core) * 0.9) * 0.72 + exp(-dot(spread, spread) * 0.8) * 0.42;
  color *= 1.0 - clamp(occlusion, 0.0, 1.0) * uShadow;

  /* A dither step wide enough to kill banding on a near-flat sweep. */
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  color += (dither - 0.5) * 0.0035;

  gl_FragColor = vec4(color, 1.0);
}
`;

export function createGlassToggleScene({
  canvas,
  mode,
  speed,
  on,
}: GlassToggleSceneOptions): GlassToggleScene {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 40);
  camera.position.set(0, 0.22, 9.4);
  camera.lookAt(0, 0, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const backdropUniforms = {
    uAspect: { value: 1 },
    uShadow: { value: PALETTES[mode].shadow },
    uBackdrop: { value: srgb(PALETTES[mode].backdrop) },
    uFloor: { value: srgb(PALETTES[mode].backdropFloor) },
  };

  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.ShaderMaterial({
      uniforms: backdropUniforms,
      vertexShader: BACKDROP_VERTEX,
      fragmentShader: BACKDROP_FRAGMENT,
      depthWrite: false,
    }),
  );
  backdrop.position.z = -3.2;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  const micro = buildMicroTextures();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  if (micro?.roughness) {
    micro.roughness.anisotropy = maxAnisotropy;
    micro.roughness.repeat.set(3, 2);
  }
  if (micro?.normal) {
    micro.normal.anisotropy = maxAnisotropy;
    micro.normal.repeat.set(3, 2);
  }

  /* One rig, turned a few degrees so the capsule reads as a solid object. */
  const rig = new THREE.Group();
  rig.rotation.set(-0.05, 0.13, 0);
  scene.add(rig);

  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: srgb(PALETTES[mode].glass),
    metalness: 0,
    roughness: 0.115,
    transmission: 1,
    ior: 1.62,
    clearcoat: 1,
    clearcoatRoughness: 0.008,
    attenuationColor: srgb(PALETTES[mode].attenuationOff),
    attenuationDistance: 6,
    envMapIntensity: PALETTES[mode].envIntensity,
    specularIntensity: 1,
    roughnessMap: micro?.roughness ?? null,
    clearcoatNormalMap: micro?.normal ?? null,
    clearcoatNormalScale: new THREE.Vector2(0.13, 0.13),
  });
  /* @types/three 0.149 leaves these out of the parameters interface. */
  glassMaterial.thickness = 1.25;
  /* A whisper of thin-film so the shoulders pick up colour the way real
     coated glass does. */
  glassMaterial.iridescence = 0.2;
  glassMaterial.iridescenceIOR = 1.3;
  glassMaterial.iridescenceThicknessRange = [120, 420];
  glassMaterial.emissive = srgb(PALETTES[mode].filamentOn);
  glassMaterial.emissiveIntensity = 0;

  const track = new THREE.Mesh(
    new THREE.CapsuleGeometry(TRACK_RADIUS, TRACK_LENGTH, 64, 192),
    glassMaterial,
  );
  track.rotation.z = Math.PI / 2;
  /* Flattened in depth: a switch is a lozenge, not a capsule pill. */
  track.scale.set(1, 1, 0.82);
  rig.add(track);

  /* A slim lit filament lying in the bottom of the trough. It stays opaque so
     it reaches the transmission backdrop and the shell actually refracts it. */
  const filamentMaterial = new THREE.MeshStandardMaterial({
    color: srgb(PALETTES[mode].filamentOff),
    emissive: srgb(PALETTES[mode].filamentOn),
    emissiveIntensity: on ? 1 : 0,
    roughness: 0.34,
    metalness: 0,
  });
  const filament = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.105, TRACK_LENGTH + 0.16, 16, 64),
    filamentMaterial,
  );
  filament.rotation.z = Math.PI / 2;
  filament.position.set(0, -0.31, -0.04);
  rig.add(filament);

  /* The knob is a frosted lens standing proud of the capsule, so it refracts
     both the sweep behind the stage and the filament inside the trough. */
  const knobMaterial = new THREE.MeshPhysicalMaterial({
    color: srgb(PALETTES[mode].knob),
    metalness: 0,
    roughness: 0.125,
    transmission: PALETTES[mode].knobTransmission,
    ior: 1.47,
    clearcoat: 1,
    clearcoatRoughness: 0.01,
    attenuationColor: srgb(PALETTES[mode].attenuationOff),
    attenuationDistance: 3,
    envMapIntensity: PALETTES[mode].envIntensity * PALETTES[mode].knobEnv,
    roughnessMap: micro?.roughness ?? null,
    clearcoatNormalMap: micro?.normal ?? null,
    clearcoatNormalScale: new THREE.Vector2(0.1, 0.1),
  });
  knobMaterial.thickness = 0.62;
  knobMaterial.iridescence = 0.12;
  knobMaterial.iridescenceIOR = 1.25;
  knobMaterial.iridescenceThicknessRange = [100, 380];

  const knob = new THREE.Mesh(new THREE.SphereGeometry(THUMB_RADIUS, 160, 96), knobMaterial);
  /* Left perfectly spherical — no depth squash. Its equator has to sit at the
     shell's front surface (TRACK_RADIUS * the depth flattening): any deeper and
     the silhouette is read through the curved wall, which refracts it into an
     egg. At the surface the outline is a true circle and the back half still
     sits down in the trough. */
  knob.position.z = TRACK_RADIUS * 0.82;
  rig.add(knob);

  /* IBL does nearly all the work; the key is only here to keep a terminator. */
  const ambient = new THREE.AmbientLight(srgb(0xffffff), PALETTES[mode].ambient);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(srgb(PALETTES[mode].key), PALETTES[mode].keyIntensity);
  key.position.set(2.2, 3.4, 4);
  scene.add(key);

  let environmentTarget: THREE.WebGLRenderTarget | null = null;

  function applyEnvironment(next: ToggleMode) {
    const source = buildEnvironmentTexture(PALETTES[next]);
    if (!source) return;
    const nextTarget = pmrem.fromEquirectangular(source);
    source.dispose();
    environmentTarget?.dispose();
    environmentTarget = nextTarget;
    scene.environment = nextTarget.texture;
  }

  applyEnvironment(mode);

  let currentMode = mode;
  let currentSpeed = speed;
  let target = on ? 1 : 0;
  let progress = target;
  let velocity = 0;
  let onGlow = target;
  const attenuationOffColor = srgb(PALETTES[mode].attenuationOff);
  const attenuationOnColor = srgb(PALETTES[mode].attenuationOn);
  const filamentOffColor = srgb(PALETTES[mode].filamentOff);
  const filamentOnColor = srgb(PALETTES[mode].filamentOn);
  const pointer = new THREE.Vector2(0, 0);
  const smoothedPointer = new THREE.Vector2(0, 0);
  let width = 1;
  let height = 1;
  let baseDistance = camera.position.z;
  let sizeScale = 1;
  let disposed = false;
  let last = performance.now();
  let elapsed = 0;

  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function applyPalette(next: ToggleMode) {
    const palette = PALETTES[next];
    backdropUniforms.uBackdrop.value = srgb(palette.backdrop);
    backdropUniforms.uFloor.value = srgb(palette.backdropFloor);
    backdropUniforms.uShadow.value = palette.shadow;
    glassMaterial.color = srgb(palette.glass);
    glassMaterial.envMapIntensity = palette.envIntensity;
    knobMaterial.color = srgb(palette.knob);
    knobMaterial.attenuationColor = srgb(palette.attenuationOff);
    knobMaterial.transmission = palette.knobTransmission;
    knobMaterial.envMapIntensity = palette.envIntensity * palette.knobEnv;
    attenuationOffColor.copy(srgb(palette.attenuationOff));
    attenuationOnColor.copy(srgb(palette.attenuationOn));
    filamentOffColor.copy(srgb(palette.filamentOff));
    filamentOnColor.copy(srgb(palette.filamentOn));
    filamentMaterial.emissive = srgb(palette.filamentOn);
    glassMaterial.emissive = srgb(palette.filamentOn);
    ambient.intensity = palette.ambient;
    key.color = srgb(palette.key);
    key.intensity = palette.keyIntensity;
    applyEnvironment(next);
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, Math.round(nextWidth));
    height = Math.max(1, Math.round(nextHeight));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;

    /* Frame the control identically at every stage size by moving the camera
       rather than scaling the meshes — glass thickness is in world units, so a
       scaled pill would refract differently at every viewport. */
    const halfFov = (camera.fov * Math.PI) / 360;
    const visibleHeight = Math.max(VIEW_HEIGHT, CONTROL_WIDTH / (WIDTH_SHARE * camera.aspect)) / sizeScale;
    baseDistance = visibleHeight / (2 * Math.tan(halfFov));
    camera.position.z = baseDistance;
    camera.updateProjectionMatrix();

    const backdropHeight = 2 * (baseDistance - backdrop.position.z) * Math.tan(halfFov);
    backdrop.scale.set(backdropHeight * camera.aspect * 1.08, backdropHeight * 1.08, 1);
    backdropUniforms.uAspect.value = camera.aspect;
  }

  function measureSwitch() {
    const halfWidth = TRACK_LENGTH / 2 + TRACK_RADIUS;
    const left = new THREE.Vector3(-halfWidth, 0, 0).project(camera);
    const right = new THREE.Vector3(halfWidth, 0, 0).project(camera);
    const top = new THREE.Vector3(0, TRACK_RADIUS, 0).project(camera);
    const bottom = new THREE.Vector3(0, -TRACK_RADIUS, 0).project(camera);
    return {
      width: Math.abs(right.x - left.x) * 0.5 * width,
      height: Math.abs(top.y - bottom.y) * 0.5 * height,
    };
  }

  function frame(now: number) {
    if (disposed) return;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += delta * currentSpeed;

    /* Critically damped travel — it arrives without the rubbery overshoot a
       spring would give a glass object this heavy-looking. */
    const stiffness = reduceMotion ? 400 : 150;
    const damping = 2 * Math.sqrt(stiffness);
    const step = reduceMotion ? Math.min(delta, 0.016) : delta;
    velocity += (target - progress) * stiffness * step - velocity * damping * step;
    progress += velocity * step;

    onGlow += (target - onGlow) * Math.min(1, delta * 6);
    smoothedPointer.lerp(pointer, Math.min(1, delta * 3.2));

    knob.position.x = (progress * 2 - 1) * TRAVEL;
    knob.rotation.z = -progress * Math.PI * 0.9;
    knob.rotation.y = smoothedPointer.x * 0.3;

    filamentMaterial.emissiveIntensity = onGlow * (currentMode === "dark" ? 3.2 : 1.4);
    filamentMaterial.color.copy(filamentOffColor).lerp(filamentOnColor, onGlow * 0.85);
    glassMaterial.attenuationColor.copy(attenuationOffColor).lerp(attenuationOnColor, onGlow);
    glassMaterial.attenuationDistance = 6 - onGlow * 4.8;
    glassMaterial.emissiveIntensity = onGlow * PALETTES[currentMode].shellEmissive;

    camera.position.set(
      smoothedPointer.x * 0.5,
      0.22 + smoothedPointer.y * 0.32,
      baseDistance,
    );
    camera.lookAt(0, 0, 0);

    renderer.render(scene, camera);
    window.requestAnimationFrame(frame);
  }

  window.requestAnimationFrame(frame);

  return {
    setMode(next) {
      if (next === currentMode) return;
      currentMode = next;
      applyPalette(next);
    },
    setSpeed(next) {
      currentSpeed = next;
    },
    setSize(next) {
      sizeScale = next;
      resize(width, height);
    },
    setOn(next) {
      target = next ? 1 : 0;
    },
    setPointer(x, y) {
      pointer.set(x, y);
    },
    resize,
    measureSwitch,
    dispose() {
      disposed = true;
      environmentTarget?.dispose();
      pmrem.dispose();
      micro?.roughness?.dispose();
      micro?.normal?.dispose();
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material = object.material;
        if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
        else material.dispose();
      });
      renderer.dispose();
    },
  };
}
```

### `src/shaders/skeuomorphic-toggle/glass-toggle.css`

Role: variant-style · 108 lines · 2718 bytes · SHA-256 `d87d193e981e191dbab386f1dc7dbcfbe46fb709bcc7085305455acd217765f3`

```css
.glass-toggle,
.glass-toggle *,
.glass-toggle *::before,
.glass-toggle *::after {
  box-sizing: border-box;
}

.glass-toggle {
  --glass-toggle-hue: 0deg;
  --glass-toggle-saturation: 1;
  --glass-toggle-brightness: 1;
  --glass-toggle-stage: #eef1f6;
  --glass-toggle-caption: rgba(17, 22, 34, 0.5);
  --glass-toggle-caption-on: rgba(17, 22, 34, 0.78);
  --glass-toggle-focus: rgba(58, 120, 255, 0.45);
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  container-type: size;
  background: var(--glass-toggle-stage);
  color-scheme: light;
  filter: hue-rotate(var(--glass-toggle-hue)) saturate(var(--glass-toggle-saturation)) brightness(var(--glass-toggle-brightness));
  font-family: ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.glass-toggle[data-mode="dark"] {
  --glass-toggle-stage: #08090d;
  --glass-toggle-caption: rgba(233, 238, 250, 0.46);
  --glass-toggle-caption-on: rgba(233, 238, 250, 0.82);
  --glass-toggle-focus: rgba(122, 168, 255, 0.5);
  color-scheme: dark;
}

.glass-toggle__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* A real control sitting exactly over the rendered pill, so the scene stays
   keyboard- and screen-reader-operable. */
.glass-toggle__switch {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 200px;
  height: 112px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
  appearance: none;
}

.glass-toggle__switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--glass-toggle-focus);
}

.glass-toggle__caption {
  position: absolute;
  left: 50%;
  /* The control keeps 13% of the stage height, so the caption tracks the centre
     rather than the floor — otherwise it drifts away in a tall frame. */
  top: calc(50% + max(52px, 11cqh));
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 0.55em;
  margin: 0;
  font-size: clamp(11px, 1.9cqw, 14px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--glass-toggle-caption);
  transition: color 0.45s ease;
  pointer-events: none;
}

.glass-toggle[data-state="on"] .glass-toggle__caption {
  color: var(--glass-toggle-caption-on);
}

.glass-toggle__caption b {
  font-weight: 500;
}

.glass-toggle__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: var(--glass-toggle-caption);
}
```

### `src/shaders/skeuomorphic-toggle/ShaderToggle.tsx`

Role: variant-component · 179 lines · 5253 bytes · SHA-256 `69bfab67ebe67b1e886c66c69451a64db9241267d922bfe774dc491df1f592ef`

```tsx
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent } from "react";

import "./shader-toggle.css";
import { createShaderToggleScene, type ShaderToggleScene } from "./shaderToggleScene";
import { clamp, useToggleMode, type ToggleModePreference } from "./toggleMode";

export type ShaderToggleProps = {
  mode?: ToggleModePreference;
  defaultOn?: boolean;
  label?: string;
  speed?: number;
  size?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  onChange?: (on: boolean) => void;
  className?: string;
  style?: CSSProperties;
};

export const SHADER_TOGGLE_DEFAULTS = {
  mode: "auto" as ToggleModePreference,
  defaultOn: true,
  label: "Live Sync",
  speed: 1,
  size: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

export function ShaderToggle({
  mode = SHADER_TOGGLE_DEFAULTS.mode,
  defaultOn = SHADER_TOGGLE_DEFAULTS.defaultOn,
  label = SHADER_TOGGLE_DEFAULTS.label,
  speed = SHADER_TOGGLE_DEFAULTS.speed,
  size = SHADER_TOGGLE_DEFAULTS.size,
  opacity = SHADER_TOGGLE_DEFAULTS.opacity,
  hue = SHADER_TOGGLE_DEFAULTS.hue,
  saturation = SHADER_TOGGLE_DEFAULTS.saturation,
  brightness = SHADER_TOGGLE_DEFAULTS.brightness,
  onChange,
  className,
  style,
}: ShaderToggleProps) {
  const resolvedMode = useToggleMode(mode);
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const switchRef = useRef<HTMLButtonElement>(null);
  const sceneRef = useRef<ShaderToggleScene | null>(null);
  const [on, setOn] = useState(defaultOn);
  const [supported, setSupported] = useState(true);

  const flip = useCallback(() => {
    setOn((current) => {
      const next = !current;
      onChange?.(next);
      return next;
    });
  }, [onChange]);

  const syncSwitchFootprint = useCallback(() => {
    const control = switchRef.current;
    const footprint = sceneRef.current?.measureSwitch();
    if (!control || !footprint) return;
    control.style.width = `${Math.round(footprint.width)}px`;
    control.style.height = `${Math.round(footprint.height)}px`;
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return undefined;

    let scene: ShaderToggleScene;
    try {
      scene = createShaderToggleScene({
        canvas,
        mode: resolvedMode,
        speed,
        size: clamp(size, 0.35, 2.5),
        on: defaultOn,
      });
    } catch {
      setSupported(false);
      return undefined;
    }
    sceneRef.current = scene;

    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      scene.resize(box.width, box.height);
      syncSwitchFootprint();
    });
    observer.observe(host);
    scene.resize(host.clientWidth, host.clientHeight);
    syncSwitchFootprint();

    return () => {
      observer.disconnect();
      scene.dispose();
      sceneRef.current = null;
    };
    /* Built once for the host element; every knob below is pushed in. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    sceneRef.current?.setMode(resolvedMode);
  }, [resolvedMode]);

  useEffect(() => {
    sceneRef.current?.setSpeed(clamp(speed, 0, 3));
  }, [speed]);

  useEffect(() => {
    sceneRef.current?.setSize(clamp(size, 0.35, 2.5));
    syncSwitchFootprint();
  }, [size, syncSwitchFootprint]);

  useEffect(() => {
    sceneRef.current?.setOn(on);
  }, [on]);

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const host = hostRef.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;
    sceneRef.current?.setPointer(clamp(x, -1, 1), clamp(-y, -1, 1));
  };

  const stageStyle = {
    "--shader-toggle-hue": `${clamp(hue, -180, 180)}deg`,
    "--shader-toggle-saturation": clamp(saturation, 0, 2),
    "--shader-toggle-brightness": clamp(brightness, 0.35, 1.65),
    opacity: clamp(opacity, 0.05, 1),
    ...style,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className={`shader-toggle${className ? ` ${className}` : ""}`}
      data-mode={resolvedMode}
      data-state={on ? "on" : "off"}
      style={stageStyle}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
      onClick={flip}
    >
      <canvas ref={canvasRef} className="shader-toggle__canvas" />
      <button
        ref={switchRef}
        type="button"
        className="shader-toggle__switch"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={(event) => {
          /* The whole stage is clickable, so keep the button from toggling twice. */
          event.stopPropagation();
          flip();
        }}
      />
      <p className="shader-toggle__caption">
        <span>{label}</span>
        <b>{on ? "On" : "Off"}</b>
      </p>
      {supported ? null : (
        <p className="shader-toggle__fallback">This variant needs WebGL, which this browser did not provide.</p>
      )}
    </div>
  );
}
```

### `src/shaders/skeuomorphic-toggle/shaderToggleScene.ts`

Role: variant-renderer · 199 lines · 6726 bytes · SHA-256 `6eadd83c7abeaadb2bb4a9c44624234050f7faf6a36af6ace8738b36f9dfb673`

```typescript
import { buildShaderToggleFragment, SHADER_TOGGLE_VERTEX } from "./shaderToggleGlsl";
import type { ToggleMode } from "./toggleMode";

export type ShaderToggleSceneOptions = {
  canvas: HTMLCanvasElement;
  mode: ToggleMode;
  speed: number;
  size: number;
  on: boolean;
};

export type ShaderToggleScene = {
  setMode: (mode: ToggleMode) => void;
  setSpeed: (speed: number) => void;
  setSize: (size: number) => void;
  setOn: (on: boolean) => void;
  setPointer: (x: number, y: number) => void;
  resize: (width: number, height: number) => void;
  /* CSS-pixel footprint of the drawn capsule, so the DOM control matches it. */
  measureSwitch: () => { width: number; height: number };
  dispose: () => void;
};

/* Control-space constants, shared with the fragment shader. */
const TRACK_HALF_LENGTH = 1.35;
const TRACK_RADIUS = 1;
const HEIGHT_SHARE = 0.13;
const WIDTH_SHARE = 0.18;

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Shader could not be created.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader failed to compile: ${log ?? "unknown error"}`);
  }
  return shader;
}

export function createShaderToggleScene({
  canvas,
  mode,
  speed,
  size,
  on,
}: ShaderToggleSceneOptions): ShaderToggleScene {
  const context = canvas.getContext("webgl", { antialias: true, alpha: false })
    ?? canvas.getContext("experimental-webgl", { antialias: true, alpha: false });
  if (!context) throw new Error("WebGL is unavailable.");
  const gl = context as WebGLRenderingContext;

  /* Derivatives give the distance fields a one-pixel edge at any scale; the
     shader falls back to a fixed width when the extension is absent. */
  const hasDerivatives = Boolean(gl.getExtension("OES_standard_derivatives"));

  const program = gl.createProgram();
  if (!program) throw new Error("Program could not be created.");
  const vertex = compile(gl, gl.VERTEX_SHADER, SHADER_TOGGLE_VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, buildShaderToggleFragment(hasDerivatives));
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    throw new Error(`Program failed to link: ${log ?? "unknown error"}`);
  }
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, "aPosition");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    res: gl.getUniformLocation(program, "uRes"),
    unit: gl.getUniformLocation(program, "uUnit"),
    time: gl.getUniformLocation(program, "uTime"),
    on: gl.getUniformLocation(program, "uOn"),
    progress: gl.getUniformLocation(program, "uProgress"),
    mode: gl.getUniformLocation(program, "uMode"),
    pointer: gl.getUniformLocation(program, "uPointer"),
  };

  const pixelRatio = Math.min(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1, 2);
  const reduceMotion = typeof window !== "undefined"
    && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 1;
  let height = 1;
  let unit = 1;
  let sizeScale = size;
  let currentMode = mode;
  let currentSpeed = speed;
  let target = on ? 1 : 0;
  let progress = target;
  let velocity = 0;
  let glow = target;
  let pointerX = 0;
  let pointerY = 0;
  let smoothX = 0;
  let smoothY = 0;
  let elapsed = 0;
  let last = typeof performance === "undefined" ? 0 : performance.now();
  let disposed = false;
  let handle = 0;

  function layout() {
    /* The capsule keeps ~13% of the stage height and never spills past 18% of
       its width, so all four variants read at the same size in the picker. */
    unit = Math.min(
      (height * HEIGHT_SHARE) / (TRACK_RADIUS * 2),
      (width * WIDTH_SHARE) / ((TRACK_HALF_LENGTH + TRACK_RADIUS) * 2),
    ) * sizeScale;
  }

  function resize(nextWidth: number, nextHeight: number) {
    width = Math.max(1, Math.round(nextWidth));
    height = Math.max(1, Math.round(nextHeight));
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    gl.viewport(0, 0, canvas.width, canvas.height);
    layout();
  }

  function measureSwitch() {
    return {
      width: unit * (TRACK_HALF_LENGTH + TRACK_RADIUS) * 2,
      height: unit * TRACK_RADIUS * 2,
    };
  }

  function frame(now: number) {
    if (disposed) return;
    const delta = Math.min(0.05, (now - last) / 1000);
    last = now;
    elapsed += delta * currentSpeed;

    const stiffness = reduceMotion ? 420 : 165;
    const damping = 2 * Math.sqrt(stiffness);
    const step = reduceMotion ? Math.min(delta, 0.016) : delta;
    velocity += (target - progress) * stiffness * step - velocity * damping * step;
    progress += velocity * step;
    glow += (target - glow) * Math.min(1, delta * 5.5);
    smoothX += (pointerX - smoothX) * Math.min(1, delta * 3.4);
    smoothY += (pointerY - smoothY) * Math.min(1, delta * 3.4);

    gl.uniform2f(uniforms.res, canvas.width, canvas.height);
    gl.uniform1f(uniforms.unit, unit * pixelRatio);
    gl.uniform1f(uniforms.time, elapsed);
    gl.uniform1f(uniforms.on, glow);
    gl.uniform1f(uniforms.progress, progress);
    gl.uniform1f(uniforms.mode, currentMode === "dark" ? 1 : 0);
    gl.uniform2f(uniforms.pointer, smoothX, smoothY);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    handle = window.requestAnimationFrame(frame);
  }

  handle = window.requestAnimationFrame(frame);

  return {
    setMode(next) {
      currentMode = next;
    },
    setSpeed(next) {
      currentSpeed = next;
    },
    setSize(next) {
      sizeScale = next;
      layout();
    },
    setOn(next) {
      target = next ? 1 : 0;
    },
    setPointer(x, y) {
      pointerX = x;
      pointerY = y;
    },
    resize,
    measureSwitch,
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(handle);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      /* Never force a context loss here: React remounts this effect on the same
         canvas in StrictMode, and a lost context can never be re-acquired. */
    },
  };
}
```

### `src/shaders/skeuomorphic-toggle/shaderToggleGlsl.ts`

Role: shader-source · 298 lines · 12519 bytes · SHA-256 `12eef096246b9fe460ab256e0369b846266a3e87fe5869760dc4e67c9bfa0b57`

```typescript
export const SHADER_TOGGLE_VERTEX = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

/* One fragment shader draws the whole control. Every edge is antialiased from
   the screen-space derivative of its own distance field rather than a fixed
   smoothstep, so the borders stay one pixel crisp at any size — a constant
   width blurs the rim as soon as the control is scaled up. */
const SHADER_TOGGLE_FRAGMENT_BODY = `
precision highp float;

uniform vec2 uRes;
uniform float uUnit;
uniform float uTime;
uniform float uOn;
uniform float uProgress;
uniform float uMode;
uniform vec2 uPointer;

const float R = 1.0;
const float L = 1.35;
const float TH = 0.78;
const float PI = 3.14159265359;

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453123);
}

vec2 hash21(float n) {
  return fract(sin(vec2(n * 127.1, n * 311.7)) * 43758.5453123);
}

/* Screen-space hash. Feeding raw gl_FragCoord into a sin-based hash runs out of
   float precision at 1080p and bands into visible diagonal wedges, so wrap the
   coordinate into a small range first. */
float hash22(vec2 co) {
  return fract(sin(dot(mod(co, 512.0), vec2(12.9898, 78.233))) * 43758.5453123);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash11(i.x + i.y * 57.0);
  float b = hash11(i.x + 1.0 + i.y * 57.0);
  float c = hash11(i.x + (i.y + 1.0) * 57.0);
  float d = hash11(i.x + 1.0 + (i.y + 1.0) * 57.0);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * valueNoise(p);
    p = p * 2.03 + 11.3;
    amplitude *= 0.5;
  }
  return value;
}

/* Ridged noise reads as filament rather than cloud — it is what gives the
   trough its threaded, fibrous look instead of a soft blur. */
float ridged(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(valueNoise(p) * 2.0 - 1.0);
    value += amplitude * n * n;
    p = p * 2.11 + 7.7;
    amplitude *= 0.5;
  }
  return value;
}

/* Two rounds of domain warping. One fbm on its own drifts; warping it by
   another turns the flow into curling filaments that read as real motion. */
vec2 warp(vec2 p, float t) {
  vec2 q = vec2(fbm(p + vec2(0.0, t * 0.12)), fbm(p + vec2(5.2, 1.3) - t * 0.09));
  vec2 r = vec2(fbm(p + 3.4 * q + vec2(1.7, 9.2)), fbm(p + 3.4 * q + vec2(8.3, 2.8)));
  return p + 0.42 * r;
}

float sdCapsule(vec2 p, float halfLength, float radius) {
  p.x -= clamp(p.x, -halfLength, halfLength);
  return length(p) - radius;
}

float fw(float d) {
#ifdef HAS_DERIVATIVES
  return max(fwidth(d), 1e-5);
#else
  return 1.6 / uUnit;
#endif
}

/* Filled side of a distance field, one pixel of coverage at the boundary. */
float fill(float d) {
  float w = fw(d) * 0.72;
  return smoothstep(w, -w, d);
}

/* A stroke centred on the isoline, measured in control-space units. */
float stroke(float d, float halfWidth) {
  float w = fw(d) * 0.8;
  return smoothstep(halfWidth + w, halfWidth - w, abs(d));
}

float capsuleHalo(vec2 p, float spread) {
  return exp(-max(0.0, sdCapsule(p, L, R)) * spread);
}

void main() {
  vec2 frag = gl_FragCoord.xy - 0.5 * uRes;
  vec2 p = frag / uUnit;
  vec2 screen = frag / max(uRes.x, uRes.y);

  float dark = uMode;
  float energy = mix(0.16, 1.0, uOn);

  vec3 accent = mix(vec3(0.09, 0.32, 0.95), vec3(0.24, 0.55, 1.0), dark);
  vec3 accentWarm = mix(vec3(0.55, 0.18, 0.86), vec3(0.62, 0.32, 1.0), dark);
  vec3 accentCool = mix(vec3(0.06, 0.62, 0.92), vec3(0.36, 0.86, 1.0), dark);
  vec3 sparkColor = mix(vec3(0.15, 0.62, 0.98), vec3(0.55, 0.86, 1.0), dark);
  vec3 dormant = mix(vec3(0.66, 0.69, 0.75), vec3(0.16, 0.19, 0.25), dark);

  /* Stage. */
  vec3 skyTop = mix(vec3(0.965, 0.972, 0.984), vec3(0.055, 0.062, 0.086), dark);
  vec3 skyBottom = mix(vec3(0.886, 0.906, 0.941), vec3(0.016, 0.019, 0.031), dark);
  vec3 color = mix(skyBottom, skyTop, smoothstep(-0.55, 0.55, screen.y));

  /* A faint dot lattice keeps the empty stage from reading as flat paint. */
  vec2 lattice = fract(p * 1.8) - 0.5;
  float dots = smoothstep(0.09, 0.02, length(lattice));
  color += dots * mix(-0.05, 0.05, dark) * mix(vec3(0.32, 0.4, 0.62), accent, dark);

  /* Bloom, one exponential per channel for a touch of chromatic spread. */
  float haloR = capsuleHalo(p * 0.985, 1.35);
  float haloG = capsuleHalo(p, 1.5);
  float haloB = capsuleHalo(p * 1.015, 1.65);
  vec3 halo = vec3(haloR, haloG, haloB) * mix(accent, accentWarm, 0.35);
  color += halo * energy * mix(0.045, 0.3, dark);

  float d = sdCapsule(p, L, R);
  float inside = fill(d);

  /* ---- Trough interior ---------------------------------------------- */
  vec2 flowP = vec2(p.x * 0.72 - uTime * 0.3, p.y * 1.25);
  vec2 w = warp(flowP, uTime);
  float plasma = fbm(w * 1.5);
  float threads = ridged(vec2(w.x * 2.2, w.y * 3.4 + uTime * 0.16));

  /* Brushed striations along the travel axis. */
  float brushed = 0.5 + 0.5 * sin(p.y * 74.0 + fbm(w * 3.0) * 9.0);
  brushed *= 0.5 + 0.5 * valueNoise(vec2(p.x * 26.0, p.y * 4.0));

  /* Interference bands, following the warp so they curve with the flow. */
  float caustic = pow(abs(sin(w.x * 3.6 - uTime * 1.5 + threads * 2.4)), 9.0);

  /* A micro lattice the light catches, crisp because it is derivative-AA'd. */
  vec2 cell = fract(p * vec2(22.0, 19.0)) - 0.5;
  float micro = stroke(length(cell) - 0.2, 0.035);

  /* A travelling charge front. */
  float streak = pow(max(0.0, sin(p.x * 2.1 - uTime * 2.6 + plasma * 3.4)), 7.0);

  vec3 interior = mix(dormant, mix(accent, accentWarm, plasma * 0.42), uOn);
  interior *= mix(0.24, 0.86, plasma) * energy;
  interior += mix(accentCool, vec3(1.0), 0.25) * threads * threads * uOn * 0.15;
  interior += mix(accent, vec3(1.0), 0.35) * caustic * uOn * 0.2;
  interior += accentCool * micro * mix(0.018, 0.05, dark) * energy;
  interior *= 0.82 + 0.18 * brushed;
  interior += mix(accent, vec3(1.0), 0.35) * streak * uOn * 0.34;

  /* Powered down still has to read as a slot, not a hole — on a light stage an
     unlit trough at the on-state's exposure goes nearly black. */
  vec3 restColor = dormant * mix(0.6, 0.2, dark) * (0.72 + 0.4 * plasma);
  restColor += accentCool * micro * mix(0.02, 0.045, dark);
  restColor *= 0.88 + 0.12 * brushed;
  interior = mix(restColor, interior, uOn);

  /* Inner shading: the capsule is still a physical trough. */
  float trough = smoothstep(-R, R * 0.35, p.y);
  interior *= mix(0.42, 1.2, trough);

  color = mix(color, interior, inside);

  /* ---- Borders ------------------------------------------------------- */
  /* A hairline seat just outside the wall reads as the shadow the rim casts. */
  color *= 1.0 - stroke(d - 0.028, 0.026) * mix(0.16, 0.3, dark);
  /* The lit rim itself: one crisp stroke on the boundary. */
  vec3 rimColor = mix(accent, vec3(1.0), mix(0.5, 0.28, dark));
  color += rimColor * stroke(d, 0.013) * mix(0.34, 0.66, dark) * energy;
  /* An inner bevel a hair inside the wall, brightest along the top shoulder. */
  float bevel = stroke(d + 0.062, 0.02) * smoothstep(-0.35, 0.85, p.y / R);
  color += mix(accentCool, vec3(1.0), 0.5) * bevel * mix(0.2, 0.34, dark) * energy;
  /* Soft glow bleeding inward from the wall. */
  color += rimColor * exp(-abs(d) * 18.0) * mix(0.06, 0.13, dark) * energy * inside;

  /* ---- Sparks -------------------------------------------------------- */
  /* A dense fine mist rather than a handful of blobs. Phase and lane come from
     independent hashes — sharing one makes the field collapse into a visible
     lattice — and each mote carries its own size, speed and brightness so the
     drift never reads as one animated sheet. */
  vec3 sparks = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    float fi = float(i);
    vec2 h = hash21(fi + 3.7);
    float phase = hash11(fi * 7.13 + 1.7);
    float weight = hash11(fi * 3.31 + 5.9);
    float life = fract(uTime * (0.2 + h.x * 0.42) * mix(0.35, 1.0, uOn) + phase);
    float x = mix(-L - R * 0.55, L + R * 0.55, life);
    float y = (h.y - 0.5) * 1.52 * (0.32 + 0.68 * sin(life * PI)) + sin(life * 6.4 + fi) * 0.06;
    vec2 sp = p - vec2(x, y);
    /* Stretch along travel so each one carries a comet tail. */
    sp.x *= 0.45;
    float fade = sin(life * PI);
    /* Tight kernels: the big ones were reading as glowing pills. */
    float grain = 1500.0 + 5200.0 * weight;
    float core = exp(-dot(sp, sp) * grain * 3.0);
    float tail = exp(-dot(sp, sp) * grain);
    float brightness = 0.35 + 0.65 * weight;
    sparks += mix(sparkColor, vec3(1.0), 0.6 * fade) * (tail * 0.55 + core) * fade * brightness;
  }
  color += sparks * mix(0.3, 1.15, uOn) * mix(0.85, 1.15, dark) * inside;

  /* ---- Thumb --------------------------------------------------------- */
  float thumbX = mix(-L, L, uProgress);
  vec2 tp = p - vec2(thumbX, 0.0);
  float td = length(tp) - TH;
  float thumbIn = fill(td);
  vec2 disc = tp / TH;
  float discLength = min(1.0, length(disc));
  vec3 normal = normalize(vec3(disc, sqrt(max(1e-4, 1.0 - discLength * discLength))));

  /* Micro relief on the shell, sampled in the sphere's own frame so it wraps
     with the surface instead of sliding across it. */
  vec2 shellUv = vec2(atan(normal.y, normal.x) * 1.6, normal.z * 2.4);
  float relief = valueNoise(shellUv * 15.0) * 0.6 + valueNoise(shellUv * 41.0) * 0.4;
  vec3 bumped = normalize(normal + vec3((relief - 0.5) * 0.035, (relief - 0.5) * 0.035, 0.0));

  vec3 light = normalize(vec3(-0.42 + uPointer.x * 0.35, 0.58 + uPointer.y * 0.35, 0.8));
  /* A cool fill from the opposite side, and a rim from behind: one lamp on a
     sphere gives a flat coin, three give it form. */
  vec3 fillDir = normalize(vec3(0.62, -0.28, 0.55));
  vec3 rimDir = normalize(vec3(0.34, 0.5, -0.72));
  float diffuse = max(0.0, dot(bumped, light));
  float specular = pow(max(0.0, dot(reflect(-light, bumped), vec3(0.0, 0.0, 1.0))), 120.0);
  /* A second, stretched lobe: the brushed anisotropic streak. */
  vec3 stretched = normalize(vec3(bumped.x * 0.28, bumped.y, bumped.z));
  float sheen = pow(max(0.0, dot(reflect(-light, stretched), vec3(0.0, 0.0, 1.0))), 16.0);
  float fillTerm = max(0.0, dot(bumped, fillDir));
  float rimTerm = pow(max(0.0, dot(bumped, rimDir)), 2.2) * pow(1.0 - max(0.0, normal.z), 1.6);
  float fresnel = pow(1.0 - max(0.0, normal.z), 2.6);

  vec3 thumbBase = mix(vec3(0.96, 0.97, 0.99), vec3(0.78, 0.82, 0.9), dark);
  vec3 thumbColor = thumbBase * (0.17 + 0.86 * diffuse * diffuse);
  thumbColor += thumbBase * mix(accentCool, vec3(1.0), 0.35) * fillTerm * 0.3;
  thumbColor += mix(accentCool, vec3(1.0), 0.5) * rimTerm * mix(0.3, 0.55, dark);
  thumbColor *= 0.975 + 0.05 * relief;
  thumbColor += mix(accent, accentWarm, 0.4) * fresnel * mix(0.34, 0.6, dark) * energy;
  thumbColor += vec3(1.0) * specular * 1.6;
  thumbColor += mix(vec3(1.0), accentCool, 0.35) * sheen * 0.13;
  thumbColor += mix(accent, accentWarm, 0.6) * uOn * 0.1;
  /* Roll the highlights off instead of letting them clip — a clipped sphere
     reads as a white sticker rather than a lit object. */
  /* Bounce off the lit trough onto the underside. */
  thumbColor += accentCool * smoothstep(0.2, -0.9, disc.y) * uOn * mix(0.1, 0.16, dark);
  thumbColor = thumbColor / (1.0 + thumbColor * 0.22);

  /* Contact shadow under the thumb. */
  float contact = exp(-dot(tp * vec2(0.8, 1.6), tp * vec2(0.8, 1.6)) * 1.9);
  color *= 1.0 - contact * 0.42 * inside;

  color = mix(color, thumbColor, thumbIn);
  /* Crisp terminator ring so the thumb keeps a defined edge. */
  color += mix(vec3(1.0), accentCool, 0.4) * stroke(td, 0.01) * mix(0.15, 0.26, dark);
  color += mix(accent, accentWarm, 0.35) * exp(-max(0.0, td) * 7.0) * uOn * 0.22 * inside;

  /* ---- Grade --------------------------------------------------------- */
  color *= mix(0.86, 1.0, smoothstep(1.0, 0.2, length(screen * vec2(1.0, 1.25))));
  float grain = hash22(gl_FragCoord.xy + vec2(mod(uTime * 61.0, 512.0), mod(uTime * 37.0, 512.0)));
  color += (grain - 0.5) * mix(0.014, 0.03, dark);

  gl_FragColor = vec4(max(color, 0.0), 1.0);
}
`;

export function buildShaderToggleFragment(hasDerivatives: boolean) {
  /* The extension pragma has to lead the source, before any other directive. */
  const prefix = hasDerivatives
    ? "#extension GL_OES_standard_derivatives : enable\n#define HAS_DERIVATIVES\n"
    : "";
  return prefix + SHADER_TOGGLE_FRAGMENT_BODY;
}
```

### `src/shaders/skeuomorphic-toggle/shader-toggle.css`

Role: variant-style · 108 lines · 2751 bytes · SHA-256 `c57012bddaaa4bfe1e18d19c23188f43d79e44fccf9d9e1e15454cd57e4f34cd`

```css
.shader-toggle,
.shader-toggle *,
.shader-toggle *::before,
.shader-toggle *::after {
  box-sizing: border-box;
}

.shader-toggle {
  --shader-toggle-hue: 0deg;
  --shader-toggle-saturation: 1;
  --shader-toggle-brightness: 1;
  --shader-toggle-stage: #f4f6fa;
  --shader-toggle-caption: rgba(17, 22, 34, 0.5);
  --shader-toggle-caption-on: rgba(17, 22, 34, 0.78);
  --shader-toggle-focus: rgba(58, 120, 255, 0.45);
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  isolation: isolate;
  container-type: size;
  background: var(--shader-toggle-stage);
  color-scheme: light;
  filter: hue-rotate(var(--shader-toggle-hue)) saturate(var(--shader-toggle-saturation)) brightness(var(--shader-toggle-brightness));
  font-family: ui-sans-serif, -apple-system, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.shader-toggle[data-mode="dark"] {
  --shader-toggle-stage: #06070b;
  --shader-toggle-caption: rgba(233, 238, 250, 0.46);
  --shader-toggle-caption-on: rgba(233, 238, 250, 0.82);
  --shader-toggle-focus: rgba(122, 168, 255, 0.5);
  color-scheme: dark;
}

.shader-toggle__canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}

/* A real control sitting exactly over the drawn capsule, so the scene stays
   keyboard- and screen-reader-operable. */
.shader-toggle__switch {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 200px;
  height: 112px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  transform: translate(-50%, -50%);
  cursor: pointer;
  appearance: none;
}

.shader-toggle__switch:focus-visible {
  outline: none;
  box-shadow: 0 0 0 4px var(--shader-toggle-focus);
}

.shader-toggle__caption {
  position: absolute;
  left: 50%;
  /* The control keeps 13% of the stage height, so the caption tracks the centre
     rather than the floor — otherwise it drifts away in a tall frame. */
  top: calc(50% + max(52px, 11cqh));
  transform: translateX(-50%);
  display: flex;
  align-items: baseline;
  gap: 0.55em;
  margin: 0;
  font-size: clamp(11px, 1.9cqw, 14px);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--shader-toggle-caption);
  transition: color 0.45s ease;
  pointer-events: none;
}

.shader-toggle[data-state="on"] .shader-toggle__caption {
  color: var(--shader-toggle-caption-on);
}

.shader-toggle__caption b {
  font-weight: 500;
}

.shader-toggle__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  text-align: center;
  font-size: 13px;
  line-height: 1.5;
  color: var(--shader-toggle-caption);
}
```

### `src/shaders/skeuomorphic-toggle/toggleMode.ts`

Role: variant-module · 45 lines · 1870 bytes · SHA-256 `2ed0a1183b05b22c990f385d6e457bf6b3a11bf5749c84aae44ee9b1d0e406b8`

```typescript
import { useEffect, useState } from "react";

export type ToggleMode = "dark" | "light";
export type ToggleModePreference = ToggleMode | "auto";

export function readAutomaticToggleMode(): ToggleMode {
  if (typeof document === "undefined" || typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const declared = root.dataset.theme ?? root.dataset.scheme;
  if (declared === "light" || declared === "dark") return declared;
  if (root.classList.contains("light")) return "light";
  if (root.classList.contains("dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/* Mirrors the packaged export's automatic appearance: the site's own
   data-theme/data-scheme attribute wins, then the system preference. */
export function useToggleMode(preference: ToggleModePreference): ToggleMode {
  const enabled = preference === "auto";
  const [automatic, setAutomatic] = useState<ToggleMode>(readAutomaticToggleMode);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setAutomatic(readAutomaticToggleMode());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-scheme", "data-theme"],
    });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);

  if (preference === "light" || preference === "dark") return preference;
  return automatic;
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
```

### `src/shaders/neuform-isolated/NeuformBatchEffects.tsx`

Role: variant-component · 949 lines · 41426 bytes · SHA-256 `dc68c51bea26b922965de44b4fb8d6c432607508fb2b61e16ed60d245da1a69f`

```tsx
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import constellationFieldSource from "./sources/constellation-field.html?raw";
import particleDriftSource from "./sources/particle-drift.html?raw";
import particleNetworkSource from "./sources/particle-network.html?raw";
import fluxVortexSource from "./sources/flux-vortex.html?raw";
import portalFieldSource from "./sources/portal-field.html?raw";
import flowFieldSource from "./sources/flow-field.html?raw";
import amberHalftoneSource from "./sources/amber-halftone.html?raw";
import diagnosticsPanelSource from "./sources/diagnostics-panel.html?raw";
import signalParticlesSource from "./sources/signal-particles.html?raw";
import skeuomorphicToggleSource from "./sources/skeuomorphic-toggle.html?raw";
import matrixFieldSource from "./sources/matrix-field.html?raw";
import gatewayFlowSource from "./sources/gateway-flow.html?raw";
import connectivityGraphSource from "./sources/connectivity-graph.html?raw";
import interfaceLinesSource from "./sources/interface-lines.html?raw";
import wireframeFormsSource from "./sources/wireframe-forms.html?raw";
import defenseLinesSource from "./sources/defense-lines.html?raw";
import overrideGridSource from "./sources/override-grid.html?raw";
import topoFieldSource from "./sources/topo-field.html?raw";

type FocusRole = "background" | "ui";
type NeuformMode = "dark" | "light";
type NeuformModePreference = NeuformMode | "auto";

type FocusTarget = {
  selector: string;
  role: FocusRole;
  width?: string;
};

type BakeKnobs = {
  variant: string;
  size: number;
  gap: number;
  length: number;
  density: number;
  strokeWidth: number;
  mode: NeuformMode;
};

type EffectDefinition = {
  title: string;
  source: string;
  background: string | ((mode: NeuformMode) => string);
  defaultMode?: NeuformModePreference;
  supportsMode?: boolean;
  targets: readonly FocusTarget[];
  focusCss?: string;
  patch?: (source: string, knobs: BakeKnobs) => string;
};

export type NeuformBatchEffectProps = {
  variant?: string;
  mode?: NeuformModePreference;
  speed?: number;
  size?: number;
  gap?: number;
  length?: number;
  density?: number;
  strokeWidth?: number;
  opacity?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  className?: string;
  style?: CSSProperties;
};

export const NEUFORM_BATCH_DEFAULTS = {
  mode: "dark" as NeuformMode,
  speed: 1,
  size: 1,
  gap: 2,
  length: 1,
  density: 1,
  strokeWidth: 1,
  opacity: 1,
  hue: 0,
  saturation: 1,
  brightness: 1,
} as const;

const LIGHT_PAPER = "#eef1f6";

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function scaleCount(base: number, density: number, minimum = 1) {
  return Math.max(minimum, Math.round(base * density));
}

function resolveWireframeVariant(variant: string) {
  return variant === "cylinders" || variant === "sphere" ? variant : "cube";
}

/** WebGL1 GLSL ES requires float literals (10.0), not ints (10). */
function glslFloat(value: number, digits = 3) {
  const fixed = Number(value).toFixed(digits);
  return fixed.includes(".") ? fixed : `${fixed}.0`;
}

function resolveMode(mode: NeuformMode | number | string | undefined, fallback: NeuformMode = "dark"): NeuformMode {
  if (mode === undefined || mode === null) return fallback;
  if (mode === "light" || mode === 1 || mode === "1") return "light";
  return "dark";
}

function readAutomaticMode(): NeuformMode {
  if (typeof document === "undefined" || typeof window === "undefined") return "dark";
  const root = document.documentElement;
  const declared = root.dataset.scheme ?? root.dataset.theme;
  if (declared === "light" || declared === "dark") return declared;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function useAutomaticMode(enabled: boolean) {
  const [mode, setMode] = useState<NeuformMode>(readAutomaticMode);

  useEffect(() => {
    if (!enabled || typeof document === "undefined" || typeof window === "undefined") return undefined;
    const root = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setMode(readAutomaticMode());
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["data-scheme", "data-theme"] });
    media.addEventListener("change", update);
    update();
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, [enabled]);

  return mode;
}

function resolveBackground(background: EffectDefinition["background"], mode: NeuformMode) {
  return typeof background === "function" ? background(mode) : background;
}

const DIAGNOSTICS_PANEL_FOCUS_CSS = `
[data-threeui-role="ui"].flex-grow {
  flex: none !important;
  width: min(calc(100% - 32px), var(--threeui-target-width, 360px)) !important;
  height: auto !important;
  min-height: 0 !important;
  max-height: calc(100% - 32px) !important;
  aspect-ratio: 1 / 1 !important;
  margin: 0 !important;
  overflow: hidden !important;
}
[data-threeui-role="ui"] > canvas {
  position: absolute !important;
  inset: 0 !important;
  width: 100% !important;
  height: 100% !important;
}
`;

function patchDiagnosticsPanel(source: string, { mode }: BakeKnobs) {
  let next = source.replaceAll(
    "time += 0.015;",
    "time += 0.015 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);",
  );
  if (mode === "light") {
    // Match canvas cutouts to light paper; deepen emerald strokes for contrast.
    next = next
      .replaceAll("ctx.fillStyle = '#020804';", `ctx.fillStyle = '${LIGHT_PAPER}';`)
      .replaceAll("rgba(52,211,153,", "rgba(4,120,87,");
  }
  return next;
}

const EFFECTS = {
  constellationField: {
    title: "Constellation Field",
    source: constellationFieldSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#070914"),
    targets: [{ selector: "#constellationCanvas", role: "background" }],
    patch(source, { size, length, density, strokeWidth, mode }) {
      let next = source
        .replace("const LINK = 160;", `const LINK = ${Math.round(160 * length)};`)
        .replace(
          "const MAX_NODES = window.innerWidth < 768 ? 40 : 85;",
          `const MAX_NODES = window.innerWidth < 768 ? ${scaleCount(40, density, 8)} : ${scaleCount(85, density, 12)};`,
        )
        .replace(
          "radius: Math.random() * 2.4 + 1.8",
          `radius: (Math.random() * 2.4 + 1.8) * ${size}`,
        )
        .replace("ctx.lineWidth = 1;", `ctx.lineWidth = ${Number(Math.max(0.25, strokeWidth).toFixed(2))};`)
        .replace("node.x += node.vx;", "node.x += node.vx * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("node.y += node.vy;", "node.y += node.vy * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);");
      if (mode === "light") {
        // Deeper bronze ink so gold nodes stay readable on paper.
        next = next
          .replace("ctx.strokeStyle = '#E6C879';", "ctx.strokeStyle = '#8B6914';")
          .replace("ctx.fillStyle = '#E6C879';", "ctx.fillStyle = '#8B6914';");
      }
      return next;
    },
  },
  particleDrift: {
    title: "Particle Drift",
    source: particleDriftSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#030509"),
    targets: [{ selector: "#particle-canvas", role: "background" }],
    patch(source, { size, length, density, mode }) {
      const link = Math.round(120 * length);
      const proximityAlpha = mode === "light" ? 0.22 : 0.15;
      let next = source
        .replace("Array.from({ length: 90 })", `Array.from({ length: ${scaleCount(90, density, 12)} })`)
        .replace("Array.from({ length: 25 })", `Array.from({ length: ${scaleCount(25, density, 4)} })`)
        .replace("length: Math.random() * 100 + 50,", `length: (Math.random() * 100 + 50) * ${length},`)
        .replace("n.y += n.vy; // Slow drift", "n.y += n.vy * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1); // Slow drift")
        .replace("b.y -= b.speed;", "b.y -= b.speed * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("if(d < 120) {", `if(d < ${link}) {`)
        .replace("0.15 * (1 - d/120)", `${proximityAlpha} * (1 - d/${link})`)
        .replace("ctx.lineWidth = 1.5;", `ctx.lineWidth = ${Number((1.5 * size).toFixed(2))};`);
      if (mode === "light") {
        next = next
          .replaceAll("rgba(96, 165, 250,", "rgba(37, 99, 235,")
          .replaceAll("rgba(156, 163, 175,", "rgba(36, 48, 68,")
          .replace("ctx.fillStyle = dist < 180 ? '#60A5FA' : 'rgba(36, 48, 68, 0.4)';", "ctx.fillStyle = dist < 180 ? '#2563EB' : 'rgba(36, 48, 68, 0.55)';");
      }
      return next;
    },
  },
  particleNetwork: {
    title: "Particle Network",
    source: particleNetworkSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#05070d"),
    targets: [{ selector: "#particle-canvas", role: "background" }],
    patch(source, { size, length, density, mode }) {
      let next = source
        .replace("const particleCount = 200;", `const particleCount = ${scaleCount(200, density, 40)};`)
        .replace("this.length = Math.random() * 2 + 0.5;", `this.length = (Math.random() * 2 + 0.5) * ${length};`)
        .replace("this.z -= this.speed;", "this.z -= this.speed * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("const fov = 300;", `const fov = ${Math.round(300 / Math.max(0.4, size))};`);
      if (mode === "light") {
        next = next
          .replace("ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';", "ctx.fillStyle = 'rgba(238, 241, 246, 0.55)';")
          .replace(
            "const hue = Math.random() > 0.5 ? '200, 220, 255' : '106, 157, 237';",
            "const hue = Math.random() > 0.5 ? '36, 48, 68' : '37, 99, 235';",
          );
      }
      return next;
    },
  },
  fluxVortex: {
    title: "Flux Vortex",
    source: fluxVortexSource,
    background: "#050505",
    targets: [{ selector: "#webgl-canvas", role: "background" }],
    patch(source, { size, density }) {
      return source
        .replace("const vortexCount = 9500;", `const vortexCount = ${scaleCount(9500, density, 1200)};`)
        .replace("const particlesCount = 300;", `const particlesCount = ${scaleCount(300, density, 40)};`)
        .replace("size: 0.006, // Smaller dots requested", `size: ${Number((0.006 * size).toFixed(4))}, // Smaller dots requested`)
        .replace("size: 0.008,", `size: ${Number((0.008 * size).toFixed(4))},`);
    },
  },
  portalField: {
    title: "Portal Field",
    source: portalFieldSource,
    background: "#05060a",
    targets: [{ selector: "#webgl-container", role: "background" }],
    patch(source, { size, length }) {
      return source
        .replace(
          "float d1 = sdArc(st, center, 0.6, 0.02, 0.15);",
          `float d1 = sdArc(st, center, ${glslFloat(0.6 * length, 3)}, ${glslFloat(0.02 * size, 4)}, 0.15);`,
        )
        .replace(
          "float d2 = sdArc(st, center, 0.65, 0.06, 0.2);",
          `float d2 = sdArc(st, center, ${glslFloat(0.65 * length, 3)}, ${glslFloat(0.06 * size, 4)}, 0.2);`,
        );
    },
  },
  flowField: {
    title: "Flow Field",
    source: flowFieldSource,
    background: "#0a0a0a",
    targets: [{ selector: "#canvas", role: "background" }],
    patch(source, { size, length, density }) {
      return source
        .replace(/<script defer src="https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js[^>]*><\/script>/, "")
        .replace("const PARTICLE_COUNT = 2500;", `const PARTICLE_COUNT = ${scaleCount(2500, density, 300)};`)
        .replace("let NOISE_SCALE = 0.0025;", `let NOISE_SCALE = ${Number((0.0025 / length).toFixed(6))};`)
        .replace("time += 0.0008;", "time += 0.0008 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||0);")
        .replace(
          "let vx = Math.cos(angle) * p.speed * SPEED;",
          "let vx = Math.cos(angle) * p.speed * SPEED * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||0);",
        )
        .replace(
          "let vy = Math.sin(angle) * p.speed * SPEED;",
          "let vy = Math.sin(angle) * p.speed * SPEED * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||0);",
        )
        .replace("ctx.lineWidth = p.size;", `ctx.lineWidth = p.size * ${Number(size.toFixed(3))};`);
    },
  },
  amberHalftone: {
    title: "Amber Halftone",
    source: amberHalftoneSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#0A0A0A"),
    targets: [{ selector: "#webgl-halftone", role: "background" }],
    patch(source, { size, length, density, mode }) {
      // Density must tighten spacing (not grow gridSize). Growing gridSize only adds
      // points outside the orthographic frustum, which looks sparse/broken full-bleed.
      const spacing = Number((0.085 / Math.max(0.25, density)).toFixed(4));
      const gridSize = Math.max(12, Math.ceil(2.8 / spacing));
      const pointSize = Number((9 * size).toFixed(2));
      const wave = Number((6 * length).toFixed(2));
      let next = source
        .replace("const gridSize = 20;", `const gridSize = ${gridSize};`)
        .replace("positions.push(x * 0.15, y * 0.15, 0);", `positions.push(x * ${spacing}, y * ${spacing}, 0);`)
        .replace(
          "float animatedScale = scale * (sin(dist * 6.0 - time * 2.5) * 0.5 + 0.5);",
          `float animatedScale = scale * (sin(dist * ${glslFloat(wave, 2)} - time * 2.5) * 0.5 + 0.5);`,
        )
        .replace("gl_PointSize = animatedScale * 5.0;", `gl_PointSize = animatedScale * ${glslFloat(pointSize, 2)};`)
        .replace(
          "material.uniforms.time.value = clock.getElapsedTime();",
          "material.uniforms.time.value = clock.getElapsedTime() * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);",
        );
      if (mode === "light") {
        next = next
          .replace("renderer.setClearColor(0x0A0A0A, 1);", "renderer.setClearColor(0xeef1f6, 1);")
          .replace("color1: { value: new THREE.Color(0xFBBF24) },", "color1: { value: new THREE.Color(0xB45309) },")
          .replace("color2: { value: new THREE.Color(0xFFFFFF) }", "color2: { value: new THREE.Color(0x1a1f2a) }");
      }
      return next;
    },
  },
  diagnosticsLayers: {
    title: "Layered Planes",
    source: diagnosticsPanelSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#020804"),
    targets: [{ selector: "#main-container article:nth-of-type(1) .flex-grow", role: "ui", width: "360px" }],
    focusCss: DIAGNOSTICS_PANEL_FOCUS_CSS,
    patch: patchDiagnosticsPanel,
  },
  diagnosticsNodes: {
    title: "Node Cubes",
    source: diagnosticsPanelSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#020804"),
    targets: [{ selector: "#main-container article:nth-of-type(2) .flex-grow", role: "ui", width: "360px" }],
    focusCss: DIAGNOSTICS_PANEL_FOCUS_CSS,
    patch: patchDiagnosticsPanel,
  },
  diagnosticsFlow: {
    title: "Flowing Mesh",
    source: diagnosticsPanelSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#020804"),
    targets: [{ selector: "#main-container article:nth-of-type(3) .flex-grow", role: "ui", width: "360px" }],
    focusCss: DIAGNOSTICS_PANEL_FOCUS_CSS,
    patch: patchDiagnosticsPanel,
  },
  signalParticles: {
    title: "Signal Particles",
    source: signalParticlesSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#0a0a0a"),
    targets: [{ selector: "#particle-canvas", role: "background" }],
    patch(source, { size, length, mode }) {
      let next = source
        .replace("const spacing = 16;", `const spacing = ${Math.max(6, Math.round(16 / Math.max(0.35, length)))};`)
        .replace("const dotRadius = 1.5;", `const dotRadius = ${Number((1.5 * size).toFixed(2))};`)
        .replace("time += 0.02;", "time += 0.02 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);");
      if (mode === "light") {
        next = next
          .replace("ctx.fillStyle = '#3b82f6'; // Blue highlight", "ctx.fillStyle = '#1d4ed8'; // Blue highlight")
          .replace("ctx.fillStyle = '#8b5cf6'; // Purple highlight", "ctx.fillStyle = '#5b21b6'; // Purple highlight")
          .replace("ctx.fillStyle = `rgba(148, 163, 184, ${alpha})`;", `ctx.fillStyle = \`rgba(36, 48, 68, \${alpha})\`;`);
      }
      return next;
    },
  },
  skeuomorphicToggle: {
    title: "Skeuomorphic Toggle",
    source: skeuomorphicToggleSource,
    supportsMode: true,
    defaultMode: "auto",
    background: (mode) => (mode === "light" ? "#f8fafc" : "#0b1220"),
    targets: [{ selector: "#skeuomorphic-toggle", role: "ui", width: "192px" }],
    focusCss: `
#skeuomorphic-toggle {
  width: 12rem !important;
  height: 4rem !important;
  margin: auto !important;
  overflow: visible !important;
  max-height: none !important;
}
`,
    patch(source, { mode }) {
      if (mode !== "dark") return source;
      return source
        .replace(
          "var ON_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%)';",
          "var ON_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.035) 2px, rgba(255,255,255,0.035) 4px), linear-gradient(180deg, #1e3a8a 0%, #172554 100%)';",
        )
        .replace(
          "var OFF_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px), linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)';",
          "var OFF_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.025) 2px, rgba(255,255,255,0.025) 4px), linear-gradient(180deg, #1e293b 0%, #0f172a 100%)';",
        )
        .replace(
          "var ON_SHADOW = 'inset 0 4px 8px rgba(0,0,0,0.1), inset 0 -2px 4px rgba(255,255,255,0.7), 0 0 0 6px rgba(239, 246, 255, 0.8), 0 0 25px 5px rgba(96, 165, 250, 0.4)';",
          "var ON_SHADOW = 'inset 0 5px 10px rgba(0,0,0,0.52), inset 0 -2px 4px rgba(147,197,253,0.24), 0 0 0 6px rgba(15,23,42,0.96), 0 0 26px 5px rgba(59,130,246,0.42)';",
        )
        .replace(
          "var OFF_SHADOW = 'inset 0 4px 8px rgba(0,0,0,0.12), inset 0 -2px 4px rgba(255,255,255,0.55), 0 0 0 6px rgba(241, 245, 249, 0.9), 0 0 18px 2px rgba(148, 163, 184, 0.25)';",
          "var OFF_SHADOW = 'inset 0 5px 10px rgba(0,0,0,0.56), inset 0 -2px 4px rgba(148,163,184,0.12), 0 0 0 6px rgba(15,23,42,0.96), 0 0 18px 2px rgba(30,64,175,0.2)';",
        )
        .replace("var ON_BORDER = '#60a5fa';", "var ON_BORDER = '#3b82f6';")
        .replace("var OFF_BORDER = '#94a3b8';", "var OFF_BORDER = '#334155';")
        .replace(
          "background: linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%);",
          "background: linear-gradient(180deg, #e2e8f0 0%, #94a3b8 100%);",
        )
        .replace("border: 1px solid #e0edfa;", "border: 1px solid #64748b;");
    },
  },
  matrixField: {
    title: "Matrix Field",
    source: matrixFieldSource,
    background: "#000000",
    targets: [{ selector: "#glcanvas", role: "background" }],
    patch(source, { size, length }) {
      return source.replace(
        "float intensity = 0.006;",
        `float intensity = ${glslFloat(0.006 * size * length, 5)};`,
      );
    },
  },
  gatewayFlow: {
    title: "Gateway Flow",
    source: gatewayFlowSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#000000"),
    targets: [{ selector: "#flow-canvas", role: "background" }],
    patch(source, { size, density, mode }) {
      let next = source
        .replace("const numPaths = 80;", `const numPaths = ${scaleCount(80, density, 12)};`)
        .replace("p.t += p.speed;", "p.t += p.speed * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("ctx.lineWidth = 1.2;", `ctx.lineWidth = ${Number((1.2 * size).toFixed(2))};`);
      if (mode === "light") {
        next = next
          .replace("ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';", `ctx.strokeStyle = 'rgba(26, 31, 42, 0.4)';`)
          .replace("ctx.fillStyle = `rgba(255, 255, 255, 0.7)`;", `ctx.fillStyle = \`rgba(26, 31, 42, 0.75)\`;`);
      }
      return next;
    },
  },
  connectivityGraph: {
    title: "Connectivity Graph",
    source: connectivityGraphSource,
    supportsMode: true,
    defaultMode: "light",
    background: (mode) => (mode === "light" ? "#c4d9ef" : "#0a1220"),
    targets: [{ selector: "#networkCanvas", role: "background" }],
    patch(source, { size, length, density, mode }) {
      let next = source
        .replace(
          "const particleCount = window.innerWidth < 768 ? 150 : 400;",
          `const particleCount = window.innerWidth < 768 ? ${scaleCount(150, density, 30)} : ${scaleCount(400, density, 60)};`,
        )
        .replace("this.maxLength = 20 + Math.random() * 180;", `this.maxLength = (20 + Math.random() * 180) * ${length};`)
        .replace("this.distance += this.speed;", "this.distance += this.speed * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("ctx.lineWidth = 0.5 + (distRatio * 2);", `ctx.lineWidth = (0.5 + (distRatio * 2)) * ${size};`);
      if (mode === "dark") {
        next = next
          .replace("const lightness = 15 + (distRatio * 35);", "const lightness = 58 + (distRatio * 28);")
          .replace(
            "const tailColor = `hsla(${hue}, 90%, ${Math.max(5, lightness - 15)}%, ${this.alpha * 0.05})`;",
            "const tailColor = `hsla(${hue}, 90%, ${Math.max(40, lightness - 15)}%, ${this.alpha * 0.08})`;",
          );
      }
      return next;
    },
  },
  interfaceLines: {
    title: "Interface Lines",
    source: interfaceLinesSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#050505"),
    targets: [{ selector: "#bg-canvas", role: "background" }],
    patch(source, { size, length, density, mode }) {
      const link = Math.round(120 * length);
      let next = source
        .replace(
          "const numParticles = window.innerWidth < 640 ? 30 : 70;",
          `const numParticles = window.innerWidth < 640 ? ${scaleCount(30, density, 8)} : ${scaleCount(70, density, 12)};`,
        )
        .replace("p.x += p.vx;", "p.x += p.vx * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("p.y += p.vy;", "p.y += p.vy * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("if (dist < 120)", `if (dist < ${link})`)
        .replace("ctx.lineWidth = 1;", `ctx.lineWidth = ${Number((1 * size).toFixed(2))};`);
      if (mode === "light") {
        next = next
          .replace(
            "ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + (1 - dist / 120) * 0.42})`;",
            `ctx.strokeStyle = \`rgba(26, 31, 42, \${0.28 + (1 - dist / ${link}) * 0.42})\`;`,
          )
          .replace("ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';", `ctx.fillStyle = 'rgba(26, 31, 42, 0.85)';`);
      } else {
        // Keep stroke alpha formula in sync with baked link distance on dark path.
        next = next.replace(
          "ctx.strokeStyle = `rgba(255, 255, 255, ${0.28 + (1 - dist / 120) * 0.42})`;",
          `ctx.strokeStyle = \`rgba(255, 255, 255, \${0.28 + (1 - dist / ${link}) * 0.42})\`;`,
        );
      }
      return next;
    },
  },
  wireframeForms: {
    title: "Wireframe Forms",
    source: wireframeFormsSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#050505"),
    targets: [{ selector: "main", role: "ui", width: "1040px" }],
    focusCss: `
main {
  display: flex !important;
  flex-direction: row !important;
  flex-wrap: wrap !important;
  align-items: center !important;
  justify-content: center !important;
  gap: clamp(1rem, 3vw, 2.5rem) !important;
  height: auto !important;
  min-height: 0 !important;
  padding: 1.5rem !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  grid-template-columns: none !important;
}
main > .absolute { display: none !important; }
main > .group {
  height: auto !important;
  min-height: 0 !important;
  padding: 0 !important;
  overflow: visible !important;
  background: transparent !important;
  flex: 0 0 auto !important;
  width: min(72vw, 480px) !important;
}
main > .group:not([data-wireframe-selected]) { display: none !important; }
main > .group > :not([data-wireframe-visual]) { display: none !important; }
main > .group > [data-wireframe-visual] {
  padding: 0 !important;
  flex-grow: 0 !important;
  width: 100% !important;
  aspect-ratio: 1 !important;
}
main > .group > [data-wireframe-visual] > :not(canvas) { display: none !important; }
#canvas1, #canvas2, #canvas3 {
  width: 100% !important;
  max-width: none !important;
  height: 100% !important;
  opacity: 1 !important;
  mix-blend-mode: normal !important;
}
`,
    patch(source, { variant, size, length, mode }) {
      const selectedVariant = resolveWireframeVariant(variant);
      const selectedSection = {
        cube: "<!-- Section 01: Hypercube -->",
        cylinders: "<!-- Section 02: Logic Cylinders -->",
        sphere: "<!-- Section 03: Esoteric Sphere -->",
      }[selectedVariant];
      let next = source
        .replace(
          `${selectedSection}\n        <div class="group`,
          `${selectedSection}\n        <div data-wireframe-selected="${selectedVariant}" class="group`,
        )
        .replace("this.angleY += 0.005;", "this.angleY += 0.005 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("this.angleX += 0.002;", "this.angleX += 0.002 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);")
        .replace("const s = 80;", `const s = ${Math.round(80 * length)};`)
        .replace("const r = 70;", `const r = ${Math.round(70 * length)};`)
        .replace("const s = 50; ", `const s = ${Math.round(50 * length)}; `)
        .replace("this.ctx.lineWidth = 0.8;", `this.ctx.lineWidth = ${Number((0.8 * size).toFixed(2))};`);
      if (mode === "light") {
        next = next
          .replace(
            "this.ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.4})`;",
            "this.ctx.strokeStyle = `rgba(26, 31, 42, ${alpha * 0.45})`;",
          )
          .replace(
            "this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;",
            "this.ctx.fillStyle = `rgba(26, 31, 42, ${alpha})`;",
          );
      }
      return next;
    },
  },
  defenseLines: {
    title: "Defense Lines",
    source: defenseLinesSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? "#f4ecec" : "#120303"),
    targets: [{ selector: "#bg-canvas", role: "background" }],
    patch(source, { size, length, density, mode }) {
      let next = source
        .replace(
          "const particleCount = window.innerWidth < 768 ? 40 : 100;",
          `const particleCount = window.innerWidth < 768 ? ${scaleCount(40, density, 8)} : ${scaleCount(100, density, 16)};`,
        )
        .replace("baseLength: Math.random() * 80 + 20,", `baseLength: (Math.random() * 80 + 20) * ${length},`)
        .replace(
          "p.y -= p.speedY * 1.5 * (1 + centerProximity * 0.5);",
          "p.y -= p.speedY * 1.5 * (1 + centerProximity * 0.5) * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);",
        )
        .replace("ctx.lineWidth = 0.5;", `ctx.lineWidth = ${Number((0.5 * size).toFixed(2))};`);
      if (mode === "light") {
        // Slightly deeper crimson so rain lines stay crisp on pale rose paper.
        next = next
          .replaceAll("rgba(220, 38, 38, 0)", "rgba(153, 27, 27, 0)")
          .replace("grad.addColorStop(0.5, `rgba(255, ${38 + brightness}, ${38 + brightness}, ${currentOpacity})`);", "grad.addColorStop(0.5, `rgba(185, ${20 + brightness * 0.55}, ${20 + brightness * 0.55}, ${currentOpacity})`);");
      }
      return next;
    },
  },
  overrideGrid: {
    title: "Override Grid",
    source: overrideGridSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#050505"),
    targets: [{ selector: "#grid-canvas", role: "background" }],
    patch(source, { size, gap, mode }) {
      const blockSize = Math.max(8, Math.round(size));
      const blockGap = Math.max(0, Math.round(gap));
      let next = source
        .replace("const blockSize = 48;", `const blockSize = ${blockSize};`)
        .replace("const blockGap = 2;", `const blockGap = ${blockGap};`)
        .replace("time += 0.04;", "time += 0.04 * ((window.__SF_CONTROLS&&window.__SF_CONTROLS.speed)||1);");
      if (mode === "light") {
        next = next.replace(
          "ctx.fillStyle = `rgba(249, 115, 22, ${alpha})`;",
          "ctx.fillStyle = `rgba(194, 65, 12, ${alpha * 1.35})`;",
        );
      }
      return next;
    },
  },
  topoField: {
    title: "Topo Field",
    source: topoFieldSource,
    supportsMode: true,
    background: (mode) => (mode === "light" ? LIGHT_PAPER : "#000000"),
    targets: [{ selector: "#topo-canvas", role: "background" }],
    patch(source, { length, density, mode }) {
      let next = source
        .replace("float noiseScale = 1.4;", `float noiseScale = ${glslFloat(1.4 * length, 3)};`)
        .replace("float numBands = 10.0;", `float numBands = ${glslFloat(10 * density, 2)};`);
      if (mode === "light") {
        // Additive white-on-black does not invert cleanly — mix paper toward ink by line strength.
        next = next
          .replace("gridLines = clamp(gridLines, 0.0, 1.0) * 0.12;", "gridLines = clamp(gridLines, 0.0, 1.0) * 0.55;")
          .replace(
            "float topoLines = smoothstep(0.02, 0.00, triangleWave) * 0.45;",
            "float topoLines = smoothstep(0.03, 0.00, triangleWave) * 0.95;",
          )
          .replace(
            "vec3 color = vec3(0.0);\n                    color += vec3(1.0) * gridLines;\n                    color += vec3(1.0) * topoLines;",
            "vec3 paper = vec3(0.933, 0.945, 0.965);\n                    vec3 ink = vec3(0.12, 0.14, 0.18);\n                    float lines = clamp(gridLines + topoLines, 0.0, 1.0);\n                    vec3 color = mix(paper, ink, lines);",
          );
      }
      return next;
    },
  },
} as const satisfies Record<string, EffectDefinition>;

function buildFocusedDocument(
  definition: EffectDefinition,
  knobs: BakeKnobs & {
    speed: number;
    opacity: number;
  },
) {
  const mode = knobs.mode;
  const background = resolveBackground(definition.background, mode);
  const targetJson = JSON.stringify(definition.targets).replace(/</g, "\\u003c");
  const controlsJson = JSON.stringify({
    mode,
    speed: knobs.speed,
    size: knobs.size,
    gap: knobs.gap,
    length: knobs.length,
    density: knobs.density,
    strokeWidth: knobs.strokeWidth,
    opacity: knobs.opacity,
  }).replace(/</g, "\\u003c");
  const patchedSource = definition.patch
    ? definition.patch(definition.source, {
        variant: knobs.variant,
        size: knobs.size,
        gap: knobs.gap,
        length: knobs.length,
        density: knobs.density,
        strokeWidth: knobs.strokeWidth,
        mode,
      })
    : definition.source;
  const focusStyle = `<style data-threeui-focus>
html, body { width: 100% !important; height: 100% !important; min-height: 0 !important; margin: 0 !important; padding: 0 !important; overflow: hidden !important; background: ${background} !important; }
body { position: relative !important; display: flex !important; align-items: center !important; justify-content: center !important; }
body > * { visibility: hidden !important; }
body[data-threeui-ready] > [data-threeui-role] { visibility: visible !important; }
[data-threeui-residual] { display: none !important; }
[data-threeui-role="background"] { position: fixed !important; inset: 0 !important; width: 100% !important; height: 100% !important; max-width: none !important; max-height: none !important; z-index: 0 !important; opacity: 1 !important; pointer-events: none !important; }
[data-threeui-role="ui"] { position: relative !important; z-index: 1 !important; width: min(calc(100% - 32px), var(--threeui-target-width, 1040px)) !important; max-width: none !important; max-height: calc(100% - 32px) !important; margin: auto !important; overflow: auto !important; opacity: 1 !important; transform: none !important; filter: none !important; flex: none !important; box-sizing: border-box !important; }
${definition.focusCss ?? ""}
</style>`;
  const controlScript = `<script data-threeui-controls>
(function () {
  var controls = ${controlsJson};
  window.__SF_CONTROLS = controls;
  var origin = performance.now();
  var virtual = 0;
  var last = origin;
  var performanceNow = performance.now.bind(performance);
  var dateNow = Date.now.bind(Date);
  var dateOrigin = dateNow();
  performance.now = function () {
    var real = performanceNow();
    virtual += (real - last) * (controls.speed || 1);
    last = real;
    return origin + virtual;
  };
  Date.now = function () {
    return dateOrigin + (performance.now() - origin);
  };
  var raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = function (callback) {
    return raf(function () {
      callback(performance.now());
    });
  };
  function applyVisual() {
    var opacity = controls.opacity == null ? 1 : controls.opacity;
    var size = controls.size == null ? 1 : controls.size;
    Array.prototype.forEach.call(document.querySelectorAll('[data-threeui-role]'), function (element) {
      element.style.opacity = String(opacity);
      if (element.getAttribute('data-threeui-role') === 'ui') {
        element.style.transform = 'scale(' + size + ')';
        element.style.transformOrigin = 'center center';
      }
    });
  }
  window.addEventListener('message', function (event) {
    if (!event.data || event.data.type !== 'threeui-controls') return;
    var next = event.data.controls || {};
    Object.keys(next).forEach(function (key) { controls[key] = next[key]; });
    applyVisual();
  });
  window.__SF_APPLY_CONTROLS = applyVisual;
})();
</script>`;
  const focusScript = `<script data-threeui-focus>
(function () {
  var isolated = false;
  function isolate() {
    if (isolated) return;
    var specs = ${targetJson};
    var roots = [];
    specs.forEach(function (spec) {
      var element = document.querySelector(spec.selector);
      if (!element) return;
      element.setAttribute('data-threeui-role', spec.role);
      if (spec.width) element.style.setProperty('--threeui-target-width', spec.width);
      if (!roots.some(function (root) { return root.contains(element); })) roots.push(element);
    });
    if (!roots.length) return;
    isolated = true;
    roots.forEach(function (root) { document.body.appendChild(root); });
    Array.from(document.body.children).forEach(function (element) {
      if (roots.indexOf(element) !== -1) return;
      element.setAttribute('data-threeui-residual', '');
      element.setAttribute('aria-hidden', 'true');
      if ('inert' in element) element.inert = true;
    });
    document.body.setAttribute('data-threeui-ready', '');
    if (window.__SF_APPLY_CONTROLS) window.__SF_APPLY_CONTROLS();
    requestAnimationFrame(function () { window.dispatchEvent(new Event('resize')); });
  }
  function scheduleIsolation() { setTimeout(isolate, 100); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scheduleIsolation, { once: true });
  else scheduleIsolation();
  window.addEventListener('load', isolate, { once: true });
})();
</script>`;
  return patchedSource
    .replace(/<head([^>]*)>/i, `<head$1>${controlScript}${focusStyle}`)
    .replace(/<\/body>/i, `${focusScript}</body>`);
}

function NeuformBatchEffect({
  definition,
  variant = "cube",
  mode,
  speed = NEUFORM_BATCH_DEFAULTS.speed,
  size = NEUFORM_BATCH_DEFAULTS.size,
  gap = NEUFORM_BATCH_DEFAULTS.gap,
  length = NEUFORM_BATCH_DEFAULTS.length,
  density = NEUFORM_BATCH_DEFAULTS.density,
  strokeWidth = NEUFORM_BATCH_DEFAULTS.strokeWidth,
  opacity = NEUFORM_BATCH_DEFAULTS.opacity,
  hue = NEUFORM_BATCH_DEFAULTS.hue,
  saturation = NEUFORM_BATCH_DEFAULTS.saturation,
  brightness = NEUFORM_BATCH_DEFAULTS.brightness,
  className,
  style,
}: NeuformBatchEffectProps & { definition: EffectDefinition }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestedMode = mode ?? definition.defaultMode ?? NEUFORM_BATCH_DEFAULTS.mode;
  const automaticMode = useAutomaticMode(requestedMode === "auto");
  const resolvedMode = requestedMode === "auto"
    ? automaticMode
    : resolveMode(requestedMode, NEUFORM_BATCH_DEFAULTS.mode);
  const background = resolveBackground(definition.background, resolvedMode);
  const safeSpeed = clamp(speed, 0, 3);
  // Size accepts both multipliers (most effects) and absolute pixels (override grid).
  const safeSize = clamp(size, 0.05, 200);
  const safeGap = clamp(gap, 0, 64);
  const safeLength = clamp(length, 0.35, 2.5);
  const safeDensity = clamp(density, 0.25, 2.5);
  const safeStrokeWidth = clamp(strokeWidth, 0.25, 8);
  const safeOpacity = clamp(opacity, 0.05, 1);
  const safeHue = clamp(hue, -180, 180);
  const safeSaturation = clamp(saturation, 0, 2);
  const safeBrightness = clamp(brightness, 0.35, 1.65);

  // Rebuild when baked geometry/mode knobs change. Speed/opacity stay live via postMessage + time wrap.
  const source = useMemo(
    () =>
      buildFocusedDocument(definition, {
        variant,
        mode: resolvedMode,
        speed: NEUFORM_BATCH_DEFAULTS.speed,
        size: safeSize,
        gap: safeGap,
        length: safeLength,
        density: safeDensity,
        strokeWidth: safeStrokeWidth,
        opacity: NEUFORM_BATCH_DEFAULTS.opacity,
      }),
    [definition, resolvedMode, safeDensity, safeGap, safeLength, safeSize, safeStrokeWidth, variant],
  );

  useEffect(() => {
    const frame = iframeRef.current?.contentWindow;
    if (!frame) return;
    frame.postMessage(
      {
        type: "threeui-controls",
        controls: {
          mode: resolvedMode,
          speed: safeSpeed,
          size: safeSize,
          gap: safeGap,
          length: safeLength,
          density: safeDensity,
          strokeWidth: safeStrokeWidth,
          opacity: safeOpacity,
        },
      },
      "*",
    );
  }, [resolvedMode, safeDensity, safeGap, safeLength, safeOpacity, safeSize, safeSpeed, safeStrokeWidth, source]);

  const filter =
    safeHue === 0 && safeSaturation === 1 && safeBrightness === 1
      ? undefined
      : `hue-rotate(${safeHue}deg) saturate(${safeSaturation}) brightness(${safeBrightness})`;

  return (
    <iframe
      ref={iframeRef}
      className={className}
      title={definition.title}
      srcDoc={source}
      sandbox="allow-scripts"
      loading="eager"
      style={{
        display: "block",
        width: "100%",
        height: "100%",
        border: 0,
        background,
        filter,
        ...style,
      }}
    />
  );
}

function createEffectComponent(definition: EffectDefinition) {
  return function EffectComponent(props: NeuformBatchEffectProps) {
    return <NeuformBatchEffect {...props} definition={definition} />;
  };
}

export const ConstellationField = createEffectComponent(EFFECTS.constellationField);
export const ParticleDrift = createEffectComponent(EFFECTS.particleDrift);
export const ParticleNetwork = createEffectComponent(EFFECTS.particleNetwork);
export const FluxVortex = createEffectComponent(EFFECTS.fluxVortex);
export const PortalField = createEffectComponent(EFFECTS.portalField);
export const FlowField = createEffectComponent(EFFECTS.flowField);
export const AmberHalftone = createEffectComponent(EFFECTS.amberHalftone);
const DIAGNOSTICS_PANEL_VARIANTS = {
  layers: EFFECTS.diagnosticsLayers,
  nodes: EFFECTS.diagnosticsNodes,
  flow: EFFECTS.diagnosticsFlow,
} as const;

export type DiagnosticsPanelVariant = keyof typeof DIAGNOSTICS_PANEL_VARIANTS;

export const DIAGNOSTICS_PANEL_DEFAULTS = {
  ...NEUFORM_BATCH_DEFAULTS,
  variant: "layers",
} as const;

export function DiagnosticsPanel({
  variant = DIAGNOSTICS_PANEL_DEFAULTS.variant,
  ...props
}: NeuformBatchEffectProps & { variant?: DiagnosticsPanelVariant }) {
  const definition = DIAGNOSTICS_PANEL_VARIANTS[variant] ?? DIAGNOSTICS_PANEL_VARIANTS.layers;
  return <NeuformBatchEffect {...props} definition={definition} />;
}
export const SignalParticles = createEffectComponent(EFFECTS.signalParticles);
export const SkeuomorphicToggle = createEffectComponent(EFFECTS.skeuomorphicToggle);
export const MatrixField = createEffectComponent(EFFECTS.matrixField);
export const GatewayFlow = createEffectComponent(EFFECTS.gatewayFlow);
export const ConnectivityGraph = createEffectComponent(EFFECTS.connectivityGraph);
export const InterfaceLines = createEffectComponent(EFFECTS.interfaceLines);
export const WireframeForms = createEffectComponent(EFFECTS.wireframeForms);
export const DefenseLines = createEffectComponent(EFFECTS.defenseLines);
export const OverrideGrid = createEffectComponent(EFFECTS.overrideGrid);
export const TopoField = createEffectComponent(EFFECTS.topoField);
```

### `src/shaders/neuform-isolated/sources/skeuomorphic-toggle.html`

Role: canonical-source · 164 lines · 11066 bytes · SHA-256 `3e19e7fec9ac3339f29c888341aad1f6f4009d1c1d76f0231c3ad24a6ce49b5a`

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skeuomorphic Toggle UI - Blue Remix</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://code.iconify.design/iconify-icon/1.0.7/iconify-icon.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/ScrollTrigger.min.js"></script>
</head>
<body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 antialiased" style="background-image: linear-gradient(to right, #e2e8f0 1px, transparent 1px), linear-gradient(to bottom, #e2e8f0 1px, transparent 1px); background-size: 120px 120px; background-position: center center;">

    <!-- Card Container with Premium Gradient Border -->
    <div id="toggle-card" class="relative rounded-[2rem] w-full max-w-[380px] shadow-[0_25px_50px_-12px_rgba(15,23,42,0.12)] p-[1px] bg-gradient-to-b from-slate-200/80 via-slate-100/50 to-slate-50/20 z-10">
        
        <div class="bg-white rounded-[calc(2rem-1px)] w-full h-full overflow-hidden flex flex-col relative">
            
            <!-- Top Section: 3D Environment -->
            <div class="relative h-64 w-full flex items-center justify-center overflow-hidden" style="background: radial-gradient(circle at 50% 50%, #f0f7ff 0%, #ffffff 80%);">
                
                <!-- Light Rays -->
                <div class="absolute inset-0 pointer-events-none opacity-40" style="background: repeating-conic-gradient(from 0deg at 50% -10%, rgba(59, 130, 246, 0.04) 0deg, transparent 4deg, transparent 8deg, rgba(59, 130, 246, 0.04) 12deg);"></div>

                <!-- Soft Overlay Shadows -->
                <div class="absolute inset-0 pointer-events-none" style="box-shadow: inset 0 20px 40px -10px rgba(0,0,0,0.04), inset 0 -20px 40px -10px rgba(59, 130, 246, 0.05);"></div>

                <!-- Simulated WebGL Waves / Ripples -->
                <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <!-- Ambient Wave Base -->
                    <div class="absolute bottom-0 w-full h-32" style="background: radial-gradient(ellipse at 50% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 70%);"></div>
                    
                    <!-- Outer Ripple -->
                    <div class="absolute w-[320px] h-[160px] rounded-[80px]" style="border: 1px solid rgba(96, 165, 250, 0.05); box-shadow: 0 0 30px rgba(96, 165, 250, 0.06), inset 0 0 20px rgba(96, 165, 250, 0.03);"></div>
                    <!-- Middle Ripple -->
                    <div class="absolute w-[260px] h-[120px] rounded-[60px]" style="border: 1px solid rgba(96, 165, 250, 0.12); box-shadow: 0 0 20px rgba(96, 165, 250, 0.1), inset 0 0 15px rgba(96, 165, 250, 0.05);"></div>
                    <!-- Inner Ripple -->
                    <div class="absolute w-[220px] h-[90px] rounded-[45px]" style="border: 1px solid rgba(96, 165, 250, 0.2); box-shadow: 0 0 15px rgba(96, 165, 250, 0.18), inset 0 0 10px rgba(96, 165, 250, 0.1);"></div>
                </div>

                <!-- Dotted Pattern Arc -->
                <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[120px] pointer-events-none" style="mask-image: radial-gradient(circle at bottom, transparent 50px, black 51px); -webkit-mask-image: radial-gradient(circle at bottom, transparent 50px, black 51px);">
                    <div class="w-full h-full opacity-40" style="background-image: radial-gradient(rgba(59, 130, 246, 0.7) 1.5px, transparent 1.5px); background-size: 8px 8px; mask-image: linear-gradient(to bottom, black, transparent); -webkit-mask-image: linear-gradient(to bottom, black, transparent);"></div>
                </div>

                <!-- Skeuomorphic Toggle Control -->
                <div id="skeuomorphic-toggle" role="switch" aria-checked="true" tabindex="0" class="relative z-10 w-48 h-16 rounded-full p-1.5 cursor-pointer select-none" style="background: repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%); box-shadow: inset 0 4px 8px rgba(0,0,0,0.1), inset 0 -2px 4px rgba(255,255,255,0.7), 0 0 0 6px rgba(239, 246, 255, 0.8), 0 0 25px 5px rgba(96, 165, 250, 0.4); border: 1px solid #60a5fa; transition: background 0.35s ease, box-shadow 0.35s ease, border-color 0.35s ease;">
                    <div id="skeuomorphic-thumb" class="absolute top-1.5 left-1.5 w-[116px] h-[calc(100%-0.75rem)] rounded-full flex items-center justify-center" style="background: linear-gradient(180deg, #ffffff 0%, #f4f8ff 100%); box-shadow: 0 10px 20px -4px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(0,0,0,0.04), inset 0 3px 4px rgba(255,255,255,1), inset 0 -2px 4px rgba(96, 165, 250, 0.2); border: 1px solid #e0edfa; transform: translateX(64px); transition: transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease;">
                        <span class="text-sm font-normal text-slate-800 tracking-wide" style="text-shadow: 0 1px 1px rgba(255,255,255,0.9); transition: color 0.35s ease, opacity 0.35s ease;">Live Sync</span>
                    </div>
                </div>
            </div>

            <!-- Bottom Section: Content -->
            <div class="p-7 pb-9 bg-white z-20 relative">
                <!-- Icon -->
                <div class="w-8 h-8 rounded-[0.6rem] mb-4 flex items-center justify-center" style="background: linear-gradient(135deg, #60a5fa 0%, #2563eb 100%); box-shadow: inset 0 2px 2px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.1), 0 4px 8px -2px rgba(37, 99, 235, 0.4); border: 1px solid #1d4ed8;">
                    <iconify-icon icon="solar:server-square-linear" class="text-white text-base" style="filter: drop-shadow(0 1px 1px rgba(0,0,0,0.2));"></iconify-icon>
                </div>
                
                <!-- Text -->
                <h2 class="text-xl font-normal tracking-tight text-slate-900 mb-1.5 mask-reveal">Real-time Updates</h2>
                <p class="text-sm text-slate-500 leading-relaxed mask-reveal">Seamless background integration keeps everything current.</p>
            </div>
            
        </div>
    </div>

    <script>
        (function () {
            var toggle = document.getElementById('skeuomorphic-toggle');
            var thumb = document.getElementById('skeuomorphic-thumb');
            var label = thumb && thumb.querySelector('span');
            if (!toggle || !thumb) return;

            var ON_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.02) 2px, rgba(0,0,0,0.02) 4px), linear-gradient(180deg, #dbeafe 0%, #93c5fd 100%)';
            var OFF_BG = 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px), linear-gradient(180deg, #e2e8f0 0%, #cbd5e1 100%)';
            var ON_SHADOW = 'inset 0 4px 8px rgba(0,0,0,0.1), inset 0 -2px 4px rgba(255,255,255,0.7), 0 0 0 6px rgba(239, 246, 255, 0.8), 0 0 25px 5px rgba(96, 165, 250, 0.4)';
            var OFF_SHADOW = 'inset 0 4px 8px rgba(0,0,0,0.12), inset 0 -2px 4px rgba(255,255,255,0.55), 0 0 0 6px rgba(241, 245, 249, 0.9), 0 0 18px 2px rgba(148, 163, 184, 0.25)';
            var ON_BORDER = '#60a5fa';
            var OFF_BORDER = '#94a3b8';
            var ON_THUMB_SHADOW = '0 10px 20px -4px rgba(37, 99, 235, 0.3), 0 4px 6px -2px rgba(0,0,0,0.04), inset 0 3px 4px rgba(255,255,255,1), inset 0 -2px 4px rgba(96, 165, 250, 0.2)';
            var OFF_THUMB_SHADOW = '0 8px 16px -4px rgba(15, 23, 42, 0.18), 0 3px 5px -2px rgba(0,0,0,0.05), inset 0 3px 4px rgba(255,255,255,1), inset 0 -2px 4px rgba(148, 163, 184, 0.25)';

            function travel() {
                return Math.max(0, toggle.clientWidth - thumb.clientWidth - 12);
            }

            function apply(on) {
                toggle.setAttribute('aria-checked', on ? 'true' : 'false');
                toggle.style.background = on ? ON_BG : OFF_BG;
                toggle.style.boxShadow = on ? ON_SHADOW : OFF_SHADOW;
                toggle.style.borderColor = on ? ON_BORDER : OFF_BORDER;
                thumb.style.transform = 'translateX(' + (on ? travel() : 0) + 'px)';
                thumb.style.boxShadow = on ? ON_THUMB_SHADOW : OFF_THUMB_SHADOW;
                if (label) {
                    label.style.opacity = on ? '1' : '0.72';
                    label.style.color = on ? '#1e293b' : '#475569';
                }
            }

            function flip() {
                apply(toggle.getAttribute('aria-checked') !== 'true');
            }

            apply(true);
            toggle.addEventListener('click', flip);
            toggle.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    flip();
                }
            });
            window.addEventListener('resize', function () {
                apply(toggle.getAttribute('aria-checked') === 'true');
            });
        })();

        document.addEventListener("DOMContentLoaded", () => {
            if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
            gsap.registerPlugin(ScrollTrigger);
            
            document.querySelectorAll('.mask-reveal').forEach(el => {
                const text = el.innerText;
                el.innerHTML = '';
                
                text.split(/(\s+)/).forEach(part => {
                    if (!part.trim()) {
                        el.appendChild(document.createTextNode(part));
                        return;
                    }
                    
                    const wrapper = document.createElement('span');
                    wrapper.style.display = 'inline-block';
                    wrapper.style.overflow = 'hidden';
                    wrapper.style.verticalAlign = 'bottom';
                    
                    const inner = document.createElement('span');
                    inner.innerText = part;
                    inner.style.display = 'inline-block';
                    inner.className = 'reveal-word';
                    inner.style.transform = 'translateY(110%)';
                    inner.style.opacity = '0';
                    
                    wrapper.appendChild(inner);
                    el.appendChild(wrapper);
                });
                
                gsap.to(el.querySelectorAll('.reveal-word'), {
                    y: '0%',
                    opacity: 1,
                    duration: 0.6,
                    stagger: 0.04,
                    ease: 'power3.out',
                    scrollTrigger: {
                        trigger: el,
                        start: 'top 95%',
                    }
                });
            });
        });
    </script>
</body>
</html>
```

### `src/shaders/threeui.css`

Role: shared-style · 1775 lines · 40715 bytes · SHA-256 `efe4447139f1358dd8e9be68edf6fa46cbefbd1de423a4d6c439ca61d2c8eccf`

```css
.threeui-mount,
.terrain-plume-component,
.text-path-study,
.article-headings-component,
.animated-top-dock-component,
.typography-vortex-component,
.mechanical-keyboard,
.retro-metallic,
.landscape-scene,
.japanese-tower-landscape,
.sakura-branch-scene,
.isometric-motion-grid,
.isometric-illustration,
.tetrahedron-365,
.liquid-metal-button,
.iso-mail-lightshafts,
.spark-badge,
.hypnotic-loops,
.at-the-horizon,
.scalability-bricks,
.threeui-background {
  position: relative;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.mechanical-keyboard {
  isolation: isolate;
  background: #090a0c;
}

.mechanical-keyboard__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #090a0c;
  opacity: 0;
  transition: opacity 180ms ease-out;
  touch-action: none;
}

.mechanical-keyboard__frame.is-ready {
  opacity: 1;
}

.retro-metallic {
  isolation: isolate;
  background: #08090a;
}

.retro-metallic__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #08090a;
  opacity: 0;
  transition: opacity 180ms ease-out;
  touch-action: none;
}

.retro-metallic__frame.is-ready {
  opacity: 1;
}

.japanese-tower-landscape {
  isolation: isolate;
  background: #ecdcbc;
}

.japanese-tower-landscape__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ecdcbc;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.japanese-tower-landscape__frame.is-ready {
  opacity: 1;
}

.landscape-scene {
  isolation: isolate;
  background: #ecdcbc;
}

.landscape-scene__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #ecdcbc;
  opacity: 0;
  transition: opacity 180ms ease-out;
  touch-action: none;
}

.landscape-scene__frame.is-ready {
  opacity: 1;
}

.sakura-branch-scene {
  isolation: isolate;
  background: #d4738a;
}

.sakura-branch-scene__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #d4738a;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.sakura-branch-scene__frame.is-ready {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .sakura-branch-scene__frame {
    transition: none;
  }
}

.isometric-motion-grid {
  isolation: isolate;
  background: #08090a;
}

.isometric-motion-grid__stage {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 1200px;
  height: 675px;
  transform-origin: 50% 50%;
}

.isometric-motion-grid__frame {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #08090a;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.isometric-motion-grid__frame.is-ready {
  opacity: 1;
}

.isometric-illustration {
  isolation: isolate;
  background: #111;
}

.isometric-illustration__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #111;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.isometric-illustration__frame.is-ready {
  opacity: 1;
}

.tetrahedron-365 {
  isolation: isolate;
  background: #000;
}

.tetrahedron-365__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.tetrahedron-365__frame.is-ready {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .tetrahedron-365__frame {
    transition: none;
  }
}

.liquid-metal-button {
  isolation: isolate;
  background: #070708;
}

.liquid-metal-button__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #070708;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.liquid-metal-button__frame.is-ready {
  opacity: 1;
}

@media (prefers-reduced-motion: reduce) {
  .liquid-metal-button__frame {
    transition: none;
  }
}

.iso-mail-lightshafts {
  isolation: isolate;
  background: #140f0b;
}

.iso-mail-lightshafts__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #140f0b;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.iso-mail-lightshafts__frame.is-ready {
  opacity: 1;
}

.spark-badge {
  isolation: isolate;
  background: #000;
}

.spark-badge__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.spark-badge__frame.is-ready {
  opacity: 1;
}

.hypnotic-loops {
  isolation: isolate;
  background: #f15a24;
}

.hypnotic-loops__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #f15a24;
  opacity: 0;
}

.hypnotic-loops__frame.is-ready {
  opacity: 1;
}

.at-the-horizon {
  isolation: isolate;
  background: #000;
}

.at-the-horizon__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #000;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.at-the-horizon__frame.is-ready {
  opacity: 1;
}

.scalability-bricks {
  isolation: isolate;
  background: #0b0b0c;
}

.scalability-bricks__frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #0b0b0c;
  opacity: 0;
  transition: opacity 180ms ease-out;
}

.scalability-bricks__frame.is-ready {
  opacity: 1;
}

.text-path-study {
  isolation: isolate;
  background: #08090a;
}

.text-path-study--light {
  background: #f3f5f8;
}

.text-path-study-frame {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: transparent;
  transform-origin: 50% 50%;
}

.threeui-background {
  position: relative;
  isolation: isolate;
  background: #030304;
}

.threeui-background.condensation {
  background: transparent;
}

.threeui-background.predictive-arc--light,
.threeui-background.data-pixel-arc--light {
  background: #f3f6f1;
}

.typography-vortex-component.typography-vortex-component--light {
  background: #eef1f6;
}

.typography-vortex-component--light .typography-vortex-component__hint {
  color: rgba(28, 30, 38, 0.55);
}

.threeui-background > canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.cross-beam-canvas,
.terrain-plume-canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.terrain-plume-component {
  pointer-events: none;
}

.terrain-plume-component {
  --fe-bg: #030304;
  --fe-band: clamp(260px, 52cqw, 820px);

  isolation: isolate;
  container-type: inline-size;
  background:
    linear-gradient(180deg, #050505 0%, #020202 44%, #000 100%);
}

/* Each scene keeps the same engraved grammar and only moves the ground tone the
   body fill and the reveal cover are painted with. */
.terrain-plume-component[data-terrain-scene="river"] {
  --fe-bg: #03070a;

  background:
    linear-gradient(180deg, #05090d 0%, #020507 44%, #000 100%);
}

.terrain-plume-component[data-terrain-scene="desert"] {
  --fe-bg: #0a0603;

  background:
    linear-gradient(180deg, #0d0805 0%, #060302 44%, #000 100%);
}

.terrain-plume-component[data-terrain-scene="bridge-city"] {
  --fe-bg: #03050b;

  background:
    linear-gradient(180deg, #050810 0%, #020407 44%, #000 100%);
}

/* The authored plume sits at the foot of its own canvas, where the terrain band
   buries it. Every scene keeps that exact gradient and only raises the canvas
   until the glow clears the range — stopping below the far edge of the hatch so
   the ground line the eye reads as the horizon is also where the sky starts,
   and the canvas edge itself stays behind the terrain. */
.terrain-plume-component[data-terrain-scene="river"] .terrain-plume-canvas,
.terrain-plume-component[data-terrain-scene="desert"] .terrain-plume-canvas,
.terrain-plume-component[data-terrain-scene="bridge-city"] .terrain-plume-canvas {
  top: auto;
  bottom: calc(var(--fe-band) * 0.33);
}

/* The footer vignette was tuned to bury the plume behind a range that fills the
   frame. These scenes leave far more open sky, so the same wash is lightened
   until the glow survives it. */
.terrain-plume-component[data-terrain-scene="river"]::after,
.terrain-plume-component[data-terrain-scene="desert"]::after,
.terrain-plume-component[data-terrain-scene="bridge-city"]::after {
  background:
    radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.07), transparent 34%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.06), rgba(0, 0, 0, 0.3) 72%, rgba(0, 0, 0, 0.62));
}

.terrain-plume-component::before,
.terrain-plume-component::after {
  position: absolute;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  content: "";
}

.terrain-plume-component::before {
  background:
    linear-gradient(90deg, transparent calc(50% - 0.5px), rgba(255, 255, 255, 0.05) calc(50% - 0.5px) calc(50% + 0.5px), transparent calc(50% + 0.5px)),
    repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.022) 0 1px, transparent 1px 11.5vw),
    repeating-linear-gradient(180deg, rgba(255, 255, 255, 0.018) 0 1px, transparent 1px 5.8rem);
  opacity: 0.74;
}

.terrain-plume-component::after {
  background:
    radial-gradient(circle at 50% 100%, rgba(255, 255, 255, 0.09), transparent 34%),
    linear-gradient(180deg, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0.62) 72%, rgba(0, 0, 0, 0.9));
}

.terrain-plume-canvas {
  z-index: 0;
}

.footer-engraved-terrain {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 1;
  display: block;
  width: 100%;
  height: var(--fe-band);
  pointer-events: none;
}

.footer-engraved-reveal {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.footer-engraved-grain {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/></filter><rect width='160' height='160' filter='url(%23n)'/></svg>");
  background-size: 160px 160px;
}
.sunset-valley-scene,
.sunset-valley-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.sunset-valley-scene {
  position: relative;
  overflow: hidden;
  background: #090d16;
}

.sunset-valley-canvas {
  position: relative;
  z-index: 1;
  opacity: 0;
  touch-action: none;
}

.sunset-valley-canvas.is-ready {
  opacity: 1;
}

img.sunset-valley-fallback {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.temple-night-scene,
.temple-night-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.temple-night-scene {
  position: relative;
  overflow: hidden;
  background: #05070a;
}

.temple-night-canvas {
  position: relative;
  z-index: 1;
  opacity: 0;
  touch-action: none;
}

.temple-night-canvas.is-ready {
  opacity: 1;
}

.temple-night-unavailable {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #a9b2b7;
  background: #05070a;
}

.yosemite-sunset-scene,
.yosemite-sunset-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.yosemite-sunset-scene {
  position: relative;
  overflow: hidden;
  background: #241a26;
}

.yosemite-sunset-canvas {
  position: relative;
  z-index: 1;
  opacity: 0;
  touch-action: none;
}

.yosemite-sunset-canvas.is-ready {
  opacity: 1;
}

.yosemite-sunset-unavailable {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #e0c3ab;
  background: #241a26;
}

.presidio-sunset-scene,
.presidio-sunset-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.presidio-sunset-scene {
  position: relative;
  overflow: hidden;
  background: #2a1c22;
}

.presidio-sunset-canvas {
  position: relative;
  z-index: 1;
  opacity: 0;
  touch-action: none;
}

.presidio-sunset-canvas.is-ready {
  opacity: 1;
}

.presidio-sunset-unavailable {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #e6c1ad;
  background: #2a1c22;
}

.lake-louise-scene,
.lake-louise-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.lake-louise-scene {
  position: relative;
  overflow: hidden;
  background: #171d2c;
}

.lake-louise-canvas {
  position: relative;
  z-index: 1;
  opacity: 0;
  touch-action: none;
}

.lake-louise-canvas.is-ready {
  opacity: 1;
}

.lake-louise-unavailable {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  color: #b9c8d6;
  background: #171d2c;
}

.bookshelf,
.bookshelf__canvas,
.sketchbook,
.sketchbook__frame {
  display: block;
  width: 100%;
  height: 100%;
}

.bookshelf {
  position: relative;
  container-type: inline-size;
  overflow: hidden;
  background: #171a24;
  outline: none;
}

.bookshelf__canvas {
  position: absolute;
  inset: 0;
  opacity: 0;
  touch-action: none;
}

.bookshelf__canvas.is-ready {
  opacity: 1;
}

.bookshelf__source-controls {
  display: none;
}

.bookshelf__unavailable {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 24px;
  color: #f4eee6;
  text-align: center;
}

.sketchbook {
  position: relative;
  overflow: hidden;
  background: #ece7dc;
}

.sketchbook__frame {
  border: 0;
  opacity: 0;
  background: #ece7dc;
}

.sketchbook__frame.is-ready {
  opacity: 1;
}

@font-face {
  font-family: "ThreeUI Fragment Mono";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("./fonts/fragment-mono.woff2") format("woff2");
}

.article-headings-component,
.animated-top-dock-component,
.typography-vortex-component {
  container-type: inline-size;
  color: #ecece8;
  background: #0b0b0b;
  font-family: "Geist", "Helvetica Neue", Helvetica, Arial, sans-serif;
}

.article-headings-component {
  display: grid;
  grid-template-rows: auto 1fr 1fr;
  padding: clamp(20px, 5.4cqw, 74px) clamp(20px, 6.2cqw, 86px);
  isolation: isolate;
}

.article-headings-component::after,
.animated-top-dock-component::after,
.typography-vortex-component::after {
  position: absolute;
  inset: 0;
  z-index: 5;
  pointer-events: none;
  content: "";
  opacity: 0.12;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.16'/%3E%3C/svg%3E");
  mix-blend-mode: soft-light;
}

.article-headings-component__header {
  display: flex;
  justify-content: space-between;
  padding-bottom: clamp(14px, 2.6cqw, 30px);
  color: #62625e;
  font: 400 clamp(8px, 0.85cqw, 10px) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.12em;
}

.article-headings-component__entry {
  display: grid;
  grid-template-columns: clamp(28px, 4cqw, 56px) minmax(0, 1fr) auto;
  align-items: center;
  gap: clamp(10px, 2.2cqw, 30px);
  border-top: 1px solid #2a2a28;
}

.article-headings-component__entry h2 {
  margin: 0;
  color: #e9e9e5;
  font-size: clamp(18px, 3.2cqw, 44px);
  font-weight: 600;
  line-height: 1.08;
  letter-spacing: -0.02em;
}

.article-headings-component__index,
.article-headings-component__meta {
  color: #60605c;
  font: 400 clamp(8px, 0.85cqw, 10px) / 1.3 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.06em;
}

.article-headings-component__meta {
  text-align: right;
}

.article-headings-component--light {
  color: #202128;
  background: #f3f5f8;
}

.article-headings-component--light .article-headings-component__header,
.article-headings-component--light .article-headings-component__index,
.article-headings-component--light .article-headings-component__meta {
  color: #71737b;
}

.article-headings-component--light .article-headings-component__entry {
  border-color: #d9dce3;
}

.article-headings-component--light .article-headings-component__entry h2 {
  color: #1d1f26;
}

.typography-vortex-component {
  position: relative;
  isolation: isolate;
  touch-action: none;
  cursor: crosshair;
}

.typography-vortex-component canvas {
  position: absolute;
  inset: 0;
  display: block;
  width: 100%;
  height: 100%;
}

.typography-vortex-component__hint,
.animated-top-dock-component__caption {
  position: absolute;
  z-index: 6;
  color: #62625e;
  font: 400 9px/1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.1em;
}

.typography-vortex-component__hint {
  right: 18px;
  bottom: 16px;
}

.animated-top-dock-component {
  position: relative;
  display: grid;
  place-items: center;
  isolation: isolate;
  background:
    radial-gradient(circle at 50% 20%, rgba(255, 255, 255, 0.035), transparent 34%),
    #080808;
}

.animated-top-dock__nav {
  position: absolute;
  top: clamp(24px, 5cqw, 46px);
  left: 50%;
  z-index: 10;
  display: flex;
  align-items: flex-start;
  gap: 3px;
  height: 38px;
  padding: 4px;
  overflow: visible;
  border: 1px solid #292929;
  border-radius: 11px;
  background: rgba(14, 14, 14, 0.86);
  box-shadow: 0 12px 34px rgba(0, 0, 0, 0.48), inset 0 1px rgba(255, 255, 255, 0.035);
  backdrop-filter: blur(18px) saturate(75%);
  transform: translateX(-50%);
  isolation: isolate;
}

.animated-top-dock__item {
  position: relative;
  z-index: 6;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 28px;
  min-width: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  outline: none;
  color: #858580;
  background: rgba(21, 21, 20, 0.9);
  font: 400 10px/1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.1em;
  white-space: nowrap;
  backdrop-filter: blur(14px) saturate(70%);
  transform-origin: 50% 0;
  transition: color 0.15s, border-color 0.18s, background 0.18s, box-shadow 0.18s;
  will-change: width, height, transform;
  cursor: pointer;
}

.animated-top-dock__item[data-dock-near="true"],
.animated-top-dock__item:focus-visible {
  z-index: 7;
  color: #ecece8;
  border-color: #41413e;
  background: rgba(27, 27, 26, 0.94);
  box-shadow: 0 7px 16px rgba(0, 0, 0, 0.26);
}

.animated-top-dock__logo {
  width: 28px;
  height: 28px;
  overflow: hidden;
  background: #e8e8e3;
}

.animated-top-dock__logo svg {
  display: block;
  width: 100%;
  height: 100%;
}

.animated-top-dock__link {
  gap: 6px;
  width: 94px;
  padding: 0 9px;
}

.animated-top-dock__link[aria-pressed="true"] {
  color: #111;
  border-color: #e8e8e3;
  background: #e8e8e3;
  box-shadow: 0 7px 18px rgba(0, 0, 0, 0.28);
}

.animated-top-dock__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 13px;
  height: 13px;
  opacity: 0.62;
  transition: opacity 0.16s;
}

.animated-top-dock__icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.animated-top-dock__item[data-dock-near="true"] .animated-top-dock__icon,
.animated-top-dock__item:focus-visible .animated-top-dock__icon {
  opacity: 1;
}

.animated-top-dock-component__caption {
  right: 18px;
  bottom: 16px;
}

@media (max-width: 600px) {
  .article-headings-component {
    padding: 18px;
  }

  .article-headings-component__entry {
    grid-template-columns: 24px minmax(0, 1fr);
  }

  .article-headings-component__entry h2 {
    font-size: clamp(17px, 5.5vw, 26px);
  }

  .article-headings-component__meta {
    display: none;
  }

  .animated-top-dock__nav {
    top: 24px;
    gap: 2px;
    height: 36px;
  }

  .animated-top-dock__item {
    height: 26px !important;
    transform: none !important;
  }

  .animated-top-dock__logo {
    width: 26px !important;
    height: 26px !important;
  }

  .animated-top-dock__link {
    width: auto !important;
    padding: 0 7px;
    font-size: 8px;
    letter-spacing: 0.07em;
  }

  .animated-top-dock__icon {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .animated-top-dock__item {
    transform: none !important;
  }
}

/* ── Top dock variants ────────────────────────────────────────────────────
   Every dimension below is a container query unit with a clamp, because these
   bars are shown at anything from a 600 px card to a 1920 px capture frame: a
   fixed 56 px bar that reads correctly in the catalogue frame becomes a thin
   strip of small type at full width. One scale block feeds all three. */

.animated-top-dock-component.atd-modern,
.animated-top-dock-component.atd-retro,
.animated-top-dock-component.atd-glass {
  --atd-top: clamp(16px, 2.6cqw, 46px);
  --atd-bar-width: min(1460px, calc(100% - clamp(24px, 4.2cqw, 96px)));
  --atd-bar-height: clamp(48px, 3.4cqw, 68px);
  --atd-bar-pad: clamp(5px, 0.42cqw, 9px);
  --atd-bar-lead: clamp(14px, 1.15cqw, 25px);
  --atd-item-height: clamp(30px, 2.2cqw, 44px);
  --atd-item-pad: clamp(10px, 0.86cqw, 18px);
  --atd-label: clamp(12px, 0.78cqw, 17px);
  --atd-icon: clamp(13px, 0.92cqw, 19px);
  --atd-gap: clamp(5px, 0.44cqw, 9px);
  --atd-brand: clamp(13px, 0.94cqw, 20px);
  --atd-mark: clamp(22px, 1.55cqw, 33px);
  --atd-action-height: clamp(34px, 2.5cqw, 50px);
  display: block;
  overflow: hidden;
}

.atd-modern__bar,
.atd-retro__bar {
  position: absolute;
  top: var(--atd-top);
  left: 50%;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: var(--atd-bar-width);
  height: var(--atd-bar-height);
  transform: translateX(-50%);
}

/* Command bar: the bar hugs its own content — brand, dock and actions sit in
   one flow with a gap between them rather than being pushed to the far edges of
   a full-bleed strip. That only holds because the dock's track is locked to its
   rest width (lockTrack in the controller): the spring then grows its items
   outside that track instead of widening the bar and shoving the brand and the
   actions around on every pointer move. */
.atd-modern__bar {
  /* space-between is inherited rather than centred on purpose: at its natural
     width the three groups already fill the box, and in a shell too narrow for
     them the overflow then runs off the right instead of taking the brand off
     the left as well */
  width: max-content;
  max-width: var(--atd-bar-width);
  padding: var(--atd-bar-pad) var(--atd-bar-pad) var(--atd-bar-pad) var(--atd-bar-lead);
}

.atd-modern__dock {
  display: flex;
  flex: none;
  gap: clamp(2px, 0.2cqw, 5px);
  align-items: flex-start;
  /* the track is one item tall and its rest width wide, and the row is centred
     inside it, so a growing item overflows evenly on all four sides without
     moving a single neighbour in the bar */
  justify-content: center;
  height: var(--atd-item-height);
}

.atd-modern__item,
.atd-retro__item,
.atd-glass__item {
  display: inline-flex;
  flex: none;
  gap: var(--atd-gap);
  align-items: center;
  justify-content: center;
  height: var(--atd-item-height);
  padding: 0 var(--atd-item-pad);
  outline: none;
  white-space: nowrap;
  transform-origin: 50% 0;
  will-change: width, height, transform;
  cursor: pointer;
}

.atd-modern__brand,
.atd-glass__brand,
.atd-retro__brand {
  display: inline-flex;
  flex: none;
  gap: clamp(7px, 0.6cqw, 13px);
  align-items: center;
  text-decoration: none;
}

.atd-modern__mark,
.atd-glass__mark {
  display: block;
  width: var(--atd-mark);
  height: var(--atd-mark);
  overflow: hidden;
}

.atd-modern__mark svg,
.atd-glass__mark svg {
  display: block;
  width: 100%;
  height: 100%;
}

.atd-modern__word,
.atd-glass__word {
  font-size: var(--atd-brand);
  font-weight: 600;
  letter-spacing: -0.018em;
}

.atd-modern__actions {
  display: inline-flex;
  flex: none;
  gap: clamp(4px, 0.34cqw, 8px);
  align-items: center;
}

.atd-modern__ghost {
  height: var(--atd-action-height);
  padding: 0 clamp(12px, 0.95cqw, 20px);
  border: 0;
  border-radius: 999px;
  background: transparent;
  font: 500 var(--atd-label) / 1 inherit;
  transition: color 0.16s, background 0.16s;
  cursor: pointer;
}

.atd-modern__cta,
.atd-glass__cta {
  height: var(--atd-action-height);
  border-radius: 999px;
  font: 600 var(--atd-label) / 1 inherit;
  letter-spacing: -0.01em;
  white-space: nowrap;
  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.18s;
  cursor: pointer;
}

/* ── Modern command bar ─────────────────────────────────────────────────── */

.animated-top-dock-component.atd-modern {
  /* a ceiling rather than a width: the command bar sizes itself to its own
     cluster, and only falls back to an inset strip in a shell too narrow to
     hold it */
  --atd-bar-width: min(1240px, calc(100% - clamp(24px, 5cqw, 120px)));
  background: #07080c;
}

.atd-modern__aurora {
  position: absolute;
  inset: -24% -12% auto -12%;
  z-index: 1;
  height: 82%;
  pointer-events: none;
  background:
    radial-gradient(58% 62% at 22% 36%, rgba(78, 116, 255, 0.4), transparent 68%),
    radial-gradient(46% 56% at 78% 20%, rgba(186, 96, 255, 0.3), transparent 70%),
    radial-gradient(40% 48% at 52% 6%, rgba(56, 220, 214, 0.2), transparent 72%),
    radial-gradient(34% 40% at 50% 14%, rgba(255, 255, 255, 0.07), transparent 76%);
  filter: blur(8px);
}

.atd-modern__bar {
  gap: clamp(14px, 2.4cqw, 40px);
  border: 1px solid rgba(255, 255, 255, 0.045);
  border-radius: 999px;
  background: linear-gradient(180deg, rgba(25, 27, 36, 0.86), rgba(12, 13, 18, 0.82));
  box-shadow: 0 22px 52px -24px rgba(0, 0, 0, 0.92), inset 0 1px rgba(255, 255, 255, 0.045);
  backdrop-filter: blur(22px) saturate(150%);
  -webkit-backdrop-filter: blur(22px) saturate(150%);
}

.atd-modern__brand {
  color: #f2f3f7;
}

.atd-modern__mark {
  /* a full circle: the shared brand mark is a rounded square, so the disc is cut
     from it by the mark box's own clip rather than by a second svg */
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.42);
}

.atd-modern__item {
  border: 1px solid transparent;
  border-radius: 999px;
  color: #9b9fae;
  background: transparent;
  font: 500 var(--atd-label) / 1 inherit;
  letter-spacing: -0.005em;
  transition: color 0.16s, border-color 0.18s, background 0.18s, box-shadow 0.18s, backdrop-filter 0.18s;
}

/* :hover is carried alongside the proximity flag so the glass still lands when
   the spring is off — reduced motion, a coarse pointer, a narrow viewport */
.atd-modern__item[data-dock-near="true"],
.atd-modern__item:hover,
.atd-modern__item:focus-visible {
  color: #f4f5f9;
  border-color: rgba(255, 255, 255, 0.055);
  background: rgba(255, 255, 255, 0.055);
  box-shadow: 0 8px 20px -14px rgba(0, 0, 0, 0.9), inset 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px) saturate(170%);
  -webkit-backdrop-filter: blur(18px) saturate(170%);
}

.atd-modern__item[aria-pressed="true"] {
  color: #0a0b10;
  border-color: transparent;
  background: linear-gradient(180deg, #ffffff, #dfe3ef);
  box-shadow: 0 10px 24px -12px rgba(120, 150, 255, 0.75), inset 0 -1px rgba(0, 0, 0, 0.14);
}

.atd-modern__icon,
.atd-glass__icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: var(--atd-icon);
  height: var(--atd-icon);
  opacity: 0.72;
  transition: opacity 0.16s;
}

.atd-modern__icon svg,
.atd-glass__icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.25;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.atd-modern__item[data-dock-near="true"] .atd-modern__icon,
.atd-modern__item[aria-pressed="true"] .atd-modern__icon,
.atd-glass__item[data-dock-near="true"] .atd-glass__icon,
.atd-glass__item[aria-pressed="true"] .atd-glass__icon {
  opacity: 1;
}

.atd-modern__ghost {
  color: #a7abba;
}

.atd-modern__ghost:hover {
  color: #f0f1f6;
  background: rgba(255, 255, 255, 0.06);
}

.atd-modern__cta {
  display: inline-flex;
  gap: var(--atd-gap);
  align-items: center;
  padding: 0 var(--atd-bar-pad) 0 clamp(14px, 1.1cqw, 24px);
  border: 0;
  color: #0a0b10;
  background: linear-gradient(180deg, #ffffff, #d8ddec);
  box-shadow: 0 10px 26px -14px rgba(150, 175, 255, 0.95), inset 0 -1px rgba(0, 0, 0, 0.16);
}

.atd-modern__cta svg {
  box-sizing: border-box;
  width: calc(var(--atd-action-height) - clamp(12px, 0.9cqw, 20px));
  height: calc(var(--atd-action-height) - clamp(12px, 0.9cqw, 20px));
  padding: clamp(4px, 0.3cqw, 7px);
  border-radius: 999px;
  background: rgba(10, 11, 16, 0.1);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.4;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.atd-modern__cta:hover {
  box-shadow: 0 16px 32px -14px rgba(150, 175, 255, 1), inset 0 -1px rgba(0, 0, 0, 0.16);
  transform: translateY(-1px);
}

.atd-modern__stage {
  position: absolute;
  top: 58%;
  left: 50%;
  z-index: 4;
  width: min(88cqw, 1120px);
  text-align: center;
  pointer-events: none;
  transform: translate(-50%, -50%);
}

.atd-modern__eyebrow {
  margin: 0 0 clamp(8px, 0.9cqw, 18px);
  color: #7d84a0;
  font: 400 clamp(8px, 0.62cqw, 13px) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.atd-modern__headline {
  /* background-clip: text paints only inside the element box, so at this size a
     1.0-ish line-height would cut the ascenders and descenders out of the fill.
     The padding buys the ink its own room back. */
  margin: 0;
  padding: 0.08em 0 0.14em;
  color: transparent;
  background: linear-gradient(180deg, #ffffff 16%, rgba(255, 255, 255, 0.3));
  background-clip: text;
  -webkit-background-clip: text;
  font-size: clamp(30px, 7.6cqw, 150px);
  font-weight: 400;
  line-height: 1.04;
  letter-spacing: -0.03em;
  text-wrap: balance;
}

/* ── Retro pixel terminal ───────────────────────────────────────────────────
   The field canvas is a small drawing buffer stretched by CSS with
   nearest-neighbour sampling, so its dither pattern arrives as real square
   pixels. Every chrome edge here is square to sit on that same grid. */

.animated-top-dock-component.atd-retro {
  --atd-label: clamp(9px, 0.68cqw, 15px);
  --atd-icon: clamp(10px, 0.78cqw, 17px);
  --atd-brand: clamp(11px, 0.8cqw, 18px);
  background: #0b0819;
}

.atd-retro__field {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}

.atd-retro__vignette {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
  background:
    radial-gradient(124% 90% at 50% 34%, transparent 28%, rgba(6, 4, 16, 0.62) 100%),
    linear-gradient(180deg, rgba(6, 4, 16, 0.6) 0%, transparent 24%, transparent 62%, rgba(6, 4, 16, 0.58) 100%);
}

/* the raster runs at screen resolution, not at the field's pixel scale, so the
   line structure stays a raster instead of banding the chunky artwork */
.atd-retro::before {
  position: absolute;
  inset: 0;
  z-index: 11;
  pointer-events: none;
  content: "";
  opacity: calc(var(--atd-retro-scan, 0.32) * 1.5);
  background: repeating-linear-gradient(180deg, rgba(0, 0, 0, 0.42) 0 1px, transparent 1px 3px);
}

/* Horizontal fit: the bar is one continuous strip and the menu cells own all of
   it. There are no gaps and no rounded ends — every cell is separated by a rule
   and runs the full height, and the controller renormalises the widths so
   opening one cell takes its room from the neighbours. */
.atd-retro__bar {
  gap: 0;
  padding: 0;
  overflow: hidden;
  border: 2px solid #f4e6c8;
  background: #1a1030;
  box-shadow: 6px 6px 0 rgba(6, 4, 16, 0.62);
}

.atd-retro__brand {
  height: 100%;
  padding: 0 clamp(12px, 1.1cqw, 26px);
  border-right: 2px solid #4b2f7e;
  color: #f9c74f;
  background: #150c28;
  font: 400 var(--atd-brand) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.12em;
}

.atd-retro__dock {
  display: flex;
  flex: 1 1 0;
  gap: 0;
  align-items: stretch;
  min-width: 0;
  height: 100%;
}

.atd-retro__badge {
  display: inline-flex;
  width: var(--atd-icon);
  height: var(--atd-icon);
}

.atd-retro__badge svg,
.atd-retro__icon svg {
  display: block;
  width: 100%;
  height: 100%;
  fill: currentColor;
  shape-rendering: crispEdges;
}

.atd-retro__item {
  height: 100%;
  min-width: 0;
  padding: 0 clamp(6px, 0.5cqw, 12px);
  overflow: hidden;
  border: 0;
  border-right: 2px solid #4b2f7e;
  color: #b9a7e8;
  background: #241548;
  font: 400 var(--atd-label) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.14em;
  transition: color 0.1s steps(2), background 0.1s steps(2);
}

.atd-retro__item[data-dock-near="true"],
.atd-retro__item:focus-visible {
  color: #fff4d6;
  background: #3a2170;
}

.atd-retro__item[aria-pressed="true"] {
  color: #1a1030;
  background: #f9c74f;
}

.atd-retro__icon {
  display: inline-flex;
  flex: none;
  width: var(--atd-icon);
  height: var(--atd-icon);
}

.atd-retro__cta {
  display: inline-flex;
  flex: none;
  gap: var(--atd-gap);
  align-items: center;
  height: 100%;
  padding: 0 clamp(14px, 1.2cqw, 28px);
  border: 0;
  border-left: 2px solid #f4e6c8;
  color: #1a1030;
  background: #f47b5c;
  font: 400 var(--atd-label) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.16em;
  transition: background 0.1s steps(2), color 0.1s steps(2);
  cursor: pointer;
}

.atd-retro__cta:hover {
  color: #1a1030;
  background: #f9c74f;
}

.atd-retro__readout {
  position: absolute;
  bottom: clamp(30px, 4.2cqw, 74px);
  left: 50%;
  z-index: 8;
  display: flex;
  gap: clamp(12px, 2.4cqw, 42px);
  margin: 0;
  color: #a08fd4;
  font: 400 clamp(9px, 0.62cqw, 13px) / 1 "ThreeUI Fragment Mono", ui-monospace, monospace;
  letter-spacing: 0.2em;
  transform: translateX(-50%);
}

/* ── Liquid glass ───────────────────────────────────────────────────────────
   Vertical fit: the dock leaves the top edge for a rail down the left side. The
   proximity field runs on the y axis, so an item grows taller and leans out to
   the right instead of widening and dropping. The rail is a real
   backdrop-filter panel over the refracting Three.js bead field, so its blur
   samples the same pixels the glass shader refracts. */

.animated-top-dock-component.atd-glass {
  --atd-rail-width: clamp(158px, 12.5cqw, 250px);
  background: #08090d;
}

.atd-glass__field {
  position: absolute;
  inset: 0;
  z-index: 0;
  display: block;
  width: 100%;
  height: 100%;
}

/* a scrim behind the rail: the bead field is bright enough in places to swallow
   the wordmark, and the panel's own blur cannot darken what it samples */
.atd-glass::before {
  position: absolute;
  inset: 0 auto 0 0;
  z-index: 5;
  width: 42%;
  pointer-events: none;
  content: "";
  background: linear-gradient(90deg, rgba(6, 7, 11, 0.66), rgba(6, 7, 11, 0));
}

.atd-glass__rail {
  position: absolute;
  top: 50%;
  left: clamp(20px, 3.4cqw, 68px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.5cqw, 11px);
  align-items: stretch;
  width: var(--atd-rail-width);
  padding: var(--atd-bar-pad);
  border-radius: clamp(20px, 1.7cqw, 34px);
  background: linear-gradient(160deg, rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.05));
  box-shadow:
    0 30px 64px -26px rgba(0, 0, 0, 0.92),
    inset 0 1px 0 rgba(255, 255, 255, 0.44),
    inset 0 -1px 0 rgba(255, 255, 255, 0.12),
    inset 0 0 0 1px rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(26px) saturate(190%);
  -webkit-backdrop-filter: blur(26px) saturate(190%);
  transform: translateY(-50%);
}

.atd-glass__rail::before {
  position: absolute;
  inset: 0;
  pointer-events: none;
  content: "";
  border-radius: inherit;
  background: linear-gradient(168deg, rgba(255, 255, 255, 0.22) 0%, rgba(255, 255, 255, 0) 30%, rgba(255, 255, 255, 0) 76%, rgba(255, 255, 255, 0.14) 100%);
}

.atd-glass__brand {
  position: relative;
  padding: clamp(6px, 0.5cqw, 12px) clamp(8px, 0.7cqw, 15px);
  color: #fbfbfe;
}

.atd-glass__mark {
  border-radius: clamp(7px, 0.5cqw, 11px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.42), inset 0 0 0 1px rgba(255, 255, 255, 0.3);
}

.atd-glass__hairline {
  height: 1px;
  margin: clamp(2px, 0.2cqw, 5px) clamp(6px, 0.5cqw, 12px);
  background: linear-gradient(90deg, rgba(255, 255, 255, 0.04), rgba(255, 255, 255, 0.26), rgba(255, 255, 255, 0.04));
}

.atd-glass__dock {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: clamp(2px, 0.2cqw, 5px);
  align-items: stretch;
}

.atd-glass__item {
  justify-content: flex-start;
  width: 100%;
  border: 1px solid transparent;
  border-radius: clamp(12px, 1cqw, 22px);
  color: rgba(255, 255, 255, 0.66);
  background: transparent;
  font: 500 var(--atd-label) / 1 inherit;
  letter-spacing: -0.005em;
  /* the rail grows downward from each item's own top edge */
  transform-origin: 0 50%;
  transition: color 0.18s, border-color 0.2s, background 0.2s, box-shadow 0.2s;
}

.atd-glass__item[data-dock-near="true"],
.atd-glass__item:focus-visible {
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.24);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.07));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.46), 0 8px 18px -10px rgba(0, 0, 0, 0.8);
}

.atd-glass__item[aria-pressed="true"] {
  color: #0d0f16;
  border-color: rgba(255, 255, 255, 0.6);
  background: linear-gradient(180deg, #ffffff, #e6e9f4);
  box-shadow: 0 10px 24px -12px rgba(255, 255, 255, 0.5), inset 0 -1px rgba(0, 0, 0, 0.14);
}

.atd-glass__cta {
  display: inline-flex;
  gap: var(--atd-gap);
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 0 clamp(12px, 1cqw, 22px);
  border: 1px solid rgba(255, 255, 255, 0.55);
  color: #0d0f16;
  background: linear-gradient(180deg, #ffffff, #dfe3f0);
  box-shadow: 0 12px 30px -14px rgba(255, 255, 255, 0.6), inset 0 -1px rgba(0, 0, 0, 0.16);
}

.atd-glass__cta svg {
  width: var(--atd-icon);
  height: var(--atd-icon);
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.atd-glass__cta:hover {
  box-shadow: 0 16px 34px -14px rgba(255, 255, 255, 0.75), inset 0 -1px rgba(0, 0, 0, 0.16);
  transform: translateY(-1px);
}

.atd-modern .animated-top-dock-component__caption,
.atd-glass .animated-top-dock-component__caption {
  color: rgba(255, 255, 255, 0.34);
}

.atd-retro .animated-top-dock-component__caption {
  z-index: 12;
  color: #7b6ab0;
}

@container (max-width: 900px) {
  .atd-modern__ghost {
    display: none;
  }

  .atd-modern__item span:last-child,
  .atd-retro__item span:last-child {
    display: none;
  }

  /* the bar is sized by its content now, so a shell this narrow has to give the
     content back: the call to action drops to its glyph rather than pushing the
     cluster past the bar's own max width */
  .atd-modern__cta span {
    display: none;
  }

  .atd-modern__cta {
    padding: 0 var(--atd-bar-pad);
  }

  /* the rail collapses to its icons rather than keeping a 158 px column in a
     card that is only a few hundred pixels wide */
  .animated-top-dock-component.atd-glass {
    --atd-rail-width: auto;
  }

  .atd-glass__item {
    justify-content: center;
  }

  .atd-glass__item span:last-child,
  .atd-glass__word,
  .atd-glass__cta span {
    display: none;
  }

  .atd-glass__cta {
    justify-content: center;
  }
}

@media (max-width: 600px) {
  .atd-modern__word {
    display: none;
  }

  .atd-modern__item {
    height: 28px !important;
    transform: none !important;
  }

  .atd-glass__item {
    height: auto !important;
    transform: none !important;
  }

  /* the strip keeps its full-height cells on a phone; only the spring stops */
  .atd-retro__item {
    height: 100% !important;
    transform: none !important;
  }

  .atd-modern__stage {
    top: 62%;
  }

  .atd-retro__readout {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .atd-modern__item,
  .atd-retro__item,
  .atd-glass__item {
    transform: none !important;
  }
}
```
