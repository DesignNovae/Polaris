"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import dynamic from "next/dynamic";
import { ECOSYSTEM_MODULES } from "../landing/ecosystem-modules";
import { EFFECTS, GALLERY_HEADING_VARIANTS, NeuformIsolatedEffect, transformGalleryHeadingSource, type EffectDefinition } from "./GalleryHeading.generated";
import { renderModuleIcons } from "../landing/module-icon-renders";
import styles from "../landing/ecosystem-gallery.module.css";
const EcosystemDetails = dynamic(() => import("../landing/EcosystemDetails").then(module => module.EcosystemDetails), { ssr: false });

/** Only content and canvas stock change; the source's halftone painter and projection remain intact. */
export function customizePolarisGallery(source: string, icons: string[]) {
  let result = transformGalleryHeadingSource(source, "dark", GALLERY_HEADING_VARIANTS["vertical-loop"]);
  const replace = (from: string, to: string) => {
    if (!result.includes(from)) throw new Error(`ThreeUI customization anchor missing: ${from}`);
    result = result.replace(from, to);
  };
  replace("<title>One Wall, Twelve Plates — motion</title>", "<title>Polaris — One connected command center</title>");
  replace("background:#000000", "background:#faf6f0");
  replace("ctx.fillStyle = '#000000';", "ctx.fillStyle = '#faf6f0';");
  replace("{ s:'ONE WALL', top:930,  w:1132, fill:'#c0402c' }", "{ s:'ONE CONNECTED', top:930,  w:1850, fill:'#b8546a' }");
  replace("{ s:'TWELVE PLATES', top:1114, w:1840, fill:'#f2efe8' }", "{ s:'COMMAND CENTER', top:1114, w:2170, fill:'#2c1810' }");
  replace("var TEX = buildTextures();", `var TEX = buildTextures();
  var uprightIcons=[];
  var moduleImages = ${JSON.stringify(icons)};
  Promise.all(moduleImages.map(function(url) {
    return new Promise(function(resolve) {
      var image = new Image(); image.onload = function(){ resolve(image); };
      image.onerror = function(){ resolve(null); }; image.src = url;
    });
  })).then(function(images) {
    if (!images.length) return;
    uprightIcons=images;
    render(tNow);
  });`);
  replace("ctx.drawImage(img, -TS/2, -TS/2, TS, TS);", `ctx.drawImage(img, -TS/2, -TS/2, TS, TS);
  // Keep the icon facing the viewer while the plate retains its authored projection.
  var icon=uprightIcons[i%uprightIcons.length];
  if(icon){
    var iconSize=Math.min(Math.hypot(ex,ey)*2,Math.hypot(fx,fy)*2*RING.aspect)*.82;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.drawImage(icon,p0[0]-iconSize/2,p0[1]-iconSize/2,iconSize,iconSize);
  }`);
  replace("function drawTile(i, psi){", `var cardGeometry=[], polarisVisible=true;
  window.addEventListener('message',function(event){
    if(event.source!==parent)return;
    if(typeof event.data?.polarisFreeze==='boolean'){
      if(event.data.polarisFreeze)playing=false;else window.__play();
    }
    if(typeof event.data?.polarisVisible==='boolean')polarisVisible=event.data.polarisVisible;
    if(Number.isFinite(event.data?.polarisRotate)){
      window.__seek(tNow+Math.max(-1,Math.min(1,event.data.polarisRotate))*DUR);
    }
  });
  var cardDepth=0;
  function drawTile(i, psi){`);
  replace("var facing = C[2] > 0;", `var pixelRatio=W/window.innerWidth;
  cardGeometry.push({index:i,depth:cardDepth++,matrix:[ex*2/TS/pixelRatio,ey*2/TS/pixelRatio,fx*2/TS/pixelRatio,fy*2/TS/pixelRatio,(p0[0]-ex-fx*RING.aspect)/pixelRatio,(p0[1]-ey-fy*RING.aspect)/pixelRatio]});
  var facing = C[2] > 0;`);
  replace("function render(t){", "function render(t){ cardDepth=0;cardGeometry=[];");
  // Slow automatic rotation is independent of pointer hover; dragging pauses it.
  result = result.replaceAll("(hovering ? 1 : 0)", "0.22");
  replace("if (playing){", "if (playing && polarisVisible && !document.hidden && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){");
  replace("ctx.drawImage(labelLayer,0,0);", "ctx.drawImage(labelLayer,0,0);parent.postMessage({polarisCards:cardGeometry},'*');");
  return result;
}

