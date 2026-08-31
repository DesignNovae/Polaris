"use client";

/**
 * Video + interpreter layout.
 *
 * Media stays first in the DOM in every layout, so reading order and tab order
 * always reach the lesson before the interpreter. Placement is done with grid
 * order and CSS at desktop widths only - moving the panel visually must never
 * move it in the accessibility tree.
 *
 * Three arrangements, because the right one depends on who is watching:
 *
 *   beside   the lesson leads, interpreter alongside. The default.
 *   focus    the interpreter leads and the lesson plays smaller beside it. This
 *            is the real usage scene for a Deaf student - the signing is the
 *            content, not a decoration on it.
 *   overlay  interpreter floats over a full-width lesson, for narrow screens and
 *            for watching at full attention.
 *
 * Below the desktop breakpoint every layout collapses to a single column with
 * the video first, as the brief specifies.
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import {
  SIZE_TRACKS,
  type InterpreterLayout,
  type InterpreterSide,
  type InterpreterSize,
} from "@/lib/interpreter/types/interpreter";

export function InterpreterStage({
  media,
  panel,
  side,
  size,
  layout,
  enabled,
  className,
}: {
  media: ReactNode;
  panel: ReactNode;
  side: InterpreterSide;
  size: InterpreterSize;
  layout: InterpreterLayout;
  /** When off, the media takes the full width and no column is reserved. */
  enabled: boolean;
  className?: string;
}) {
  if (!enabled) return <div className={className}>{media}</div>;

  if (layout === "overlay") {
    return (
      <div className={cn("interpreter-stage-overlay", className)} data-side={side} data-size={size}>
        <div className="interpreter-stage-media min-w-0">{media}</div>
        <div className="interpreter-stage-float">{panel}</div>
      </div>
    );
  }

  return (
    <div
      className={cn("interpreter-stage", className)}
      data-side={side}
      data-layout={layout}
      style={{ "--interpreter-column": SIZE_TRACKS[size].column } as React.CSSProperties}
    >
      <div className="interpreter-stage-media min-w-0">{media}</div>
      <div className="interpreter-stage-panel min-w-0">{panel}</div>
    </div>
  );
}
