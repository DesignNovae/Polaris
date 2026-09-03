"use client";

/**
 * Service-worker registration and the connection banner.
 *
 * Two jobs:
 *   1. Register the worker (production only - a cached shell during development
 *      is a debugging trap).
 *   2. Tell the student the truth about their connection. An app that silently
 *      serves stale data is worse than one that says "offline - showing your
 *      last saved plan", because the second is something they can act on.
 */

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function OfflineProvider() {
  const [offline, setOffline] = useState(false);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Registration failing must never break the page.
      console.warn("[pwa] service worker registration failed:", err);
    });
  }, []);

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      setRestored(true);
      window.setTimeout(() => setRestored(false), 3200);
      // Anything written while offline goes out now.
      navigator.serviceWorker?.controller?.postMessage("flush-outbox");
    };

    setOffline(!navigator.onLine);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(offline || restored) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-4 z-[80] flex justify-center px-4"
        >
          <div
            className={`flex items-center gap-2.5 rounded-full px-4 py-2.5 text-[12.5px] font-medium shadow-[0_12px_36px_-14px_rgba(0,0,0,0.6)] backdrop-blur-xl ${
              offline
                ? "bg-[#2C1810]/92 text-paper ring-1 ring-inset ring-white/15"
                : "bg-aurora-600/92 text-paper ring-1 ring-inset ring-white/20"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                offline ? "bg-rose-300" : "bg-white"
              }`}
            />
            {offline
              ? "Offline - showing your last saved plan. Changes will sync when you reconnect."
              : "Back online. Syncing your changes."}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
