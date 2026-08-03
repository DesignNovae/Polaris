"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Btn, Card, Icon, Pill, Progress, RingMini, Tag } from "@/components/app/ui";
import { MarkdownMessage } from "@/components/app/MarkdownMessage";
import { LEARNING_VIDEOS } from "@/lib/action-lab/data";
import type { LearningVideo, PracticeQuestion, WritingTask } from "@/lib/action-lab/types";
import { gemmaHeaders, getBrowserGemmaKey, setBrowserGemmaKey } from "@/lib/gemma/browser-key";
import { cn } from "@/lib/cn";
import { translateUiText } from "@/lib/i18n/bengali";

type Lang = "en" | "bn";
type Trace = { source: "gemma4" | "deterministic-fallback"; model: string };

async function studioPost<T>(body: Record<string, unknown>, lang: Lang): Promise<T> {
  const response = await fetch("/api/gemma-studio", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-polaris-language": lang,
      ...gemmaHeaders(),
    },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Gemma Studio could not complete the request.");
  return data;
}

const IELTS_SECTIONS = ["Listening", "Reading", "Writing", "Speaking"] as const;
const SAT_SECTIONS = ["Reading and Writing", "Math"] as const;
const DIFFICULTIES = ["Foundation", "Medium", "Advanced"] as const;

type Viseme = "rest" | "closed" | "open" | "wide" | "round" | "bite" | "dental" | "narrow";
type SpeechFrame = { word: string; wordIndex: number; charStart: number; viseme: Viseme; duration: number };

const VISEME_SHAPES: Record<Viseme, { outer: string; inner: string; teeth: boolean; tongue: boolean }> = {
  rest: { outer: "M25 37 Q60 31 95 37 Q60 44 25 37 Z", inner: "M34 37 Q60 35 86 37 Q60 39 34 37 Z", teeth: false, tongue: false },
  closed: { outer: "M20 37 Q60 32 100 37 Q60 42 20 37 Z", inner: "M28 37 Q60 36 92 37 Q60 38 28 37 Z", teeth: false, tongue: false },
  open: { outer: "M24 34 Q60 18 96 34 Q60 61 24 34 Z", inner: "M34 34 Q60 25 86 34 Q60 53 34 34 Z", teeth: true, tongue: true },
  wide: { outer: "M14 35 Q60 22 106 35 Q60 52 14 35 Z", inner: "M25 35 Q60 28 95 35 Q60 45 25 35 Z", teeth: true, tongue: false },
  round: { outer: "M39 28 Q60 16 81 28 Q91 37 81 50 Q60 62 39 50 Q29 37 39 28 Z", inner: "M46 30 Q60 23 74 30 Q82 37 74 46 Q60 53 46 46 Q38 37 46 30 Z", teeth: false, tongue: false },
  bite: { outer: "M21 34 Q60 23 99 34 Q60 49 21 34 Z", inner: "M31 34 Q60 28 89 34 Q60 43 31 34 Z", teeth: true, tongue: false },
  dental: { outer: "M24 33 Q60 20 96 33 Q60 55 24 33 Z", inner: "M34 33 Q60 26 86 33 Q60 48 34 33 Z", teeth: true, tongue: true },
  narrow: { outer: "M31 31 Q60 23 89 31 Q60 53 31 31 Z", inner: "M40 32 Q60 28 80 32 Q60 46 40 32 Z", teeth: false, tongue: false },
};

function tokenViseme(token: string): Viseme {
  if (/^(m|b|p)$/.test(token)) return "closed";
  if (/^(f|v|ph)$/.test(token)) return "bite";
  if (token === "th") return "dental";
  if (/^(o|u|w|q|oo|ou|ow)$/.test(token)) return "round";
  if (/^(i|y|ee|ea|ai|ay)$/.test(token)) return "wide";
  if (/^(a|e)$/.test(token)) return "open";
  if (/^(t|d|s|z|n|l)$/.test(token)) return "dental";
  if (/^(sh|ch|j|r|k|g|h|c|x)$/.test(token)) return "narrow";
  return "rest";
}

function buildSpeechFrames(script: string): SpeechFrame[] {
  const frames: SpeechFrame[] = [];
  const matcher = /\S+/g;
  let match: RegExpExecArray | null;
  let wordIndex = 0;
  while ((match = matcher.exec(script))) {
    const word = match[0];
    const clean = word.toLowerCase().replace(/[^a-z]/g, "");
    const tokens = clean.match(/th|sh|ch|ph|oo|ee|ea|ai|ay|ou|ow|[a-z]/g) || [""];
    tokens.forEach((token) => frames.push({
      word,
      wordIndex,
      charStart: match?.index ?? 0,
      viseme: tokenViseme(token),
      duration: /[.!?]$/.test(word) ? 125 : /[,;:]$/.test(word) ? 105 : 78,
    }));
    frames.push({ word, wordIndex, charStart: match.index, viseme: "rest", duration: /[.!?]$/.test(word) ? 180 : 42 });
    wordIndex += 1;
  }
  return frames;
}

function VisemeMouth({ viseme }: { viseme: Viseme }) {
  const shape = VISEME_SHAPES[viseme];
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full overflow-visible" aria-hidden="true">
      <motion.path d={shape.outer} fill="#7d3140" stroke="#4a1e29" strokeWidth="4" animate={{ d: shape.outer }} transition={{ duration: 0.09, ease: "easeOut" }} />
      <motion.path d={shape.inner} fill="#2c1118" animate={{ d: shape.inner }} transition={{ duration: 0.09, ease: "easeOut" }} />
      {shape.teeth && <path d="M36 33 Q60 27 84 33 L81 38 Q60 34 39 38 Z" fill="#fff8ed" opacity="0.96" />}
      {shape.tongue && <path d="M43 45 Q60 39 77 45 Q60 53 43 45 Z" fill="#d56c7d" opacity="0.88" />}
      <path d="M24 34 Q60 17 96 34" fill="none" stroke="#d78a91" strokeWidth="1.5" opacity="0.65" />
    </svg>
  );
}

