"use client";

/**
 * Renderer host.
 *
 * Selects a renderer for the resolved track, loads it on demand, and contains its
 * failures. The panel never imports a concrete renderer, so swapping SVG for
 * WebGL, or falling back from a filmed track to a synthetic one, changes nothing
 * above this component.
 *
 * The error boundary matters more than it looks. A renderer throwing inside an
 * animation frame would otherwise unmount the whole learn tab and take the lesson
 * video down with it - the accessibility feature breaking the thing it exists to
 * make accessible.
 */

import { Component, useEffect, useState, type ReactNode } from "react";
import {
  loadRenderer,
  selectRenderer,
  type AvatarRendererComponent,
  type AvatarRendererProps,
} from "@/lib/interpreter/render/registry";

type BoundaryProps = { fallback: ReactNode; onError: (message: string) => void; children: ReactNode };

class RendererBoundary extends Component<BoundaryProps, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message);
  }

  render() {
    return this.state.crashed ? this.props.fallback : this.props.children;
  }
}

export type AvatarStageProps = Omit<AvatarRendererProps, "sync"> &
  Pick<AvatarRendererProps, "sync"> & {
    /** Shown while the renderer module is still downloading. */
    loadingLabel: string;
    fallback: ReactNode;
  };

export function AvatarRenderer({ loadingLabel, fallback, ...props }: AvatarStageProps) {
  const [Renderer, setRenderer] = useState<AvatarRendererComponent | null>(null);
  const [failed, setFailed] = useState(false);

  const descriptor = selectRenderer(props.track, props.settings.rendererId);
  const rendererId = descriptor?.id ?? null;

  useEffect(() => {
    if (!rendererId) {
      setFailed(true);
      return;
    }
    let active = true;
    setFailed(false);

    void loadRenderer(rendererId)
      .then((component) => {
        // `setState` with a function value would be read as an updater, so the
        // component is wrapped rather than passed directly.
        if (active) setRenderer(() => component);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFailed(true);
        props.onError(error instanceof Error ? error.message : "The interpreter could not load.");
      });

    return () => {
      active = false;
    };
    // props.onError is stable at the call site; including it would reload the
    // renderer module whenever the panel re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendererId]);

  if (failed) return <>{fallback}</>;

  if (!Renderer) {
    return (
      <div className="flex h-full items-center justify-center" role="status" aria-live="polite">
        <span className="text-[10.5px] text-ink-muted">{loadingLabel}</span>
      </div>
    );
  }

  return (
    <RendererBoundary fallback={fallback} onError={props.onError}>
      <Renderer {...props} />
    </RendererBoundary>
  );
}
