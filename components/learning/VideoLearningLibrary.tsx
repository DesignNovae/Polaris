"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Icon } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import type { LearningVideo } from "@/lib/action-lab/types";
import { LEARNING_LIBRARY, LEARNING_PATHS, LEARNING_SECTIONS } from "@/lib/learning/catalog";
import { filterLibrary, formatTime, resumePosition, type LibraryFilters, type LibraryVideo } from "@/lib/learning/library";
import { translateUiText } from "@/lib/i18n/bengali";
import { LEARNING_BENGALI } from "@/lib/learning/copy";
import { InterpreterPanel } from "@/components/interpreter/InterpreterPanel";
import { InterpreterStage } from "@/components/interpreter/InterpreterStage";
import { InterpreterToggle } from "@/components/interpreter/InterpreterControls";
import { LessonPlayer } from "@/components/interpreter/LessonPlayer";
import { ImportedLessonPlayer } from "@/components/interpreter/ImportedLessonPlayer";
import { INTERPRETER_COPY } from "@/components/interpreter/copy";
import { useInterpreterSettings } from "@/lib/interpreter/hooks/useInterpreterSettings";
import type { PlaybackClockSource } from "@/lib/interpreter/synchronization/clocks/types";
import { liveJobSchema, youtubeVideoId } from "@/lib/interpreter/model/live";
import { describeMedia } from "@/lib/interpreter/bootstrap";
import { gemmaHeaders } from "@/lib/gemma/browser-key";
import { useLearningProgress } from "./useLearningProgress";

const initialFilters: LibraryFilters = { exam: "IELTS", topic: "All", query: "", level: "All", length: "All", view: "all", sort: "recommended" };
const control = "min-h-11 rounded-lg border border-ink-faint/30 bg-paper-card px-3 text-sm text-ink";
const secondary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-ink-faint/30 px-3 text-sm font-medium text-ink transition-colors hover:bg-paper-deep disabled:opacity-50";
const primary = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-paper transition-colors hover:bg-polaris-700 hover:text-white disabled:opacity-50";

function Bookmark({ saved }: { saved: boolean }) {
  return <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7"><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
}

function Thumbnail({ video }: { video: LearningVideo }) {
  const [failed, setFailed] = useState(false);
  return failed ? <div className="grid aspect-video place-items-center bg-paper-deep text-ink-dim"><Icon.play size={32} /></div>
    : <Image src={`https://i.ytimg.com/vi/${video.youtubeId}/hqdefault.jpg`} alt="" width={480} height={270} unoptimized
      onError={() => setFailed(true)} className="aspect-video w-full object-cover" />;
}

