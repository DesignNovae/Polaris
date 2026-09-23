"use client";
import { useEffect, useRef, useState } from "react";
import type { NoticeInput } from "@/lib/notices/schema";
import { PolarisLoading } from "@/components/ui/PolarisLoading";
import { NoticeContent } from "./NoticeContent";
import { Icon } from "@/components/app/ui";
import styles from "./notices.module.css";

type Props = {
  notice: NoticeInput;
  date?: string;
  onDisplayed?: () => void;
  onClose?: () => void;
};
export function NoticePaper({ notice, date, onDisplayed, onClose }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const [mounted, setMounted] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(1);
  const callbacks = useRef({ onDisplayed, onClose });
  callbacks.current = { onDisplayed, onClose };
  useEffect(() => {
    let visible = true;
    const update = () => setMounted(visible && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        update();
      },
      { rootMargin: "100px" },
    );
    if (host.current) observer.observe(host.current);
    document.addEventListener("visibilitychange", update);
    const message = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === "polaris-paper-ready") {
        setReady(true);
        setLoaded(true);
      }
      if (event.data?.type === "polaris-paper-error") setFailed(true);
      if (event.data?.type === "polaris-paper-close")
        callbacks.current.onClose?.();
      if (event.data?.type === "polaris-paper-content") {
        setPages(Math.max(1, Number(event.data.pages) || 1));
        setPage(Number(event.data.page) || 0);
        callbacks.current.onDisplayed?.();
      }
    };
    window.addEventListener("message", message);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("message", message);
    };
  }, []);
  useEffect(() => {
    if (failed) callbacks.current.onDisplayed?.();
  }, [failed]);
  useEffect(() => {
    setReady(false);
    setLoaded(false);
  }, [mounted]);
  useEffect(() => {
    if (!mounted || ready || failed) return;
    const timer = setTimeout(() => setFailed(true), 15000);
    return () => clearTimeout(timer);
  }, [mounted, ready, failed]);
  useEffect(() => {
    if (!loaded || !mounted) return;
    const controller = new AbortController();
    const imageData = async (url: string) => {
      if (!url) return "";
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "X-Polaris-Background": "1" },
        });
        if (!res.ok) return "";
        const blob = await res.blob();
        return await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(blob);
        });
      } catch {
        return "";
      }
    };
    const send = (image = "", logo = "") =>
      frame.current?.contentWindow?.postMessage(
        {
          type: "polaris-notice",
          notice: {
            title: notice.title || "Your notice title",
            summary: notice.summary || "A short introduction appears here.",
            body: notice.body,
            category: notice.category,
            priority: notice.priority,
            date: date || "Draft preview",
            image,
            logo,
          },
        },
        "*",
      );
    send();
    void Promise.all([
      imageData(notice.imageUrl),
      imageData(notice.logoUrl),
    ]).then(([image, logo]) => {
      if (!controller.signal.aborted) send(image, logo);
    });
    return () => controller.abort();
  }, [
    notice.title,
    notice.summary,
    notice.body,
    notice.category,
    notice.priority,
    notice.imageUrl,
    notice.logoUrl,
    date,
    loaded,
    mounted,
  ]);
  function turnPage(next: number) {
    frame.current?.contentWindow?.postMessage(
      { type: "polaris-paper-page", page: next },
      "*",
    );
  }
  return (
    <div
      ref={host}
      className={styles.paperStage}
      aria-label="Interactive 3D notice artwork"
    >
      {failed ? (
        <div className={styles.paperFallback}>
          <NoticeContent notice={notice} date={date} />
        </div>
      ) : (
        <>
          {!ready && (
            <div className={styles.paperLoading}>
              <PolarisLoading label="Preparing the paper view" />
            </div>
          )}
          {mounted && (
            <iframe
              ref={frame}
              src="/effects/notice-paper.html?v=2"
              sandbox="allow-scripts"
              title="Polaris interactive notice paper — drag to turn"
              onLoad={() => setLoaded(true)}
              className={styles.paperFrame}
              style={{ opacity: ready ? 1 : 0 }}
            />
          )}
          <div className="sr-only">
            <NoticeContent notice={notice} date={date} includeAction={false} />
          </div>
          {ready && (
            <div className={styles.paperControls}>
              {pages > 1 && (
                <>
                  <button
                    type="button"
                    disabled={page === 0}
                    aria-label="Previous paper page"
                    onClick={() => turnPage(page - 1)}
                  >
                    <span aria-hidden="true" className={styles.previousIcon}>
                      {Icon.arrow({ size: 18 })}
                    </span>
                  </button>
                  <span aria-live="polite">
                    {page + 1} / {pages}
                  </span>
                  <button
                    type="button"
                    disabled={page === pages - 1}
                    aria-label="Next paper page"
                    onClick={() => turnPage(page + 1)}
                  >
                    <span aria-hidden="true">{Icon.arrow({ size: 18 })}</span>
                  </button>
                </>
              )}
              {notice.linkUrl && (
                <a href={notice.linkUrl} rel="noopener noreferrer">
                  {notice.linkLabel}{" "}
                  <span aria-hidden="true">{Icon.arrow({ size: 14 })}</span>
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
