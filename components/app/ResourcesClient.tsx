"use client";

import { GemmaDiscoveryRefresh } from "@/components/app/GemmaDiscoveryRefresh";

/**
 * Resources - the Admission Knowledge Hub.
 *
 *   Hero          - animated gradient + interactive category tiles
 *   Stories       - "Admission Galaxy": composite admit case studies as
 *                   glowing stars clustered by destination, click → rich
 *                   journey modal with Apply-strategy / Ask-Strategist
 *   Scholarships  - real scholarships, official URLs, typical windows,
 *                   one-click deadline import
 *   Costs         - sourced tuition + official visa-benchmark living costs
 *   Exam hub      - SAT/IELTS (or explorer topics for younger levels) with
 *                   in-app playable videos and practice links
 *   Guides        - essay / application / leadership resource packs
 *
 * Personalized by education level + shortlisted universities; every
 * interaction emits shared-store events the Strategist can see.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { roadmapStore } from "@/lib/roadmap/store";
import type { EducationLevel } from "@/lib/roadmap/types";
import { resourcesForTopics, isYouTubeId } from "@/lib/roadmap/resources";
import type { UniProfile } from "@/lib/admissions";
import {
  HUB_META, SCHOLARSHIP_META, SCHOLARSHIP_TYPE_LABEL, COUNTRY_COSTS,
  CASE_STUDY_DISCLOSURE, caseStudyUniId,
} from "@/lib/resources/hub";
import { UniversityLogo } from "./UniversityLogo";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";

/* ─── seed-data shapes (match data/*.json) ─── */

export type HubCaseStudy = {
  id: string;
  title: string;
  profile: {
    country: string;
    school: string;
    gpa: string;
    tests: string;
    ecs: string[];
    tier: string;
  };
  whatWorked: string;
  tags: string[];
};

export type HubScholarship = {
  id: string;
  name: string;
  host: string;
  level: string;
  value: string;
  eligibility: string;
  tags: string[];
  summary: string;
};

type Section = "stories" | "scholarships" | "costs" | "exams" | "guides";

const WISHLIST_KEY = "polaris.unis.wishlist";

/* ════════════════════════════════════════════════════════════════════════ */