function ListeningExamPlayer({ script, questionId, lang }: { script: string; questionId: string; lang: Lang }) {
  const bn = lang === "bn";
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const visualTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visualFrameIndexRef = useRef(0);
  const [state, setState] = useState<"ready" | "playing" | "paused" | "finished" | "unsupported" | "error">("ready");
  const [progress, setProgress] = useState(0);
  const [lipReading, setLipReading] = useState(false);
  const [activeWord, setActiveWord] = useState("");
  const [activeWordIndex, setActiveWordIndex] = useState(-1);
  const [viseme, setViseme] = useState<Viseme>("rest");
  const words = useMemo(() => script.split(/\s+/).filter(Boolean), [script]);
  const frames = useMemo(() => buildSpeechFrames(script), [script]);

  const stopVisual = () => {
    if (visualTimerRef.current) clearTimeout(visualTimerRef.current);
    visualTimerRef.current = null;
  };

  const startVisual = () => {
    stopVisual();
    if (!frames.length) return;
    const advance = () => {
      const frame = frames[visualFrameIndexRef.current];
      if (!frame) {
        stopVisual();
        setViseme("rest");
        if (!("speechSynthesis" in window) || !window.speechSynthesis.speaking) {
          setProgress(100);
          setState("finished");
        }
        return;
      }
      setActiveWord(frame.word);
      setActiveWordIndex(frame.wordIndex);
      setViseme(frame.viseme);
      setProgress(Math.min(98, Math.round(((visualFrameIndexRef.current + 1) / frames.length) * 100)));
      visualTimerRef.current = setTimeout(() => {
        visualFrameIndexRef.current += 1;
        advance();
      }, frame.duration);
    };
    advance();
  };

  useEffect(() => {
    window.speechSynthesis?.cancel();
    stopVisual();
    utteranceRef.current = null;
    visualFrameIndexRef.current = 0;
    setState(typeof window === "undefined" || !("speechSynthesis" in window) ? "unsupported" : "ready");
    setProgress(0);
    setActiveWord("");
    setActiveWordIndex(-1);
    setViseme("rest");
    return () => {
      window.speechSynthesis?.cancel();
      stopVisual();
    };
  }, [questionId, script]);

  const play = () => {
    if (state === "finished") return;
    if (state === "paused") {
      window.speechSynthesis?.resume();
      startVisual();
      setState("playing");
      return;
    }
    visualFrameIndexRef.current = 0;
    if (!("speechSynthesis" in window)) {
      if (lipReading) {
        setState("playing");
        startVisual();
      }
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(script);
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => /^en-GB/i.test(voice.lang))
      ?? voices.find((voice) => /^en/i.test(voice.lang))
      ?? null;
    utterance.lang = utterance.voice?.lang || "en-GB";
    utterance.rate = 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => { setState("playing"); startVisual(); };
    utterance.onboundary = (event) => {
      if (typeof event.charIndex !== "number") return;
      const alignedIndex = frames.findIndex((frame) => frame.charStart >= event.charIndex);
      if (alignedIndex >= 0 && Math.abs(alignedIndex - visualFrameIndexRef.current) > 2) {
        visualFrameIndexRef.current = alignedIndex;
      }
    };
    utterance.onend = () => { stopVisual(); setViseme("rest"); setProgress(100); setState("finished"); };
    utterance.onerror = () => {
      stopVisual();
      if (lipReading) {
        setState("playing");
        startVisual();
      } else {
        setState("error");
        setProgress(0);
      }
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const pause = () => {
    if (state !== "playing") return;
    window.speechSynthesis?.pause();
    stopVisual();
    setViseme("rest");
    setState("paused");
  };

  const status = state === "playing"
    ? (lipReading ? (bn ? "ভিজ্যুয়াল স্পিকার চলছে" : "Visual speaker playing") : (bn ? "অডিও চলছে" : "Audio playing"))
    : state === "paused"
      ? (bn ? "পরীক্ষা বিরতিতে" : "Playback paused")
      : state === "finished"
        ? (bn ? "শোনার সুযোগ শেষ" : "Listening complete")
        : state === "unsupported"
          ? (lipReading ? (bn ? "ভিজ্যুয়াল মোড প্রস্তুত" : "Visual mode ready") : (bn ? "এই ব্রাউজারে ভয়েস চালু নেই" : "Voice is unavailable in this browser"))
          : state === "error"
            ? (bn ? "অডিও চালানো যায়নি" : "Audio could not play")
            : (bn ? "শোনার জন্য প্রস্তুত" : "Ready to listen");
  const captionStart = Math.max(0, activeWordIndex - 2);
  const captionWords = words.slice(captionStart, Math.min(words.length, activeWordIndex + 4));

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-nova-500/25 bg-nova-500/[0.06]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-faint/10 px-4 py-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">{bn ? "অ্যাক্সেসিবিলিটি" : "Accessibility"}</p>
          <p className="mt-0.5 text-[11px] text-ink-dim">{bn ? "Gemma-এর তৈরি স্ক্রিপ্টের ভিজ্যুয়াল বক্তা" : "Visual speaker for the Gemma-generated script"}</p>
        </div>
        <button
          type="button"
          onClick={() => setLipReading((value) => !value)}
          aria-pressed={lipReading}
          className={cn("rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition", lipReading ? "border-aurora-500/40 bg-aurora-500/15 text-aurora-500" : "border-ink-faint/20 text-ink-dim hover:border-polaris-500/40")}
        >
          {lipReading ? (bn ? "✓ লিপ-রিডিং চালু" : "✓ Lip-reading on") : (bn ? "লিপ-রিডিং সংস্করণ" : "Lip-reading version")}
        </button>
      </div>

      {lipReading && (
        <div className="grid gap-5 border-b border-ink-faint/10 bg-gradient-to-br from-polaris-500/[0.08] via-bg/70 to-aurora-500/[0.08] p-4 sm:p-5 2xl:grid-cols-[220px_minmax(0,1fr)] 2xl:items-center">
          <div className="relative mx-auto h-[230px] w-[205px] overflow-hidden rounded-[28px] border border-polaris-500/20 bg-[#171111] shadow-card" aria-label={bn ? `অ্যানিমেটেড বক্তার মুখ, বর্তমান ভিসিম ${viseme}` : `Animated speaker face, current viseme ${viseme}`} data-viseme={viseme}>
            <div className="absolute inset-x-0 top-0 h-24 bg-[radial-gradient(circle_at_50%_100%,rgba(201,126,82,0.22),transparent_65%)]" />
            <motion.svg viewBox="0 0 220 260" className="absolute inset-0 h-full w-full" animate={{ y: state === "playing" ? [0, -1.5, 0] : 0 }} transition={{ repeat: state === "playing" ? Infinity : 0, duration: 1.7 }}>
              <defs>
                <linearGradient id={`skin-${questionId}`} x1="0" y1="0" x2="0.8" y2="1">
                  <stop offset="0" stopColor="#e0ad83" />
                  <stop offset="1" stopColor="#a95f45" />
                </linearGradient>
                <linearGradient id={`shirt-${questionId}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#75442e" />
                  <stop offset="1" stopColor="#35211e" />
                </linearGradient>
              </defs>
              <path d="M20 260 Q28 208 74 199 L146 199 Q192 208 200 260 Z" fill={`url(#shirt-${questionId})`} />
              <path d="M83 181 L137 181 L143 211 Q110 228 77 211 Z" fill="#b87354" />
              <ellipse cx="110" cy="108" rx="72" ry="91" fill={`url(#skin-${questionId})`} stroke="#d99b72" strokeWidth="2" />
              <path d="M39 91 Q41 17 110 13 Q181 20 181 92 Q164 66 149 51 Q105 70 49 58 Z" fill="#2b1b1a" />
              <path d="M47 67 Q29 111 47 151" fill="none" stroke="#2b1b1a" strokeWidth="10" strokeLinecap="round" />
              <path d="M173 67 Q191 111 173 151" fill="none" stroke="#2b1b1a" strokeWidth="10" strokeLinecap="round" />
              <ellipse cx="75" cy="104" rx="15" ry="9" fill="#fff8ed" />
              <ellipse cx="145" cy="104" rx="15" ry="9" fill="#fff8ed" />
              <motion.ellipse cx="76" cy="104" rx="5" ry={state === "playing" ? 5 : 4} fill="#241817" animate={{ cy: state === "playing" ? [104, 103, 104] : 104 }} transition={{ repeat: state === "playing" ? Infinity : 0, duration: 2.1 }} />
              <motion.ellipse cx="144" cy="104" rx="5" ry={state === "playing" ? 5 : 4} fill="#241817" animate={{ cy: state === "playing" ? [104, 103, 104] : 104 }} transition={{ repeat: state === "playing" ? Infinity : 0, duration: 2.1 }} />
              <path d="M59 88 Q75 79 91 88" fill="none" stroke="#422824" strokeWidth="5" strokeLinecap="round" />
              <path d="M129 88 Q145 79 161 88" fill="none" stroke="#422824" strokeWidth="5" strokeLinecap="round" />
              <path d="M109 105 Q101 130 111 138 Q120 137 123 134" fill="none" stroke="#8f503e" strokeWidth="3" strokeLinecap="round" />
              <ellipse cx="75" cy="139" rx="18" ry="7" fill="#c97966" opacity="0.22" />
              <ellipse cx="146" cy="139" rx="18" ry="7" fill="#c97966" opacity="0.22" />
              <foreignObject x="50" y="139" width="120" height="72">
                <div className="h-full w-full"><VisemeMouth viseme={viseme} /></div>
              </foreignObject>
            </motion.svg>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[8px] font-bold uppercase tracking-[0.18em] text-white/65 backdrop-blur">Gemma visual speech</div>
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2"><Pill tone="aurora">{bn ? "৮টি ভিসিম" : "8 visemes"}</Pill><Tag tone="ink">{bn ? "শব্দের সীমার সঙ্গে সিঙ্ক" : "word-boundary synced"}</Tag></div>
            <h4 className="mt-3 font-serif text-[20px] font-bold text-ink">{bn ? "মুখের নড়াচড়া ও লাইভ ক্যাপশন" : "Mouth movement with live caption"}</h4>
            <div className="mt-3 min-h-[76px] rounded-2xl border border-ink-faint/15 bg-bg/70 px-4 py-4 text-center shadow-soft" aria-live="polite">
              {activeWordIndex < 0 ? (
                <span className="text-[12px] text-ink-muted">{bn ? "প্লে করলে বক্তার ঠোঁট ও ক্যাপশন একসঙ্গে চলবে" : "Press play to synchronize the speaker's lips and caption"}</span>
              ) : (
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[17px] font-semibold">
                  {captionWords.map((word, offset) => {
                    const wordPosition = captionStart + offset;
                    return <span key={`${wordPosition}-${word}`} className={cn("transition-all duration-100", wordPosition === activeWordIndex ? "scale-110 rounded-md bg-polaris-500 px-2 py-0.5 text-white shadow-sm" : "text-ink-muted opacity-55")}>{word}</span>;
                  })}
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-4 gap-1.5 text-center text-[8px] font-semibold uppercase tracking-wide text-ink-muted" aria-label={bn ? `বর্তমান মুখভঙ্গি ${viseme}` : `Current mouth shape ${viseme}`}>
              {([
                ["rest", bn ? "বিরতি" : "pause"],
                ["closed", "M B P"],
                ["open", "A E"],
                ["wide", "I Y"],
                ["round", "O U W"],
                ["bite", "F V"],
                ["dental", "TH T D"],
                ["narrow", "R SH K"],
              ] as Array<[Viseme, string]>).map(([shapeName, label]) => (
                <span key={shapeName} className={cn("rounded-lg border border-ink-faint/15 px-1 py-1.5 transition", viseme === shapeName && "scale-105 border-polaris-500 bg-polaris-500/15 text-polaris-500 shadow-soft")}>{label}</span>
              ))}
            </div>
            <p className="mt-3 text-[10.5px] leading-relaxed text-ink-muted">{bn ? "ঠোঁট, দাঁত, জিহ্বা ও চোয়ালের আটটি আলাদা ভঙ্গি ব্যবহার করা হয়। এটি শ্রবণ-প্রতিবন্ধী শিক্ষার্থীদের অনুশীলন সহায়তা, IELTS-এর আনুষ্ঠানিক সুবিধা নয়।" : "Eight distinct lip, teeth, tongue, and jaw positions are used. This is an inclusive practice aid, not an official IELTS accommodation."}</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 p-4">
        <button
          type="button"
          onClick={state === "playing" ? pause : play}
          disabled={state === "finished" || (state === "unsupported" && !lipReading)}
          aria-label={state === "playing" ? "Pause audio" : lipReading ? "Start visual listening" : "Play audio"}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-paper shadow-card transition hover:bg-polaris-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <span className="text-[15px]">{state === "playing" ? "Ⅱ" : "▶"}</span>
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12px] font-semibold text-ink">{status}</span>
            <span className="rounded-full border border-ink-faint/20 px-2 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">{bn ? "একবার" : "One play"}</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/10 dark:bg-white/10">
            <div className="h-full rounded-full bg-nova-500 transition-[width] duration-300" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-[10.5px] text-ink-muted">{bn ? "স্ট্যান্ডার্ড মোডে ট্রান্সক্রিপ্ট লুকানো থাকে এবং রেকর্ডিং একবার চলে। প্রয়োজন হলে লিপ-রিডিং সংস্করণ চালু করুন।" : "Standard mode hides the transcript and plays once. Activate the lip-reading version when an accessibility aid is needed."}</p>
        </div>
      </div>
    </div>
  );
}

function examTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function wordCount(value: string) {
  return value.trim() ? value.trim().split(/\s+/).filter(Boolean).length : 0;
}

export function GemmaExamStudio({ lang }: { lang: Lang }) {
  const bn = lang === "bn";
  const [exam, setExam] = useState<"IELTS" | "SAT">("IELTS");
  const sections = exam === "IELTS" ? IELTS_SECTIONS : SAT_SECTIONS;
  const [section, setSection] = useState<string>("Listening");
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>("Medium");
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [trace, setTrace] = useState<Trace | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [writingTask, setWritingTask] = useState<WritingTask | null>(null);
  const [writingResponse, setWritingResponse] = useState("");
  const [writingSeconds, setWritingSeconds] = useState(0);
  const [writingRunning, setWritingRunning] = useState(false);
  const [writingSubmitted, setWritingSubmitted] = useState(false);
  const [writingFeedback, setWritingFeedback] = useState("");

  const question = questions[index];
  const score = questions.filter((item) => answers[item.id] === item.answer).length;
  const listening = exam === "IELTS" && section === "Listening";
  const writing = exam === "IELTS" && section === "Writing";
  const responseWords = wordCount(writingResponse);

  useEffect(() => {
    if (!writingRunning || writingSubmitted) return;
    const timer = window.setInterval(() => {
      setWritingSeconds((value) => {
        if (value <= 1) {
          setWritingRunning(false);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [writingRunning, writingSubmitted]);

  const resetWriting = () => {
    setWritingTask(null);
    setWritingResponse("");
    setWritingSeconds(0);
    setWritingRunning(false);
    setWritingSubmitted(false);
    setWritingFeedback("");
  };

  const changeExam = (next: "IELTS" | "SAT") => {
    setExam(next);
    setSection(next === "IELTS" ? "Listening" : "Reading and Writing");
    setQuestions([]);
    setAnswers({});
    setFinished(false);
    setFeedback("");
    setTrace(null);
    resetWriting();
  };

  const generate = async () => {
    setBusy(true);
    setError("");
    try {
      if (writing) {
        const result = await studioPost<{ task: WritingTask } & Trace>({
          kind: "writing-generate",
          difficulty,
        }, lang);
        setWritingTask(result.task);
        setWritingResponse("");
        setWritingSeconds(result.task.timeLimitMinutes * 60);
        setWritingRunning(false);
        setWritingSubmitted(false);
        setWritingFeedback("");
        setTrace(result);
        setQuestions([]);
        return;
      }
      const result = await studioPost<{ questions: PracticeQuestion[] } & Trace>({
        kind: "exam-generate",
        exam,
        section,
        difficulty,
        count: 3,
      }, lang);
      setQuestions(result.questions);
      setTrace(result);
      setIndex(0);
      setAnswers({});
      setFinished(false);
      setFeedback("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : writing
        ? (bn ? "রচনার বিষয় তৈরি করা যায়নি।" : "The writing task could not be generated.")
        : (bn ? "প্রশ্ন তৈরি করা যায়নি।" : "Questions could not be generated."));
    } finally {
      setBusy(false);
    }
  };

  const submitWriting = async () => {
    if (!writingTask || writingSubmitted || writingResponse.trim().length < 20) return;
    setWritingRunning(false);
    setWritingSubmitted(true);
    setBusy(true);
    setError("");
    try {
      const result = await studioPost<{ wordCount: number; feedback: string } & Trace>({
        kind: "writing-grade",
        task: writingTask,
        response: writingResponse,
        elapsedSeconds: (writingTask.timeLimitMinutes * 60) - writingSeconds,
      }, lang);
      setWritingFeedback(result.feedback);
      setTrace(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (bn ? "রচনাটি মূল্যায়ন করা যায়নি।" : "The response could not be evaluated."));
    } finally {
      setBusy(false);
    }
  };

  const grade = async () => {
    setFinished(true);
    setBusy(true);
    setError("");
    try {
      const result = await studioPost<{ score: number; feedback: string } & Trace>({
        kind: "exam-grade",
        exam,
        questions,
        answers,
      }, lang);
      setFeedback(result.feedback);
      setTrace(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (bn ? "উত্তর যাচাই করা যায়নি।" : "Answers could not be graded."));
    } finally {
      setBusy(false);
    }
  };

  if (finished) {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card className="border border-aurora-500/20 bg-aurora-500/[0.05] p-6 text-center">
          <RingMini value={Math.round((score / questions.length) * 100)} size={94} stroke={7} tone="aurora" label={<span className="text-[17px] font-bold">{score}/{questions.length}</span>} />
          <h2 className="mt-4 font-serif text-[24px] font-bold text-ink">{bn ? "Gemma মূল্যায়ন সম্পন্ন" : "Gemma review complete"}</h2>
          <p className="mt-2 text-[11.5px] text-ink-muted">{exam} · {section} · {difficulty}</p>
          <Btn className="mt-5" variant="outline" onClick={() => { setFinished(false); setAnswers({}); setIndex(0); }}>{bn ? "আরেকবার চেষ্টা করুন" : "Try this set again"}</Btn>
          <Btn className="mt-2" variant="accent" onClick={() => void generate()} disabled={busy}>{bn ? "নতুন সেট তৈরি করুন" : "Generate a new set"}</Btn>
        </Card>
        <div className="space-y-3">
          <Card className="border border-ink-faint/15 p-5">
            <div className="flex items-center justify-between gap-3">
              <Pill tone="polaris">Gemma 4 feedback</Pill>
              <ModelTrace trace={trace} />
            </div>
            {busy ? <p className="mt-4 text-[12.5px] text-ink-dim">{bn ? "Gemma আপনার ভুলের ধরন বিশ্লেষণ করছে…" : "Gemma is diagnosing your answer pattern…"}</p> : <MarkdownMessage className="mt-4 text-[12.5px]" text={feedback || error} theme="light" />}
          </Card>
          {questions.map((item, itemIndex) => {
            const correct = answers[item.id] === item.answer;
            return (
              <details key={item.id} className="rounded-xl border border-ink-faint/15 bg-paper-card p-3.5">
                <summary className="cursor-pointer list-none text-[12.5px] font-semibold text-ink">
                  <span className={cn("mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] text-white", correct ? "bg-aurora-500" : "bg-signal-rose")}>{correct ? "✓" : "×"}</span>
                  {bn ? "প্রশ্ন" : "Question"} {itemIndex + 1}: {item.skill}
                </summary>
                <p className="mt-3 pl-7 text-[11.5px] leading-relaxed text-ink-dim">{item.explanation}</p>
                {item.section === "Listening" && item.passage && (
                  <p className="mt-2 pl-7 text-[11px] leading-relaxed text-ink-muted"><span className="font-semibold text-ink-dim">{bn ? "ট্রান্সক্রিপ্ট:" : "Transcript:"}</span> {item.passage}</p>
                )}
              </details>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
      <Card className="relative overflow-hidden border border-ink-faint/15 p-5">
        <div className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full bg-polaris-500/15 blur-3xl" />
        <Pill tone="polaris"><Icon.spark size={11} /> {writing ? (bn ? "সময়বদ্ধ রচনা" : "Timed writing task") : (bn ? "চাহিদামতো প্রশ্ন" : "On-demand questions")}</Pill>
        <h2 className="mt-3 font-serif text-[24px] font-bold text-ink">{writing ? (bn ? "Gemma IELTS রচনা পরীক্ষা" : "Gemma IELTS Writing Exam") : (bn ? "Gemma মক পরীক্ষার নির্মাতা" : "Gemma Mock Generator")}</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">{writing
          ? (bn ? "Gemma একটি বাস্তবসম্মত IELTS Writing Task 2 বিষয় তৈরি করবে। ৪০ মিনিটের মধ্যে কমপক্ষে ২৫০ শব্দ লিখুন।" : "Gemma creates a realistic IELTS Writing Task 2 prompt. Write at least 250 words within 40 minutes.")
          : (bn ? "পরীক্ষা, বিভাগ ও কঠিনতার মাত্রা বেছে নিন। প্রতিবার নতুন মৌলিক অনুশীলন সেট তৈরি হবে।" : "Choose an exam, section, and difficulty. Gemma creates a fresh original practice set every time.")}</p>
        <Segmented value={exam} options={["IELTS", "SAT"]} onChange={(value) => changeExam(value as "IELTS" | "SAT")} />
        <label className="mt-4 block text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {bn ? "বিভাগ" : "Section"}
          <select value={section} onChange={(event) => { setSection(event.target.value); setQuestions([]); setAnswers({}); setFeedback(""); setFinished(false); setTrace(null); resetWriting(); }} className="mt-1.5 h-10 w-full rounded-xl border border-ink-faint/20 bg-bg px-3 text-[12.5px] normal-case tracking-normal text-ink outline-none">
            {sections.map((item) => <option key={item} value={item}>{bn ? translateUiText(item) : item}</option>)}
          </select>
        </label>
        <label className="mt-3 block text-[10px] font-bold uppercase tracking-wider text-ink-muted">
          {bn ? "কঠিনতার মাত্রা" : "Difficulty"}
          <select value={difficulty} onChange={(event) => setDifficulty(event.target.value as (typeof DIFFICULTIES)[number])} className="mt-1.5 h-10 w-full rounded-xl border border-ink-faint/20 bg-bg px-3 text-[12.5px] normal-case tracking-normal text-ink outline-none">
            {DIFFICULTIES.map((item) => <option key={item} value={item}>{bn ? translateUiText(item) : item}</option>)}
          </select>
        </label>
        <Btn className="mt-5 w-full" variant="accent" size="lg" disabled={busy} onClick={() => void generate()} icon={<Icon.spark size={13} />}>
          {busy
            ? (writing ? (bn ? "Gemma রচনার বিষয় তৈরি করছে…" : "Gemma is creating the writing task…") : (bn ? "Gemma প্রশ্ন তৈরি করছে…" : "Gemma is generating…"))
            : (writing ? (bn ? "নতুন রচনার বিষয় তৈরি করুন" : "Generate writing task") : (bn ? "নতুন মক তৈরি করুন" : "Generate fresh mock"))}
        </Btn>
        {error && <p className="mt-3 text-[11px] text-signal-rose">{error}</p>}
        <div className="mt-5 rounded-xl border border-aurora-500/20 bg-aurora-500/[0.06] p-3 text-[11px] leading-relaxed text-ink-dim">
          {writing
            ? (bn ? "এটি একটি অনানুষ্ঠানিক IELTS অনুশীলন। Gemma-এর মূল্যায়ন কোনো আনুষ্ঠানিক IELTS ব্যান্ড স্কোর নয়।" : "This is unofficial IELTS practice. Gemma's evaluation is not an official IELTS band score.")
            : (bn ? "এগুলো মৌলিক অনানুষ্ঠানিক অনুশীলন প্রশ্ন। এগুলো IELTS ব্যান্ড বা SAT স্কোরের আনুষ্ঠানিক পূর্বাভাস নয়।" : "These are original unofficial practice questions. They do not predict an official IELTS band or SAT score.")}
        </div>
      </Card>

      <Card className="min-h-[520px] overflow-hidden border border-ink-faint/15">
        {writing ? (
          !writingTask ? (
            <div className="grid min-h-[520px] place-items-center p-8 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-polaris-500/20 bg-polaris-500/[0.07] text-polaris-500"><Icon.spark size={25} /></div>
                <h3 className="mt-4 font-serif text-[22px] font-bold text-ink">{bn ? "আপনার রচনার পরীক্ষা তৈরি করুন" : "Create your writing exam"}</h3>
                <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-ink-dim">{bn ? "Gemma একটি মৌলিক IELTS Writing Task 2 বিষয় তৈরি করবে। প্রশ্ন তৈরি হলে টাইমার আলাদাভাবে শুরু করুন।" : "Gemma will create an original IELTS Writing Task 2 prompt. Start the timer separately when you are ready."}</p>
              </div>
            </div>
          ) : writingSubmitted ? (
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Pill tone="aurora"><Icon.check size={11} /> {bn ? "জমা হয়েছে" : "Submitted"}</Pill>
                  <h3 className="mt-3 font-serif text-[24px] font-bold text-ink">{bn ? "Gemma রচনা পর্যালোচনা" : "Gemma writing review"}</h3>
                  <p className="mt-1 text-[11px] text-ink-muted">{responseWords} {bn ? "শব্দ" : "words"} · {writingTask.title}</p>
                </div>
                <ModelTrace trace={trace} />
              </div>
              <Card className="mt-5 border border-ink-faint/15 p-5">
                {busy
                  ? <p className="text-[12.5px] text-ink-dim">{bn ? "Gemma Task Response, সামঞ্জস্য, শব্দভাণ্ডার ও ব্যাকরণ বিশ্লেষণ করছে…" : "Gemma is evaluating task response, coherence, vocabulary, and grammar…"}</p>
                  : <MarkdownMessage className="text-[12.5px]" text={writingFeedback || error} theme="light" />}
              </Card>
              <details className="mt-4 rounded-xl border border-ink-faint/15 bg-bg/40 p-4">
                <summary className="cursor-pointer text-[12px] font-semibold text-ink">{bn ? "জমা দেওয়া রচনা দেখুন" : "View submitted response"}</summary>
                <p className="mt-3 whitespace-pre-wrap text-[12px] leading-[1.75] text-ink-dim">{writingResponse}</p>
              </details>
              <Btn className="mt-5" variant="accent" disabled={busy} onClick={() => void generate()} icon={<Icon.spark size={13} />}>{bn ? "নতুন রচনা পরীক্ষা" : "New writing exam"}</Btn>
            </div>
          ) : (
            <div className="p-5 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2"><Pill tone="polaris">IELTS Writing Task 2</Pill><Tag tone="ink">{writingTask.difficulty}</Tag></div>
                <div className={cn("rounded-xl border px-3 py-2 font-mono text-[18px] font-bold tabular-nums", writingSeconds <= 300 ? "border-signal-rose/35 bg-signal-rose/10 text-signal-rose" : "border-ink-faint/20 bg-bg text-ink")}>
                  {examTime(writingSeconds)}
                </div>
              </div>
              <Progress value={writingTask.timeLimitMinutes ? ((writingTask.timeLimitMinutes * 60 - writingSeconds) / (writingTask.timeLimitMinutes * 60)) * 100 : 0} tone={writingSeconds <= 300 ? "rose" : "polaris"} height="h-1 mt-4" />
              <div className="mt-5 rounded-2xl border border-nova-500/20 bg-nova-500/[0.06] p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink-muted">{writingTask.title}</p>
                <h3 className="mt-3 text-[17px] font-semibold leading-[1.6] text-ink">{writingTask.prompt}</h3>
                <ul className="mt-4 space-y-2">
                  {writingTask.requirements.map((requirement) => <li key={requirement} className="flex gap-2 text-[11.5px] leading-relaxed text-ink-dim"><span className="text-polaris-500">●</span><span>{requirement}</span></li>)}
                </ul>
              </div>

              {!writingRunning && writingSeconds === writingTask.timeLimitMinutes * 60 && !writingResponse ? (
                <div className="mt-6 rounded-2xl border border-dashed border-polaris-500/30 bg-polaris-500/[0.04] p-5 text-center">
                  <p className="text-[12px] leading-relaxed text-ink-dim">{bn ? "প্রস্তুত হলে পরীক্ষা শুরু করুন। শুরু করার পর টাইমার বিরতি দেওয়া যাবে না।" : "Start when you are ready. The timer cannot be paused after the exam begins."}</p>
                  <Btn className="mt-4" variant="accent" size="lg" onClick={() => setWritingRunning(true)}>{bn ? "৪০ মিনিটের পরীক্ষা শুরু করুন" : "Start 40-minute exam"}</Btn>
                </div>
              ) : (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="ielts-writing-response" className="text-[11px] font-bold uppercase tracking-wider text-ink-muted">{bn ? "আপনার উত্তর" : "Your response"}</label>
                    <span className={cn("text-[11px] font-semibold", responseWords >= writingTask.minimumWords ? "text-aurora-500" : "text-ink-muted")}>{responseWords} / {writingTask.minimumWords} {bn ? "শব্দ" : "words"}</span>
                  </div>
                  <textarea
                    id="ielts-writing-response"
                    value={writingResponse}
                    onChange={(event) => setWritingResponse(event.target.value)}
                    disabled={!writingRunning || writingSeconds === 0}
                    rows={13}
                    spellCheck
                    placeholder={bn ? "IELTS পরীক্ষার মতো ইংরেজিতে আপনার উত্তর লিখুন…" : "Write your response in English as you would in the IELTS exam…"}
                    className="mt-2 w-full resize-y rounded-2xl border border-ink-faint/20 bg-bg px-4 py-4 text-[13px] leading-[1.8] text-ink outline-none transition focus:border-polaris-500 disabled:cursor-not-allowed disabled:opacity-70"
                  />
                  {writingSeconds === 0 && <p className="mt-2 text-[11px] font-semibold text-signal-rose">{bn ? "সময় শেষ। এখন আপনার লেখা জমা দিন।" : "Time is up. Submit the response for review."}</p>}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[10.5px] text-ink-muted">{bn ? "খসড়াটি এই পরীক্ষার ভেতরেই থাকে এবং জমা দেওয়ার পর সম্পাদনা করা যায় না।" : "The response stays in this exam and cannot be edited after submission."}</p>
                    <Btn variant="accent" disabled={busy || responseWords < 20} onClick={() => void submitWriting()}>{bn ? "জমা দিয়ে Gemma মূল্যায়ন" : "Submit for Gemma review"} <Icon.check size={13} /></Btn>
                  </div>
                </div>
              )}
            </div>
          )
        ) : !question ? (
          <div className="grid min-h-[520px] place-items-center p-8 text-center">
            <div>
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-polaris-500/20 bg-polaris-500/[0.07] text-polaris-500"><Icon.spark size={25} /></div>
              <h3 className="mt-4 font-serif text-[22px] font-bold text-ink">{bn ? "একটি নতুন মক তৈরি করুন" : "Create a fresh mock"}</h3>
              <p className="mx-auto mt-2 max-w-sm text-[12px] leading-relaxed text-ink-dim">{bn ? "Gemma নির্বাচিত বিভাগের দক্ষতা, কঠিনতার মাত্রা ও মৌলিক বিভ্রান্তিকর উত্তর পরিকল্পনা করবে।" : "Gemma plans skill coverage, difficulty, and original distractors for the selected section."}</p>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2"><Pill tone="polaris">{question.section}</Pill><Tag tone="ink">{question.difficulty}</Tag></div>
              <span className="font-mono text-[11px] text-ink-muted">{index + 1} / {questions.length}</span>
            </div>
            <Progress value={((index + 1) / questions.length) * 100} tone="polaris" height="h-1 mt-4" />
            {question.passage && (listening
              ? <ListeningExamPlayer key={question.id} script={question.passage} questionId={question.id} lang={lang} />
              : <div className="mt-6 rounded-2xl border border-nova-500/20 bg-nova-500/[0.06] p-4 text-[13px] leading-[1.75] text-ink-dim">{question.passage}</div>)}
            <h3 className="mt-6 text-[17px] font-semibold leading-relaxed text-ink">{question.prompt}</h3>
            <div className="mt-4 grid gap-2.5">
              {question.options.map((option, optionIndex) => {
                const selected = answers[question.id] === optionIndex;
                return (
                  <button key={`${question.id}-${optionIndex}`} onClick={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} className={cn("group flex items-start gap-3 rounded-xl border px-3.5 py-3 text-left transition", selected ? "border-polaris-500 bg-polaris-500/[0.09]" : "border-ink-faint/20 bg-bg/40 hover:border-polaris-500/40")}>
                    <span className={cn("inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold", selected ? "border-polaris-500 bg-polaris-500 text-white" : "border-ink-faint/30 text-ink-muted")}>{String.fromCharCode(65 + optionIndex)}</span>
                    <span className="pt-0.5 text-[12.5px] leading-relaxed text-ink">{option}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex items-center justify-between gap-3">
              <Btn variant="ghost" disabled={index === 0} onClick={() => setIndex((value) => value - 1)}>{bn ? "আগের প্রশ্ন" : "Previous"}</Btn>
              {index < questions.length - 1
                ? <Btn variant="accent" disabled={answers[question.id] === undefined} onClick={() => setIndex((value) => value + 1)}>{bn ? "পরের প্রশ্ন" : "Next question"} <Icon.arrow size={13} /></Btn>
                : <Btn variant="accent" disabled={answers[question.id] === undefined || busy} onClick={() => void grade()}>{bn ? "Gemma দিয়ে মূল্যায়ন করুন" : "Grade with Gemma"} <Icon.check size={13} /></Btn>}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

type VideoRecommendation = LearningVideo & {
  reason: string;
};

function videosFor(exam: "IELTS" | "SAT", section: string): LearningVideo[] {
  return LEARNING_VIDEOS.filter((video) => video.exam === exam && video.topic === section);
}

export function GemmaVideoLearning({ lang }: { lang: Lang }) {
  const bn = lang === "bn";
  const tr = (value: string) => bn ? translateUiText(value) : value;
  const [exam, setExam] = useState<"IELTS" | "SAT">("IELTS");
  const sections = exam === "IELTS" ? IELTS_SECTIONS : SAT_SECTIONS;
  const [section, setSection] = useState<string>("Listening");
  const initialVideo = videosFor("IELTS", "Listening")[0];
  const [selected, setSelected] = useState<LearningVideo>(initialVideo);
  const [playerVersion, setPlayerVersion] = useState(0);
  const [recommendations, setRecommendations] = useState<VideoRecommendation[]>([]);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [busy, setBusy] = useState(false);

  const defaults = useMemo(() => videosFor(exam, section), [exam, section]);
  const visibleVideos: VideoRecommendation[] = recommendations.length
    ? recommendations
    : defaults.slice(0, 2).map((video) => ({ ...video, reason: bn ? "এই বিভাগের জন্য আগে থেকে যাচাই করা পাঠ।" : "A verified starter lesson for this section." }));

  const chooseVideo = (video: LearningVideo) => {
    setSelected(video);
    setPlayerVersion((value) => value + 1);
  };

  const chooseSection = (nextSection: string, nextExam = exam) => {
    setSection(nextSection);
    const first = videosFor(nextExam, nextSection)[0];
    if (first) setSelected(first);
    setRecommendations([]);
    setTrace(null);
    setPlayerVersion(0);
  };

  const refresh = async () => {
    setBusy(true);
    try {
      const result = await studioPost<{ recommendations: VideoRecommendation[] } & Trace>({ kind: "videos", exam, section }, lang);
      setRecommendations(result.recommendations);
      setTrace(result);
      if (result.recommendations[0]) chooseVideo(result.recommendations[0]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
      <Card className="overflow-hidden border border-ink-faint/15">
        <div className="aspect-video bg-[#0b0908]">
          <iframe key={`${selected.youtubeId}-${playerVersion}`} title={selected.title} src={`https://www.youtube-nocookie.com/embed/${selected.youtubeId}?rel=0${playerVersion ? "&autoplay=1" : ""}`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2"><Pill tone="rose">{selected.exam}</Pill><Tag tone="ink">{tr(selected.topic)}</Tag><span className="ml-auto text-[10.5px] text-ink-muted">{tr(selected.duration)}</span></div>
          <h2 className="mt-3 font-serif text-[22px] font-bold text-ink">{tr(selected.title)}</h2>
          <p className="mt-1 text-[11.5px] text-ink-muted">{selected.source}</p>
        </div>
      </Card>
      <div className="space-y-4">
        <Card className="border border-ink-faint/15 p-4">
          <div className="flex items-center justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "Gemma পাঠ অনুসন্ধান" : "Gemma lesson finder"}</div><h3 className="mt-1 font-serif text-[19px] font-bold text-ink">{bn ? "নতুন প্রাসঙ্গিক পাঠ খুঁজুন" : "Find fresh related content"}</h3></div><ModelTrace trace={trace} /></div>
          <Segmented value={exam} options={["IELTS", "SAT"]} onChange={(value) => { const next = value as "IELTS" | "SAT"; setExam(next); chooseSection(next === "IELTS" ? "Listening" : "Reading and Writing", next); }} />
          <div className="mt-3 flex flex-wrap gap-1.5">{sections.map((item) => <button key={item} onClick={() => chooseSection(item)} className={cn("rounded-full border px-3 py-1.5 text-[10.5px] font-semibold transition", item === section ? "border-polaris-500 bg-polaris-500 text-white" : "border-ink-faint/20 text-ink-dim hover:border-polaris-500/40")}>{tr(item)}</button>)}</div>
          <Btn className="mt-4 w-full" variant="accent" disabled={busy} onClick={() => void refresh()} icon={<Icon.spark size={13} />}>{busy ? (bn ? "Gemma খুঁজছে…" : "Gemma is searching…") : (bn ? "Gemma দিয়ে হালনাগাদ করুন" : "Refresh with Gemma")}</Btn>
        </Card>
        <Card className="max-h-[390px] space-y-2 overflow-y-auto border border-ink-faint/15 p-3">
          {visibleVideos.map((item, index) => (
            <motion.button type="button" key={`${item.id}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} onClick={() => chooseVideo(item)} className={cn("block w-full rounded-xl border bg-bg/40 p-3 text-left transition hover:border-polaris-500/40 hover:bg-polaris-500/[0.04]", selected.youtubeId === item.youtubeId ? "border-polaris-500/45 bg-polaris-500/[0.06]" : "border-ink-faint/15")}>
              <div className="flex items-start gap-3"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-rose-500/10 text-rose-500"><Icon.play size={12} /></span><span className="min-w-0"><span className="block text-[12px] font-semibold leading-snug text-ink">{tr(item.title)}</span><span className="mt-1 block text-[10px] text-ink-muted">{item.source}</span><span className="mt-1 block text-[10.5px] leading-relaxed text-ink-dim">{item.reason}</span></span></div>
            </motion.button>
          ))}
        </Card>
      </div>
    </div>
  );
}
type KnowledgeNote = {
  id: string;
  title: string;
  content: string;
  gemmaSummary: string;
  updatedAt: string;
};

const NOTES_KEY = "polaris.knowledge.notes.v1";

function loadNotes(): KnowledgeNote[] {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY) || "[]") as KnowledgeNote[]; } catch { return []; }
}

export function GemmaNotesStudio({ lang }: { lang: Lang }) {
  const bn = lang === "bn";
  const [notes, setNotes] = useState<KnowledgeNote[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setNotes(loadNotes()); }, []);
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch {} }, [notes]);

  const save = async () => {
    if (title.trim().length < 2 || content.trim().length < 5) return;
    setBusy(true);
    try {
      const result = await studioPost<{ text: string }>({ kind: "note", title, content, feedback }, lang);
      setNotes((current) => [{ id: crypto.randomUUID(), title: title.trim(), content: content.trim(), gemmaSummary: result.text, updatedAt: new Date().toISOString() }, ...current]);
      setTitle("");
      setContent("");
      setFeedback("");
    } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[0.78fr_1.22fr]">
      <Card className="border border-ink-faint/15 p-5">
        <Pill tone="nova"><Icon.spark size={11} /> {bn ? "Gemma জ্ঞানভান্ডার" : "Gemma knowledge memory"}</Pill>
        <h2 className="mt-3 font-serif text-[23px] font-bold text-ink">{bn ? "প্রতিক্রিয়া থেকে নোট তৈরি করুন" : "Turn feedback into a reusable note"}</h2>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-dim">{bn ? "আপনার নোট এই ব্রাউজারে থাকে। Gemma এটিকে সারাংশ, মূল ধারণা ও পরবর্তী কাজে সাজায়।" : "Your notes stay in this browser. Gemma turns them into a summary, key concepts, and next actions."}</p>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={bn ? "নোটের শিরোনাম" : "Note title"} className="mt-4 h-10 w-full rounded-xl border border-ink-faint/20 bg-bg px-3 text-[12.5px] text-ink outline-none focus:border-polaris-500" />
        <textarea value={content} onChange={(event) => setContent(event.target.value)} rows={6} placeholder={bn ? "যা শিখলেন বা মনে রাখতে চান…" : "What did you learn or want to remember?"} className="mt-2 w-full resize-y rounded-xl border border-ink-faint/20 bg-bg px-3 py-3 text-[12.5px] leading-relaxed text-ink outline-none focus:border-polaris-500" />
        <textarea value={feedback} onChange={(event) => setFeedback(event.target.value)} rows={3} placeholder={bn ? "Gemma-এর প্রতিক্রিয়া এখানে দিন (ঐচ্ছিক)" : "Paste Gemma feedback (optional)"} className="mt-2 w-full resize-y rounded-xl border border-ink-faint/20 bg-bg px-3 py-3 text-[12px] leading-relaxed text-ink outline-none focus:border-polaris-500" />
        <Btn className="mt-3 w-full" variant="accent" disabled={busy || title.trim().length < 2 || content.trim().length < 5} onClick={() => void save()}>{busy ? (bn ? "Gemma সাজাচ্ছে…" : "Gemma is structuring…") : (bn ? "নোট সংরক্ষণ ও বিশ্লেষণ করুন" : "Save and analyze note")}</Btn>
      </Card>
      <div className="grid content-start gap-3 md:grid-cols-2">
        {notes.length === 0 && <Card className="col-span-full grid min-h-[260px] place-items-center border border-dashed border-ink-faint/25 p-8 text-center"><div><h3 className="font-serif text-[21px] font-bold text-ink">{bn ? "জ্ঞানভান্ডার এখন খালি" : "Your knowledge vault is empty"}</h3><p className="mt-2 text-[12px] text-ink-dim">{bn ? "মক পরীক্ষার প্রতিক্রিয়া, রচনার অন্তর্দৃষ্টি বা রোডম্যাপ গবেষণা থেকে প্রথম নোট তৈরি করুন।" : "Create the first note from mock feedback, essay insight, or roadmap research."}</p></div></Card>}
        {notes.map((note) => (
          <Card key={note.id} className="border border-ink-faint/15 p-4">
            <div className="flex items-start justify-between gap-3"><h3 className="font-serif text-[17px] font-bold text-ink">{note.title}</h3><button onClick={() => setNotes((current) => current.filter((item) => item.id !== note.id))} className="text-ink-muted hover:text-signal-rose"><Icon.close size={12} /></button></div>
            <p className="mt-2 line-clamp-4 text-[11.5px] leading-relaxed text-ink-dim">{note.content}</p>
            <div className="mt-3 border-t border-ink-faint/10 pt-3"><MarkdownMessage className="text-[11.5px]" text={note.gemmaSummary} theme="light" /></div>
          </Card>
        ))}
      </div>
    </div>
  );
}

const ESSAY_KEY = "polaris.essay.workspace.v1";
const ESSAY_DRAFTS_KEY = "polaris.essay.drafts.v2";

type EssayDraft = {
  id: string;
  title: string;
  prompt: string;
  draft: string;
  sourceLanguage: "bn" | "en" | "mixed";
  updatedAt: string;
};

type ScannedEssay = {
  base64: string;
  mimeType: "image/jpeg";
  preview: string;
};

async function optimizeEssayImage(file: File): Promise<ScannedEssay> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Please use a JPEG, PNG, or WebP image.");
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new window.Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("The image could not be opened."));
    element.src = dataUrl;
  });
  const longest = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, 1800 / longest);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image preparation is not available.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => value ? resolve(value) : reject(new Error("The image could not be prepared.")), "image/jpeg", 0.86);
  });
  const optimizedUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("The prepared image could not be read."));
    reader.readAsDataURL(blob);
  });
  const base64 = optimizedUrl.split(",")[1] || "";
  if (base64.length > 3_800_000) {
    throw new Error("The image is still too large. Crop it to the handwritten page and try again.");
  }
  return { base64, mimeType: "image/jpeg", preview: URL.createObjectURL(blob) };
}

export function GemmaEssayStudio({ lang }: { lang: Lang }) {
  const bn = lang === "bn";
  const [initialBengali] = useState(() => lang === "bn");
  const [drafts, setDrafts] = useState<EssayDraft[]>([]);
  const [activeId, setActiveId] = useState("");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [draft, setDraft] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState<"bn" | "en" | "mixed">("en");
  const [response, setResponse] = useState("");
  const [mode, setMode] = useState<"feedback" | "refine" | "outline">("feedback");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [savedAt, setSavedAt] = useState("");
  const [scan, setScan] = useState<ScannedEssay | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState("");
  const [uncertainText, setUncertainText] = useState("");
  const [translation, setTranslation] = useState("");
  const [translationBusy, setTranslationBusy] = useState(false);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(ESSAY_DRAFTS_KEY) || "[]") as EssayDraft[];
      const legacy = JSON.parse(localStorage.getItem(ESSAY_KEY) || "{}") as { prompt?: string; draft?: string };
      const initial = stored.length
        ? stored
        : [{
            id: crypto.randomUUID(),
            title: initialBengali ? "আমার রচনা" : "My essay",
            prompt: legacy.prompt || "",
            draft: legacy.draft || "",
            sourceLanguage: "en" as const,
            updatedAt: new Date().toISOString(),
          }];
      const first = initial[0];
      setDrafts(initial);
      setActiveId(first.id);
      setTitle(first.title);
      setPrompt(first.prompt);
      setDraft(first.draft);
      setSourceLanguage(first.sourceLanguage);
      setHydrated(true);
    } catch {
      const first: EssayDraft = {
        id: crypto.randomUUID(),
        title: initialBengali ? "আমার রচনা" : "My essay",
        prompt: "",
        draft: "",
        sourceLanguage: "en",
        updatedAt: new Date().toISOString(),
      };
      setDrafts([first]);
      setActiveId(first.id);
      setTitle(first.title);
      setHydrated(true);
    }
  }, [initialBengali]);

  useEffect(() => {
    if (!hydrated || !activeId) return;
    const timer = window.setTimeout(() => {
      setDrafts((current) => {
        const updatedAt = new Date().toISOString();
        const next = current.some((item) => item.id === activeId)
          ? current.map((item) => item.id === activeId ? { ...item, title: title.trim() || (bn ? "শিরোনামহীন রচনা" : "Untitled essay"), prompt, draft, sourceLanguage, updatedAt } : item)
          : [{ id: activeId, title: title.trim() || (bn ? "শিরোনামহীন রচনা" : "Untitled essay"), prompt, draft, sourceLanguage, updatedAt }, ...current];
        try { localStorage.setItem(ESSAY_DRAFTS_KEY, JSON.stringify(next)); } catch {}
        setSavedAt(updatedAt);
        return next;
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [activeId, bn, draft, hydrated, prompt, sourceLanguage, title]);

  useEffect(() => () => {
    if (scan?.preview) URL.revokeObjectURL(scan.preview);
  }, [scan]);

  const selectDraft = (item: EssayDraft) => {
    setActiveId(item.id);
    setTitle(item.title);
    setPrompt(item.prompt);
    setDraft(item.draft);
    setSourceLanguage(item.sourceLanguage);
    setResponse("");
    setTranslation("");
    setUncertainText("");
  };

  const newDraft = () => {
    const item: EssayDraft = {
      id: crypto.randomUUID(),
      title: bn ? "নতুন রচনা" : "New essay",
      prompt: "",
      draft: "",
      sourceLanguage: bn ? "bn" : "en",
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => {
      const next = [item, ...current];
      try { localStorage.setItem(ESSAY_DRAFTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    selectDraft(item);
  };

  const saveDraft = () => {
    const updatedAt = new Date().toISOString();
    setDrafts((current) => {
      const item: EssayDraft = { id: activeId || crypto.randomUUID(), title: title.trim() || (bn ? "শিরোনামহীন রচনা" : "Untitled essay"), prompt, draft, sourceLanguage, updatedAt };
      const next = current.some((entry) => entry.id === item.id)
        ? current.map((entry) => entry.id === item.id ? item : entry)
        : [item, ...current];
      try { localStorage.setItem(ESSAY_DRAFTS_KEY, JSON.stringify(next)); } catch {}
      if (!activeId) setActiveId(item.id);
      return next;
    });
    setSavedAt(updatedAt);
  };

  const deleteDraft = (id: string) => {
    setDrafts((current) => {
      const remaining = current.filter((item) => item.id !== id);
      const next = remaining.length ? remaining : [{
        id: crypto.randomUUID(),
        title: bn ? "নতুন রচনা" : "New essay",
        prompt: "",
        draft: "",
        sourceLanguage: bn ? "bn" as const : "en" as const,
        updatedAt: new Date().toISOString(),
      }];
      try { localStorage.setItem(ESSAY_DRAFTS_KEY, JSON.stringify(next)); } catch {}
      if (id === activeId) window.setTimeout(() => selectDraft(next[0]), 0);
      return next;
    });
  };

  const clearImage = () => {
    setScan(null);
    setScanError("");
    setUncertainText("");
    setTranslation("");
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const chooseImage = async (file?: File) => {
    if (!file) return;
    setScanBusy(true);
    setScanError("");
    try {
      const optimized = await optimizeEssayImage(file);
      if (scan?.preview) URL.revokeObjectURL(scan.preview);
      setScan(optimized);
      setTranslation("");
      setUncertainText("");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The image could not be prepared.";
      setScanError(bn
        ? message
            .replace("Please use a JPEG, PNG, or WebP image.", "JPEG, PNG বা WebP ছবি ব্যবহার করুন।")
            .replace("The image is still too large. Crop it to the handwritten page and try again.", "ছবিটি এখনও বড়। শুধু হাতের লেখা পৃষ্ঠা রেখে ক্রপ করে আবার চেষ্টা করুন।")
        : message);
    } finally {
      setScanBusy(false);
    }
  };

  const extractHandwriting = async () => {
    if (!scan) return;
    setScanBusy(true);
    setScanError("");
    try {
      const result = await studioPost<{
        text: string;
        title: string;
        detectedLanguage: "bn" | "en" | "mixed";
        uncertainText: string;
      } & Trace>({
        kind: "essay-ocr",
        imageBase64: scan.base64,
        mimeType: scan.mimeType,
      }, lang);
      setTitle(result.title || (result.detectedLanguage === "bn" ? "হাতের লেখা রচনা" : "Handwritten essay"));
      setDraft(result.text);
      setSourceLanguage(result.detectedLanguage);
      setUncertainText(result.uncertainText);
      setTranslation("");
      setResponse("");
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : (bn ? "Gemma হাতের লেখা পড়তে পারেনি।" : "Gemma could not read the handwriting."));
    } finally {
      setScanBusy(false);
    }
  };

  const translateToEnglish = async () => {
    if (draft.trim().length < 5) return;
    setTranslationBusy(true);
    setScanError("");
    try {
      const result = await studioPost<{ text: string } & Trace>({
        kind: "essay-translate",
        text: draft,
        fromLanguage: sourceLanguage,
      }, lang);
      setTranslation(result.text);
    } catch (cause) {
      setScanError(cause instanceof Error ? cause.message : (bn ? "Gemma অনুবাদ করতে পারেনি।" : "Gemma could not translate the essay."));
    } finally {
      setTranslationBusy(false);
    }
  };

  const saveEnglishCopy = () => {
    if (!translation.trim()) return;
    const item: EssayDraft = {
      id: crypto.randomUUID(),
      title: "English translation",
      prompt,
      draft: translation.trim(),
      sourceLanguage: "en",
      updatedAt: new Date().toISOString(),
    };
    setDrafts((current) => {
      const next = [item, ...current];
      try { localStorage.setItem(ESSAY_DRAFTS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    selectDraft(item);
  };

  const run = async () => {
    setBusy(true);
    try {
      const notes = loadNotes().slice(0, 8).map((item) => `${item.title}: ${item.gemmaSummary || item.content}`);
      const result = await studioPost<{ text: string }>({ kind: "essay", prompt: prompt || "Personal statement", draft, mode, notes }, lang);
      setResponse(result.text);
    } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <Card className="relative overflow-hidden border border-aurora-500/20 bg-gradient-to-br from-aurora-500/[0.06] via-paper-card to-polaris-500/[0.05] p-5">
        <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-aurora-500/10 blur-3xl" />
        <div className="relative grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
          <div>
            <Pill tone="aurora"><Icon.spark size={11} /> {bn ? "Gemma হাতের লেখা স্ক্যানার" : "Gemma handwriting scanner"}</Pill>
            <h2 className="mt-3 font-serif text-[23px] font-bold text-ink">{bn ? "ছবি থেকে সম্পাদনাযোগ্য রচনা" : "From handwriting to an editable essay"}</h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">{bn ? "বাংলা, ইংরেজি বা মিশ্র হাতের লেখা ছবি তুলুন বা আপলোড করুন। Gemma মূল ভাষা ও অনুচ্ছেদ ঠিক রেখে লেখাটি তুলবে।" : "Capture or upload Bengali, English, or mixed handwriting. Gemma preserves the original language, wording, and paragraphs."}</p>
            <label className="mt-4 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-aurora-500/35 bg-bg/45 p-4 text-center transition hover:border-aurora-500/70 hover:bg-aurora-500/[0.05]">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-aurora-500/15 text-lg text-aurora-600">↑</span>
              <span className="mt-2 text-[12px] font-semibold text-ink">{scan ? (bn ? "অন্য ছবি বেছে নিন" : "Choose another image") : (bn ? "স্ক্যান করুন বা ছবি আপলোড করুন" : "Scan or upload a page")}</span>
              <span className="mt-1 text-[9.5px] text-ink-muted">JPEG, PNG, WebP</span>
              <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(event) => void chooseImage(event.target.files?.[0])} />
            </label>
            <p className="mt-2 text-[9.5px] leading-relaxed text-ink-muted">{bn ? "ছবি সংরক্ষণ করা হয় না। সক্রিয় extraction অনুরোধে এটি শুধু Gemma-কে পাঠানো হয়।" : "The image is not stored. It is sent to Gemma only for the active extraction request."}</p>
          </div>
          <div className="rounded-2xl border border-ink-faint/15 bg-bg/50 p-4">
            {scan ? (
              <div className="grid gap-3 md:grid-cols-[190px_1fr]">
                <div className="relative">
                  <Image src={scan.preview} alt={bn ? "আপলোড করা হাতের লেখা" : "Uploaded handwriting"} width={190} height={208} unoptimized className="h-52 w-full rounded-xl object-contain bg-white/90 ring-1 ring-inset ring-ink-faint/10" />
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={scanBusy}
                    aria-label={bn ? "আপলোড করা ছবি মুছুন" : "Remove uploaded image"}
                    title={bn ? "ছবি মুছুন" : "Remove image"}
                    className="absolute right-2 top-2 inline-flex h-7 items-center gap-1 rounded-full bg-ink/85 px-2.5 text-[9.5px] font-semibold text-paper shadow-sm backdrop-blur transition hover:bg-signal-rose disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Icon.close size={10} />
                    <span>{bn ? "মুছুন" : "Remove"}</span>
                  </button>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Tag tone="aurora">{sourceLanguage === "bn" ? "বাংলা" : sourceLanguage === "mixed" ? (bn ? "মিশ্র ভাষা" : "Mixed") : "English"}</Tag>
                    {uncertainText && <Tag tone="nova">{bn ? "অস্পষ্ট অংশ চিহ্নিত" : "Unclear text marked"}</Tag>}
                  </div>
                  <Btn className="mt-3 w-full" variant="accent" disabled={scanBusy} onClick={() => void extractHandwriting()} icon={<Icon.spark size={13} />}>{scanBusy ? (bn ? "Gemma পড়ছে…" : "Gemma is reading…") : (bn ? "Gemma দিয়ে লেখা তুলুন" : "Extract with Gemma")}</Btn>
                  {(sourceLanguage === "bn" || sourceLanguage === "mixed") && draft.trim() && (
                    <Btn className="mt-2 w-full" variant="outline" disabled={translationBusy} onClick={() => void translateToEnglish()}>{translationBusy ? (bn ? "ইংরেজিতে অনুবাদ হচ্ছে…" : "Translating to English…") : (bn ? "Gemma দিয়ে ইংরেজিতে রূপান্তর" : "Convert to English with Gemma")}</Btn>
                  )}
                  {uncertainText && <p className="mt-3 rounded-xl bg-nova-500/[0.08] p-2.5 text-[10.5px] leading-relaxed text-ink-dim">{uncertainText}</p>}
                  {scanError && <p className="mt-3 text-[10.5px] text-signal-rose">{scanError}</p>}
                </div>
              </div>
            ) : (
              <div className="grid min-h-64 place-items-center text-center">
                <div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-aurora-500/[0.09] text-aurora-600"><Icon.spark size={22} /></div><p className="mt-3 max-w-sm text-[11.5px] leading-relaxed text-ink-dim">{bn ? "পরিষ্কার আলোতে পুরো পৃষ্ঠা সোজা করে ছবি তুলুন। Gemma বাংলা অক্ষর, ইংরেজি লেখা ও মিশ্র ভাষা শনাক্ত করবে।" : "Photograph the full page straight-on in clear light. Gemma detects Bengali script, English writing, and mixed-language essays."}</p></div>
              </div>
            )}
          </div>
        </div>
        {translation && (
          <div className="relative mt-4 rounded-2xl border border-polaris-500/20 bg-bg/55 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[12.5px] font-semibold text-ink">{bn ? "Gemma-এর ইংরেজি অনুবাদ" : "Gemma English translation"}</h3><div className="flex gap-2"><Btn size="sm" variant="outline" onClick={() => { setDraft(translation); setSourceLanguage("en"); }}>{bn ? "বর্তমান খসড়ায় ব্যবহার" : "Use in current draft"}</Btn><Btn size="sm" variant="primary" onClick={saveEnglishCopy}>{bn ? "নতুন কপি হিসেবে সংরক্ষণ" : "Save as a new copy"}</Btn></div></div>
            <textarea value={translation} onChange={(event) => setTranslation(event.target.value)} rows={8} className="mt-3 w-full resize-y rounded-xl border border-ink-faint/15 bg-bg px-3 py-3 text-[12.5px] leading-[1.7] text-ink outline-none focus:border-polaris-500" />
          </div>
        )}
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="border border-ink-faint/15 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><Pill tone="rose">{bn ? "দিনে দিনে খসড়া" : "Day-by-day drafts"}</Pill><h2 className="mt-3 font-serif text-[23px] font-bold text-ink">{bn ? "রচনা কর্মক্ষেত্র" : "Essay Workspace"}</h2></div><span className="text-[10.5px] text-ink-muted">{draft.trim() ? draft.trim().split(/\s+/).length : 0} {bn ? "শব্দ" : "words"}</span></div>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {drafts.map((item) => <button key={item.id} onClick={() => selectDraft(item)} className={cn("group flex min-w-[150px] items-center gap-2 rounded-xl border px-3 py-2 text-left transition", item.id === activeId ? "border-polaris-500 bg-polaris-500/[0.08]" : "border-ink-faint/15 hover:border-polaris-500/40")}><span className="min-w-0 flex-1 truncate text-[10.5px] font-semibold text-ink">{item.title}</span><span onClick={(event) => { event.stopPropagation(); deleteDraft(item.id); }} className="text-[10px] text-ink-muted opacity-0 transition group-hover:opacity-100">×</span></button>)}
            <button onClick={newDraft} className="min-w-[110px] rounded-xl border border-dashed border-polaris-500/35 px-3 py-2 text-[10.5px] font-semibold text-polaris-600 hover:bg-polaris-500/[0.05]">+ {bn ? "নতুন খসড়া" : "New draft"}</button>
          </div>
          <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={bn ? "খসড়ার শিরোনাম" : "Draft title"} className="mt-3 h-10 w-full rounded-xl border border-ink-faint/20 bg-bg px-3 text-[12.5px] font-semibold text-ink outline-none focus:border-polaris-500" />
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={2} placeholder={bn ? "রচনার বিষয় বা প্রশ্ন" : "Essay prompt or question"} className="mt-2 w-full resize-y rounded-xl border border-ink-faint/20 bg-bg px-3 py-3 text-[12px] leading-relaxed text-ink outline-none focus:border-polaris-500" />
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={16} placeholder={bn ? "নিজের ভাষায় খসড়া লিখুন। Gemma আপনার কণ্ঠ ও তথ্য বজায় রেখে সাহায্য করবে।" : "Write in your own voice. Gemma will help while preserving your facts and authorship."} className="mt-2 w-full resize-y rounded-xl border border-ink-faint/20 bg-bg px-3 py-3 text-[13px] leading-[1.75] text-ink outline-none focus:border-polaris-500" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[10.5px] leading-relaxed text-ink-muted">{bn ? "প্রতিটি খসড়া এই ব্রাউজারে আলাদাভাবে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।" : "Every draft autosaves separately in this browser."}</p><Btn size="sm" variant="outline" onClick={saveDraft}>{bn ? "এখন সংরক্ষণ করুন" : "Save now"}</Btn></div>
          {savedAt && <p className="mt-1 text-right text-[9px] text-aurora-600">{bn ? "সংরক্ষিত" : "Saved"} · {new Date(savedAt).toLocaleTimeString(lang === "bn" ? "bn-BD" : "en-US", { hour: "2-digit", minute: "2-digit" })}</p>}
        </Card>
        <Card className="border border-ink-faint/15 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "নৈতিক Gemma পরামর্শক" : "Ethical Gemma coach"}</div><h3 className="mt-1 font-serif text-[21px] font-bold text-ink">{bn ? "আপনার কণ্ঠ, আরও পরিষ্কার" : "Your voice, made clearer"}</h3></div></div>
          <Segmented value={mode} options={["feedback", "refine", "outline"]} labels={bn ? ["প্রতিক্রিয়া", "পরিমার্জন", "রূপরেখা"] : undefined} onChange={(value) => setMode(value as typeof mode)} />
          <Btn className="mt-4 w-full" variant="accent" disabled={busy || draft.trim().length < 20} onClick={() => void run()} icon={<Icon.spark size={13} />}>{busy ? (bn ? "Gemma বিশ্লেষণ করছে…" : "Gemma is reviewing…") : (bn ? "Gemma দিয়ে উন্নত করুন" : "Improve with Gemma")}</Btn>
          <div className="mt-4 min-h-[420px] rounded-2xl border border-ink-faint/15 bg-bg/35 p-4">
            {response ? <MarkdownMessage className="text-[12.5px]" text={response} theme="light" /> : <div className="grid min-h-[380px] place-items-center text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-polaris-500/[0.08] text-polaris-500"><Icon.spark size={22} /></div><p className="mt-4 max-w-sm text-[12px] leading-relaxed text-ink-dim">{bn ? "Gemma আপনার সংরক্ষিত নোটের সঙ্গে খসড়া মিলিয়ে নির্দিষ্টতা, আত্মবিশ্লেষণ, কাঠামো ও নিজস্ব কণ্ঠ উন্নত করবে।" : "Gemma can connect your saved knowledge notes with the draft to improve specificity, reflection, structure, and voice."}</p></div></div>}
          </div>
        </Card>
      </div>
    </div>
  );
}

export function GemmaKeyCard({ lang, compact = false }: { lang: Lang; compact?: boolean }) {
  const bn = lang === "bn";
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSaved(Boolean(getBrowserGemmaKey())); }, []);
  const save = () => { setBrowserGemmaKey(value); setSaved(Boolean(value.trim())); setValue(""); };
  return (
    <Card className={cn("border border-aurora-500/20 bg-aurora-500/[0.045]", compact ? "p-3.5" : "p-5")}>
      <div className="flex items-start gap-3"><span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aurora-500/15 text-aurora-600">✦</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[12.5px] font-semibold text-ink">{bn ? "নিজের Gemma API key" : "Use your Gemma API key"}</h3><Pill tone={saved ? "aurora" : "ink"}>{saved ? (bn ? "এই সেশনে সক্রিয়" : "Active this session") : (bn ? "ঐচ্ছিক" : "Optional")}</Pill></div><p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{bn ? "শুধু এই ব্রাউজার ট্যাবের সেশন স্টোরেজে থাকে। সার্ভারে সংরক্ষণ বা লগ করা হয় না।" : "Stored only in this browser tab's session storage. It is never saved or logged by Polaris."}</p><div className="mt-3 flex gap-2"><input type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder={saved ? "••••••••••••••••" : "Gemma API key"} className="h-9 min-w-0 flex-1 rounded-lg border border-ink-faint/20 bg-bg px-3 text-[11.5px] text-ink outline-none focus:border-aurora-500" /><Btn size="sm" variant="outline" onClick={save}>{value.trim() ? (bn ? "ব্যবহার করুন" : "Use key") : (bn ? "মুছুন" : "Clear")}</Btn></div></div></div>
    </Card>
  );
}

function ModelTrace({ trace }: { trace: Trace | null }) {
  return <span className="rounded-full border border-ink-faint/15 bg-bg/50 px-2 py-1 text-[9px] font-semibold text-ink-muted">{trace?.source === "gemma4" ? `Gemma 4 · ${trace.model}` : "Gemma 4 ready"}</span>;
}

function Segmented({ value, options, labels, onChange }: { value: string; options: readonly string[]; labels?: readonly string[]; onChange: (value: string) => void }) {
  return (
    <div className="mt-4 flex rounded-xl border border-ink-faint/20 bg-bg p-1">
      {options.map((option, index) => <button key={option} onClick={() => onChange(option)} className={cn("flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold capitalize transition", value === option ? "bg-ink text-paper shadow-sm" : "text-ink-dim hover:text-ink")}>{labels?.[index] || option}</button>)}
    </div>
  );
}
