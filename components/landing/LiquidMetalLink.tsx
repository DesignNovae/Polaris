"use client";

import Link from "next/link";
import type { ReactNode, PointerEvent } from "react";
import styles from "./landing-effects.module.css";

/** Native navigation with a pointer-lit, spectral metal finish. */
export function LiquidMetalLink({ href, children, secondary = false }: {
  href: string; children: ReactNode; secondary?: boolean;
}) {
  function illuminate(event: PointerEvent<HTMLAnchorElement>) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--light-x", `${event.clientX - rect.left}px`);
    event.currentTarget.style.setProperty("--light-y", `${event.clientY - rect.top}px`);
  }
  return (
    <Link href={href} className={`${styles.metal} ${secondary ? styles.secondary : ""}`}
      onPointerMove={illuminate} onPointerDown={illuminate}>
      <span className={styles.metalSurface} aria-hidden="true" />
      <span className={styles.metalContent}>{children}</span>
    </Link>
  );
}
