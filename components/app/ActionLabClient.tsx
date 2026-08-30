"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Btn, Card, Icon, Pill, Tag } from "@/components/app/ui";
import { useLang } from "@/lib/i18n/LangProvider";
import { DEFAULT_ROUTINE, LEARNING_VIDEOS } from "@/lib/action-lab/data";
import type {
  ActionLabTab,
  DecisionResult,
  EvidenceResult,
  LearningVideo,
  RoutineBlock,
  RoutineCategory,
  RoutineSuggestion,
} from "@/lib/action-lab/types";
import { cn } from "@/lib/cn";
import { gemmaHeaders } from "@/lib/gemma/browser-key";
import { GemmaKeyCard } from "@/components/app/GemmaKeyCard";

const ActionLabExamStudio = dynamic(() => import("@/components/app/ActionLabExamStudio").then((module) => module.ActionLabExamStudio), { loading: PanelLoading });
const GemmaEssayStudio = dynamic(() => import("@/components/app/GemmaStudioPanels").then((module) => module.GemmaEssayStudio), { loading: PanelLoading });
const GemmaNotesStudio = dynamic(() => import("@/components/app/GemmaStudioPanels").then((module) => module.GemmaNotesStudio), { loading: PanelLoading });
const GemmaVideoLearning = dynamic(() => import("@/components/app/GemmaStudioPanels").then((module) => module.GemmaVideoLearning), { loading: PanelLoading });

function PanelLoading() {
  return <div className="grid min-h-64 place-items-center rounded-2xl border border-ink-faint/15 bg-paper-card/60 text-[11px] text-ink-muted">Opening workspace…</div>;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

const PROOF_TYPES = [
  { value: "Project / portfolio", en: "Project / portfolio", bn: "প্রকল্প / পোর্টফোলিও", hintEn: "Builds, launches, and repositories", hintBn: "তৈরি কাজ, প্রকাশনা ও রিপোজিটরি", tone: "from-polaris-500/20 to-polaris-500/[0.04]" },
  { value: "Certificate / award", en: "Certificate / award", bn: "সনদ / পুরস্কার", hintEn: "Verified recognition", hintBn: "যাচাইযোগ্য স্বীকৃতি", tone: "from-nova-500/20 to-nova-500/[0.04]" },
  { value: "Score report", en: "Score report", bn: "স্কোর রিপোর্ট", hintEn: "Official test evidence", hintBn: "অফিসিয়াল পরীক্ষার প্রমাণ", tone: "from-aurora-500/20 to-aurora-500/[0.04]" },
  { value: "Reference letter", en: "Reference letter", bn: "সুপারিশপত্র", hintEn: "A credible third-party view", hintBn: "বিশ্বস্ত তৃতীয় পক্ষের মতামত", tone: "from-rose-500/20 to-rose-500/[0.04]" },
  { value: "Research / publication", en: "Research / publication", bn: "গবেষণা / প্রকাশনা", hintEn: "Methods, findings, and authorship", hintBn: "পদ্ধতি, ফলাফল ও লেখকত্ব", tone: "from-polaris-500/20 to-nova-500/[0.04]" },
  { value: "Community impact", en: "Community impact", bn: "সামাজিক প্রভাব", hintEn: "People reached and outcomes", hintBn: "উপকৃত মানুষ ও ফলাফল", tone: "from-aurora-500/20 to-polaris-500/[0.04]" },
] as const;

const COPY = {
  en: {
    eyebrow: "Polaris Action Lab",
    title: "Decide, prove, practise, repeat.",
    subtitle: "A living student operating system. Test a decision, turn claims into evidence, practise under pressure, and protect the time to follow through.",
    tabs: {
      decision: ["Decision Twin", "Stress-test the roadmap"],
      evidence: ["Evidence Graph", "Turn claims into proof"],
      exam: ["Exam Lab", "Mocks and AI practice"],
      routine: ["Smart Routine", "Gemma + manual planning"],
      learn: ["Video Learning", "Curated official lessons"],
      notes: ["Knowledge Notes", "Feedback becomes memory"],
      essay: ["Essay Studio", "Write, reflect, refine"],
    },
    gemmaReady: "Gemma 4 reasoning layer",
  },
  bn: {
    eyebrow: "Polaris অ্যাকশন ল্যাব",
    title: "সিদ্ধান্ত নিন, প্রমাণ গড়ুন, অনুশীলন করুন।",
    subtitle: "শিক্ষার্থীর জন্য একটি জীবন্ত কাজের ব্যবস্থা। সিদ্ধান্তের প্রভাব যাচাই করুন, দাবিকে প্রমাণে রূপ দিন, পরীক্ষার অনুশীলন করুন এবং কাজ শেষ করার সময় নিশ্চিত করুন।",
    tabs: {
      decision: ["ডিসিশন টুইন", "রোডম্যাপ যাচাই করুন"],
      evidence: ["প্রমাণের মানচিত্র", "দাবিকে প্রমাণে রূপ দিন"],
      exam: ["মক পরীক্ষা", "IELTS ও SAT অনুশীলন"],
      routine: ["স্মার্ট রুটিন", "Gemma ও ম্যানুয়াল পরিকল্পনা"],
      learn: ["ভিডিও লার্নিং", "নির্বাচিত অফিসিয়াল পাঠ"],
      notes: ["নলেজ নোট", "প্রতিক্রিয়া থেকে স্মৃতি"],
      essay: ["রচনা স্টুডিও", "লিখুন, ভাবুন, উন্নত করুন"],
    },
    gemmaReady: "Gemma 4 বিশ্লেষণ ব্যবস্থা",
  },
} as const;

const INITIAL_DECISION: DecisionResult = {
  summary: "Moving the SAT target forward makes testing the immediate constraint. Polaris protects the flagship project but reduces parallel work until the next diagnostic.",
  probabilityBefore: 41,
  probabilityAfter: 47,
  risk: "lower",
  changes: [
    { area: "Testing", before: "2 mixed blocks/week", after: "1 diagnostic + 3 targeted blocks", reason: "The new test date compresses the feedback cycle." },
    { area: "Project", before: "Two parallel deliverables", after: "One verifiable release", reason: "Protect evidence quality while test load rises." },
    { area: "Review", before: "Monthly score check", after: "Friday score recalculation", reason: "The roadmap needs faster evidence." },
  ],
  nextAction: "Take a 45-minute diagnostic tonight and tag every mistake by skill.",
  evidenceToCollect: "Diagnostic score, error log, and seven days of completed practice.",
  source: "deterministic-fallback",
  model: "none",
};

const INITIAL_EVIDENCE: EvidenceResult = {
  claim: "I built a student portal used by 120 learners.",
  proof: "Public repository, deployment analytics, and two teacher references.",
  verifiedSignal: "Technical execution with measurable adoption",
  gap: "Retention and learning outcomes are not yet measured.",
  nextAction: "Publish a one-page impact note with 30-day returning users and one before/after outcome.",
  verification: "Check repository history, analytics date range, and reference identity.",
  source: "deterministic-fallback",
  model: "none",
};

function postAction<T>(body: Record<string, unknown>): Promise<T> {
  return fetch("/api/action-lab", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...gemmaHeaders() },
    body: JSON.stringify(body),
  }).then(async (response) => {
    if (!response.ok) {
      const data = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(data.error || "Action Lab could not complete this request.");
    }
    return response.json() as Promise<T>;
  });
}

