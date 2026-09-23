"use client";

import { useEffect, useRef } from "react";
import styles from "./effects.module.css";

export function PolarisOrb() {
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const iframe = ref.current;
    if (!iframe) return;
    const observer = new IntersectionObserver(([entry]) =>
      iframe.contentWindow?.postMessage(
        { type: "polaris-orb-controls", paused: !entry.isIntersecting },
        "*",
      ),
    );
    observer.observe(iframe);
    return () => observer.disconnect();
  }, []);
  return (
    <span className={styles.orb} aria-hidden="true">
      <iframe
        ref={ref}
        title="Polaris activity animation"
        src="/effects/polaris-orb.html?v=2"
        sandbox="allow-scripts"
        tabIndex={-1}
      />
    </span>
  );
}
export function PolarisLoading({
  label = "Loading your workspace",
  detail = "This will update as soon as it is ready.",
}: {
  label?: string;
  detail?: string;
}) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <PolarisOrb />
      <span className="sr-only">
        {label}. {detail}
      </span>
    </div>
  );
}
export function PolarisLoadingScreen() {
  return (
    <div className={styles.activity}>
      <PolarisLoading />
    </div>
  );
}
