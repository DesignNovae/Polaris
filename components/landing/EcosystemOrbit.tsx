"use client";

import { PolarisGalleryHeading } from "@/components/threeui/PolarisGalleryHeading";
import styles from "./ecosystem-gallery.module.css";

/** Polaris content layered over the verified ThreeUI Halftone Loop. */
export function EcosystemOrbit() {
  return (
    <section id="how" data-section-theme="light" aria-label="One connected command center for your admission journey" className={styles.section}>
      {/* Serve the byte-exact shared CSS without rebundling its unrelated asset URLs. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/threeui/threeui.css" precedence="default" />
      <div className={`shader-frame ${styles.frame}`}>
        <PolarisGalleryHeading />
      </div>
    </section>
  );
}
