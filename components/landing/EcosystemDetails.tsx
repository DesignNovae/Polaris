"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { renderModuleIcons } from "./module-icon-renders";
import { KoiStudies } from "../threeui/KoiStudies.generated";
import { ECOSYSTEM_MODULES } from "./ecosystem-modules";
import styles from "./ecosystem-details.module.css";

export function EcosystemDetails({ selected, onClose }: { selected: number; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const exploreLink = useRef<HTMLAnchorElement>(null);
  const entry = ECOSYSTEM_MODULES[selected];
  useEffect(() => {
    const element = dialog.current;
    const iframe = scene.current?.querySelector("iframe");
    if (!element || !iframe) return;
    const prior = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element.showModal();
    let alive = true;
    const configure = () => { void renderModuleIcons().then(icons => {
      if (alive) iframe.contentWindow?.postMessage({ polarisModule: { ...entry, icon: icons[selected], index: selected } }, "*");
    }); };
    configure(); iframe.addEventListener("load", configure);
    const receive = (event: MessageEvent) => {
      if (event.source !== iframe.contentWindow) return;
      if (event.data?.polarisClose === true) onClose();
      const controls = event.data?.polarisControls;
      if (controls) {
        for (const [name, target] of [["close", closeButton.current], ["explore", exploreLink.current]] as const) {
          const rect = controls[name];
          if (!target || !rect || ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite)) continue;
          Object.assign(target.style, { left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px`, visibility: "visible" });
        }
      }
    };
    window.addEventListener("message", receive);
    return () => {
      alive = false; iframe.removeEventListener("load", configure); window.removeEventListener("message", receive);
      element.close(); document.body.style.overflow = previousOverflow; prior?.focus({ preventScroll: true });
    };
  }, [entry, onClose, selected]);
  return createPortal(
    <dialog ref={dialog} className={styles.dialog} aria-labelledby="ecosystem-detail-title" onCancel={event => { event.preventDefault(); onClose(); }}>
      <div className={styles.layout}>
        <div className={styles.studies}>
          <h2 id="ecosystem-detail-title" className={styles.title}>{entry.name}</h2>
          <div ref={scene} className={styles.scene}>
            <KoiStudies style={{ width: "100%", height: "100%" }} />
            <button ref={closeButton} className={styles.closeControl} onClick={onClose} aria-label="Close module details">×</button>
            <Link ref={exploreLink} className={styles.exploreControl} href={entry.href} onClick={onClose}>Explore {entry.name.toLowerCase()} ↗</Link>
          </div>
        </div>
      </div>
    </dialog>, document.body
  );
}