export function VideoLearningLibrary({ lang }: { lang: "en" | "bn" }) {
  const bn = lang === "bn";
  const t = (en: string, bengali: string) => bn ? bengali : en;
  const tr = (value: string) => bn ? LEARNING_BENGALI[value] || translateUiText(value) : value;
  const [filters, setFilters] = useState(initialFilters);
  const [limit, setLimit] = useState(12);
  const [selected, setSelected] = useState<LearningVideo | null>(null);
  const [clock, setClock] = useState<PlaybackClockSource | null>(null);
  const [queue, setQueue] = useState<string[]>([]);
  const [pathId, setPathId] = useState<string | null>(null);
  const [imported, setImported] = useState<{ url: string; jobId: string; file: File; title: string } | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<{ id: string; reason: string }[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSource, setAiSource] = useState("");
  const [interpreter, updateInterpreter] = useInterpreterSettings();
  const { progress, ready, error: progressError, update, retry } = useLearningProgress();
  const progressRef = useRef(progress); progressRef.current = progress;
  const watchingRef = useRef<HTMLDivElement>(null);
  const libraryRef = useRef<HTMLDivElement>(null);
  const importAbort = useRef<AbortController | null>(null);
  const aiAbort = useRef<AbortController | null>(null);
  const requestScroll = useRef(false);
  const resumeOverride = useRef<number | null>(null);
  const selectedId = selected?.id;
  const catalogSelected = LEARNING_LIBRARY.find((v) => v.id === selectedId);
  const currentPath = LEARNING_PATHS.find((p) => p.id === pathId);
  const available = useMemo(() => LEARNING_LIBRARY.filter((v) => !unavailable.includes(v.id)), [unavailable]);
  const matches = useMemo(() => filterLibrary(available, filters, progress), [available, filters, progress]);
  const topics = filters.exam === "All" ? [...new Set(Object.values(LEARNING_SECTIONS).flat())] : LEARNING_SECTIONS[filters.exam as "IELTS" | "SAT"];
  const queuedVideos = queue.map((id) => available.find((v) => v.id === id)).filter((v): v is LibraryVideo => Boolean(v));
  const validSuggestions = suggestions.filter((item) => available.some((video) => video.id === item.id));
  const next = queuedVideos[queuedVideos.findIndex((v) => v.id === selectedId) + 1];

  const changeFilters = (patch: Partial<LibraryFilters>) => {
    setFilters((current) => ({ ...current, ...patch })); setLimit(12);
    aiAbort.current?.abort(); setSuggestions([]); setAiError(""); setAiBusy(false);
  };
  const chooseVideo = (video: LearningVideo, ids?: string[], nextPath?: string | null) => {
    importAbort.current?.abort(); setImportBusy(false);
    if (ids) { setQueue(ids); setPathId(nextPath ?? null); }
    if (!imported && selected?.id === video.id) {
      watchingRef.current?.scrollIntoView({ block: "start" });
      watchingRef.current?.focus({ preventScroll: true });
      return;
    }
    clock?.pause?.(); setClock(null); setImported(null); setImportError("");
    setSelected(video); requestScroll.current = true;
  };
  useEffect(() => {
    if (selected && requestScroll.current) {
      requestScroll.current = false;
      watchingRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
      watchingRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  useEffect(() => {
    if (!selected) return;
    describeMedia({ mediaId: selected.id, videoId: selected.youtubeId, title: selected.title, topic: selected.topic, exam: selected.exam, source: selected.source });
  }, [selected]);
  useEffect(() => () => { importAbort.current?.abort(); aiAbort.current?.abort(); }, []);
  useEffect(() => {
    if (!imported) return;
    return () => { URL.revokeObjectURL(imported.url); void fetch(`/api/interpreter/live/${imported.jobId}`, { method: "DELETE", keepalive: true }); };
  }, [imported]);

  // Store the source's actual position, never an independent signing timeline.
  useEffect(() => {
    if (!clock || !selectedId || !catalogSelected || !ready || imported) return;
    let restored = false;
    let last = { position: 0, duration: 0 };
    let lastWritten = -1;
    const capture = (save = false) => {
      const snapshot = clock.read();
      if (snapshot.lost || !snapshot.duration) return;
      if (!restored) {
        restored = true;
        const start = resumeOverride.current ?? resumePosition(progressRef.current[selectedId]);
        resumeOverride.current = null;
        if (start > 0) { clock.seekTo?.(Math.min(start, snapshot.duration - 1)); return; }
      }
      last = { position: Math.max(0, Math.min(snapshot.currentTime, snapshot.duration)), duration: snapshot.duration };
      if (save && Math.abs(last.position - lastWritten) >= .5 && last.position > 0) {
        lastWritten = last.position; update(selectedId, last);
      }
    };
    const timer = window.setInterval(() => capture(true), 5000);
    const stop = clock.subscribe((state) => capture(!state.playing && !state.buffering));
    const leave = () => capture(true);
    const hidden = () => { if (document.visibilityState === "hidden") leave(); };
    window.addEventListener("pagehide", leave); document.addEventListener("visibilitychange", hidden);
    capture();
    return () => {
      clearInterval(timer); stop(); window.removeEventListener("pagehide", leave); document.removeEventListener("visibilitychange", hidden);
      if (last.position > 0 && Math.abs(last.position - lastWritten) >= .5) update(selectedId, last);
    };
  }, [clock, selectedId, catalogSelected, ready, imported, update]);

  const importFile = async (file: File) => {
    if (!file.size || file.size > 100 * 1024 * 1024) { setImportError(t("Choose a file smaller than 100 MB.", "১০০ এমবির কম আকারের ফাইল বেছে নিন।")); return; }
    importAbort.current?.abort(); const controller = new AbortController(); importAbort.current = controller;
    setImportBusy(true); setImportError("");
    try {
      const response = await fetch("/api/interpreter/live?upload=1", { method: "POST", body: file, headers: { "Content-Type": "application/octet-stream" }, signal: controller.signal });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Import failed.");
      const job = liveJobSchema.parse(body);
      if (controller.signal.aborted) {
        void fetch(`/api/interpreter/live/${job.id}`, { method: "DELETE", keepalive: true });
        return;
      }
      clock?.pause?.(); setClock(null); setQueue([]); setPathId(null);
      setSelected({ id: job.id, title: file.name, exam: "IELTS", topic: "Imported media", source: "Your file", duration: "", youtubeId: "", officialUrl: "" });
      setImported({ url: URL.createObjectURL(file), jobId: job.id, file, title: file.name }); requestScroll.current = true;
      updateInterpreter({ enabled: true, language: "ase" });
    } catch (cause) { if (!controller.signal.aborted) setImportError(cause instanceof Error ? cause.message : "Import failed."); }
    finally { if (!controller.signal.aborted) setImportBusy(false); }
  };
  const recommend = async () => {
    aiAbort.current?.abort(); const controller = new AbortController(); aiAbort.current = controller;
    setAiBusy(true); setAiError("");
    try {
      const response = await fetch("/api/gemma-studio", { method: "POST", headers: { "Content-Type": "application/json", "x-polaris-language": lang, ...gemmaHeaders() },
        body: JSON.stringify({ kind: "videos", exam: filters.exam === "All" ? "IELTS" : filters.exam, section: filters.topic }), signal: controller.signal });
      const body = await response.json(); if (!response.ok) throw new Error(body.error || "Recommendations unavailable.");
      if (!controller.signal.aborted) { setSuggestions(body.recommendations.filter((v: LearningVideo) => available.some((item) => item.id === v.id))); setAiSource(body.source); }
    } catch (cause) { if (!controller.signal.aborted) setAiError(cause instanceof Error ? cause.message : "Recommendations unavailable."); }
    finally { if (!controller.signal.aborted) setAiBusy(false); }
  };
  const onPlayerState = useCallback((state: string) => {
    if (state === "unavailable" && selectedId) setUnavailable((ids) => ids.includes(selectedId) ? ids : [...ids, selectedId]);
    if (state === "ready" && selectedId) setUnavailable((ids) => ids.filter((id) => id !== selectedId));
  }, [selectedId]);
  const saveButton = (video: LearningVideo) => <button type="button" disabled={!ready} className={secondary} aria-pressed={Boolean(progress[video.id]?.saved)}
    aria-label={`${progress[video.id]?.saved ? t("Unsave", "সরিয়ে দিন") : t("Save", "সংরক্ষণ করুন")}: ${tr(video.title)}`}
    onClick={() => update(video.id, { saved: !progress[video.id]?.saved })}><Bookmark saved={Boolean(progress[video.id]?.saved)} /><span>{progress[video.id]?.saved ? t("Saved", "সংরক্ষিত") : t("Save", "সংরক্ষণ")}</span></button>;

  return <div className="space-y-8" data-testid="learning-library">
    {selected && <section ref={watchingRef} tabIndex={-1} className="scroll-mt-24 space-y-4 outline-none" aria-label={t("Watching lesson", "পাঠ দেখছেন")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className={secondary} onClick={() => libraryRef.current?.scrollIntoView({ block: "start" })}>{t("Browse library", "পাঠাগার দেখুন")}</button>
        <button type="button" className={secondary} onClick={() => { importAbort.current?.abort(); setImportBusy(false); clock?.pause?.(); setClock(null); setSelected(null); setImported(null); }}>{t("Close player", "প্লেয়ার বন্ধ করুন")}<Icon.close /></button>
      </div>
      <InterpreterStage enabled={interpreter.enabled} side={interpreter.side} size={interpreter.size} layout={interpreter.layout}
        media={<div className="overflow-hidden rounded-2xl border border-ink-faint/25 bg-paper-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-faint/20 p-3">
            <InterpreterToggle enabled={interpreter.enabled} onChange={(enabled) => updateInterpreter({ enabled })} copy={INTERPRETER_COPY[lang]} />
            <span className="text-xs text-ink-dim">{imported ? t("Your media", "আপনার মিডিয়া") : `${selected.exam} · ${tr(selected.topic)}`}</span>
          </div>
          {imported ? <ImportedLessonPlayer key={imported.url} url={imported.url} title={imported.title} onSource={setClock} />
            : <LessonPlayer key={selected.id} videoId={selected.youtubeId} title={selected.title} onSource={setClock} onState={onPlayerState}
              fallbackUrl={selected.officialUrl || undefined} onTryAnother={next ? () => chooseVideo(next) : undefined} locale={lang} />}
          <div className="space-y-3 p-5">
            <h2 className="font-serif text-2xl font-bold text-ink">{tr(selected.title)}</h2>
            <p className="text-sm text-ink-dim">{selected.source}{catalogSelected ? ` · ${formatTime(catalogSelected.durationSeconds)} · ${tr(catalogSelected.skill)}` : ""}</p>
            {catalogSelected && <div className="flex flex-wrap gap-2">{saveButton(selected)}
              <button type="button" className={secondary} disabled={!ready} aria-pressed={Boolean(progress[selected.id]?.completed)}
                onClick={() => update(selected.id, { completed: !progress[selected.id]?.completed })}><Icon.check />{progress[selected.id]?.completed ? t("Completed", "সম্পন্ন") : t("Mark complete", "সম্পন্ন হিসেবে চিহ্নিত করুন")}</button>
              <button type="button" className={secondary} disabled={!clock} onClick={() => { clock?.seekTo?.(0); update(selected.id, { position: 0, duration: clock?.read().duration || catalogSelected.durationSeconds }); }}>{t("Start over", "শুরু থেকে দেখুন")}</button>
            </div>}
          </div>
        </div>}
        panel={<InterpreterPanel mediaId={imported?.jobId ?? selected.id} source={clock} lang={lang} className="h-full"
          liveInput={imported ? { kind: "job", jobId: imported.jobId } : { kind: "youtube", videoId: selected.youtubeId }}
          onLiveRetry={imported ? () => { if (!importBusy) void importFile(imported.file); } : undefined} />} />
      {queuedVideos.length > 1 && <div className="rounded-xl border border-ink-faint/25 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-semibold text-ink">{currentPath ? tr(currentPath.title) : t("In this selection", "এই তালিকার পাঠ")}</h3>
          {next && <button type="button" className={secondary} onClick={() => chooseVideo(next)}>{t("Next lesson", "পরের পাঠ")}<Icon.arrow /></button>}</div>
        <ol className="mt-3 flex gap-2 overflow-x-auto pb-2">{queuedVideos.map((video, index) => <li key={video.id} className="w-52 shrink-0">
          <button type="button" aria-current={selected.id === video.id ? "step" : undefined} onClick={() => chooseVideo(video)}
            className={cn("h-full w-full rounded-lg p-3 text-left text-sm text-ink transition-colors hover:bg-paper-deep", selected.id === video.id && "bg-paper-deep font-semibold")}>
            <span className="mb-1 block text-xs text-ink-dim">{index + 1} / {queuedVideos.length}{progress[video.id]?.completed ? ` · ${t("Completed", "সম্পন্ন")}` : ""}</span>{tr(video.title)}</button></li>)}</ol>
      </div>}
    </section>}

    <section ref={libraryRef} className="scroll-mt-24 space-y-6" aria-label={t("Learning library", "শেখার পাঠাগার")}>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><h2 className="font-serif text-3xl font-bold text-ink">{t("Learning library", "শেখার পাঠাগার")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-dim">{t("Find your next lesson. Build a skill, follow a learning path, or pick up where you left off.", "পরের পাঠ খুঁজুন। দক্ষতা বাড়ান, শেখার পথ অনুসরণ করুন অথবা আগের পাঠ চালিয়ে যান।")}</p></div>
        <p className="pt-1 text-sm text-ink-dim">{available.length} {t("curated lessons", "বাছাই করা পাঠ")} · IELTS & SAT</p>
      </header>
      {progressError && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-ink-faint/30 p-3 text-sm text-ink">
        <p>{t("Your saved lessons or progress could not sync. You can keep browsing.", "সংরক্ষিত পাঠ বা অগ্রগতি সিঙ্ক হয়নি। আপনি পাঠ দেখতে পারবেন।")}</p><button type="button" onClick={retry} className={secondary}>{t("Retry sync", "আবার সিঙ্ক করুন")}</button></div>}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("Choose exam", "পরীক্ষা বেছে নিন")}>{["All", "IELTS", "SAT"].map((exam) => <button type="button" key={exam}
          aria-pressed={filters.exam === exam} onClick={() => changeFilters({ exam, topic: "All" })} className={cn(secondary, filters.exam === exam && "bg-ink text-paper hover:bg-ink")}>{exam === "All" ? t("All exams", "সব পরীক্ষা") : exam}</button>)}</div>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("Choose skill", "দক্ষতা বেছে নিন")}>{["All", ...topics].map((topic) => <button type="button" key={topic} aria-pressed={filters.topic === topic}
          onClick={() => changeFilters({ topic })} className={cn("min-h-11 rounded-lg px-3 text-sm text-ink transition-colors hover:bg-paper-deep", filters.topic === topic && "bg-paper-deep font-semibold underline decoration-2 underline-offset-4")}>{topic === "All" ? t("All skills", "সব দক্ষতা") : tr(topic)}</button>)}</div>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-[minmax(220px,1fr)_160px_160px_160px]">
          <label className="space-y-1.5 text-xs font-medium text-ink-dim"><span>{t("Search lessons", "পাঠ খুঁজুন")}</span><div className="relative"><span className="pointer-events-none absolute left-3 top-3.5"><Icon.search /></span>
            <input type="search" value={filters.query} onChange={(event) => changeFilters({ query: event.target.value })} placeholder={t("Try algebra, Task 2, pronunciation…", "বীজগণিত, Task 2, pronunciation…")} className={cn(control, "w-full pl-9")} /></div></label>
          <label className="space-y-1.5 text-xs font-medium text-ink-dim"><span>{t("Level", "স্তর")}</span><select className={cn(control, "w-full")} value={filters.level} onChange={(e) => changeFilters({ level: e.target.value })}>{["All", "Foundation", "Practice", "Advanced"].map((level) => <option key={level} value={level}>{level === "All" ? t("All levels", "সব স্তর") : tr(level)}</option>)}</select></label>
          <label className="space-y-1.5 text-xs font-medium text-ink-dim"><span>{t("Duration", "দৈর্ঘ্য")}</span><select className={cn(control, "w-full")} value={filters.length} onChange={(e) => changeFilters({ length: e.target.value })}><option value="All">{t("Any duration", "যেকোনো দৈর্ঘ্য")}</option><option value="short">{t("Under 10 minutes", "১০ মিনিটের কম")}</option><option value="medium">{t("10–30 minutes", "১০–৩০ মিনিট")}</option><option value="long">{t("30+ minutes", "৩০ মিনিটের বেশি")}</option></select></label>
          <label className="space-y-1.5 text-xs font-medium text-ink-dim"><span>{t("Sort", "সাজান")}</span><select className={cn(control, "w-full")} value={filters.sort} onChange={(e) => changeFilters({ sort: e.target.value })}><option value="recommended">{t("Library order", "পাঠাগারের ক্রম")}</option><option value="shortest">{t("Shortest first", "ছোট পাঠ আগে")}</option><option value="title">{t("Title A–Z", "শিরোনাম A–Z")}</option></select></label>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-faint/25 pb-3">
        <div role="group" aria-label={t("Your library", "আপনার পাঠাগার")} className="flex flex-wrap gap-1">{[["all", t("All lessons", "সব পাঠ")], ["continue", t("Continue watching", "দেখা চালিয়ে যান")], ["saved", t("Saved", "সংরক্ষিত")], ["completed", t("Completed", "সম্পন্ন")]].map(([view, label]) => <button key={view} type="button" aria-pressed={filters.view === view} onClick={() => changeFilters({ view })}
          className={cn("min-h-11 rounded-lg px-3 text-sm text-ink transition-colors hover:bg-paper-deep", filters.view === view && "bg-paper-deep font-semibold")}>{label}</button>)}</div>
        <p role="status" className="text-sm tabular-nums text-ink-dim">{matches.length} {t(matches.length === 1 ? "lesson" : "lessons", "পাঠ")}</p>
      </div>
      {matches.length === 0 ? <div className="py-10 text-center"><h3 className="font-serif text-xl font-bold text-ink">{filters.view === "saved" ? t("Save a lesson for later", "পরে দেখার জন্য পাঠ সংরক্ষণ করুন") : filters.view === "continue" ? t("Your next lesson starts here", "আপনার পরের পাঠ এখানেই") : filters.view === "completed" ? t("Build your learning record", "শেখার রেকর্ড তৈরি করুন") : t("No lessons match these filters", "এই ফিল্টারে কোনো পাঠ পাওয়া যায়নি")}</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm text-ink-dim">{t("Explore the library or clear your filters to see more lessons.", "আরও পাঠ দেখতে পাঠাগার দেখুন অথবা ফিল্টার মুছে দিন।")}</p><button type="button" className={cn(secondary, "mt-4")} onClick={() => changeFilters({ ...initialFilters, exam: "All" })}>{t("Show all lessons", "সব পাঠ দেখান")}</button></div>
        : <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 2xl:grid-cols-3">{matches.slice(0, limit).map((video) => {
          const record = progress[video.id]; const position = resumePosition(record);
          return <article key={video.id} className="min-w-0" data-testid={`lesson-${video.id}`}>
            <button type="button" className="group relative block w-full overflow-hidden rounded-xl bg-paper-deep text-left" aria-label={`${position >= 5 ? t("Resume", "চালিয়ে যান") : t("Watch", "দেখুন")}: ${tr(video.title)}`}
              onClick={() => chooseVideo(video, matches.map((v) => v.id))}>
              <Thumbnail video={video} /><span className="absolute bottom-2 right-2 rounded bg-black/85 px-2 py-1 text-xs font-semibold tabular-nums text-white">{formatTime(video.durationSeconds)}</span>
              {record?.completed && <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-black/85 px-2 py-1 text-xs font-medium text-white"><Icon.check />{t("Completed", "সম্পন্ন")}</span>}
              {position >= 5 && <span className="absolute inset-x-0 bottom-0 h-1 bg-black/40"><span className="block h-full bg-polaris-400" style={{ width: `${Math.min(100, position / (record?.duration || video.durationSeconds) * 100)}%` }} /></span>}
            </button>
            <div className="mt-3 flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-ink-dim">{video.exam} · {tr(video.topic)} · {tr(video.level)}</p>
              <h3 className="mt-1 text-base font-semibold leading-snug text-ink"><button type="button" className="text-left hover:underline" onClick={() => chooseVideo(video, matches.map((v) => v.id))}>{tr(video.title)}</button></h3>
              <p className="mt-1 text-sm text-ink-dim">{video.source}</p>{position >= 5 && <p className="mt-1 text-xs text-ink-dim">{t("Resume at", "চালিয়ে যান")} {formatTime(position)}</p>}</div>
              <button type="button" disabled={!ready} aria-pressed={Boolean(record?.saved)} aria-label={`${record?.saved ? t("Unsave", "সরিয়ে দিন") : t("Save", "সংরক্ষণ করুন")}: ${tr(video.title)}`}
                className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-lg text-ink transition-colors hover:bg-paper-deep disabled:opacity-50" onClick={() => update(video.id, { saved: !record?.saved })}><Bookmark saved={Boolean(record?.saved)} /></button>
            </div>
          </article>;
        })}</div>}
      {matches.length > limit && <div className="text-center"><button type="button" className={secondary} onClick={() => setLimit((n) => n + 12)}>{t("Show more lessons", "আরও পাঠ দেখান")} ({matches.length - limit})<Icon.chevDown /></button></div>}

      {filters.view === "all" && <section className="space-y-4 border-t border-ink-faint/25 pt-7" aria-label={t("Learning paths", "শেখার পথ")}>
        <div><h3 className="font-serif text-2xl font-bold text-ink">{t("A little structure goes a long way", "ধাপে ধাপে এগিয়ে যান")}</h3><p className="mt-1 text-sm text-ink-dim">{t("Follow a short sequence of lessons, one skill at a time.", "একটি দক্ষতার জন্য সাজানো ছোট পাঠক্রম অনুসরণ করুন।")}</p></div>
        <div className="grid gap-x-8 sm:grid-cols-2">{LEARNING_PATHS.filter((p) => filters.exam === "All" || filters.exam === p.exam).map((path) => {
          const ids = path.videoIds.filter((id) => available.some((v) => v.id === id));
          const completed = ids.filter((id) => progress[id]?.completed).length;
          const first = available.find((v) => v.id === (ids.find((id) => !progress[id]?.completed) || ids[0]));
          return <div key={path.id} className="border-b border-ink-faint/20 py-5"><h4 className="font-semibold text-ink">{tr(path.title)}</h4><p className="mt-2 text-sm leading-relaxed text-ink-dim">{tr(path.description)}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-ink-dim">{path.exam} · {completed}/{ids.length} {t("completed", "সম্পন্ন")}</p><button type="button" className={secondary} disabled={!first} onClick={() => first && chooseVideo(first, ids, path.id)}>{completed ? t("Continue path", "চালিয়ে যান") : t("Start path", "পাঠক্রম শুরু করুন")}<Icon.arrow /></button></div></div>;
        })}</div>
      </section>}

      <details className="rounded-xl border border-ink-faint/25 p-4">
        <summary className="min-h-7 cursor-pointer font-semibold text-ink">{t("Help me choose a lesson", "পাঠ বেছে নিতে সাহায্য করুন")}</summary>
        <p className="mt-3 text-sm text-ink-dim">{t("Get suggestions from the curated catalog for your selected exam and skill.", "নির্বাচিত পরীক্ষা ও দক্ষতার জন্য পাঠের পরামর্শ পান।")}</p>
        <button type="button" className={cn(secondary, "mt-3")} disabled={aiBusy || filters.exam === "All"} onClick={() => void recommend()}>{aiBusy ? t("Preparing suggestions…", "পরামর্শ তৈরি হচ্ছে…") : t("Suggest lessons", "পাঠের পরামর্শ দিন")}<Icon.spark /></button>
        {filters.exam === "All" && <p className="mt-2 text-xs text-ink-dim">{t("Select IELTS or SAT to get suggestions.", "পরামর্শ পেতে IELTS অথবা SAT বেছে নিন।")}</p>}
        {aiError && <p role="alert" className="mt-2 text-sm text-ink">{aiError}</p>}
        {validSuggestions.length > 0 && <div className="mt-4 space-y-3"><p className="text-xs text-ink-dim">{aiSource === "gemma4" ? t("Polaris AI suggestions", "Polaris AI পরামর্শ") : t("Curated starter lessons", "বাছাই করা প্রাথমিক পাঠ")}</p>{validSuggestions.map((item) => {
          const video = available.find((v) => v.id === item.id)!;
          return <div key={item.id}><button type="button" className="min-h-11 text-left font-semibold text-ink underline underline-offset-4" onClick={() => chooseVideo(video, validSuggestions.map((v) => v.id))}>{tr(video.title)}</button><p className="text-sm leading-relaxed text-ink-dim">{item.reason}</p></div>;
        })}</div>}
      </details>
      <details className="rounded-xl border border-ink-faint/25 p-4">
        <summary className="min-h-7 cursor-pointer font-semibold text-ink">{t("Learn from your own video", "নিজের ভিডিও দিয়ে শিখুন")}</summary>
        <p className="mt-3 text-sm leading-relaxed text-ink-dim">{t("Add an English video or audio file for ASL signing. Playback buffers while new sections are prepared.", "ASL-এর জন্য ইংরেজি ভিডিও বা অডিও দিন। নতুন অংশ প্রস্তুত হওয়ার সময় প্লেব্যাক অপেক্ষা করবে।")}</p>
        <div className="mt-4 flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 space-y-1.5 text-sm text-ink-dim"><span>{t("YouTube link", "YouTube লিংক")}</span><input type="url" className={cn(control, "w-full")} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=…" /></label>
          <button type="button" className={primary} disabled={importBusy} onClick={() => {
            const id = youtubeVideoId(videoUrl); if (!id) { setImportError(t("Enter a valid HTTPS YouTube video link.", "সঠিক HTTPS YouTube ভিডিও লিংক দিন।")); return; }
            chooseVideo({ id: `youtube:${id}`, youtubeId: id, title: t("Your YouTube video", "আপনার YouTube ভিডিও"), exam: "IELTS", topic: "Imported media", source: "YouTube", duration: "", officialUrl: "" }, []);
            updateInterpreter({ enabled: true, language: "ase" });
          }}>{t("Load video", "ভিডিও চালু করুন")}</button>
          <label className={cn(secondary, "cursor-pointer focus-within:outline focus-within:outline-2 focus-within:outline-polaris-500")}>
            {importBusy ? t("Importing…", "আমদানি হচ্ছে…") : t("Import video / audio", "ভিডিও / অডিও দিন")}
            <input type="file" className="sr-only" accept="video/mp4,video/webm,audio/mpeg,audio/wav,audio/mp4,audio/ogg" disabled={importBusy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; }} />
          </label>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-ink-dim">{t("MP4, WebM, MP3, WAV, M4A or Ogg · up to 100 MB and 2 hours. If YouTube audio is unavailable, import the original file.", "MP4, WebM, MP3, WAV, M4A অথবা Ogg · সর্বোচ্চ ১০০ এমবি ও ২ ঘণ্টা। YouTube অডিও না পেলে মূল ফাইল দিন।")}</p>
        {importError && <p role="alert" className="mt-3 text-sm text-ink">{importError}</p>}
      </details>
    </section>
  </div>;
}
