"use client";

import { useEffect, useRef } from "react";
import { createShaderToggleScene } from "@/components/threeui/pro-badge/shaderToggleScene";
import styles from "./pro-badge.module.css";
import { useTheme } from "./ThemeProvider";

/** A plan label, not a switch. ThreeUI's shader supplies the lit capsule. */
export function ProBadge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { theme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let dispose: (() => void) | undefined;
    const start = () => {
      dispose?.();
      try {
        const scene = createShaderToggleScene({ canvas, mode: theme, speed: 0.65, size: 1, on: true });
        scene.resize(64, 28);
        canvas.style.opacity = "1";
        dispose = () => scene.dispose();
      } catch {
        canvas.style.opacity = "0";
      }
    };
    const lost = (event: Event) => {
      event.preventDefault();
      dispose?.();
      dispose = undefined;
      canvas.style.opacity = "0";
    };
    start();
    canvas.addEventListener("webglcontextlost", lost);
    canvas.addEventListener("webglcontextrestored", start);
    return () => {
      dispose?.();
      canvas.removeEventListener("webglcontextlost", lost);
      canvas.removeEventListener("webglcontextrestored", start);
    };
  }, [theme]);

  return <span className={styles.badge} data-mode={theme} aria-label="Pro plan">
    <canvas ref={canvasRef} aria-hidden="true" />
    <span>PRO</span>
  </span>;
}
