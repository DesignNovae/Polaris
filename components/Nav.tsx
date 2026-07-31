"use client";

/**
 * CompassLogo - the Polaris compass rose SVG.
 * Exported here so auth pages can import it without pulling in the full Nav.
 */

import { cn } from "@/lib/cn";

export function CompassLogo({ className, onDark }: { className?: string; onDark?: boolean }) {
  const ring = onDark ? "#F4D7BC" : "#8B5E3C";
  const ringSoft = onDark ? "#F4D7BC" : "#C47D4E";
  const fillCore = onDark ? "#F4D7BC" : "#8B5E3C";
  const fillCenter = onDark ? "#2C1810" : "#FAF6F0";
  return (
    <span aria-hidden className={cn("relative inline-flex h-8 w-8 items-center justify-center shrink-0", className)}>
      <svg viewBox="0 0 32 32" width="32" height="32" fill="none">
        <circle cx="16" cy="16" r="14" stroke={ring} strokeWidth="1.5" opacity="0.4" />
        <circle cx="16" cy="16" r="11" stroke={ringSoft} strokeWidth="0.75" opacity="0.35" />
        <line x1="16" y1="3" x2="16" y2="29" stroke={ring} strokeWidth="0.5" opacity="0.25" />
        <line x1="3" y1="16" x2="29" y2="16" stroke={ring} strokeWidth="0.5" opacity="0.25" />
        <polygon points="16,4 18.5,14 16,12.5 13.5,14" fill={fillCore} />
        <polygon points="16,28 18.5,18 16,19.5 13.5,18" fill={ringSoft} opacity="0.55" />
        <polygon points="28,16 18,13.5 19.5,16 18,18.5" fill={ringSoft} opacity="0.55" />
        <polygon points="4,16 14,13.5 12.5,16 14,18.5" fill={ringSoft} opacity="0.55" />
        <circle cx="16" cy="16" r="2" fill={fillCore} />
        <circle cx="16" cy="16" r="1" fill={fillCenter} />
      </svg>
    </span>
  );
}
