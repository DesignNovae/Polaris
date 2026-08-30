"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, Pill, Progress } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import type { PublicExamItem, PublicExamSession } from "@/lib/exams/types";

type SaveState = "saved" | "saving" | "error";
type PublicResponse = { answer: string | null; flagged: boolean; hasRecording?: boolean };
type MicrophoneStatus = "checking" | "unknown" | "granted" | "prompt" | "denied" | "unsupported";

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error || "The exam request failed.");
  return body;
}

function clock(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function wordCount(value: string | null | undefined) {
  return value?.trim() ? value.trim().split(/\s+/).length : 0;
}

function microphoneError(cause: unknown, secureContext: boolean) {
  if (!secureContext) return "Microphone access requires a secure page. Use localhost or HTTPS, then try again.";
  if (cause instanceof DOMException && cause.name === "NotAllowedError") {
    return "This site cannot use the microphone. Check the microphone permission for this exact localhost address and your operating-system privacy settings, then reload the page.";
  }
  if (cause instanceof DOMException && cause.name === "NotFoundError") {
    return "No microphone was found. Connect or select a microphone, then try again.";
  }
  if (cause instanceof DOMException && cause.name === "NotReadableError") {
    return "The microphone is already in use or could not be opened. Close other recording apps and try again.";
  }
  if (cause instanceof DOMException && (cause.name === "SecurityError" || cause.name === "TypeError")) {
    return "The browser blocked microphone access on this page. Use localhost or HTTPS and allow the microphone for this site.";
  }
  return cause instanceof Error ? cause.message : "The microphone could not be started. You can continue with a transcript.";
}

function speakingGuidance(itemId: string) {
  if (itemId === "ielts-speaking-part-2") return "Use the one-minute preparation, then give one sustained answer for up to two minutes.";
  if (itemId === "ielts-speaking-part-3") return "Give extended answers with reasons, examples, and comparisons. Treat this as a discussion with an examiner.";
  return "Answer each short question naturally in around 20–30 seconds. Aim for complete answers, not one-word replies.";
}

function Stimulus({ item, listening, played, active, anotherRecordingActive, playbackSeconds, playbackDuration, onPlay }: {
  item: PublicExamItem;
  listening?: boolean;
  played?: boolean;
  active?: boolean;
  anotherRecordingActive?: boolean;
  playbackSeconds?: number;
  playbackDuration?: number;
  onPlay?: () => void;
}) {
  if (!item.stimulus) return null;
  if (item.stimulus.kind === "audio") {
    return (
      <div className="rounded-xl border border-nova-500/25 bg-nova-500/[0.05] p-4">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink"><Icon.play size={12} /> {item.stimulus.title}</div>
        <p className="mt-2 text-[10.5px] text-ink-muted">{item.stimulus.content}</p>
        <button
          type="button"
          onClick={onPlay}
          disabled={played || active || anotherRecordingActive}
          className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-polaris-500 px-4 text-[12px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-ink-faint"
        >
          <Icon.play size={12} /> {active ? "Recording playing…" : anotherRecordingActive ? "Another recording is playing" : played ? "Recording already played" : "Play recording once"}
        </button>
        {(active || anotherRecordingActive) && (
          <div className="mt-3" aria-live="polite">
            {anotherRecordingActive && <p className="mb-2 text-[10px] font-medium text-nova-700">The current recording is still playing. Return to its questions to follow along.</p>}
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-faint/20">
              <div className="h-full rounded-full bg-nova-500 transition-[width] duration-300" style={{ width: `${playbackDuration ? Math.min(100, (playbackSeconds ?? 0) / playbackDuration * 100) : 0}%` }} />
            </div>
            <div className="mt-1.5 flex justify-between font-mono text-[9.5px] text-ink-muted">
              <span>{clock(Math.floor(playbackSeconds ?? 0))}</span>
              <span>{playbackDuration ? clock(Math.ceil(playbackDuration)) : "Loading…"}</span>
            </div>
          </div>
        )}
        {listening && <p className="mt-2 text-[9.5px] text-ink-muted">Playback can be started once. The transcript stays hidden until submission.</p>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-ink-faint/20 bg-bg/40 p-4">
      {item.stimulus.title && <h2 className="font-serif text-[18px] font-bold text-ink">{item.stimulus.title}</h2>}
      <div className={cn(
        "mt-2 whitespace-pre-wrap text-[13px] leading-7 text-ink-dim",
        item.stimulus.kind === "table" && "font-mono text-[12px]",
      )}>{item.stimulus.content}</div>
    </div>
  );
}

export function ExamRunner({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [session, setSession] = useState<PublicExamSession | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [remaining, setRemaining] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [activeAudioPart, setActiveAudioPart] = useState<string | null>(null);
  const [audioObjectUrl, setAudioObjectUrl] = useState<string | null>(null);
  const [audioPlaybackSeconds, setAudioPlaybackSeconds] = useState(0);
  const [audioPlaybackDuration, setAudioPlaybackDuration] = useState(0);
  const [recordingSupported, setRecordingSupported] = useState<boolean | null>(null);
  const [microphoneStatus, setMicrophoneStatus] = useState<MicrophoneStatus>("checking");
  const [microphoneCheckBusy, setMicrophoneCheckBusy] = useState(false);
  const [prepRemaining, setPrepRemaining] = useState<number | null>(null);
  const [prepPartId, setPrepPartId] = useState<string | null>(null);
  const [preparedParts, setPreparedParts] = useState<Record<string, boolean>>({});
  const revisionRef = useRef(0);
  const responsesRef = useRef<Record<string, PublicResponse>>({});
  const currentItemIdRef = useRef<string | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveErrorRef = useRef<Error | null>(null);
  const textTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitStartedRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const cancelSubmitRef = useRef<HTMLButtonElement | null>(null);
  const submitDialogRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const applySession = useCallback((next: PublicExamSession) => {
    if (next.status === "completed") {
      router.replace(`/exams/${next.id}/results`);
      return;
    }
    revisionRef.current = next.revision;
    responsesRef.current = next.responses;
    setSession(next);
    setCurrentIndex(0);
    setRecordingBlob(null);
    setRemaining(Math.max(0, Math.ceil((new Date(next.expiresAt).getTime() - Date.now()) / 1000)));
  }, [router]);

  const load = useCallback(async () => {
    try {
      applySession(await apiJson<PublicExamSession>(`/api/exams/sessions/${sessionId}`));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The exam could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [applySession, sessionId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const supported = Boolean(window.isSecureContext && typeof navigator.mediaDevices?.getUserMedia === "function" && "MediaRecorder" in window);
    setRecordingSupported(supported);
    if (!supported) {
      setMicrophoneStatus("unsupported");
      return;
    }
    if (!navigator.permissions?.query) {
      setMicrophoneStatus("unknown");
      return;
    }
    let active = true;
    navigator.permissions.query({ name: "microphone" as PermissionName }).then((permission) => {
      if (!active) return;
      setMicrophoneStatus(permission.state);
      permission.onchange = () => setMicrophoneStatus(permission.state);
    }).catch(() => { if (active) setMicrophoneStatus("unknown"); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
  }, []);
  useEffect(() => {
    if (!recordingBlob) {
      setRecordingPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(recordingBlob);
    setRecordingPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [recordingBlob]);
  useEffect(() => () => {
    if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  }, [audioObjectUrl]);
  useEffect(() => {
    if (!confirmSubmit) return;
    cancelSubmitRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting) setConfirmSubmit(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [confirmSubmit, submitting]);

  useEffect(() => {
    if (prepRemaining === null || prepRemaining <= 0) return;
    const interval = window.setInterval(() => {
      setPrepRemaining((value) => {
        if (value === null) return null;
        const next = Math.max(0, value - 1);
        if (next === 0 && prepPartId) setPreparedParts((parts) => ({ ...parts, [prepPartId]: true }));
        return next;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [prepPartId, prepRemaining]);

  const queueSave = useCallback((itemId: string, response: PublicResponse) => {
    setSaveState("saving");
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      const save = () => apiJson<{ revision: number }>(`/api/exams/sessions/${sessionId}/responses`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, answer: response.answer, flagged: response.flagged, revision: revisionRef.current }),
      });
      let result: { revision: number };
      try {
        result = await save();
      } catch {
        // The server rejects a save that carries a stale revision, so one
        // dropped or retried request would otherwise wedge every later save
        // for the rest of the exam. Resynchronise the revision and retry once
        // before surfacing anything to the student.
        const current = await apiJson<PublicExamSession>(`/api/exams/sessions/${sessionId}`);
        revisionRef.current = current.revision;
        result = await save();
      }
      revisionRef.current = result.revision;
      saveErrorRef.current = null;
      setSession((value) => value ? { ...value, revision: result.revision } : value);
      setSaveState("saved");
    }).catch((cause) => {
      saveErrorRef.current = cause instanceof Error ? cause : new Error("A response could not be saved.");
      setSaveState("error");
      setError(saveErrorRef.current.message);
    });
  }, [sessionId]);

  const changeResponse = useCallback((itemId: string, patch: Partial<PublicResponse>, persist = true) => {
    const prior = responsesRef.current[itemId] ?? { answer: null, flagged: false };
    const next = { ...prior, ...patch };
    responsesRef.current = { ...responsesRef.current, [itemId]: next };
    setSession((value) => value ? {
      ...value,
      responses: { ...value.responses, [itemId]: next },
      answeredCount: Object.values(responsesRef.current).filter((response) => Boolean(response.answer?.trim()) || response.hasRecording).length,
      flaggedCount: Object.values(responsesRef.current).filter((response) => response.flagged).length,
    } : value);
    if (persist) queueSave(itemId, next);
  }, [queueSave]);

  const setText = useCallback((itemId: string, value: string) => {
    changeResponse(itemId, { answer: value }, false);
    if (textTimerRef.current) clearTimeout(textTimerRef.current);
    textTimerRef.current = setTimeout(() => {
      textTimerRef.current = null;
      queueSave(itemId, responsesRef.current[itemId] ?? { answer: null, flagged: false });
    }, 700);
  }, [changeResponse, queueSave]);

  const flushText = useCallback(() => {
    if (!textTimerRef.current) return;
    clearTimeout(textTimerRef.current);
    textTimerRef.current = null;
    const itemId = currentItemIdRef.current;
    if (itemId) queueSave(itemId, responsesRef.current[itemId] ?? { answer: null, flagged: false });
  }, [queueSave]);

  const submitStage = useCallback(async () => {
    if (submitStartedRef.current) return;
    submitStartedRef.current = true;
    setSubmitting(true);
    setConfirmSubmit(false);
    setError("");
    try {
      flushText();
      await saveQueueRef.current;
      if (saveErrorRef.current) throw saveErrorRef.current;
      const outcome = await apiJson<{ completed: boolean; resultId?: string }>(`/api/exams/sessions/${sessionId}/submit`, { method: "POST" });
      if (outcome.completed) router.replace(`/exams/${sessionId}/results`);
      else {
        submitStartedRef.current = false;
        setSubmitting(false);
        setLoading(true);
        await load();
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The section could not be submitted.");
      setSubmitting(false);
      submitStartedRef.current = false;
    }
  }, [flushText, load, router, sessionId]);

  useEffect(() => {
    if (!session || session.status !== "in_progress") return;
    const tick = () => {
      const seconds = Math.max(0, Math.ceil((new Date(session.expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(seconds);
      if (seconds === 0) void submitStage();
    };
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [session, submitStage]);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setRecordingSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  const checkMicrophone = async () => {
    setMicrophoneCheckBusy(true);
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setMicrophoneStatus("unsupported");
      setRecordingSupported(false);
      setError(microphoneError(null, Boolean(window.isSecureContext)));
      setMicrophoneCheckBusy(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicrophoneStatus("granted");
      setRecordingSupported(true);
    } catch (cause) {
      setMicrophoneStatus(cause instanceof DOMException && cause.name === "NotAllowedError" ? "denied" : "unknown");
      setError(microphoneError(cause, Boolean(window.isSecureContext)));
    } finally {
      setMicrophoneCheckBusy(false);
    }
  };

  const startRecording = async () => {
    setError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || !("MediaRecorder" in window)) {
      setRecordingSupported(false);
      setMicrophoneStatus("unsupported");
      setError(`${microphoneError(null, Boolean(window.isSecureContext))} You can still complete the speaking practice with a transcript.`);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      setMicrophoneStatus("granted");
      const preferredMimeType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]
        .find((mimeType) => MediaRecorder.isTypeSupported(mimeType));
      const recorder = preferredMimeType ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      setRecordingBlob(null);
      setRecordingSeconds(0);
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = () => {
        setRecordingBlob(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      };
      recorder.start(500);
      setRecording(true);
    } catch (cause) {
      setMicrophoneStatus(cause instanceof DOMException && cause.name === "NotAllowedError" ? "denied" : "unknown");
      setError(`${microphoneError(cause, Boolean(window.isSecureContext))} You can still complete the speaking practice with a transcript.`);
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    setRecording(false);
  };

  const uploadRecording = async (itemId: string) => {
    if (!recordingBlob) return;
    setSaveState("saving");
    try {
      flushText();
      await saveQueueRef.current;
      const form = new FormData();
      form.set("itemId", itemId);
      form.set("transcript", responsesRef.current[itemId]?.answer ?? "");
      form.set("revision", String(revisionRef.current));
      form.set("audio", recordingBlob, `${itemId}.webm`);
      const result = await apiJson<{ revision: number }>(`/api/exams/sessions/${sessionId}/recording`, { method: "POST", body: form });
      revisionRef.current = result.revision;
      changeResponse(itemId, { hasRecording: true }, false);
      setSession((value) => value ? { ...value, revision: result.revision } : value);
      setRecordingBlob(null);
      setSaveState("saved");
    } catch (cause) {
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "The recording could not be saved.");
    }
  };

  const releaseListeningAudio = useCallback(() => {
    // The object url itself is revoked by the effect that tracks it.
    setAudioObjectUrl(null);
    setActiveAudioPart(null);
    setAudioPlaybackSeconds(0);
    setAudioPlaybackDuration(0);
  }, []);

  const playListeningPart = async (part: string) => {
    setError("");
    if (activeAudioPart) {
      setError("Finish the current recording before starting another part.");
      return;
    }
    try {
      const response = await fetch(`/api/exams/sessions/${sessionId}/audio`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ part }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error || "The recording could not be played.");
      }
      const url = URL.createObjectURL(await response.blob());
      setAudioObjectUrl(url);
      setActiveAudioPart(part);
      setAudioPlaybackSeconds(0);
      setAudioPlaybackDuration(0);
      setSession((value) => value ? { ...value, playedAudioParts: [...value.playedAudioParts, part] } : value);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The recording could not be played.");
    }
  };

  if (loading) return <main className="grid h-full place-items-center p-8"><div className="text-center"><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-polaris-500 border-t-transparent" /><p className="mt-3 text-[12px] text-ink-muted">Restoring your exam session…</p></div></main>;
  if (!session) return <main className="mx-auto h-full max-w-xl overflow-y-auto p-8 text-center"><h1 className="font-serif text-[28px] font-bold">Exam unavailable</h1><p className="mt-3 text-sm text-signal-rose">{error}</p><button onClick={() => void load()} className="mt-5 rounded-lg bg-ink px-4 py-2 text-sm text-paper">Try again</button></main>;

  const item = session.items[currentIndex];
  if (item) currentItemIdRef.current = item.id;
  const response = item ? session.responses[item.id] ?? { answer: null, flagged: false } : { answer: null, flagged: false };
  const unanswered = session.items.length - session.answeredCount;
  const isFinalStage = session.stageNumber === session.totalStages;
  const submitLabel = isFinalStage ? "Submit exam" : session.stageKind === "break" ? "Continue to Math" : "Complete module";

  const questionContent = item && (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2"><Pill tone="polaris">Question {currentIndex + 1} of {session.items.length}</Pill><Pill tone="ink">{item.domain}</Pill></div>
        <button type="button" aria-pressed={response.flagged} onClick={() => changeResponse(item.id, { flagged: !response.flagged })} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-semibold", response.flagged ? "border-nova-500 bg-nova-500/10 text-nova-600" : "border-ink-faint/25 text-ink-dim")}>{response.flagged ? "★ Flagged" : "☆ Flag for review"}</button>
      </div>
      <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{item.skill}</div>
      <h1 className="mt-3 font-serif text-[22px] font-bold leading-relaxed text-ink sm:text-[26px]">{item.prompt}</h1>
      {(item.itemType === "multiple-choice" || item.itemType === "true-false-not-given") ? (
        <div className="mt-6 space-y-3">
          {item.options?.map((option) => (
            <button key={option.id} type="button" aria-pressed={response.answer === option.id} onClick={() => changeResponse(item.id, { answer: option.id })} className={cn("flex w-full items-center gap-4 rounded-xl border p-4 text-left transition", response.answer === option.id ? "border-polaris-500 bg-polaris-500/[0.08]" : "border-ink-faint/25 hover:border-polaris-500/45")}>
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border text-[12px] font-bold", response.answer === option.id ? "border-polaris-500 bg-polaris-500 text-white" : "border-ink-faint/35 text-ink-dim")}>{option.id}</span>
              <span className="text-[13px] leading-relaxed text-ink">{option.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <label htmlFor="short-answer" className="block text-[11px] font-semibold text-ink-dim">Your answer</label>
          <input id="short-answer" value={response.answer ?? ""} onChange={(event) => setText(item.id, event.target.value)} onBlur={flushText} className="mt-3 h-12 w-full max-w-xl rounded-xl border border-ink-faint/30 bg-bg/30 px-4 text-[15px] text-ink outline-none focus:border-polaris-500" placeholder={item.itemType === "student-produced-response" ? "Integer, decimal, or fraction" : "Use words or numbers from the recording"} />
        </div>
      )}
    </>
  );

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-ink-faint/20 bg-bg/95 px-4 py-3 backdrop-blur md:px-7">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{session.exam} · Stage {session.stageNumber} of {session.totalStages}</div>
            <div className="truncate text-[13px] font-semibold text-ink">{session.title}</div>
          </div>
          <div className="flex items-center gap-3">
            <div className={cn("hidden text-[10.5px] sm:block", saveState === "error" ? "text-signal-rose" : "text-ink-muted")}>{saveState === "saving" ? "Saving…" : saveState === "error" ? "Save needs attention" : "All changes saved"}</div>
            <div role="timer" aria-live={remaining <= 300 ? "polite" : "off"} className={cn("rounded-lg border px-3 py-2 font-mono text-[16px] font-bold", remaining <= 300 ? "border-signal-rose/40 bg-signal-rose/[0.08] text-signal-rose" : "border-ink-faint/25 bg-paper-card text-ink")}>{clock(remaining)}</div>
          </div>
        </div>
      </header>

      {session.stageKind !== "break" && (
        <FocusRail session={session} currentIndex={currentIndex} />
      )}

      {session.stageKind === "break" ? (
        <section key={session.title} className="exam-content-enter grid flex-1 place-items-center p-5">
          <div className="max-w-lg rounded-2xl border border-aurora-500/25 bg-paper-card p-8 text-center shadow-card">
            <Pill tone="aurora">Reading and Writing complete</Pill>
            <h1 className="mt-5 font-serif text-[36px] font-bold text-ink">Scheduled break</h1>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">{session.instructions}</p>
            <div className="mx-auto mt-6 w-fit rounded-xl bg-bg px-5 py-3 font-mono text-[28px] font-bold text-ink">{clock(remaining)}</div>
            <button type="button" onClick={() => void submitStage()} disabled={submitting} className="mt-7 h-11 rounded-lg bg-polaris-500 px-6 text-[13px] font-semibold text-white disabled:opacity-60">{submitting ? "Opening Math…" : "Continue when ready"}</button>
          </div>
        </section>
      ) : session.stageKind === "writing" && item ? (
        <div key={item.id} className="exam-content-enter mx-auto grid w-full max-w-[1400px] min-h-0 flex-1 gap-4 overflow-hidden px-4 py-5 lg:grid-cols-[380px_minmax(0,1fr)] md:px-7">
          <aside className="h-full min-h-0 overflow-y-auto rounded-2xl border border-ink-faint/20 bg-paper-card p-5 shadow-card">
            <Pill tone="nova">{item.section}</Pill>
            <h1 className="mt-4 font-serif text-[24px] font-bold text-ink">{item.domain}</h1>
            {item.stimulus && <div className="mt-4"><Stimulus item={item} /></div>}
            <p className="mt-4 text-[12.5px] leading-relaxed text-ink-dim">{item.prompt}</p>
          </aside>
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-faint/20 bg-paper-card shadow-card">
            <div className="flex items-center justify-between border-b border-ink-faint/15 px-5 py-4">
              <div className="flex gap-2">{session.items.map((task, index) => <button key={task.id} type="button" onClick={() => { flushText(); setCurrentIndex(index); }} className={cn("rounded-lg px-3 py-2 text-[11px] font-semibold", index === currentIndex ? "bg-polaris-500 text-white" : "border border-ink-faint/25 text-ink")}>{task.section}</button>)}</div>
              <span className="text-[11px] text-ink-muted">{wordCount(response.answer)} words</span>
            </div>
            <textarea value={response.answer ?? ""} onChange={(event) => setText(item.id, event.target.value)} onBlur={flushText} className="min-h-0 flex-1 resize-none bg-transparent p-6 text-[15px] leading-7 text-ink outline-none sm:p-8" placeholder="Write your response here. Your draft is saved automatically." />
            <div className="flex shrink-0 items-center justify-between border-t border-ink-faint/15 bg-paper-card px-5 py-4">
              <span className="text-[10.5px] text-ink-muted">Suggested minimum: {item.id.includes("task-1") ? "150" : "250"} words</span>
              <button type="button" onClick={() => setConfirmSubmit(true)} className="h-10 rounded-lg bg-polaris-500 px-5 text-[12px] font-semibold text-white">Review and submit</button>
            </div>
          </section>
        </div>
      ) : session.stageKind === "speaking" && item ? (
        <div key={item.id} className="exam-content-enter mx-auto grid w-full max-w-5xl min-h-0 flex-1 gap-4 overflow-y-auto px-4 py-6 md:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-ink-faint/20 bg-paper-card p-4 shadow-card">
            <h2 className="text-[12px] font-semibold text-ink">Speaking parts</h2>
            <div className="mt-4 space-y-2">{session.items.map((part, index) => <button key={part.id} type="button" disabled={recording} onClick={() => { flushText(); setCurrentIndex(index); setRecordingBlob(null); }} className={cn("w-full rounded-lg border px-3 py-3 text-left text-[11px] font-semibold", index === currentIndex ? "border-polaris-500 bg-polaris-500/[0.08] text-polaris-700" : "border-ink-faint/20 text-ink")}>{part.section}{session.responses[part.id]?.hasRecording && <span className="ml-2 text-aurora-600">✓</span>}</button>)}</div>
          </aside>
          <section className="rounded-2xl border border-ink-faint/20 bg-paper-card p-6 shadow-card sm:p-8">
            <div className="flex items-center justify-between gap-3"><Pill tone="polaris">{item.section}</Pill><span className="font-mono text-[12px] text-ink-muted">{recording ? clock(recordingSeconds) : "Ready"}</span></div>
            {item.stimulus && <div className="mt-5"><Stimulus item={item} /></div>}
            <h1 className="mt-5 font-serif text-[24px] font-bold leading-relaxed text-ink">{item.prompt}</h1>
            <div className="mt-4 rounded-xl border border-polaris-500/20 bg-polaris-500/[0.05] p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-polaris-600">How to respond</div>
              <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">{speakingGuidance(item.id)}</p>
            </div>
            {item.id === "ielts-speaking-part-2" && (
              <div className="mt-6 rounded-xl border border-nova-500/25 bg-nova-500/[0.06] p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold text-ink">One-minute preparation</div>
                    <p className="mt-1 text-[10.5px] text-ink-muted">Use the task card to plan brief notes. Recording unlocks when preparation ends.</p>
                  </div>
                  {preparedParts[item.id] ? (
                    <Pill tone="aurora">Preparation complete</Pill>
                  ) : prepPartId === item.id && prepRemaining !== null ? (
                    <span className="font-mono text-[22px] font-bold text-nova-600">{clock(prepRemaining)}</span>
                  ) : (
                    <button type="button" onClick={() => { setPrepPartId(item.id); setPrepRemaining(60); }} className="h-9 rounded-lg bg-nova-500 px-4 text-[11px] font-semibold text-white">Start preparation</button>
                  )}
                </div>
              </div>
            )}
            <div className="mt-7 rounded-2xl border border-ink-faint/20 bg-bg/35 p-5 text-center">
              <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
                <Pill tone={microphoneStatus === "granted" ? "aurora" : microphoneStatus === "denied" ? "rose" : "ink"}>
                  {microphoneStatus === "granted" ? "Microphone ready" : microphoneStatus === "denied" ? "Microphone blocked" : microphoneStatus === "unsupported" ? "Recording unavailable" : "Microphone not checked"}
                </Pill>
                {!recording && <button type="button" onClick={() => void checkMicrophone()} disabled={microphoneCheckBusy} className="rounded-lg border border-ink-faint/25 px-3 py-1.5 text-[10.5px] font-semibold text-ink-dim transition hover:border-polaris-500/40 hover:text-ink disabled:opacity-50">{microphoneCheckBusy ? "Checking…" : "Check microphone"}</button>}
              </div>
              {recording ? (
                <button type="button" onClick={stopRecording} className="inline-flex h-12 items-center gap-2 rounded-full bg-signal-rose px-6 text-[13px] font-semibold text-white"><span className="h-3 w-3 rounded-sm bg-white" /> Stop recording</button>
              ) : (
                <button type="button" disabled={recordingSupported === false || (item.id === "ielts-speaking-part-2" && !preparedParts[item.id])} onClick={() => void startRecording()} className="inline-flex h-12 items-center gap-2 rounded-full bg-polaris-500 px-6 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45"><Icon.mic size={15} /> {response.hasRecording ? "Record again" : "Start recording"}</button>
              )}
              <p className={cn("mt-3 text-[10.5px]", recordingSupported === false || microphoneStatus === "denied" ? "text-signal-rose" : "text-ink-muted")}>{recordingSupported === false ? "Recording is unavailable here. Add a transcript below to complete the practice." : microphoneStatus === "denied" ? "Allow the microphone for this exact localhost address, then reload and check it again." : "Record one response for this speaking part. A transcript is available as a fallback."}</p>
              {recordingPreviewUrl && <audio className="mx-auto mt-4 w-full max-w-md" controls src={recordingPreviewUrl} />}
              {!recordingBlob && response.hasRecording && <audio className="mx-auto mt-4 w-full max-w-md" controls src={`/api/exams/sessions/${sessionId}/recording?itemId=${item.id}`} />}
            </div>
            <label htmlFor="speaking-transcript" className="mt-6 block text-[11px] font-semibold text-ink">Transcript or speaking notes</label>
            <textarea id="speaking-transcript" value={response.answer ?? ""} onChange={(event) => setText(item.id, event.target.value)} onBlur={flushText} className="mt-2 min-h-32 w-full rounded-xl border border-ink-faint/25 bg-bg/30 p-4 text-[13px] leading-6 text-ink outline-none focus:border-polaris-500" placeholder="Add a transcript or notes so language feedback can refer to what you said." />
            <div className="sticky bottom-0 z-10 -mx-6 -mb-6 mt-5 flex flex-wrap justify-end gap-2 border-t border-ink-faint/15 bg-paper-card/95 px-6 py-4 backdrop-blur sm:-mx-8 sm:-mb-8 sm:px-8">
              {recordingBlob && <button type="button" onClick={() => void uploadRecording(item.id)} className="h-10 rounded-lg border border-aurora-500/40 bg-aurora-500/10 px-4 text-[12px] font-semibold text-aurora-700">Save recording</button>}
              <button type="button" onClick={() => setConfirmSubmit(true)} disabled={recording} className="h-10 rounded-lg bg-polaris-500 px-5 text-[12px] font-semibold text-white disabled:opacity-50">Review and submit</button>
            </div>
          </section>
        </div>
      ) : (
        <div key={item?.id ?? session.title} className={cn("exam-content-enter mx-auto grid w-full max-w-[1400px] min-h-0 flex-1 gap-4 overflow-hidden px-4 py-5 md:px-7", session.mode === "ielts-reading" ? "lg:grid-cols-[minmax(320px,0.9fr)_minmax(420px,1.1fr)]" : "md:grid-cols-[minmax(0,1fr)_260px]")}>
          {session.mode === "ielts-reading" && item && <aside className="h-full min-h-0 overflow-y-auto rounded-2xl border border-ink-faint/20 bg-paper-card p-5 shadow-card"><Stimulus item={item} /></aside>}
          <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-ink-faint/20 bg-paper-card shadow-card">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-7 sm:px-8">
              {item && session.mode !== "ielts-reading" && item.stimulus && <div className="mb-5"><Stimulus
                item={item}
                listening={session.mode === "ielts-listening"}
                played={Boolean(item.stimulus.mediaUrl && session.playedAudioParts.includes(item.stimulus.mediaUrl))}
                active={item.stimulus.mediaUrl === activeAudioPart}
                anotherRecordingActive={Boolean(activeAudioPart && item.stimulus.mediaUrl !== activeAudioPart)}
                playbackSeconds={audioPlaybackSeconds}
                playbackDuration={audioPlaybackDuration}
                onPlay={item.stimulus.mediaUrl ? () => void playListeningPart(item.stimulus!.mediaUrl!) : undefined}
              /></div>}
              {questionContent}
            </div>
            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-ink-faint/15 bg-paper-card px-5 py-4">
              <button type="button" onClick={() => { flushText(); setCurrentIndex((value) => Math.max(0, value - 1)); }} disabled={currentIndex === 0} className="h-10 rounded-lg border border-ink-faint/25 px-4 text-[12px] font-semibold text-ink disabled:opacity-40">← Previous</button>
              {currentIndex < session.items.length - 1 ? <button type="button" onClick={() => { flushText(); setCurrentIndex((value) => Math.min(session.items.length - 1, value + 1)); }} className="h-10 rounded-lg bg-ink px-5 text-[12px] font-semibold text-paper">Next →</button> : <button type="button" onClick={() => setConfirmSubmit(true)} className="h-10 rounded-lg bg-polaris-500 px-5 text-[12px] font-semibold text-white">{submitLabel}</button>}
            </div>
          </section>
          {session.mode !== "ielts-reading" && <Navigator session={session} currentIndex={currentIndex} onSelect={(index) => { flushText(); setCurrentIndex(index); }} onSubmit={() => setConfirmSubmit(true)} />}
        </div>
      )}

      {error && <div role="alert" className="fixed bottom-4 left-1/2 z-40 w-[min(92vw,520px)] -translate-x-1/2 rounded-xl border border-signal-rose/30 bg-paper-card px-4 py-3 text-[11px] text-signal-rose shadow-pop">{error} <button type="button" onClick={() => setError("")} className="float-right font-bold">×</button></div>}
      {audioObjectUrl && <audio
        src={audioObjectUrl}
        autoPlay
        onTimeUpdate={(event) => setAudioPlaybackSeconds(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setAudioPlaybackDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
        onEnded={releaseListeningAudio}
        onError={() => {
          // Without this the stage stays stuck on a recording that will never
          // finish, and every other part reports that one is still playing.
          releaseListeningAudio();
          setError("This recording could not be played. Continue with the remaining parts and raise this with your instructor.");
        }}
      />}
      {confirmSubmit && (
        <div
          ref={submitDialogRef}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="submit-title"
          aria-describedby="submit-description"
          onKeyDown={(event) => {
            if (event.key !== "Tab") return;
            const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
            const first = buttons[0];
            const last = buttons.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-ink-faint/20 bg-paper-card p-6 shadow-pop">
            <Pill tone={unanswered ? "nova" : "aurora"}>{unanswered ? `${unanswered} incomplete` : "All responses complete"}</Pill>
            <h2 id="submit-title" className="mt-4 font-serif text-[25px] font-bold text-ink">{isFinalStage ? "Submit this exam?" : "Complete this stage?"}</h2>
            <p id="submit-description" className="mt-3 text-[12px] leading-relaxed text-ink-dim">You cannot return to this stage after continuing. Saved responses will be locked and used for your practice analytics.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button ref={cancelSubmitRef} type="button" onClick={() => setConfirmSubmit(false)} disabled={submitting} className="h-10 rounded-lg border border-ink-faint/25 px-4 text-[12px] font-semibold text-ink">Go back</button>
              <button type="button" onClick={() => void submitStage()} disabled={submitting || recording || Boolean(recordingBlob)} className="h-10 rounded-lg bg-polaris-500 px-4 text-[12px] font-semibold text-white disabled:opacity-50">{submitting ? "Locking…" : isFinalStage ? "Submit and lock" : "Lock and continue"}</button>
            </div>
            {recordingBlob && <p className="mt-3 text-[10.5px] text-signal-rose">Save the current recording before submitting.</p>}
          </div>
        </div>
      )}
    </main>
  );
}

function FocusRail({ session, currentIndex }: { session: PublicExamSession; currentIndex: number }) {
  const unanswered = Math.max(0, session.items.length - session.answeredCount);
  const progress = session.items.length ? ((currentIndex + 1) / session.items.length) * 100 : 0;
  return (
    <section aria-label="Exam focus status" className="shrink-0 border-b border-ink-faint/15 bg-paper-card/70 px-4 py-2.5 backdrop-blur md:px-7">
      <div className="mx-auto flex max-w-[1400px] items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-center justify-between gap-3 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            <span>Section progress</span>
            <span>{currentIndex + 1} of {session.items.length}</span>
          </div>
          <Progress value={progress} height="h-1" />
        </div>
        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <FocusMetric value={session.answeredCount} label="Answered" tone="aurora" />
          <FocusMetric value={unanswered} label="Open" tone="ink" />
          <FocusMetric value={session.flaggedCount} label="Flagged" tone="nova" />
        </div>
      </div>
    </section>
  );
}

function FocusMetric({ value, label, tone }: { value: number; label: string; tone: "aurora" | "ink" | "nova" }) {
  return (
    <div className={cn(
      "flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[10px]",
      tone === "aurora" && "border-aurora-500/25 bg-aurora-500/[0.07] text-aurora-700",
      tone === "nova" && "border-nova-500/25 bg-nova-500/[0.07] text-nova-600",
      tone === "ink" && "border-ink-faint/20 bg-bg/35 text-ink-dim",
    )}>
      <span className="font-mono font-bold">{value}</span>
      <span>{label}</span>
    </div>
  );
}

function Navigator({ session, currentIndex, onSelect, onSubmit }: {
  session: PublicExamSession;
  currentIndex: number;
  onSelect: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <aside className="h-full min-h-0 overflow-y-auto rounded-2xl border border-ink-faint/20 bg-paper-card p-4 shadow-card">
      <div className="flex items-center justify-between"><h2 className="text-[12px] font-semibold text-ink">Question navigator</h2><span className="text-[10px] text-ink-muted">{session.answeredCount}/{session.items.length}</span></div>
      <div className="mt-4 grid grid-cols-6 gap-2 md:grid-cols-5">
        {session.items.map((item, index) => {
          const response = session.responses[item.id];
          const answered = Boolean(response?.answer?.trim()) || response?.hasRecording;
          return <button key={item.id} type="button" aria-label={`Question ${index + 1}`} aria-current={index === currentIndex ? "step" : undefined} onClick={() => onSelect(index)} className={cn("relative grid aspect-square place-items-center rounded-lg border text-[11px] font-semibold", index === currentIndex ? "border-polaris-500 bg-polaris-500 text-white" : answered ? "border-aurora-500/40 bg-aurora-500/10 text-aurora-700" : "border-ink-faint/25 text-ink-dim")}>{index + 1}{response?.flagged && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-paper-card bg-nova-500" />}</button>;
        })}
      </div>
      <button type="button" onClick={onSubmit} className="mt-5 h-10 w-full rounded-lg border border-polaris-500/40 bg-polaris-500/[0.07] text-[11.5px] font-semibold text-polaris-700">Review stage</button>
    </aside>
  );
}