export function ActionLabClient() {
  const { lang } = useLang();
  const copy = COPY[lang];
  const [tab, setTab] = useState<ActionLabTab>("decision");
  useEffect(() => {
    const hashTab = window.location.hash.replace("#", "") as ActionLabTab;
    if (hashTab && Object.prototype.hasOwnProperty.call(copy.tabs, hashTab)) {
      setTab(hashTab);
      return;
    }
    const saved = window.sessionStorage.getItem("polaris.actionLab.tab") as ActionLabTab | null;
    if (saved && Object.prototype.hasOwnProperty.call(copy.tabs, saved)) setTab(saved);
  }, [copy.tabs]);
  const chooseTab = (id: ActionLabTab) => {
    setTab(id);
    window.history.replaceState(null, "", `#${id}`);
    try { window.sessionStorage.setItem("polaris.actionLab.tab", id); } catch {}
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      <style jsx global>{`
        .action-lab-grid {
          background-image:
            linear-gradient(rgba(196, 125, 78, .12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(196, 125, 78, .12) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, black, transparent);
        }
        .action-evidence-grid {
          background-image: radial-gradient(circle, rgba(196, 125, 78, .28) 1px, transparent 1px);
          background-size: 22px 22px;
          mask-image: radial-gradient(circle at center, black, transparent 82%);
        }
        .action-orbit {
          position: absolute;
          border: 1px solid rgba(196, 125, 78, .18);
          border-radius: 9999px;
          animation: action-orbit-spin 22s linear infinite;
        }
        .action-orbit::after {
          content: "";
          position: absolute;
          width: 7px;
          height: 7px;
          border-radius: 9999px;
          background: #C47D4E;
          box-shadow: 0 0 18px rgba(196, 125, 78, .7);
          top: 50%;
          left: -4px;
        }
        .action-orbit-one { width: 210px; height: 210px; }
        .action-orbit-two { width: 164px; height: 164px; animation-direction: reverse; animation-duration: 17s; }
        @keyframes action-orbit-spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[-10%] h-[420px] w-[420px] rounded-full bg-polaris-500/[0.10] blur-[100px]" />
        <div className="absolute top-[35%] -left-24 h-[320px] w-[320px] rounded-full bg-aurora-500/[0.08] blur-[90px]" />
        <div className="absolute inset-x-0 top-0 h-44 opacity-[0.16] action-lab-grid" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-polaris-500">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-polaris-500/10 text-polaris-500"><Icon.spark size={14} /></span>
              {copy.eyebrow}
            </div>
            <h1 className="max-w-3xl font-serif text-[34px] font-bold leading-[1.04] tracking-tight text-ink sm:text-[43px]">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-dim">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-aurora-500/25 bg-aurora-500/[0.08] px-3 py-2 text-[11px] font-medium text-aurora-700 dark:text-aurora-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-500" />
            </span>
            {copy.gemmaReady}
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-ink-faint/20 bg-paper-card/80 p-2 shadow-card backdrop-blur-xl md:grid-cols-4 xl:grid-cols-7">
          {(Object.keys(copy.tabs) as ActionLabTab[]).map((id) => {
            const [label, hint] = copy.tabs[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => chooseTab(id)}
                className={cn(
                  "relative rounded-xl px-3 py-3 text-left transition-colors",
                  tab === id ? "text-paper" : "text-ink-dim hover:bg-paper-deep/60 hover:text-ink",
                )}
              >
                {tab === id && (
                  <motion.span
                    layoutId="action-tab"
                    className="absolute inset-0 rounded-xl bg-ink shadow-pop"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative block text-[12.5px] font-semibold">{label}</span>
                <span className={cn("relative mt-0.5 hidden text-[10px] md:block", tab === id ? "text-paper/55" : "text-ink-muted")}>{hint}</span>
              </button>
            );
          })}
        </div>

        <details className="group mb-5 ml-auto max-w-xl rounded-2xl border border-aurora-500/15 bg-paper-card/65 p-2 open:shadow-card">
          <summary className="cursor-pointer list-none px-2 py-1 text-right text-[10.5px] font-semibold text-aurora-700 dark:text-aurora-100">
            {lang === "bn" ? "নিজের Gemma API key ব্যবহার করুন" : "Use your own Gemma API key"}
          </summary>
          <div className="mt-2"><GemmaKeyCard lang={lang} compact /></div>
        </details>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "decision" && <DecisionTwin lang={lang} />}
            {tab === "evidence" && <EvidenceGraph lang={lang} />}
            {tab === "exam" && <ActionLabExamStudio lang={lang} />}
            {tab === "routine" && <RoutineStudio lang={lang} />}
            {tab === "learn" && <GemmaVideoLearning lang={lang} />}
            {tab === "notes" && <GemmaNotesStudio lang={lang} />}
            {tab === "essay" && <GemmaEssayStudio lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function DecisionTwin({ lang }: { lang: "en" | "bn" }) {
  const bn = lang === "bn";
  const [event, setEvent] = useState("My SAT date moved six weeks earlier.");
  const [currentScore, setCurrentScore] = useState(1320);
  const [targetScore, setTargetScore] = useState(1500);
  const [weeklyHours, setWeeklyHours] = useState(14);
  const [budgetBdt, setBudgetBdt] = useState(180000);
  const [targetCountry, setTargetCountry] = useState("United States");
  const [result, setResult] = useState<DecisionResult>(INITIAL_DECISION);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await postAction<DecisionResult>({
        kind: "decision",
        event,
        currentScore,
        targetScore,
        weeklyHours,
        budgetBdt,
        targetCountry,
      });
      setResult(next);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not run the scenario.");
    } finally {
      setBusy(false);
    }
  };

  const presets = bn
    ? ["আমার SAT পরীক্ষা ছয় সপ্তাহ এগিয়ে এসেছে।", "আমার সাপ্তাহিক সময় ১৪ ঘণ্টা থেকে ৮ ঘণ্টা হয়েছে।", "আমি যুক্তরাষ্ট্রের বদলে কানাডাকে লক্ষ্য করতে চাই।"]
    : ["My SAT date moved six weeks earlier.", "My weekly study time dropped from 14 to 8 hours.", "I want to switch my target country from the US to Canada."];

  return (
    <div className="grid gap-4 xl:grid-cols-[0.88fr_1.45fr]">
      <Card className="relative overflow-hidden border border-ink-faint/15 p-5">
        <div className="absolute right-[-70px] top-[-70px] h-44 w-44 rounded-full border border-polaris-500/20" />
        <div className="absolute right-[-45px] top-[-45px] h-32 w-32 rounded-full border border-polaris-500/15" />
        <Pill tone="polaris"><Icon.spark size={11} /> {bn ? "পরিবর্তন লিখুন" : "Change a constraint"}</Pill>
        <h2 className="mt-3 font-serif text-[22px] font-bold text-ink">{bn ? "কী বদলেছে?" : "What changed?"}</h2>
        <textarea
          value={event}
          onChange={(e) => setEvent(e.target.value)}
          rows={3}
          className="mt-3 w-full resize-none rounded-xl border border-ink-faint/25 bg-bg/60 px-3.5 py-3 text-[13px] leading-relaxed text-ink outline-none transition focus:border-polaris-500"
          placeholder={bn ? "যেমন: আমার SAT পরীক্ষার তারিখ এগিয়ে এসেছে…" : "Example: My SAT test date moved earlier…"}
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((preset) => (
            <button key={preset} onClick={() => setEvent(preset)} className="rounded-full border border-ink-faint/20 px-2.5 py-1.5 text-[10.5px] text-ink-dim hover:border-polaris-500/40 hover:text-ink">
              {preset}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <NumberField label={bn ? "বর্তমান SAT" : "Current SAT"} value={currentScore} setValue={setCurrentScore} min={400} max={1600} step={10} />
          <NumberField label={bn ? "লক্ষ্য SAT" : "Target SAT"} value={targetScore} setValue={setTargetScore} min={400} max={1600} step={10} />
          <NumberField label={bn ? "সাপ্তাহিক ঘণ্টা" : "Hours / week"} value={weeklyHours} setValue={setWeeklyHours} min={1} max={80} step={1} />
          <NumberField label={bn ? "বাজেট (BDT)" : "Budget (BDT)"} value={budgetBdt} setValue={setBudgetBdt} min={0} max={10000000} step={10000} />
        </div>
        <label className="mt-3 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
          {bn ? "লক্ষ্য দেশ" : "Target country"}
          <select value={targetCountry} onChange={(e) => setTargetCountry(e.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-ink-faint/25 bg-bg px-3 text-[12.5px] normal-case tracking-normal text-ink outline-none">
            {["United States", "Canada", "United Kingdom", "Germany", "Australia"].map((country) => <option key={country}>{country}</option>)}
          </select>
        </label>
        <Btn onClick={() => void run()} disabled={busy || event.trim().length < 3} variant="accent" size="lg" className="mt-4 w-full" icon={<Icon.spark size={14} />}>
          {busy ? (bn ? "Gemma পরিকল্পনা পরীক্ষা করছে…" : "Gemma is stress-testing…") : (bn ? "পরিকল্পনার প্রভাব দেখুন" : "Run the Decision Twin")}
        </Btn>
        {error && <p className="mt-2 text-[11px] text-signal-rose">{error}</p>}
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden border border-ink-faint/15">
          <div className="grid md:grid-cols-[0.85fr_1.15fr]">
            <div className="relative flex min-h-[230px] items-center justify-center overflow-hidden border-b border-ink-faint/15 bg-[radial-gradient(circle_at_center,rgba(196,125,78,0.13),transparent_68%)] p-5 md:border-b-0 md:border-r">
              <div className="action-orbit action-orbit-one" />
              <div className="action-orbit action-orbit-two" />
              <div className="relative z-10 flex items-center gap-5">
                <ScoreOrb value={result.probabilityBefore} label={bn ? "আগে" : "Before"} tone="muted" />
                <div className="flex flex-col items-center text-polaris-500">
                  <Icon.arrow size={22} />
                  <span className="mt-1 text-[9px] font-semibold uppercase tracking-widest">{result.risk}</span>
                </div>
                <ScoreOrb value={result.probabilityAfter} label={bn ? "পরে" : "After"} tone="live" />
              </div>
            </div>
            <div className="p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "জীবন্ত পরিকল্পনার পার্থক্য" : "Live plan diff"}</div>
                  <h3 className="mt-1 font-serif text-[20px] font-bold text-ink">{bn ? "এক পরিবর্তনে কী বদলাল" : "What one change moves"}</h3>
                </div>
                <ModelTrace source={result.source} model={result.model} />
              </div>
              <p className="mt-3 text-[12.5px] leading-relaxed text-ink-dim">{result.summary}</p>
              <div className="mt-4 rounded-xl border border-aurora-500/20 bg-aurora-500/[0.07] p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-aurora-700 dark:text-aurora-100">{bn ? "এখনই করুন" : "Do this now"}</div>
                <p className="mt-1 text-[12.5px] font-medium leading-relaxed text-ink">{result.nextAction}</p>
              </div>
            </div>
          </div>
        </Card>

        <div className="grid gap-3 md:grid-cols-3">
          {result.changes.map((change, index) => (
            <motion.div key={`${change.area}-${index}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
              <Card className="h-full border border-ink-faint/15 p-4">
                <div className="flex items-center justify-between">
                  <Pill tone={index === 0 ? "rose" : index === 1 ? "polaris" : "aurora"}>{change.area}</Pill>
                  <span className="font-mono text-[10px] text-ink-muted">0{index + 1}</span>
                </div>
                <div className="mt-3 text-[10px] uppercase tracking-wider text-ink-muted">{bn ? "আগে" : "Before"}</div>
                <p className="mt-1 text-[12px] text-ink-dim">{change.before}</p>
                <div className="my-2 h-px bg-gradient-to-r from-polaris-500/35 to-transparent" />
                <div className="text-[10px] uppercase tracking-wider text-polaris-500">{bn ? "এখন" : "Now"}</div>
                <p className="mt-1 text-[12.5px] font-semibold text-ink">{change.after}</p>
                <p className="mt-2 text-[10.5px] leading-relaxed text-ink-muted">{change.reason}</p>
              </Card>
            </motion.div>
          ))}
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-nova-500/20 bg-nova-500/[0.06] px-4 py-3">
          <span className="mt-0.5 text-nova-500"><Icon.attach size={14} /></span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-nova-600">{bn ? "যে প্রমাণ সংগ্রহ করবেন" : "Evidence to collect"}</div>
            <p className="mt-1 text-[11.5px] text-ink-dim">{result.evidenceToCollect}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceGraph({ lang }: { lang: "en" | "bn" }) {
  const bn = lang === "bn";
  const [claim, setClaim] = useState(INITIAL_EVIDENCE.claim);
  const [proofType, setProofType] = useState("Project / portfolio");
  const [proofDetail, setProofDetail] = useState(INITIAL_EVIDENCE.proof);
  const [result, setResult] = useState<EvidenceResult>(INITIAL_EVIDENCE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      setResult(await postAction<EvidenceResult>({ kind: "evidence", claim, proofType, proofDetail }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not map the evidence.");
    } finally {
      setBusy(false);
    }
  };

  const nodes = [
    { label: bn ? "দাবি" : "Claim", value: result.claim, tone: "polaris" },
    { label: bn ? "প্রমাণ" : "Proof", value: result.proof, tone: "nova" },
    { label: bn ? "যাচাইযোগ্য সংকেত" : "Verified signal", value: result.verifiedSignal, tone: "aurora" },
    { label: bn ? "ঘাটতি" : "Gap", value: result.gap, tone: "rose" },
    { label: bn ? "পরবর্তী কাজ" : "Next action", value: result.nextAction, tone: "polaris" },
  ] as const;

  return (
    <div className="grid gap-4 xl:grid-cols-[0.78fr_1.5fr]">
      <Card className="border border-ink-faint/15 p-5">
        <Pill tone="nova"><Icon.attach size={11} /> {bn ? "প্রমাণ নিরীক্ষা" : "Evidence audit"}</Pill>
        <h2 className="mt-3 font-serif text-[22px] font-bold text-ink">{bn ? "একটি দাবি যোগ করুন" : "Add one student claim"}</h2>
        <label className="mt-4 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
          {bn ? "আপনার দাবি" : "Your claim"}
          <textarea value={claim} onChange={(e) => setClaim(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-ink-faint/25 bg-bg/60 px-3.5 py-3 text-[13px] normal-case leading-relaxed tracking-normal text-ink outline-none focus:border-polaris-500" />
        </label>
        <fieldset className="mt-3">
          <legend className="text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
            {bn ? "প্রমাণের ধরন" : "Proof type"}
          </legend>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {PROOF_TYPES.map((type, index) => {
              const selected = proofType === type.value;
              return (
                <motion.button
                  key={type.value}
                  type="button"
                  aria-pressed={selected}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => setProofType(type.value)}
                  className={cn(
                    "group relative overflow-hidden rounded-xl border px-3 py-2.5 text-left transition-all",
                    selected
                      ? "border-polaris-500 bg-paper-card shadow-[0_8px_24px_-16px_rgba(196,125,78,0.9)] ring-2 ring-polaris-500/15"
                      : "border-ink-faint/15 bg-bg/45 hover:border-polaris-500/35 hover:bg-paper-card",
                  )}
                >
                  <span className={cn("pointer-events-none absolute inset-0 bg-gradient-to-br opacity-70", type.tone)} />
                  <span className="relative flex items-start gap-2.5">
                    <span className={cn(
                      "mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[9px] font-bold transition-colors",
                      selected
                        ? "border-polaris-500 bg-polaris-500 text-white"
                        : "border-ink-faint/20 bg-paper-card text-ink-muted group-hover:text-ink",
                    )}>
                      {selected ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d="M5 12l4 4L19 6" />
                        </svg>
                      ) : String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11.5px] font-semibold normal-case tracking-normal text-ink">{bn ? type.bn : type.en}</span>
                      <span className="mt-0.5 block text-[9.5px] font-normal normal-case leading-snug tracking-normal text-ink-muted">{bn ? type.hintBn : type.hintEn}</span>
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>
        </fieldset>
        <label className="mt-3 block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
          {bn ? "লিংক বা বিস্তারিত" : "Link or details"}
          <textarea value={proofDetail} onChange={(e) => setProofDetail(e.target.value)} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-ink-faint/25 bg-bg/60 px-3.5 py-3 text-[13px] normal-case leading-relaxed tracking-normal text-ink outline-none focus:border-polaris-500" />
        </label>
        <Btn onClick={() => void run()} disabled={busy || claim.trim().length < 3} variant="accent" size="lg" className="mt-4 w-full" icon={<Icon.spark size={14} />}>
          {busy ? (bn ? "Gemma যাচাই করছে…" : "Gemma is auditing…") : (bn ? "প্রমাণের মানচিত্র তৈরি করুন" : "Build the evidence graph")}
        </Btn>
        {error && <p className="mt-2 text-[11px] text-signal-rose">{error}</p>}
      </Card>

      <Card className="relative min-h-[560px] overflow-hidden border border-ink-faint/15 p-5 sm:p-7">
        <div className="absolute inset-0 action-evidence-grid opacity-30" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "প্রমাণ থেকে কাজে" : "Evidence to action"}</div>
            <h3 className="mt-1 font-serif text-[23px] font-bold text-ink">{bn ? "যা বলা হয়েছে, যা প্রমাণ করা যায়" : "What is said versus what can be proven"}</h3>
          </div>
          <ModelTrace source={result.source} model={result.model} />
        </div>

        <div className="relative mt-8 grid gap-4 md:grid-cols-[1fr_44px_1fr] md:items-center">
          <EvidenceNode {...nodes[0]} index={1} />
          <GraphArrow />
          <EvidenceNode {...nodes[1]} index={2} />
          <div className="hidden md:block" />
          <div className="hidden h-11 w-px justify-self-center bg-gradient-to-b from-nova-500/50 to-aurora-500/50 md:block" />
          <div className="hidden md:block" />
          <EvidenceNode {...nodes[3]} index={4} />
          <GraphArrow />
          <EvidenceNode {...nodes[2]} index={3} />
          <div className="hidden md:block" />
          <div className="hidden h-11 w-px justify-self-center bg-gradient-to-b from-aurora-500/50 to-polaris-500/50 md:block" />
          <div className="hidden md:block" />
          <div className="md:col-start-2 md:-ml-[180px] md:w-[360px]">
            <EvidenceNode {...nodes[4]} index={5} featured />
          </div>
        </div>
        <div className="relative mt-6 flex items-start gap-3 rounded-xl border border-ink-faint/15 bg-bg/70 p-3.5 backdrop-blur">
          <span className="text-aurora-500"><Icon.check size={14} /></span>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-muted">{bn ? "যাচাই পদ্ধতি" : "Verification method"}</div>
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{result.verification}</p>
          </div>
        </div>
      </Card>
    </div>
  );
}

function RoutineStudio({ lang }: { lang: "en" | "bn" }) {
  const bn = lang === "bn";
  const [blocks, setBlocks] = useState<RoutineBlock[]>(DEFAULT_ROUTINE);
  const [instruction, setInstruction] = useState("Add math practice on Monday from 9 to 10 pm.");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<RoutineBlock, "id">>({ day: "Monday", start: "21:00", end: "22:00", title: "Math practice", category: "exam" });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("polaris.actionLab.routine");
      if (saved) setBlocks(JSON.parse(saved) as RoutineBlock[]);
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem("polaris.actionLab.routine", JSON.stringify(blocks)); } catch {}
  }, [blocks]);

  const addFromGemma = async () => {
    setBusy(true);
    try {
      const suggestion = await postAction<RoutineSuggestion>({
        kind: "routine",
        instruction,
        existing: blocks.map(({ day, start, end, title }) => ({ day, start, end, title })),
      });
      setBlocks((current) => [...current, { ...suggestion, id: crypto.randomUUID() }]);
    } finally {
      setBusy(false);
    }
  };

  const saveManual = () => {
    if (!draft.title.trim() || draft.start >= draft.end) return;
    if (editingId) {
      setBlocks((current) => current.map((block) => block.id === editingId ? { ...draft, id: editingId } : block));
    } else {
      setBlocks((current) => [...current, { ...draft, id: crypto.randomUUID() }]);
    }
    setEditingId(null);
    setDraft({ day: "Monday", start: "21:00", end: "22:00", title: "", category: "study" });
  };

  const edit = (block: RoutineBlock) => {
    setEditingId(block.id);
    setDraft({ day: block.day, start: block.start, end: block.end, title: block.title, category: block.category, rationale: block.rationale });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="relative overflow-hidden border border-ink-faint/15 p-5">
          <div className="absolute right-[-80px] top-[-100px] h-60 w-60 rounded-full bg-nova-500/[0.10] blur-2xl" />
          <div className="relative">
            <Pill tone="nova"><Icon.spark size={11} /> {bn ? "প্রাকৃতিক ভাষায় রুটিন" : "Natural-language scheduling"}</Pill>
            <h2 className="mt-3 font-serif text-[22px] font-bold text-ink">{bn ? "Gemma-কে বলুন কী যোগ করবেন" : "Tell Gemma what to add"}</h2>
            <p className="mt-1.5 text-[11.5px] text-ink-dim">{bn ? "দিন, সময় ও কাজ লিখুন। যোগ হওয়ার পর প্রতিটি ব্লক ম্যানুয়ালি পরিবর্তন করা যাবে।" : "Include the day, time, and task. Every generated block stays manually editable."}</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input value={instruction} onChange={(e) => setInstruction(e.target.value)} className="h-11 flex-1 rounded-xl border border-ink-faint/25 bg-bg/70 px-3.5 text-[13px] text-ink outline-none focus:border-polaris-500" />
              <Btn onClick={() => void addFromGemma()} disabled={busy || instruction.trim().length < 3} variant="accent" size="lg" icon={<Icon.plus size={14} />}>
                {busy ? (bn ? "যোগ হচ্ছে…" : "Adding…") : (bn ? "রুটিনে যোগ করুন" : "Add to routine")}
              </Btn>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                "Add IELTS reading on Wednesday from 8 to 9 pm.",
                "Add a Saturday SAT mock from 9 to 11 am.",
                "Add project work on Tuesday from 7 to 8:30 pm.",
              ].map((sample) => <button key={sample} onClick={() => setInstruction(sample)} className="rounded-full border border-ink-faint/20 px-2.5 py-1.5 text-[10.5px] text-ink-dim hover:text-ink">{sample}</button>)}
            </div>
          </div>
        </Card>

        <Card className="border border-ink-faint/15 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "ম্যানুয়াল সম্পাদনা" : "Manual editor"}</div>
              <h3 className="mt-1 font-serif text-[18px] font-bold text-ink">{editingId ? (bn ? "ব্লক পরিবর্তন করুন" : "Edit block") : (bn ? "নতুন ব্লক" : "New block")}</h3>
            </div>
            {editingId && <button onClick={() => setEditingId(null)} className="text-ink-muted"><Icon.close size={14} /></button>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select value={draft.day} onChange={(e) => setDraft((value) => ({ ...value, day: e.target.value }))} className="col-span-2 h-9 rounded-lg border border-ink-faint/20 bg-bg px-2.5 text-[11.5px] text-ink">
              {DAYS.map((day) => <option key={day}>{day}</option>)}
            </select>
            <input type="time" value={draft.start} onChange={(e) => setDraft((value) => ({ ...value, start: e.target.value }))} className="h-9 rounded-lg border border-ink-faint/20 bg-bg px-2.5 text-[11.5px] text-ink" />
            <input type="time" value={draft.end} onChange={(e) => setDraft((value) => ({ ...value, end: e.target.value }))} className="h-9 rounded-lg border border-ink-faint/20 bg-bg px-2.5 text-[11.5px] text-ink" />
            <input value={draft.title} onChange={(e) => setDraft((value) => ({ ...value, title: e.target.value }))} placeholder={bn ? "কাজের নাম" : "Task name"} className="col-span-2 h-9 rounded-lg border border-ink-faint/20 bg-bg px-2.5 text-[11.5px] text-ink" />
            <select value={draft.category} onChange={(e) => setDraft((value) => ({ ...value, category: e.target.value as RoutineCategory }))} className="col-span-2 h-9 rounded-lg border border-ink-faint/20 bg-bg px-2.5 text-[11.5px] text-ink">
              {(["study", "exam", "project", "application", "wellbeing"] as RoutineCategory[]).map((category) => <option key={category}>{category}</option>)}
            </select>
          </div>
          <Btn onClick={saveManual} variant="outline" className="mt-3 w-full" icon={<Icon.check size={13} />}>{editingId ? (bn ? "পরিবর্তন সংরক্ষণ" : "Save changes") : (bn ? "ম্যানুয়ালি যোগ করুন" : "Add manually")}</Btn>
        </Card>
      </div>

      <Card className="overflow-hidden border border-ink-faint/15">
        <div className="flex flex-col gap-2 border-b border-ink-faint/15 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">{bn ? "সাপ্তাহিক রুটিন" : "Weekly routine"}</div>
            <h3 className="mt-1 font-serif text-[20px] font-bold text-ink">{bn ? "পরিকল্পনা থেকে প্রতিদিনের কাজে" : "From roadmap to protected time"}</h3>
          </div>
          <Tag tone="aurora">{blocks.length} {bn ? "টি সময় ব্লক" : "time blocks"}</Tag>
        </div>
        <div className="grid min-w-[850px] grid-cols-7 divide-x divide-ink-faint/15 overflow-x-auto">
          {DAYS.map((day) => {
            const dayBlocks = blocks.filter((block) => block.day === day).sort((a, b) => a.start.localeCompare(b.start));
            return (
              <div key={day} className="min-h-[360px] bg-gradient-to-b from-paper-card to-bg/40 p-2.5">
                <div className="mb-3 px-1 text-[10.5px] font-bold uppercase tracking-wider text-ink-muted">{day.slice(0, 3)}</div>
                <div className="space-y-2">
                  {dayBlocks.map((block) => (
                    <motion.button
                      layout
                      key={block.id}
                      onClick={() => edit(block)}
                      className={cn("w-full rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-card", routineTone(block.category))}
                    >
                      <div className="font-mono text-[9.5px] opacity-70">{formatTime(block.start)}–{formatTime(block.end)}</div>
                      <div className="mt-1 text-[11px] font-semibold leading-snug">{block.title}</div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[8.5px] uppercase tracking-wider opacity-65">{block.category}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => { event.stopPropagation(); setBlocks((current) => current.filter((item) => item.id !== block.id)); }}
                          className="opacity-50 hover:opacity-100"
                        >
                          <Icon.close size={10} />
                        </span>
                      </div>
                    </motion.button>
                  ))}
                  {!dayBlocks.length && <div className="rounded-xl border border-dashed border-ink-faint/20 px-2 py-4 text-center text-[9.5px] text-ink-muted">{bn ? "খালি সময়" : "Open time"}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function VideoLearning() {
  const [exam, setExam] = useState<"IELTS" | "SAT">("IELTS");
  const filtered = LEARNING_VIDEOS.filter((video) => video.exam === exam);
  const [selectedId, setSelectedId] = useState(filtered[0].id);
  const selected = LEARNING_VIDEOS.find((video) => video.id === selectedId && video.exam === exam) || filtered[0];

  const switchExam = (next: "IELTS" | "SAT") => {
    setExam(next);
    setSelectedId(LEARNING_VIDEOS.find((video) => video.exam === next)?.id || "");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
      <Card className="overflow-hidden border border-ink-faint/15">
        <div className="aspect-video w-full bg-ink">
          <iframe
            key={selected.youtubeId}
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${selected.youtubeId}?rel=0`}
            title={selected.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Pill tone={selected.exam === "IELTS" ? "nova" : "polaris"}>{selected.exam}</Pill>
              <Tag tone="aurora">{selected.source}</Tag>
            </div>
            <h2 className="mt-3 font-serif text-[22px] font-bold text-ink">{selected.title}</h2>
            <p className="mt-1.5 text-[11.5px] text-ink-dim">{selected.topic} · {selected.duration} · embedded with privacy-enhanced playback</p>
          </div>
          <a href={selected.officialUrl} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-ink-faint/20 px-3 py-2 text-[11px] font-medium text-ink-dim hover:text-ink">
            Official source <Icon.arrow size={11} />
          </a>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="border border-ink-faint/15 p-4">
          <div className="flex rounded-xl border border-ink-faint/20 bg-bg p-1">
            {(["IELTS", "SAT"] as const).map((name) => <button key={name} onClick={() => switchExam(name)} className={cn("flex-1 rounded-lg px-3 py-2 text-[12px] font-semibold", exam === name ? "bg-ink text-paper" : "text-ink-dim")}>{name}</button>)}
          </div>
          <div className="mt-4">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-muted">Related lessons</div>
            <div className="mt-2 space-y-2">
              {filtered.map((video, index) => (
                <VideoSuggestion key={video.id} video={video} active={selected.id === video.id} index={index} onClick={() => setSelectedId(video.id)} />
              ))}
            </div>
          </div>
        </Card>
        <Card className="border border-aurora-500/20 bg-aurora-500/[0.06] p-4">
          <div className="flex gap-3">
            <span className="text-aurora-500"><Icon.check size={15} /></span>
            <div>
              <div className="text-[11.5px] font-semibold text-ink">Curated, not an uncontrolled feed</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-ink-dim">Polaris recommends official preparation content by exam and skill. Videos play inside the workspace; source links remain visible.</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function NumberField({ label, value, setValue, min, max, step }: { label: string; value: number; setValue: (value: number) => void; min: number; max: number; step: number }) {
  return (
    <label className="block text-[10.5px] font-semibold uppercase tracking-wider text-ink-muted">
      {label}
      <input type="number" value={value} onChange={(e) => setValue(Number(e.target.value))} min={min} max={max} step={step} className="mt-1.5 h-10 w-full rounded-lg border border-ink-faint/25 bg-bg px-3 font-mono text-[12.5px] normal-case tracking-normal text-ink outline-none focus:border-polaris-500" />
    </label>
  );
}

function ModelTrace({ source, model }: { source: string; model: string }) {
  const live = source === "gemma4";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-medium", live ? "border-aurora-500/25 bg-aurora-500/[0.08] text-aurora-700 dark:text-aurora-100" : "border-ink-faint/20 text-ink-muted")}>
      <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-aurora-500" : "bg-ink-muted")} />
      {live ? `Gemma 4 · ${model}` : "Preview · run to use Gemma 4"}
    </span>
  );
}

function ScoreOrb({ value, label, tone }: { value: number; label: string; tone: "muted" | "live" }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cn("relative flex h-24 w-24 items-center justify-center rounded-full border", tone === "live" ? "border-aurora-500/50 bg-aurora-500/[0.10] shadow-[0_0_50px_rgba(91,140,109,0.22)]" : "border-ink-faint/25 bg-bg/70")}>
        <div className={cn("absolute inset-2 rounded-full border border-dashed", tone === "live" ? "border-aurora-500/35 animate-[spin_18s_linear_infinite]" : "border-ink-faint/20")} />
        <span className="relative font-serif text-[28px] font-bold text-ink">{Math.round(value)}<small className="text-[11px]">%</small></span>
      </div>
      <span className="mt-2 text-[9.5px] font-semibold uppercase tracking-wider text-ink-muted">{label}</span>
    </div>
  );
}

function EvidenceNode({ label, value, tone, index, featured }: { label: string; value: string; tone: "polaris" | "nova" | "aurora" | "rose"; index: number; featured?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.06 }} className={cn("relative rounded-2xl border bg-paper-card/90 p-4 shadow-card backdrop-blur", nodeTone(tone), featured && "ring-2 ring-polaris-500/15")}>
      <span className="absolute -left-2 -top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink font-mono text-[9px] text-paper">{index}</span>
      <div className="text-[9.5px] font-bold uppercase tracking-[0.18em] opacity-70">{label}</div>
      <p className="mt-2 text-[12px] font-medium leading-relaxed text-ink">{value}</p>
    </motion.div>
  );
}

function GraphArrow() {
  return (
    <div className="hidden items-center md:flex">
      <div className="h-px flex-1 bg-gradient-to-r from-polaris-500/20 to-polaris-500/70" />
      <span className="text-polaris-500"><Icon.chev size={12} /></span>
    </div>
  );
}

function VideoSuggestion({ video, active, index, onClick }: { video: LearningVideo; active: boolean; index: number; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition", active ? "border-polaris-500/45 bg-polaris-500/[0.08]" : "border-ink-faint/15 hover:border-polaris-500/30")}>
      <span className={cn("inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", active ? "bg-polaris-500 text-white" : "bg-paper-deep text-ink-dim")}><Icon.play size={12} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[11.5px] font-semibold text-ink">{video.title}</span>
        <span className="mt-0.5 block text-[9.5px] text-ink-muted">{video.source} · {video.topic}</span>
      </span>
      <span className="font-mono text-[9px] text-ink-muted">0{index + 1}</span>
    </button>
  );
}

function formatTime(value: string): string {
  const [hour, minute] = value.split(":").map(Number);
  const suffix = hour >= 12 ? "pm" : "am";
  const display = hour % 12 || 12;
  return `${display}${minute ? `:${String(minute).padStart(2, "0")}` : ""}${suffix}`;
}

function routineTone(category: RoutineCategory): string {
  return {
    study: "border-polaris-500/25 bg-polaris-500/[0.08] text-polaris-700 dark:text-polaris-100",
    exam: "border-signal-rose/25 bg-signal-rose/[0.08] text-signal-rose",
    project: "border-nova-500/25 bg-nova-500/[0.08] text-nova-600 dark:text-nova-100",
    application: "border-aurora-500/25 bg-aurora-500/[0.08] text-aurora-700 dark:text-aurora-100",
    wellbeing: "border-ink-faint/20 bg-paper-deep/60 text-ink-dim",
  }[category];
}

function nodeTone(tone: "polaris" | "nova" | "aurora" | "rose"): string {
  return {
    polaris: "border-polaris-500/30",
    nova: "border-nova-500/30",
    aurora: "border-aurora-500/30",
    rose: "border-signal-rose/30",
  }[tone];
}
