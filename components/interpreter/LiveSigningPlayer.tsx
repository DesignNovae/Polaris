"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaybackClockSource } from "@/lib/interpreter/synchronization/clocks/types";
import { SigningBuffer } from "@/lib/interpreter/model/buffer";
import { liveJobSchema, parseMeshChunk, signingChunkIndex, type LiveSigningInput, type LiveSigningJob, type MeshChunk } from "@/lib/interpreter/model/live";
import type { Lang } from "./copy";

async function jsonRequest(url: string, init?: RequestInit): Promise<LiveSigningJob> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Signing could not start.");
  return liveJobSchema.parse(body);
}

export function LiveSigningPlayer({ input, source, lang, onReady, onError, onRetry }: {
  input: LiveSigningInput; source: PlaybackClockSource | null; lang: Lang;
  onReady?: () => void; onError?: () => void;
  onRetry?: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chunks = useRef(new Map<number, MeshChunk>());
  const jobRef = useRef<LiveSigningJob | null>(null);
  const topologyRef = useRef<Uint32Array | null>(null);
  const [job, setJob] = useState<LiveSigningJob | null>(null);
  const [error, setError] = useState("");
  const [waiting, setWaiting] = useState(true);
  const [retry, setRetry] = useState(0);
  const [rendererReady, setRendererReady] = useState(false);
  const buffer = useRef(new SigningBuffer());
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const sourceRef = useRef(source);
  const refreshRef = useRef<() => void>(() => {});
  sourceRef.current = source;
  const inputKey = input.kind === "youtube" ? `youtube:${input.videoId}` : `job:${input.jobId}`;
  const bn = lang === "bn";

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let current: LiveSigningJob | null = null;
    let lastFocus = -1;
    let fetching = false;
    let refreshPending = false;
    chunks.current.clear();
    topologyRef.current = null;
    jobRef.current = null;
    setJob(null); setError(""); setWaiting(true);
    buffer.current = new SigningBuffer();

    const loadAsset = async (asset: string) => {
      const response = await fetch(`/api/interpreter/live/${current!.id}?asset=${asset}`, { signal: controller.signal, cache: "no-store" });
      if (!response.ok) throw new Error("The signing section could not load. Retry the interpreter.");
      return response.arrayBuffer();
    };
    const poll = async () => {
      if (fetching || controller.signal.aborted) return;
      fetching = true;
      try {
        if (!current) {
          current = input.kind === "job"
            ? await jsonRequest(`/api/interpreter/live/${input.jobId}`, { signal: controller.signal })
            : await jsonRequest("/api/interpreter/live", { method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...input, language: "ase" }), signal: controller.signal });
        } else current = await jsonRequest(`/api/interpreter/live/${current.id}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (current.error) throw new Error(current.error);
        jobRef.current = current;
        setJob(current);
        const time = sourceRef.current?.read().currentTime ?? 0;
        const focus = signingChunkIndex(time, current.duration, current.chunkSeconds);
        if (focus !== lastFocus) {
          await jsonRequest(`/api/interpreter/live/${current.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ seconds: time }), signal: controller.signal });
          lastFocus = focus;
        }
        // Exam geometry is fetched only after its actual recording has been claimed.
        if (current.scope.kind !== "exam" || sourceRef.current) {
          const available = [focus, focus + 1, focus + 2, focus - 1].filter((i) => current!.chunks[i] && !chunks.current.has(i));
          if (available.length && !topologyRef.current) {
            const data = await loadAsset("topology");
            const topology = new Uint32Array(data);
            if (topology.length !== 20908 * 3 || topology.some((v) => v >= 10475)) throw new Error("Invalid avatar topology");
            if (!controller.signal.aborted) topologyRef.current = topology;
          }
          for (const index of available) {
            const descriptor = current.chunks[index];
            const data = await loadAsset(String(index));
            if (controller.signal.aborted) return;
            chunks.current.set(index, parseMeshChunk(data, index, descriptor.start, descriptor.end));
          }
          for (const index of chunks.current.keys()) if (Math.abs(index - focus) > 3) chunks.current.delete(index);
        }
        const covered = [focus, focus + 1, focus + 2].every((i) => i * current!.chunkSeconds >= current!.duration || chunks.current.has(i));
        timer = setTimeout(() => void poll(), covered ? sourceRef.current?.read().playing ? 2000 : 30_000 : 800);
      } catch (cause) {
        if (!controller.signal.aborted) {
          sourceRef.current?.pause?.();
          buffer.current.pauseByUser();
          setError(cause instanceof Error ? cause.message : "Signing failed.");
          callbacks.current.onError?.();
          refreshRef.current = () => {};
        }
      } finally {
        fetching = false;
        if (refreshPending && !controller.signal.aborted) { refreshPending = false; clearTimeout(timer); timer = setTimeout(() => void poll(), 0); }
      }
    };
    refreshRef.current = () => { if (fetching) refreshPending = true; else { clearTimeout(timer); void poll(); } };
    void poll();
    return () => {
      controller.abort(); clearTimeout(timer);
      refreshRef.current = () => {};
      // Cancel jobs created by this player, but retain imported/exam jobs across a
      // language toggle. The import/exam owner releases those jobs on source change.
      if (current && input.kind === "youtube") void fetch(`/api/interpreter/live/${current.id}`, { method: "DELETE", keepalive: true });
    };
  // The stable input key intentionally owns the request lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey, retry]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    let cleanup: (() => void) | undefined;
    setRendererReady(false);
    void import("three").then((THREE) => {
      if (disposed) return;
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
      renderer.setClearColor(0xeff2ef);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(36, 4 / 3, .01, 20);
      // SMPL-X's neutral head is near y=.42 and pelvis near y=-.45.
      // Frame the face, torso, and full signing space rather than the model origin.
      camera.position.set(0, .05, 1.5);
      camera.lookAt(0, .05, 0);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x77776c, 2));
      const key = new THREE.DirectionalLight(0xffffff, 2.2);
      key.position.set(-2, 3, 4); scene.add(key);
      const fill = new THREE.DirectionalLight(0xffffff, .8);
      fill.position.set(2, 1, 3); scene.add(fill);
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(10475 * 3);
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage));
      const material = new THREE.MeshStandardMaterial({ color: 0xa0a8a3, roughness: .85, metalness: 0 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.frustumCulled = false; scene.add(mesh);
      let installedTopology: Uint32Array | null = null;
      let lastChunk: MeshChunk | undefined;
      let lastFrame = -1;
      let animation = 0;
      let readySignalled = false;
      let lastUiWaiting = true;
      let requestedIndex = -1;
      const resize = new ResizeObserver(() => {
        const width = canvas.clientWidth, height = canvas.clientHeight;
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height; camera.updateProjectionMatrix();
      });
      resize.observe(canvas);
      const draw = () => {
        if (disposed) return;
        const snapshot = sourceRef.current?.read();
        const metadata = jobRef.current;
        const time = snapshot?.currentTime ?? 0;
        const index = signingChunkIndex(time, metadata?.duration ?? 0, metadata?.chunkSeconds ?? 8);
        if (index !== requestedIndex) { requestedIndex = index; refreshRef.current(); }
        const chunk = chunks.current.get(index);
        const available = Boolean(chunk && topologyRef.current && snapshot && !snapshot.lost && !error);
        if (snapshot && sourceRef.current?.pause && sourceRef.current?.play) {
          const action = buffer.current.update(snapshot, available);
          if (action === "pause") sourceRef.current.pause();
          if (action === "play") Promise.resolve(sourceRef.current.play()).catch(() => {
            setError("Press Play in the recording to allow audio playback.");
          });
        }
        if (lastUiWaiting === available) { lastUiWaiting = !available; setWaiting(!available); }
        mesh.visible = available;
        canvas.dataset.signingReady = String(available);
        if (available && chunk) {
          if (installedTopology !== topologyRef.current) {
            installedTopology = topologyRef.current;
            geometry.setIndex(new THREE.BufferAttribute(installedTopology!, 1));
          }
          const frame = Math.max(0, Math.min(chunk.frames - 1, Math.floor((time - chunk.start) * chunk.fps)));
          if (chunk !== lastChunk || frame !== lastFrame) {
            positions.set(chunk.positions.subarray(frame * positions.length, (frame + 1) * positions.length));
            geometry.attributes.position.needsUpdate = true;
            geometry.computeVertexNormals();
            lastChunk = chunk; lastFrame = frame;
            canvas.dataset.signingTime = (chunk.start + frame / chunk.fps).toFixed(3);
            canvas.dataset.signingChunk = String(index);
          }
          if (!readySignalled) { readySignalled = true; callbacks.current.onReady?.(); }
        }
        renderer.render(scene, camera);
        animation = requestAnimationFrame(draw);
      };
      const lost = (event: Event) => { event.preventDefault(); setError("The 3D renderer lost its graphics context. Retry the interpreter."); sourceRef.current?.pause?.(); callbacks.current.onError?.(); };
      canvas.addEventListener("webglcontextlost", lost);
      setRendererReady(true);
      animation = requestAnimationFrame(draw);
      cleanup = () => { cancelAnimationFrame(animation); resize.disconnect(); canvas.removeEventListener("webglcontextlost", lost);
        geometry.dispose(); material.dispose(); renderer.dispose(); };
    }).catch(() => { if (!disposed) { setError("The 3D renderer could not start. Enable WebGL in this browser."); callbacks.current.onError?.(); } });
    return () => { disposed = true; cleanup?.(); };
  }, [inputKey, retry, error]);

  useEffect(() => {
    if (!source) return;
    return source.subscribe((snapshot) => {
      // Seeks are handled by the source clock; their pause-like events are not user pause commands.
      if (!snapshot.buffering) buffer.current.transport(snapshot);
    });
  }, [source]);

  const labels: Record<string, string> = { receiving: "Importing audio…", queued: "Waiting for local generation…", downloading: "Reading the video’s audio…",
    transcribing: "Transcribing this section…", generating: "Generating hand, body, and facial motion…", ready: "Loading the requested signing section…" };
  return <div className="space-y-3">
    <div className="relative overflow-hidden rounded-xl bg-[#eff2ef]">
      <canvas ref={canvasRef} aria-label={bn ? "সাংকেতিক ভাষার থ্রিডি দোভাষী" : "3D sign language interpreter"} className="aspect-[4/3] w-full" />
      {(waiting || error || !rendererReady) && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#eff2ef]/95 p-6 text-center text-sm leading-relaxed text-[#2C1810]" role="status">
        <p>{error || (job ? labels[job.phase] || "Preparing signing…" : "Connecting to the local signing worker…")}</p>
        {!error && <p className="text-xs">{bn ? "প্রস্তুত হলে ভিডিও ও দোভাষী একই সাথে চলবে।" : "Playback waits for the figure. You can pause or seek while it prepares."}</p>}
        {error ? <button type="button" onClick={() => onRetry ? onRetry() : setRetry((n) => n + 1)} className="min-h-10 rounded-lg border border-[#2C1810]/30 px-4 font-semibold">{bn ? "আবার চেষ্টা করুন" : "Retry signing"}</button>
          : <button type="button" onClick={() => { buffer.current.pauseByUser(); source?.pause?.(); }} className="min-h-10 rounded-lg border border-[#2C1810]/30 px-4 text-xs font-semibold">{bn ? "প্রস্তুত হলেও থামিয়ে রাখুন" : "Keep playback paused"}</button>}
      </div>}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-dim">
      <p>ASL · SignSparK · {bn ? "ভাষাগত যাচাই বাকি" : "Linguistic review pending"}</p>
      {source?.play && <button type="button" className="min-h-10 rounded-lg border border-ink-faint/25 px-3 font-semibold text-ink"
        onClick={() => { const playing = source.read().playing || buffer.current.resumeRequested; if (playing) { buffer.current.pauseByUser(); source.pause?.(); } else { Promise.resolve(source.play?.()).catch(() => setError("Use the recording’s Play button to allow audio playback.")); } }}>
        {bn ? "রেকর্ডিং চালান / থামান" : "Play / pause recording"}
      </button>}
      {source?.seekTo && <div className="flex gap-2">
        <button type="button" onClick={() => source.seekTo?.(Math.max(0, source.read().currentTime - 10))}
          className="min-h-10 rounded-lg border border-ink-faint/25 px-3 font-semibold text-ink">{bn ? "১০ সেকেন্ড পেছনে" : "Back 10 seconds"}</button>
        <button type="button" onClick={() => { const state = source.read(); source.seekTo?.(Math.min(state.duration || 7200, state.currentTime + 10)); }}
          className="min-h-10 rounded-lg border border-ink-faint/25 px-3 font-semibold text-ink">{bn ? "১০ সেকেন্ড সামনে" : "Forward 10 seconds"}</button>
      </div>}
    </div>
  </div>;
}