export function PolarisGalleryHeading() {
  const [icons, setIcons] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; startX: number; startY: number; moved: boolean; index: number | null } | null>(null);
  const close = useCallback(() => setSelected(null), []);
  useEffect(() => {
    host.current?.querySelector("iframe")?.contentWindow?.postMessage({ polarisFreeze: selected !== null }, "*");
  }, [selected]);
  useEffect(() => {
    const element = host.current; if (!element) return;
    const observer = new IntersectionObserver(([entry]) => {
      element.querySelector("iframe")?.contentWindow?.postMessage({ polarisVisible: entry.isIntersecting }, "*");
    });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== host.current?.querySelector("iframe")?.contentWindow) return;
      const geometry = event.data?.polarisCards;
      if (!Array.isArray(geometry) || geometry.length > 12) return;
      const buttons = host.current?.querySelectorAll<HTMLButtonElement>("button[data-ring-card]");
      buttons?.forEach(button => { button.style.visibility = "hidden"; });
      geometry.forEach(card => {
        if (!Number.isInteger(card.index) || card.index < 0 || card.index > 11 || !Array.isArray(card.matrix) || card.matrix.length !== 6 || !card.matrix.every(Number.isFinite)) return;
        const button = buttons?.[card.index]; if (!button) return;
        button.style.visibility = "visible"; button.style.transform = `matrix(${card.matrix.join(",")})`; button.style.zIndex = String(card.depth + 1);
      });
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    let mounted = true;
    renderModuleIcons().then(images => { if (mounted) setIcons(images); }).catch(error => console.error("Polaris icon render failed", error));
    return () => { mounted = false; };
  }, []);
  const definition = useMemo<EffectDefinition>(() => ({
    ...EFFECTS.galleryHeading,
    title: "Polaris — one connected command center for your admission journey",
    background: "#faf6f0",
    theme: { lightBackground: "#faf6f0", darkBackground: "#faf6f0" },
    transformSource: source => customizePolarisGallery(source, icons),
  }), [icons]);
  const freeze = (value: boolean) => host.current?.querySelector("iframe")?.contentWindow?.postMessage({ polarisFreeze: value }, "*");
  const rotate = (amount: number) => host.current?.querySelector("iframe")?.contentWindow?.postMessage({ polarisRotate: amount }, "*");
  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.isPrimary) return;
    const button = (event.target as Element).closest<HTMLButtonElement>("button[data-ring-card]");
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, index: button ? Number(button.dataset.ringCard) % 8 : null };
    event.currentTarget.setPointerCapture(event.pointerId);
    freeze(true);
  };
  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current; if (!current || current.id !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
    if (!current.moved && distance < 6) return;
    current.moved = true; event.currentTarget.dataset.dragging = "true";
    const dx = event.clientX - current.x, dy = event.clientY - current.y;
    rotate((Math.abs(dx) > Math.abs(dy) ? dx : dy) / Math.max(320, event.currentTarget.clientWidth));
    current.x = event.clientX; current.y = event.clientY;
  };
  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    const current = drag.current; if (!current || current.id !== event.pointerId) return;
    drag.current = null; delete event.currentTarget.dataset.dragging;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.type === "pointerup" && !current.moved && current.index !== null) setSelected(current.index);
    else freeze(false);
  };
  return <>
    <div ref={host} className={styles.interactive} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onLostPointerCapture={endDrag}>
      <NeuformIsolatedEffect definition={definition} mode="light" hue={0} saturation={1} brightness={1} trackPointerHover />
      <div className={styles.dragSurface} aria-hidden="true" />
      {Array.from({ length: 12 }, (_, index) => <button key={index} data-ring-card={index} className={styles.cardHit} aria-label={`Explore ${ECOSYSTEM_MODULES[index % 8].name}`} onClick={event => { if (event.detail === 0) setSelected(index % 8); }} onKeyDown={event => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) { event.preventDefault(); rotate(["ArrowRight", "ArrowDown"].includes(event.key) ? .06 : -.06); freeze(false); } }} />)}
      <p className={styles.dragHint}>Drag to rotate · Tap an icon to explore</p>
    </div>
    {selected !== null && <EcosystemDetails selected={selected} onClose={close} />}
  </>;
}
