"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import type { Notice } from "@/lib/notices/schema";
import { demoNotices } from "@/lib/notices/demo";
import { PolarisLoading } from "@/components/ui/PolarisLoading";
import { NoticePaper } from "./NoticePaper";
import { Icon } from "@/components/app/ui";
import styles from "./notices.module.css";

export function NoticeOverlay() {
  const [open, setOpen] = useState(false);
  const [demo, setDemo] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => {
    const show = (event: Event) => {
      setDemo(Boolean((event as CustomEvent).detail?.demo));
      setOpen(true);
    };
    window.addEventListener("polaris:open-notices", show);
    return () => window.removeEventListener("polaris:open-notices", show);
  }, []);
  useEffect(() => {
    if (params.get("notices") !== "1") return;
    setDemo(pathname.startsWith("/demo"));
    setOpen(true);
    const url = new URL(location.href);
    url.searchParams.delete("notices");
    window.history.replaceState(
      window.history.state,
      "",
      url.pathname + url.search + url.hash,
    );
  }, [params, pathname]);
  const close = useCallback(() => setOpen(false), []);
  return open
    ? createPortal(<NoticeDialog demo={demo} onClose={close} />, document.body)
    : null;
}

function NoticeDialog({
  demo,
  onClose,
}: {
  demo: boolean;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdropPress = useRef<{ id: number; x: number; y: number } | null>(null);
  const backdropClick = useRef(false);
  const request = useRef<AbortController | null>(null);
  const receipts = useRef(new Set<string>());
  const [items, setItems] = useState<Notice[]>(demo ? demoNotices : []);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(!demo);
  const [error, setError] = useState("");
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.documentElement.style.overflow;
    element?.showModal();
    document.documentElement.style.overflow = "hidden";
    return () => {
      element?.close();
      document.documentElement.style.overflow = overflow;
      previous?.focus();
      request.current?.abort();
    };
  }, []);
  const load = useCallback(
    async (nextPage: number, last = false) => {
      if (demo) return;
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/notices?page=${nextPage}`, {
          cache: "no-store",
          signal: controller.signal,
          headers: { "X-Polaris-Background": "1" },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not load notices.");
        if (controller.signal.aborted) return;
        setItems(data.notices);
        setIndex(last ? Math.max(0, data.notices.length - 1) : 0);
        setPage(nextPage);
        setHasMore(data.hasMore);
      } catch (e) {
        if (!controller.signal.aborted)
          setError(e instanceof Error ? e.message : "Could not load notices.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [demo],
  );
  useEffect(() => {
    void load(0);
    return () => request.current?.abort();
  }, [load]);
  const active = items[index];
  const markRead = useCallback(() => {
    if (!active || demo || active.read) return;
    const key = `${active.id}:${active.revision}`;
    if (receipts.current.has(key)) return;
    receipts.current.add(key);
    void fetch(`/api/notices/${active.id}/read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Polaris-Background": "1",
      },
      body: JSON.stringify({ revision: active.revision }),
    })
      .then((res) => {
        if (res.ok) window.dispatchEvent(new Event("polaris:notices-read"));
        else receipts.current.delete(key);
      })
      .catch(() => receipts.current.delete(key));
  }, [active, demo]);
  return (
    <dialog
      ref={dialog}
      className={styles.noticeDialog}
      aria-label="Polaris notices"
      onCancel={onClose}
      onPointerDown={(e) => {
        backdropClick.current = false;
        backdropPress.current = e.target === e.currentTarget && e.button === 0
          ? { id: e.pointerId, x: e.clientX, y: e.clientY }
          : null;
      }}
      onPointerMove={(e) => {
        const start = backdropPress.current;
        if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6)
          backdropPress.current = null;
      }}
      onPointerUp={(e) => {
        const start = backdropPress.current;
        backdropClick.current = !!start && start.id === e.pointerId &&
          e.target === e.currentTarget &&
          Math.hypot(e.clientX - start.x, e.clientY - start.y) <= 6;
        backdropPress.current = null;
      }}
      onPointerCancel={() => {
        backdropPress.current = null;
        backdropClick.current = false;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropClick.current) onClose();
        backdropClick.current = false;
      }}
    >
      <button
        type="button"
        autoFocus
        className={styles.closeNotice}
        aria-label="Close notices"
        onClick={onClose}
      >
        <span aria-hidden="true">{Icon.close({ size: 18 })}</span>
      </button>
      {loading ? (
        <PolarisLoading label="Loading notices" />
      ) : error ? (
        <div className={styles.overlayMessage} role="alert">
          <p>{error}</p>
          <button onClick={() => load(page)}>Try again</button>
        </div>
      ) : !active ? (
        <div className={styles.overlayMessage}>
          <h2>You’re all caught up.</h2>
          <p>New notices will appear here when they’re published for you.</p>
        </div>
      ) : (
        <>
          <div className={styles.floatingPaper}>
            <NoticePaper
              key={`${active.id}:${active.revision}`}
              notice={active}
              date={
                active.publishedAt
                  ? new Date(active.publishedAt).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : ""
              }
              onDisplayed={markRead}
              onClose={onClose}
            />
          </div>
          {(items.length > 1 || page > 0 || hasMore) && (
            <nav className={styles.noticeSwitcher} aria-label="Choose a notice">
              <button
                disabled={index === 0 && page === 0}
                aria-label="Previous notice"
                onClick={() =>
                  index > 0 ? setIndex(index - 1) : load(page - 1, true)
                }
              >
                <span aria-hidden="true" className={styles.previousIcon}>
                  {Icon.arrow({ size: 18 })}
                </span>
              </button>
              <span>
                {page * 20 + index + 1}
                {!hasMore && ` / ${page * 20 + items.length}`}
              </span>
              <button
                disabled={index === items.length - 1 && !hasMore}
                aria-label="Next notice"
                onClick={() =>
                  index < items.length - 1
                    ? setIndex(index + 1)
                    : load(page + 1)
                }
              >
                <span aria-hidden="true">{Icon.arrow({ size: 18 })}</span>
              </button>
            </nav>
          )}
        </>
      )}
    </dialog>
  );
}
