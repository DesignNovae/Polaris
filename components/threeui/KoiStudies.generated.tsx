"use client";
// Generated from the verified component. URL, labels and background adapted for Polaris.
import { useState, type CSSProperties } from "react";

const KOI_STUDIES_SOURCE_URL = "/threeui/polaris-koi.html";

export type KoiStudiesProps = {
  className?: string;
  style?: CSSProperties;
};

export function KoiStudies({ className = "", style }: KoiStudiesProps) {
  const [ready, setReady] = useState(false);

  return (
    <div
      className={`threeui-background koi-studies${className ? ` ${className}` : ""}`}
      aria-label="Polaris module details"
      data-state={ready ? "ready" : "loading"}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "transparent",
        pointerEvents: "auto",
        ...style,
      }}
    >
      <iframe
        title="Polaris — Interactive Module Studies"
        src={KOI_STUDIES_SOURCE_URL}
        sandbox="allow-scripts"
        allow="autoplay"
        loading="eager"
        onLoad={() => setReady(true)}
        style={{
          position: "absolute",
          inset: 0,
          display: "block",
          width: "100%",
          height: "100%",
          border: 0,
          background: "transparent",
        }}
      />
    </div>
  );
}