export function ResourcesClient({
  caseStudies, scholarships, universities, level,
}: {
  caseStudies: HubCaseStudy[];
  scholarships: HubScholarship[];
  universities: UniProfile[];
  level: EducationLevel;
}) {
  const [section, setSection] = useState<Section>("stories");
  const [openStory, setOpenStory] = useState<HubCaseStudy | null>(null);
  const [shortlist, setShortlist] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (raw) setShortlist(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const young = level === "early-school" || level === "middle-school";

  // Shortlist-aware ordering: stories about your schools first.
  const orderedStories = useMemo(() => {
    return [...caseStudies].sort((a, b) => {
      const aHit = shortlist.has(caseStudyUniId(a.tags) ?? "") ? 0 : 1;
      const bHit = shortlist.has(caseStudyUniId(b.tags) ?? "") ? 0 : 1;
      return aHit - bHit;
    });
  }, [caseStudies, shortlist]);

  const orderedUnis = useMemo(() => {
    return [...universities].sort((a, b) => {
      const aHit = shortlist.has(a.id) ? 0 : 1;
      const bHit = shortlist.has(b.id) ? 0 : 1;
      return aHit - bHit;
    });
  }, [universities, shortlist]);

  const SECTIONS: Array<{ id: Section; label: string; count: number; icon: React.ReactNode; desc: string }> = [
    { id: "stories", label: "Student stories", count: caseStudies.length, icon: <TileIcon d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" />, desc: "How real profiles got in" },
    { id: "scholarships", label: "Scholarships", count: scholarships.length, icon: <TileIcon d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 11.5 7 22l5-3 5 3-1.5-10.5" />, desc: "Real funding, official links" },
    { id: "costs", label: "Costs & funding", count: orderedUnis.length, icon: <TileIcon d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />, desc: "Sourced cost benchmarks" },
    { id: "exams", label: young ? "Explorer hub" : "Exam hub", count: young ? 4 : 7, icon: <TileIcon d="M10 2h4M12 14l3-3M12 22a8 8 0 1 0 0-16 8 8 0 0 0 0 16z" />, desc: young ? "Olympiads, reading, projects" : "SAT & IELTS, in-app" },
    { id: "guides", label: "Guides", count: 6, icon: <TileIcon d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />, desc: "Essays, recs, strategy" },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1280px] mx-auto">
      {/* ─── Hero ─── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-6 overflow-hidden rounded-3xl app-glass p-6 sm:p-8"
      >
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-gradient-to-br from-polaris-400/25 via-nova-400/15 to-transparent blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: "6s" }} />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-gradient-to-tr from-aurora-400/20 to-transparent blur-3xl animate-pulse pointer-events-none" style={{ animationDuration: "8s" }} />
        <div className="relative">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Admission knowledge hub</div>
          <h1 className="font-serif text-[28px] sm:text-[36px] leading-[1.05] font-bold tracking-tight text-ink max-w-2xl">
            Learn from the paths that <span className="grad-text">already worked</span>
          </h1>
          <p className="text-[12.5px] text-ink-dim mt-2 max-w-xl leading-relaxed">
            Composite admit stories, real scholarships, sourced costs - wired into your roadmap and Strategist.
          </p>

          {/* Category tiles */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {SECTIONS.map((s, i) => (
              <motion.button
                key={s.id}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4 }}
                onClick={() => setSection(s.id)}
                className={cn(
                  "relative rounded-2xl p-3.5 text-left ring-1 ring-inset transition-colors overflow-hidden",
                  section === s.id
                    ? "bg-ink text-paper ring-ink shadow-pop"
                    : "bg-paper-card text-ink ring-polaris-500/15 hover:ring-polaris-400/40 dark:ring-white/[0.1]",
                )}
              >
                <span className={cn(
                  "inline-flex h-8 w-8 rounded-lg items-center justify-center mb-2 bg-gradient-to-br",
                  section === s.id ? "from-polaris-400/40 to-nova-400/30 text-paper" : "from-polaris-500/15 to-nova-500/10 text-polaris-600 dark:text-polaris-300",
                )}>
                  {s.icon}
                </span>
                <div className="text-[12.5px] font-bold leading-tight">{s.label}</div>
                <div className={cn("text-[10px] mt-0.5 leading-snug", section === s.id ? "text-paper/60" : "text-ink-muted")}>{s.desc}</div>
                <span className={cn("absolute top-2.5 right-3 font-mono text-[10px]", section === s.id ? "text-paper/50" : "text-ink-muted")}>{s.count}</span>
              </motion.button>
            ))}
          </div>
        </div>
      </motion.div>

      <GemmaDiscoveryRefresh surface="resources" defaultQuery="Scholarships, official exam preparation, costs, and application guides for Bangladeshi students" />

      {/* ─── Sections ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={section}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {section === "stories" && (
            <Galaxy stories={orderedStories} shortlist={shortlist} onOpen={(s) => {
              setOpenStory(s);
              roadmapStore.emit("CASE_STUDY_VIEWED", `Read case study "${s.title}"`);
            }} />
          )}
          {section === "scholarships" && <ScholarshipExplorer scholarships={scholarships} level={level} onToast={setToast} />}
          {section === "costs" && <CostExplorer unis={orderedUnis} shortlist={shortlist} />}
          {section === "exams" && <ExamHub young={young} />}
          {section === "guides" && <Guides />}
        </motion.div>
      </AnimatePresence>

      {/* ─── Modals + toast ─── */}
      <AnimatePresence>
        {openStory && (
          <StoryModal key={openStory.id} s={openStory} onClose={() => setOpenStory(null)} onToast={setToast} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop max-w-[90vw] truncate"
          >
            ✦ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TileIcon({ d }: { d: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Admission Galaxy - stories as glowing stars clustered by destination
 * ════════════════════════════════════════════════════════════════════════ */

const CLUSTERS: Array<{ label: string; match: (s: HubCaseStudy) => boolean; cx: number; cy: number }> = [
  { label: "USA", match: (s) => s.tags.some((t) => ["MIT", "Stanford", "CMU", "Fulbright", "Knight-Hennessy"].includes(t)), cx: 22, cy: 32 },
  { label: "UK", match: (s) => s.tags.some((t) => ["Oxford", "Cambridge", "Imperial", "Rhodes", "Gates"].includes(t)), cx: 52, cy: 22 },
  { label: "Canada", match: (s) => s.tags.some((t) => ["Waterloo", "Toronto"].includes(t)), cx: 38, cy: 62 },
  { label: "Asia & EU", match: () => true, cx: 74, cy: 55 },
];

function hashPos(id: string, salt: number): number {
  let h = salt;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return (h % 100) / 100;
}

function Galaxy({
  stories, shortlist, onOpen,
}: {
  stories: HubCaseStudy[];
  shortlist: Set<string>;
  onOpen: (s: HubCaseStudy) => void;
}) {
  const placed = useMemo(() => {
    return stories.map((s) => {
      const cluster = CLUSTERS.find((c) => c.match(s)) ?? CLUSTERS[3];
      const a = hashPos(s.id, 7) * Math.PI * 2;
      const r = 5 + hashPos(s.id, 13) * 11;
      const golden = /scholarship|full|Rhodes|Gates|Knight|Fulbright/i.test(s.title + s.tags.join(" "));
      const uniId = caseStudyUniId(s.tags);
      return {
        s,
        x: Math.min(94, Math.max(6, cluster.cx + Math.cos(a) * r)),
        y: Math.min(88, Math.max(10, cluster.cy + Math.sin(a) * r * 0.9)),
        golden,
        big: s.profile.tier === "elite",
        starred: uniId ? shortlist.has(uniId) : false,
        cluster: cluster.label,
      };
    });
  }, [stories, shortlist]);

  return (
    <div>
      {/* The galaxy panel - always deep-space dark, both themes */}
      <div className="relative rounded-3xl overflow-hidden app-glass-dark min-h-[380px] sm:min-h-[440px]">
        {/* star field + nebulas */}
        <div className="absolute inset-0 opacity-60" style={{
          backgroundImage:
            "radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,0.5), transparent 50%)," +
            "radial-gradient(1px 1px at 75% 15%, rgba(255,255,255,0.4), transparent 50%)," +
            "radial-gradient(1.5px 1.5px at 45% 75%, rgba(255,255,255,0.35), transparent 50%)," +
            "radial-gradient(1px 1px at 88% 65%, rgba(255,255,255,0.4), transparent 50%)," +
            "radial-gradient(1px 1px at 30% 88%, rgba(255,255,255,0.3), transparent 50%)",
        }} aria-hidden />
        <div className="absolute top-[10%] left-[35%] h-48 w-48 rounded-full bg-polaris-500/15 blur-3xl animate-pulse" style={{ animationDuration: "7s" }} aria-hidden />
        <div className="absolute bottom-[5%] right-[15%] h-56 w-56 rounded-full bg-aurora-500/10 blur-3xl animate-pulse" style={{ animationDuration: "9s" }} aria-hidden />

        {/* constellation lines per cluster */}
        <svg className="absolute inset-0 h-full w-full pointer-events-none" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden>
          {CLUSTERS.map((c) => {
            const members = placed.filter((p) => p.cluster === c.label);
            if (members.length < 2) return null;
            const pts = members.map((m) => `${m.x},${m.y}`).join(" ");
            return <polyline key={c.label} points={pts} fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="0.18" strokeDasharray="0.8 1.2" />;
          })}
        </svg>

        {/* cluster labels */}
        {CLUSTERS.map((c) => (
          <span key={c.label} className="absolute text-[9px] uppercase tracking-[0.25em] font-bold text-paper/30 -translate-x-1/2" style={{ left: `${c.cx}%`, top: `${c.cy - 14}%` }}>
            {c.label}
          </span>
        ))}

        {/* header */}
        <div className="absolute top-4 left-5 right-5 flex items-start justify-between gap-3 pointer-events-none">
          <div>
            <div className="font-serif text-[17px] font-bold text-paper">The Admission Galaxy</div>
            <div className="text-[10.5px] text-paper/55 mt-0.5">Every star is an admit path. Golden stars carried major scholarships. Tap one.</div>
          </div>
        </div>

        {/* stars */}
        {placed.map((p, i) => (
          <motion.button
            key={p.s.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.15 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.35 }}
            onClick={() => onOpen(p.s)}
            className="absolute -translate-x-1/2 -translate-y-1/2 group"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={p.s.title}
          >
            <span className={cn(
              "relative block rounded-full",
              p.big ? "h-3.5 w-3.5" : "h-2.5 w-2.5",
              p.golden ? "bg-nova-300" : "bg-paper",
            )}>
              <span className={cn(
                "absolute -inset-1.5 rounded-full blur-[6px] animate-pulse",
                p.golden ? "bg-nova-400/70" : "bg-paper/40",
              )} style={{ animationDuration: `${2.5 + (i % 4)}s` }} aria-hidden />
              {p.starred && <span className="absolute -inset-2.5 rounded-full ring-1 ring-polaris-400/70" aria-hidden />}
            </span>
            {/* hover tooltip */}
            <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 top-4 z-10 hidden group-hover:block whitespace-nowrap rounded-lg bg-ink/95 px-2.5 py-1.5 text-[10px] text-paper ring-1 ring-inset ring-white/15 max-w-[240px] truncate">
              {p.s.title}
            </span>
          </motion.button>
        ))}

        {/* disclosure */}
        <div className="absolute bottom-3 left-5 right-5 text-[9px] text-paper/35 leading-snug pointer-events-none">
          {CASE_STUDY_DISCLOSURE}
        </div>
      </div>

      {/* list fallback (accessible, scannable) */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
        {stories.map((s) => {
          const uniId = caseStudyUniId(s.tags);
          return (
            <motion.button
              key={s.id}
              whileHover={{ y: -3 }}
              onClick={() => onOpen(s)}
              className="app-glass rounded-2xl p-3.5 text-left flex items-center gap-3 group"
            >
              {uniId ? (
                <span className="shrink-0 rounded-lg shadow-sm group-hover:scale-105 transition-transform"><UniversityLogo id={uniId} name={s.title} size={36} /></span>
              ) : (
                <span className="shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-polaris-500/20 to-nova-500/10 flex items-center justify-center text-polaris-600 dark:text-polaris-300">
                  <TileIcon d="M12 3l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 8.7l5.4-.8z" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-semibold text-ink leading-snug line-clamp-2">{s.title}</span>
                <span className="block text-[10.5px] font-mono text-ink-muted mt-0.5">{s.profile.country} · {s.profile.tests.split(",")[0] ?? s.profile.tests}</span>
              </span>
              <span className="shrink-0 text-ink-muted group-hover:text-ink transition-colors"><Icon.chev size={12} /></span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Story modal - the journey
 * ════════════════════════════════════════════════════════════════════════ */

function StoryModal({
  s, onClose, onToast,
}: {
  s: HubCaseStudy;
  onClose: () => void;
  onToast: (t: string) => void;
}) {
  const uniId = caseStudyUniId(s.tags);
  const [applyBusy, setApplyBusy] = useState(false);
  const hasRoadmap = !!roadmapStore.get().doc;

  async function applyStrategy() {
    setApplyBusy(true);
    try {
      const r = await fetch("/api/roadmap/v2/adapt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: `Apply the strategy from this admit case study where relevant to my level and timeline: "${s.title}". What worked for them: ${s.whatWorked.slice(0, 400)}`,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.doc) {
        roadmapStore.setDoc(d.doc);
        roadmapStore.emit("RESOURCE_ADDED_TO_ROADMAP", `Applied strategy from "${s.title}" to the roadmap`);
        onToast("Roadmap adapted with this strategy");
        onClose();
      } else {
        onToast(d?.error ?? "Couldn't adapt the roadmap - try again");
      }
    } finally {
      setApplyBusy(false);
    }
  }

  function askStrategist() {
    window.dispatchEvent(new CustomEvent("polaris:openAgentRail", {
      detail: { draft: `I read the case study "${s.title}" (${s.profile.tests}; ECs: ${s.profile.ecs.slice(0, 2).join(", ")}). Compare my profile to theirs and tell me the top 2 gaps I should close. ` },
    }));
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[620px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-5 border-b border-polaris-500/10 dark:border-white/[0.08] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-polaris-200/25 via-transparent to-nova-200/20 dark:from-polaris-400/10 dark:to-nova-400/10 pointer-events-none" />
          <div className="relative flex items-start gap-4">
            {uniId && (
              <span className="shrink-0 rounded-2xl shadow-[0_10px_26px_-8px_rgba(0,0,0,0.4)]">
                <UniversityLogo id={uniId} name={s.title} size={56} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[20px] leading-tight font-bold tracking-tight text-ink">{s.title}</h2>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <Chip tone="polaris">{s.profile.country}</Chip>
                <Chip tone="nova">{s.profile.tier === "elite" ? "Elite admit" : `${s.profile.tier} admit`}</Chip>
                {s.tags.slice(0, 3).map((t) => <Chip key={t}>{t}</Chip>)}
              </div>
            </div>
            <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><Icon.close /></button>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Profile */}
          <section>
            <HubLabel>The profile</HubLabel>
            <div className="grid sm:grid-cols-2 gap-2.5">
              <InfoTile label="School / background" value={s.profile.school} />
              <InfoTile label="Academics" value={s.profile.gpa} />
              <InfoTile label="Tests" value={s.profile.tests} />
              <InfoTile label="Origin" value={s.profile.country} />
            </div>
          </section>

          {/* Journey - what they actually did */}
          <section>
            <HubLabel>What they built</HubLabel>
            <ol className="relative space-y-2.5 pl-5 before:absolute before:left-[5px] before:top-1 before:bottom-1 before:w-px before:bg-gradient-to-b before:from-polaris-400/60 before:to-aurora-400/50">
              {s.profile.ecs.map((ec, i) => (
                <motion.li
                  key={ec}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.07 }}
                  className="relative text-[13px] text-ink leading-relaxed"
                >
                  <span className="absolute -left-[19px] top-1.5 h-2 w-2 rounded-full bg-polaris-500 ring-2 ring-paper" aria-hidden />
                  {ec}
                </motion.li>
              ))}
            </ol>
          </section>

          {/* Strategy */}
          <section className="relative rounded-xl p-[1.5px] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-polaris-400/60 via-nova-400/50 to-aurora-400/60" />
            <div className="relative rounded-[10.5px] bg-paper-card px-4 py-3.5">
              <div className="text-[10.5px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300 mb-1.5">The strategy that worked</div>
              <p className="text-[13px] text-ink leading-relaxed">{s.whatWorked}</p>
            </div>
          </section>

          {/* Disclosure */}
          <p className="text-[10.5px] text-ink-muted leading-relaxed italic">
            {CASE_STUDY_DISCLOSURE} Last reviewed {HUB_META.lastUpdated}.
          </p>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-3.5 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
          {hasRoadmap && (
            <button
              onClick={() => void applyStrategy()}
              disabled={applyBusy}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
            >
              {applyBusy ? (
                <><span className="h-3 w-3 rounded-full border-2 border-paper/30 border-t-paper animate-spin" /> Adapting…</>
              ) : (
                <>Apply this strategy to my roadmap</>
              )}
            </button>
          )}
          <button onClick={askStrategist} className="text-[12.5px] text-polaris-600 dark:text-polaris-300 hover:underline font-medium">
            Ask Strategist about this story →
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Scholarship explorer
 * ════════════════════════════════════════════════════════════════════════ */

function ScholarshipExplorer({
  scholarships, level, onToast,
}: {
  scholarships: HubScholarship[];
  level: EducationLevel;
  onToast: (t: string) => void;
}) {
  const defaultLevel = level === "hsc" || level === "ssc" ? "undergraduate" : "all";
  const [levelFilter, setLevelFilter] = useState<string>(defaultLevel);
  const [busyId, setBusyId] = useState<string | null>(null);

  const visible = useMemo(() => {
    return scholarships.filter((s) => levelFilter === "all" || s.level.includes(levelFilter));
  }, [scholarships, levelFilter]);

  async function addDeadline(s: HubScholarship) {
    const meta = SCHOLARSHIP_META[s.id];
    if (!meta) return;
    setBusyId(s.id);
    try {
      const now = new Date();
      let year = now.getFullYear();
      if (now.getMonth() + 1 > meta.windowMonth) year += 1;
      const iso = `${year}-${String(meta.windowMonth).padStart(2, "0")}-15`;
      const r = await fetch("/api/deadlines", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: iso,
          title: `${s.name} - typical window`,
          kind: "soft",
          type: "scholarship",
          priority: "high",
          officialLink: meta.officialUrl,
          notes: `Typical window: ${meta.typicalWindow}. Exact dates shift every cycle - verify on the official page. ${HUB_META.verifyNote}`,
          reminderDays: [14, 7],
          checklist: [
            { id: "c0", text: "Eligibility checked", done: false },
            { id: "c1", text: "Essay/statement", done: false },
            { id: "c2", text: "Documents gathered", done: false },
            { id: "c3", text: "Submitted", done: false },
          ],
        }),
      });
      if (r.ok) {
        roadmapStore.emit("SCHOLARSHIP_DEADLINE_ADDED", `Added ${s.name} deadline window to the calendar`);
        onToast(`${s.name} window added to your calendar - verify exact date on the official page`);
      }
    } finally {
      setBusyId(null);
    }
  }

  function askStrategist(s: HubScholarship) {
    roadmapStore.emit("SCHOLARSHIP_SAVED", `Interested in ${s.name}`);
    window.dispatchEvent(new CustomEvent("polaris:openAgentRail", {
      detail: { draft: `Am I a realistic candidate for the ${s.name} (${s.value})? Eligibility: ${s.eligibility}. Compare against my profile and tell me what to strengthen. ` },
    }));
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 mb-4">
        {["all", "undergraduate", "master's", "phd"].map((l) => (
          <button
            key={l}
            onClick={() => setLevelFilter(l)}
            className={cn(
              "text-[11.5px] font-medium px-3 py-1.5 rounded-full ring-1 ring-inset transition-colors capitalize",
              levelFilter === l ? "bg-ink text-paper ring-ink" : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
            )}
          >
            {l === "all" ? "All levels" : l}
          </button>
        ))}
        <span className="ml-auto text-[10.5px] font-mono text-ink-muted">{visible.length} scholarships · sourced {HUB_META.lastUpdated}</span>
      </div>

      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"
      >
        {visible.map((s) => {
          const meta = SCHOLARSHIP_META[s.id];
          return (
            <motion.div
              key={s.id}
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
              whileHover={{ y: -5, rotateX: 1.5, transition: { duration: 0.25 } }}
              style={{ transformStyle: "preserve-3d", perspective: 800 }}
              className="app-glass rounded-2xl p-4 relative overflow-hidden group flex flex-col"
            >
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-nova-400 via-polaris-400 to-aurora-400 opacity-70" />
              <div className="flex items-start gap-2.5 mb-2">
                <span className="shrink-0 h-9 w-9 rounded-lg bg-gradient-to-br from-nova-500/25 to-nova-500/5 ring-1 ring-inset ring-nova-400/30 flex items-center justify-center text-nova-600 dark:text-nova-200">
                  <TileIcon d="M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 11.5 7 22l5-3 5 3-1.5-10.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-bold text-ink leading-snug">{s.name}</div>
                  <div className="text-[10.5px] text-ink-muted mt-0.5 truncate">{s.host}</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2">
                <span className="text-[10px] font-bold text-aurora-700 dark:text-aurora-100 bg-aurora-100 dark:bg-aurora-400/15 ring-1 ring-inset ring-aurora-400/40 rounded-full px-2 py-0.5 max-w-full truncate" title={s.value}>
                  {s.value}
                </span>
                {meta && <Chip tone="nova">{SCHOLARSHIP_TYPE_LABEL[meta.type]}</Chip>}
                {s.level.split(",").map((l) => <Chip key={l}>{l.trim()}</Chip>)}
              </div>

              <p className="text-[11.5px] text-ink-dim leading-relaxed line-clamp-2 mb-2" title={s.eligibility}>{s.eligibility}</p>

              {meta && (
                <div className="text-[10.5px] font-mono text-ink-muted mb-3 flex items-center gap-1.5">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M3 7h18M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 3v4M16 3v4"/></svg>
                  {meta.typicalWindow}
                </div>
              )}

              <div className="mt-auto flex items-center gap-2 pt-1">
                {meta && (
                  <>
                    <button
                      onClick={() => void addDeadline(s)}
                      disabled={busyId === s.id}
                      className="text-[11px] font-semibold rounded-full bg-ink text-paper px-2.5 py-1.5 hover:bg-polaris-700 transition-colors disabled:opacity-50"
                    >
                      {busyId === s.id ? "Adding…" : "+ Deadline"}
                    </button>
                    <a href={meta.officialUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-ink-dim hover:text-ink">
                      Official ↗
                    </a>
                  </>
                )}
                <button onClick={() => askStrategist(s)} className="ml-auto text-[11px] font-medium text-polaris-600 dark:text-polaris-300 hover:underline">
                  Ask Strategist
                </button>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Cost explorer
 * ════════════════════════════════════════════════════════════════════════ */

function CostExplorer({ unis, shortlist }: { unis: UniProfile[]; shortlist: Set<string> }) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <p className="text-[11.5px] text-ink-muted mb-4 max-w-2xl leading-relaxed">
        Tuition from each university&apos;s published figures; living costs from official visa/maintenance benchmarks.
        Exact totals vary by program - {HUB_META.verifyNote.toLowerCase()}
      </p>
      <motion.div
        initial="hidden" animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3.5"
      >
        {unis.map((u) => {
          const cc = COUNTRY_COSTS[u.country];
          const isOpen = openId === u.id;
          const saved = shortlist.has(u.id);
          return (
            <motion.div
              key={u.id}
              variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
              className={cn("app-glass rounded-2xl p-4 relative overflow-hidden", saved && "ring-1 ring-polaris-400/40")}
            >
              {saved && (
                <span className="absolute top-3 right-3 text-[9px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300 bg-polaris-100 dark:bg-polaris-400/20 rounded-full px-2 py-0.5">
                  your shortlist
                </span>
              )}
              <div className="flex items-start gap-3">
                <span className="shrink-0 rounded-xl shadow-sm"><UniversityLogo id={u.id} name={u.name} size={42} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[15px] font-bold text-ink leading-tight">{u.name}</div>
                  <div className="text-[10.5px] text-ink-muted mt-0.5">{u.country}</div>
                </div>
              </div>

              {/* cost bars */}
              <div className="mt-3.5 space-y-2">
                <CostRow label="Tuition (intl)" value={u.admissions?.tuitionIntl ?? "Not available from verified source"} pct={70} tone="from-polaris-400 to-polaris-600" />
                <CostRow label="Living (official benchmark)" value={cc?.living ?? "Not available from verified source"} pct={40} tone="from-nova-400 to-nova-600" />
              </div>

              <button
                onClick={() => {
                  setOpenId(isOpen ? null : u.id);
                  if (!isOpen) roadmapStore.emit("COST_GUIDE_VIEWED", `Viewed cost guide for ${u.name}`);
                }}
                className="mt-3 text-[11px] font-medium text-polaris-600 dark:text-polaris-300 hover:underline"
              >
                {isOpen ? "Hide details" : "Funding details + sources"}
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2.5 space-y-2 text-[11.5px] leading-relaxed">
                      <div><span className="font-semibold text-ink">Aid:</span> <span className="text-ink-dim">{u.admissions?.aid ?? "Not available from verified source"}</span></div>
                      <div><span className="font-semibold text-ink">Scholarships:</span> <span className="text-ink-dim">{u.admissions?.scholarships ?? "Not available from verified source"}</span></div>
                      {cc && <div className="text-ink-muted text-[10.5px]">{cc.livingNote}</div>}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 text-[10.5px]">
                        {u.admissions?.admissionsUrl && <a href={u.admissions.admissionsUrl} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline">University costs ↗</a>}
                        {cc && <a href={cc.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline">{cc.sourceName} ↗</a>}
                        <span className="font-mono text-ink-muted">checked {u.lastUpdated}</span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

function CostRow({ label, value, pct, tone }: { label: string; value: string; pct: number; tone: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-ink-muted">{label}</span>
        <span className="text-[11.5px] font-semibold text-ink text-right">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-paper-deep overflow-hidden">
        <motion.div
          initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className={cn("h-full rounded-full bg-gradient-to-r", tone)}
        />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Exam hub (or Explorer hub for younger levels)
 * ════════════════════════════════════════════════════════════════════════ */

const EXAM_TOPICS: Array<{ group: string; topics: Array<{ tag: string; label: string }> }> = [
  { group: "SAT", topics: [
    { tag: "sat-math", label: "Math" },
    { tag: "sat-reading", label: "Reading" },
    { tag: "sat-writing", label: "Writing & grammar" },
  ]},
  { group: "IELTS", topics: [
    { tag: "ielts-listening", label: "Listening" },
    { tag: "ielts-reading", label: "Reading" },
    { tag: "ielts-writing", label: "Writing" },
    { tag: "ielts-speaking", label: "Speaking" },
  ]},
];

const EXPLORER_TOPICS: Array<{ group: string; topics: Array<{ tag: string; label: string }> }> = [
  { group: "Explore & build", topics: [
    { tag: "olympiad-math", label: "Olympiad math" },
    { tag: "reading-habit", label: "Reading" },
    { tag: "science-fair", label: "Science projects" },
    { tag: "coding", label: "Coding" },
  ]},
];

function ExamHub({ young }: { young: boolean }) {
  const groups = young ? EXPLORER_TOPICS : EXAM_TOPICS;
  const all = groups.flatMap((g) => g.topics.map((t) => ({ ...t, group: g.group })));
  const [active, setActive] = useState(all[0]?.tag ?? "");
  const current = all.find((t) => t.tag === active) ?? all[0];
  const resources = useMemo(() => resourcesForTopics([current.tag], 6), [current.tag]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
      {/* topic nav */}
      <div className="app-glass rounded-2xl p-2.5 self-start">
        {groups.map((g) => (
          <div key={g.group} className="mb-2 last:mb-0">
            <div className="px-2 py-1.5 text-[9.5px] uppercase tracking-[0.2em] font-bold text-ink-muted">{g.group}</div>
            {g.topics.map((t) => (
              <button
                key={t.tag}
                onClick={() => { setActive(t.tag); roadmapStore.emit("RESOURCE_OPENED", `Browsing ${g.group} ${t.label} resources`); }}
                className={cn(
                  "w-full text-left px-2.5 py-2 rounded-lg text-[12.5px] font-medium transition-colors flex items-center gap-2",
                  active === t.tag
                    ? "bg-polaris-500/15 text-polaris-700 dark:bg-polaris-400/20 dark:text-polaris-100"
                    : "text-ink-dim hover:bg-paper-soft hover:text-ink",
                )}
              >
                {t.label}
                {active === t.tag && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-polaris-500" />}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* resources */}
      <div className="space-y-2.5">
        <div className="text-[12px] text-ink-dim mb-1">
          <span className="font-serif text-[17px] font-bold text-ink block">{current.group} · {current.label}</span>
          Videos play in-app; practice links open the official platforms.
        </div>
        {resources.map((r) => <HubResourceRow key={r.ref} r={r} />)}
        {resources.length === 0 && <div className="text-[12px] text-ink-muted italic">No curated resources for this topic yet.</div>}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Guides
 * ════════════════════════════════════════════════════════════════════════ */

const GUIDE_TILES: Array<{ tag: string; label: string; desc: string; d: string }> = [
  { tag: "essay", label: "Essays", desc: "Personal statements that worked", d: "M11 4H4v16h16v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" },
  { tag: "applications", label: "Applications", desc: "Timelines, portals, checklists", d: "M22 10L12 5 2 10l10 5 10-5zM6 12.5V17c0 1.4 2.7 2.5 6 2.5s6-1.1 6-2.5v-4.5" },
  { tag: "scholarships", label: "Scholarship strategy", desc: "Finding + winning funding", d: "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM8.5 11.5 7 22l5-3 5 3-1.5-10.5" },
  { tag: "research", label: "Research", desc: "Projects + papers as a student", d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" },
  { tag: "leadership", label: "Leadership", desc: "Clubs with measurable outcomes", d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" },
  { tag: "portfolio", label: "Portfolio", desc: "Showing your work in 30 seconds", d: "M4 4h16v16H4zM4 9h16M9 20V9" },
];

function Guides() {
  const [active, setActive] = useState<string | null>(null);
  const resources = useMemo(() => (active ? resourcesForTopics([active], 6) : []), [active]);

  /* Curated Video Learning - backend. My watch history, newest first.
   * Loaded once from MongoDB when the tab opens. */
  const [watched, setWatched] = useState<WatchedItem[]>([]);
  useEffect(() => {
    fetch("/api/resources/watched")
      .then((res) => res.json())
      .then((rows) => setWatched(rows))
      .catch(() => setWatched([]));
  }, []);

  /* Fast lookup for the "Watched" badge on each row. */
  const watchedRefs = useMemo(() => new Set(watched.map((w) => w.ref)), [watched]);

  /* Called when a video is opened - saves it to MongoDB. */
  function markWatched(ref: string, title: string) {
    // Update the screen straight away, then tell the server.
    setWatched((current) => {
      const existing = current.find((w) => w.ref === ref);
      const updated: WatchedItem = {
        ref,
        title,
        plays: (existing?.plays ?? 0) + 1,
        lastWatchedAt: new Date().toISOString(),
      };
      return [updated, ...current.filter((w) => w.ref !== ref)]; // move to top
    });
    fetch("/api/resources/watched", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref, title }),
    }).catch(() => {});
  }

  return (
    <div>
      {/* My watch history, straight from MongoDB */}
      <WatchHistory items={watched} onReplay={markWatched} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
        {GUIDE_TILES.map((g, i) => (
          <motion.button
            key={g.tag}
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.05 }}
            whileHover={{ y: -4 }}
            onClick={() => { setActive(active === g.tag ? null : g.tag); roadmapStore.emit("RESOURCE_OPENED", `Browsing ${g.label} guides`); }}
            className={cn(
              "app-glass rounded-2xl p-4 text-left transition-colors",
              active === g.tag && "ring-1 ring-polaris-400/50",
            )}
          >
            <span className="inline-flex h-8 w-8 rounded-lg items-center justify-center mb-2 bg-gradient-to-br from-polaris-500/15 to-aurora-500/10 text-polaris-600 dark:text-polaris-300">
              <TileIcon d={g.d} />
            </span>
            <div className="text-[13px] font-bold text-ink">{g.label}</div>
            <div className="text-[10.5px] text-ink-muted mt-0.5">{g.desc}</div>
          </motion.button>
        ))}
      </div>
      {active && (
        <div className="space-y-2.5">
          {resources.map((r) => (
            <HubResourceRow
              key={r.ref}
              r={r}
              watched={watchedRefs.has(r.ref)}
              onWatched={markWatched}
            />
          ))}
          {resources.length === 0 && <div className="text-[12px] text-ink-muted italic">No curated resources for this guide yet.</div>}
        </div>
      )}
    </div>
  );
}

/* One row of my watch history, as /api/resources/watched sends it. */
type WatchedItem = {
  ref: string;
  title: string;
  plays: number;
  lastWatchedAt: string;
};

/* ─── Watch history panel ─── */

function WatchHistory({ items, onReplay }: {
  items: WatchedItem[];
  onReplay: (ref: string, title: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="app-glass rounded-2xl p-4 mb-4">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-ink-muted font-semibold mb-1">
          Continue watching
        </div>
        <p className="text-[12px] text-ink-muted italic">
          Nothing watched yet. Open a guide below and press play.
        </p>
      </div>
    );
  }

  return (
    <div className="app-glass rounded-2xl p-4 mb-4">
      <div className="flex items-center justify-between mb-2.5">
        <div className="text-[10.5px] uppercase tracking-[0.2em] text-ink-muted font-semibold">
          Continue watching
        </div>
        <span className="text-[10px] font-mono text-ink-muted">{items.length}</span>
      </div>

      {/* Reuses the same row component as the guides, so clicking one
          opens the player inline exactly the same way. */}
      <div className="space-y-2">
        {items.slice(0, 5).map((w) => (
          <HubResourceRow
            key={w.ref}
            r={{
              kind: "youtube",
              title: w.title,
              ref: w.ref,
              note: `${new Date(w.lastWatchedAt).toLocaleDateString()}${w.plays > 1 ? ` · watched ${w.plays}x` : ""}`,
            }}
            onWatched={onReplay}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── shared: resource row with in-app video ─── */

function HubResourceRow({ r, watched = false, onWatched }: {
  r: { kind: string; title: string; ref: string; note?: string };
  watched?: boolean;
  onWatched?: (ref: string, title: string) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const embeddable = r.kind === "youtube" && isYouTubeId(r.ref);
  const log = () => {
    roadmapStore.emit("RESOURCE_OPENED", `Opened "${r.title}"`);
    onWatched?.(r.ref, r.title);   // -> POST /api/resources/watched -> MongoDB
  };

  if (embeddable && playing) {
    return (
      <div className="rounded-2xl overflow-hidden ring-1 ring-inset ring-polaris-500/15 dark:ring-white/10">
        <div className="aspect-video">
          <iframe
            src={`https://www.youtube.com/embed/${r.ref}?autoplay=1`}
            title={r.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        </div>
        <div className="px-3 py-2 bg-paper-soft text-[11.5px] text-ink-dim flex items-center justify-between">
          <span className="truncate">{r.title}</span>
          <button onClick={() => setPlaying(false)} className="text-ink-muted hover:text-ink ml-2 shrink-0">close player</button>
        </div>
      </div>
    );
  }

  const kindIcon =
    r.kind === "youtube" ? "M5 3l14 9-14 9V3z" :
    r.kind === "practice" ? "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" :
    r.kind === "pdf" || r.kind === "book" ? "M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" :
    "M10 14a5 5 0 0 1 0-7l3-3a5 5 0 0 1 7 7l-1.5 1.5M14 10a5 5 0 0 1 0 7l-3 3a5 5 0 0 1-7-7l1.5-1.5";

  const cls = "w-full flex items-center gap-3 rounded-2xl px-3.5 py-3 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10 bg-paper-card hover:ring-polaris-400/40 hover:-translate-y-0.5 transition-all text-left";
  const inner = (
    <>
      <span className={cn(
        "h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-gradient-to-br ring-1 ring-inset ring-ink/[0.05] dark:ring-white/[0.08]",
        r.kind === "youtube" ? "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-200" :
        r.kind === "practice" ? "from-polaris-500/20 to-polaris-500/5 text-polaris-600 dark:text-polaris-300" :
        "from-aurora-500/15 to-aurora-500/5 text-aurora-600 dark:text-aurora-200",
      )}>
        <TileIcon d={kindIcon} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink truncate">{r.title}</span>
        {r.note && <span className="block text-[11px] text-ink-muted truncate">{r.note}</span>}
      </span>
      {/* Comes from MongoDB via GET /api/resources/watched */}
      {watched && (
        <span className="shrink-0 rounded-full bg-aurora-100 text-aurora-700 ring-1 ring-inset ring-aurora-400/40 px-2 py-[1px] text-[9.5px] font-bold uppercase tracking-wide dark:bg-aurora-400/15 dark:text-aurora-100">
          Watched
        </span>
      )}
      <span className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted shrink-0">{embeddable ? "play in-app" : r.kind}</span>
    </>
  );

  return embeddable ? (
    <button onClick={() => { log(); setPlaying(true); }} className={cls}>{inner}</button>
  ) : (
    <a href={r.ref} target="_blank" rel="noopener noreferrer" onClick={log} className={cls}>{inner}</a>
  );
}

/* ─── tiny shared chips ─── */

function Chip({ children, tone = "ink" }: { children: React.ReactNode; tone?: "ink" | "polaris" | "nova" }) {
  return (
    <span className={cn(
      "text-[9.5px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[2px] ring-1 ring-inset",
      tone === "polaris" ? "text-polaris-700 dark:text-polaris-200 bg-polaris-100 dark:bg-polaris-400/15 ring-polaris-300/50 dark:ring-polaris-400/30" :
      tone === "nova" ? "text-nova-600 dark:text-nova-200 bg-nova-100 dark:bg-nova-400/15 ring-nova-400/40 dark:ring-nova-400/30" :
      "text-ink-muted bg-paper-soft ring-polaris-500/10 dark:ring-white/10",
    )}>
      {children}
    </span>
  );
}

function HubLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">{children}</div>;
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-soft px-3 py-2.5">
      <div className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted mb-0.5">{label}</div>
      <div className="text-[12px] text-ink leading-snug">{value}</div>
    </div>
  );
}

