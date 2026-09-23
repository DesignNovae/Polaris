"use client";

import { useEffect, useState } from "react";
import { PolarisLoadingScreen } from "./PolarisLoading";

// Background refreshes and streamed conversations already own their status UI.
const quietPaths =
  /^\/api\/(?:session|analytics|community\/messages|monitor\/view)(?:\/|$)/;
export function LoadingActivity() {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const original = window.fetch;
    const timers = new Map<symbol, ReturnType<typeof setTimeout>>();
    const visible = new Set<symbol>();
    let mounted = true;
    const wrapped: typeof fetch = async (input, init) => {
      const url = new URL(
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url,
        location.href,
      );
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined),
      );
      if (
        url.origin !== location.origin ||
        !url.pathname.startsWith("/api/") ||
        quietPaths.test(url.pathname) ||
        headers.get("X-Polaris-Background") === "1" ||
        url.searchParams.get("count") === "1"
      )
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
