"use client";

/**
 * AvatarUploader - real profile-picture upload (no URL field).
 *
 *   drag & drop or click to choose · JPG / PNG / WebP · max 5MB input
 *   → center-crop square → 256px canvas downscale (webp, jpeg fallback)
 *   → preview before saving → staged progress → POST /api/account/avatar
 *
 * On save/remove it dispatches `polaris:avatarUpdated` so the header,
 * dropdown, and any other avatar surface update instantly without a reload.
 */

import { useCallback, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

const MAX_INPUT_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const TARGET_PX = 256;

type Phase =
  | { kind: "idle" }
  | { kind: "preview"; dataUrl: string }
  | { kind: "working"; label: string; pct: number }
  | { kind: "error"; message: string };

export function broadcastAvatar(url: string) {
  window.dispatchEvent(new CustomEvent("polaris:avatarUpdated", { detail: { url } }));
}

/** Center-crop to square, downscale to 256px, return a compact data URL. */
async function processImage(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That file doesn't look like a readable image."));
      el.src = objectUrl;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = (img.naturalWidth - side) / 2;
    const sy = (img.naturalHeight - side) / 2;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_PX;
    canvas.height = TARGET_PX;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas isn't available in this browser.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_PX, TARGET_PX);
    const webp = canvas.toDataURL("image/webp", 0.85);
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AvatarUploader({
  current, displayName, onSaved,
}: {
  current: string;
  displayName: string;
  /** Called with the new URL ("" after removal) once the server confirms. */
  onSaved: (url: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = displayName.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "P";

  const pick = useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setPhase({ kind: "error", message: "Use a JPG, PNG, or WebP image." });
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setPhase({ kind: "error", message: "Max file size is 5MB." });
      return;
    }
    try {
      setPhase({ kind: "working", label: "Optimizing image…", pct: 35 });
      const dataUrl = await processImage(file);
      setPhase({ kind: "preview", dataUrl });
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Couldn't read that image." });
    }
  }, []);

  async function save(dataUrl: string) {
    setPhase({ kind: "working", label: "Uploading…", pct: 70 });
    try {
      const r = await fetch("/api/account/avatar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d?.error ?? "Upload failed.");
      }
      setPhase({ kind: "working", label: "Saved", pct: 100 });
      onSaved(dataUrl);
      broadcastAvatar(dataUrl);
      setTimeout(() => setPhase({ kind: "idle" }), 700);
    } catch (e) {
      setPhase({ kind: "error", message: e instanceof Error ? e.message : "Upload failed." });
    }
  }

  async function remove() {
    setPhase({ kind: "working", label: "Removing…", pct: 60 });
    try {
      await fetch("/api/account/avatar", { method: "DELETE" });
      onSaved("");
      broadcastAvatar("");
      setPhase({ kind: "idle" });
    } catch {
      setPhase({ kind: "error", message: "Couldn't remove the photo." });
    }
  }

  const previewUrl = phase.kind === "preview" ? phase.dataUrl : current;

  return (
    <div>
      <div className="flex items-start gap-4 flex-wrap">
        {/* avatar preview */}
        <div className="relative shrink-0">
          <motion.div
            key={previewUrl || "empty"}
            initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="h-20 w-20 rounded-full overflow-hidden ring-2 ring-polaris-400/40 shadow-[0_8px_20px_-8px_rgba(139,94,60,0.5)] bg-polaris-500 text-white flex items-center justify-center"
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
            ) : (
              <span className="font-serif text-[24px] font-bold">{initials}</span>
            )}
          </motion.div>
          {phase.kind === "preview" && (
            <span className="absolute -top-1 -right-1 h-5 px-1.5 rounded-full bg-nova-500 text-white text-[8.5px] font-bold uppercase tracking-wider inline-flex items-center">new</span>
          )}
        </div>

        {/* drop zone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); void pick(e.dataTransfer.files?.[0]); }}
          className={cn(
            "flex-1 min-w-[220px] rounded-2xl border-2 border-dashed px-5 py-5 text-center cursor-pointer transition-all",
            dragOver
              ? "border-polaris-400 bg-polaris-100/40 dark:bg-polaris-400/10 scale-[1.01]"
              : "border-polaris-200 bg-paper-soft hover:border-polaris-300 dark:border-white/[0.14] dark:bg-paper-deep dark:hover:border-polaris-400/50",
          )}
        >
          <div className="mx-auto mb-2 h-9 w-9 rounded-xl bg-polaris-100 dark:bg-polaris-400/15 text-polaris-600 dark:text-polaris-300 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></svg>
          </div>
          <div className="text-[13px] font-semibold text-ink">Upload profile picture</div>
          <div className="text-[11.5px] text-ink-muted mt-0.5">Drag &amp; drop or click to choose</div>
          <div className="text-[10.5px] font-mono text-ink-muted mt-1.5">JPG, PNG, WebP · max 5MB · auto-cropped square</div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED.join(",")}
            className="hidden"
            onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = ""; }}
          />
        </div>
      </div>

      {/* state row */}
      <AnimatePresence mode="wait">
        {phase.kind === "working" && (
          <motion.div key="working" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-paper-deep dark:bg-white/[0.08] overflow-hidden">
              <motion.div
                animate={{ width: `${phase.pct}%` }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="h-full rounded-full bg-gradient-to-r from-polaris-400 to-aurora-400"
              />
            </div>
            <span className="text-[11.5px] text-ink-dim shrink-0">{phase.label}</span>
          </motion.div>
        )}
        {phase.kind === "preview" && (
          <motion.div key="preview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 flex items-center gap-2">
            <button onClick={() => void save(phase.dataUrl)}
              className="h-9 px-4 rounded-full bg-ink text-paper text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors">
              Save photo
            </button>
            <button onClick={() => setPhase({ kind: "idle" })}
              className="h-9 px-4 rounded-full bg-paper-soft text-ink-dim text-[12px] font-medium hairline hover:text-ink transition-colors">
              Discard
            </button>
            <span className="text-[11px] text-ink-muted ml-1">Preview - not saved yet</span>
          </motion.div>
        )}
        {phase.kind === "error" && (
          <motion.div key="error" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mt-3 text-[12px] text-rose-600 dark:text-rose-300 flex items-center gap-2">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
            {phase.message}
            <button onClick={() => setPhase({ kind: "idle" })} className="underline text-ink-dim hover:text-ink">dismiss</button>
          </motion.div>
        )}
        {phase.kind === "idle" && current && (
          <motion.div key="idle-remove" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3">
            <button onClick={() => void remove()} className="text-[11.5px] text-rose-600 dark:text-rose-300 hover:underline">
              Remove current photo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
