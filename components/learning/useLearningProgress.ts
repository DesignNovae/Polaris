"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryProgress, VideoProgress } from "@/lib/learning/library";

export function useLearningProgress() {
  const [progress, setProgress] = useState<LibraryProgress>({});
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(new Map<string, VideoProgress>());
  const sending = useRef(false);
  const alive = useRef(true);

  const flush = useCallback(async () => {
    if (sending.current) return;
    sending.current = true;
    try {
      for (const [videoId, patch] of pending.current) {
        pending.current.delete(videoId);
        try {
          const response = await fetch("/api/learning/progress", { method: "PATCH", keepalive: true,
            headers: { "Content-Type": "application/json" }, body: JSON.stringify({ videoId, ...patch }) });
          if (!response.ok) throw new Error("Progress not saved");
        } catch {
          pending.current.set(videoId, { ...patch, ...pending.current.get(videoId) });
          if (alive.current) setError(true);
          return;
        }
      }
      if (alive.current) setError(false);
    } finally { sending.current = false; }
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/learning/progress", { cache: "no-store" });
      if (!response.ok) throw new Error("Progress unavailable");
      const result = await response.json();
      if (alive.current) { setProgress(result.progress); setReady(true); setError(false); }
    } catch { if (alive.current) setError(true); }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const sync = () => { void flush(); };
    window.addEventListener("online", sync);
    return () => { alive.current = false; window.removeEventListener("online", sync); void flush(); };
  }, [flush, load]);

  const update = useCallback((videoId: string, patch: VideoProgress) => {
    setProgress((prior) => ({ ...prior, [videoId]: { ...prior[videoId], ...patch, updatedAt: new Date().toISOString() } }));
    pending.current.set(videoId, { ...pending.current.get(videoId), ...patch });
    void flush();
  }, [flush]);
  return { progress, ready, error, update, retry: () => { void (ready ? flush() : load()); } };
}
