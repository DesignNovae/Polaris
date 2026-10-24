"use client";

import { useEffect, useState } from "react";
import { PolarisLoadingScreen } from "./PolarisLoading";

/**
 * Full-screen activity for requests that genuinely block the page.
 *
 * Opt-in: only requests sent with `X-Polaris-Loading: blocking` show it. Every
 * other request (AI generation, practice batches, chat, polling) already owns
 * its in-place status, and covering a page that has rendered made it look stuck.
 * Route changes keep their own loading screens (each route's loading.tsx).
 */
export function LoadingActivity() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const original = window.fetch;
    const timers = new Map<symbol, ReturnType<typeof setTimeout>>();
    const visible = new Set<symbol>();
    let mounted = true;
    const wrapped: typeof fetch = async (input, init) => {
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (headers.get("X-Polaris-Loading") !== "blocking")
        return original(input, init);
      const id = Symbol();
      timers.set(
        id,
        setTimeout(() => {
          visible.add(id);
          if (mounted) setPending(true);
        }, 800),
      );
      try {
        return await original(input, init);
      } finally {
        clearTimeout(timers.get(id));
        timers.delete(id);
        visible.delete(id);
        if (mounted) setPending(visible.size > 0);
      }
    };
    window.fetch = wrapped;
    return () => {
      mounted = false;
      timers.forEach(clearTimeout);
      if (window.fetch === wrapped) window.fetch = original;
    };
  }, []);
  return pending ? <PolarisLoadingScreen /> : null;
}
