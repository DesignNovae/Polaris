"use client";
import { useEffect, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import styles from "./notices.module.css";

export function NoticeBell({ demo = false }: { demo?: boolean }) {
  const { data: session } = useSession();
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!session || demo) return;
    const controller = new AbortController();
    let running = false;
    async function refresh() {
      if (document.hidden || running) return;
      running = true;
      try {
        const res = await fetch("/api/notices?count=1", {
          cache: "no-store",
          signal: controller.signal,
          headers: { "X-Polaris-Background": "1" },
        });
        if (res.ok) {
          const data = await res.json();
          if (!controller.signal.aborted) setCount(Number(data.unread) || 0);
        }
      } catch {
        /* Preserve the last known count during a temporary outage. */
      } finally {
        running = false;
      }
    }
    void refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener("polaris:notices-read", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      controller.abort();
      clearInterval(timer);
      window.removeEventListener("polaris:notices-read", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [session, demo]);
  if (!session && !demo) return null;
  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent("polaris:open-notices", { detail: { demo } }),
        )
      }
      className={styles.bell}
      aria-haspopup="dialog"
      aria-label={count ? `Notices, ${count} unread` : "Notices"}
      title="Notices"
    >
      <svg
        width="19"
        height="19"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden="true"
      >
        <path
          d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {count > 0 && (
        <span className={styles.badge} aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
}
