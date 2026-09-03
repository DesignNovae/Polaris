"use client";

import { GemmaDiscoveryRefresh } from "@/components/app/GemmaDiscoveryRefresh";
import {
  DiscoveryNoteField,
  type DiscoveryNotesController,
  useDiscoveryNotes,
} from "@/components/app/DiscoveryNoteField";
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { ProbabilityInputs } from "@/lib/ml/probability";
import {
  computeFit, nextOccurrence, daysUntil, FIT_TONES,
  type UniProfile, type FitBand,
} from "@/lib/admissions";
import { roadmapStore } from "@/lib/roadmap/store";
import { UniversityLogo } from "./UniversityLogo";
import { FitBreakdown, FactorSlider, FACTORS } from "./FitBreakdown";
import { Icon } from "./ui";
import { PremiumSelect, OptionDot } from "@/components/ui/PremiumSelect";
import { cn } from "@/lib/cn";

const WISHLIST_KEY = "polaris.unis.wishlist";

/** Compact ISO-style code badge instead of flag emojis (which render as
 *  plain letters on Windows and look broken). */
const COUNTRY_CODE: Record<string, string> = {
  USA: "US", UK: "GB", Canada: "CA", Singapore: "SG",
  Germany: "DE", India: "IN", Bangladesh: "BD",
};

function CountryBadge({ country, className }: { country: string; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center justify-center rounded-[4px] px-1 py-[1px] text-[8.5px] font-mono font-bold tracking-wide",
      "bg-gradient-to-b from-polaris-500/15 to-polaris-500/5 text-polaris-700 ring-1 ring-inset ring-polaris-500/25",
      "dark:from-polaris-400/25 dark:to-polaris-400/10 dark:text-polaris-200 dark:ring-polaris-400/30",
      className,
    )}>
      {COUNTRY_CODE[country] ?? country.slice(0, 2).toUpperCase()}
    </span>
  );
}

const BAND_STYLES: Record<FitBand, string> = {
  "Reach": "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30",
  "Competitive Reach": "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100 dark:ring-nova-400/30",
  "Target": "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/20 dark:text-polaris-100 dark:ring-polaris-400/40",
  "Likely": "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30",
  "Safety": "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/20 dark:text-aurora-100 dark:ring-aurora-400/40",
};

type DifficultyFilter = "all" | "ultra" | "very" | "selective" | "accessible";
type AidFilter = "all" | "full-need" | "some" ;
type TestFilter = "all" | "required" | "optional" | "none";

export function UniversitiesClient({
  universities, initialInputs,
}: {
  universities: UniProfile[];
  initialInputs: ProbabilityInputs;
}) {
  const [inputs, setInputs] = useState<ProbabilityInputs>(initialInputs);
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [aidFilter, setAidFilter] = useState<AidFilter>("all");
  const [testFilter, setTestFilter] = useState<TestFilter>("all");
  const [shortlistOnly, setShortlistOnly] = useState(false);
  const [labOpen, setLabOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [importUni, setImportUni] = useState<UniProfile | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const universityNotes = useDiscoveryNotes("university");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(WISHLIST_KEY);
      if (raw) setWishlist(new Set(JSON.parse(raw)));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  function toggleWishlist(u: UniProfile) {
    setWishlist((s) => {
      const next = new Set(s);
      if (next.has(u.id)) next.delete(u.id);
      else {
        next.add(u.id);
        roadmapStore.emit("UNIVERSITY_SHORTLISTED", `Shortlisted ${u.name}`);
        // Offer deadline import when the school has real deadline patterns.
        if (u.admissions?.deadlines.length) setImportUni(u);
      }
      try { localStorage.setItem(WISHLIST_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function toggleCompare(id: string) {
    setCompareIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 3 ? cur : [...cur, id],
    );
  }

  const fits = useMemo(() => {
    const m: Record<string, ReturnType<typeof computeFit>> = {};
    for (const u of universities) m[u.id] = computeFit(inputs, u);
    return m;
  }, [inputs, universities]);

  const countries = useMemo(
    () => ["all", ...[...new Set(universities.map((u) => u.country))]],
    [universities],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return universities.filter((u) => {
      if (shortlistOnly && !wishlist.has(u.id)) return false;
      if (country !== "all" && u.country !== country) return false;
      if (difficulty !== "all") {
        const r = u.acceptanceRate;
        if (difficulty === "ultra" && r >= 0.10) return false;
        if (difficulty === "very" && (r < 0.10 || r >= 0.25)) return false;
        if (difficulty === "selective" && (r < 0.25 || r >= 0.45)) return false;
        if (difficulty === "accessible" && r < 0.45) return false;
      }
      if (aidFilter !== "all") {
        const aid = (u.admissions?.aid ?? "").toLowerCase();
        const fullNeed = aid.includes("need-blind") || aid.includes("100%") || aid.includes("full");
        if (aidFilter === "full-need" && !fullNeed) return false;
        if (aidFilter === "some" && (fullNeed || aid.includes("no aid") || aid.includes("no need"))) return false;
      }
      if (testFilter !== "all") {
        const t = (u.admissions?.testPolicy ?? "").toLowerCase();
        if (testFilter === "required" && !t.includes("required")) return false;
        if (testFilter === "optional" && !(t.includes("optional") || t.includes("flexible"))) return false;
        if (testFilter === "none" && !(t.includes("blind") || t.includes("not required") || t.includes("not used") || t.includes("no sat") || t.includes("only"))) return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q) ||
        u.topPrograms.some((p) => p.toLowerCase().includes(q)) ||
        (u.admissions?.applicationSystems ?? []).some((s) => s.toLowerCase().includes(q)) ||
        u.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [universities, query, country, difficulty, aidFilter, testFilter, shortlistOnly, wishlist]);

  const detail = universities.find((u) => u.id === detailId) ?? null;
  const compareUnis = compareIds.map((id) => universities.find((u) => u.id === id)).filter(Boolean) as UniProfile[];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1280px] mx-auto">
      {/* ─── Header ─── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0">
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">University discovery</div>
          <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
            {universities.length} real universities · <span className="grad-text">explainable fit</span>
          </h1>
          <p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
            Sourced &amp; dated official data. Fit bands are <span className="font-semibold text-ink">estimates from your profile</span>.
          </p>
        </div>
        <button
          onClick={() => setLabOpen((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
            labOpen ? "bg-ink text-paper" : "bg-paper-card hairline text-ink-dim hover:text-ink",
          )}
        >
          <Icon.spark size={13} /> Scenario lab
        </button>
      </motion.div>

      <GemmaDiscoveryRefresh surface="universities" defaultQuery="Universities with strong financial aid, computer science, and realistic options for a Bangladeshi student" />

      {/* ─── Scenario lab (what-if sliders drive every fit chip live) ─── */}
      <AnimatePresence initial={false}>
        {labOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="app-glass rounded-2xl p-5 mb-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">What-if engine</div>
                  <div className="text-[12px] text-ink-dim mt-0.5">Drag - every card&apos;s fit band recomputes live.</div>
                </div>
                <button onClick={() => setInputs(initialInputs)} className="text-[12px] text-polaris-600 dark:text-polaris-300 font-medium hover:underline">
                  Reset to my profile
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {FACTORS.map((f) => (
                  <FactorSlider key={f.id} factor={f} inputs={inputs} onChange={setInputs} labelWidth="w-[170px]" />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Search + compact filter selects ─── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <label className="flex items-center gap-2 h-9 px-3 rounded-xl bg-paper-card hairline focus-within:ring-1 focus-within:ring-polaris-400 flex-1 min-w-[220px] max-w-md">
          <span className="text-ink-muted shrink-0"><Icon.search size={14} /></span>
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search universities, majors, systems…"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-muted/70 outline-none min-w-0"
          />
          {query && <button onClick={() => setQuery("")} className="text-ink-muted hover:text-ink"><Icon.close size={12} /></button>}
        </label>

        <PremiumSelect
          value={country}
          onChange={setCountry}
          searchable
          options={[
            { value: "all", label: "All countries", count: universities.length, icon: <GlobeMini /> },
            ...countries.filter((c) => c !== "all").map((c) => ({
              value: c,
              label: c,
              count: universities.filter((u) => u.country === c).length,
              icon: <CountryBadge country={c} />,
            })),
          ]}
          label="Country"
        />
        <PremiumSelect
          value={difficulty}
          onChange={(v) => setDifficulty(v as DifficultyFilter)}
          label="Difficulty"
          options={[
            { value: "all", label: "Any" },
            { value: "ultra", label: "<10% accept", description: "Ultra selective", icon: <OptionDot className="bg-rose-500" /> },
            { value: "very", label: "10–25%", description: "Very selective", icon: <OptionDot className="bg-nova-500" /> },
            { value: "selective", label: "25–45%", description: "Selective", icon: <OptionDot className="bg-polaris-500" /> },
            { value: "accessible", label: "45%+", description: "Accessible", icon: <OptionDot className="bg-aurora-500" /> },
          ]}
        />
        <PremiumSelect
          value={aidFilter}
          onChange={(v) => setAidFilter(v as AidFilter)}
          label="Aid"
          options={[
            { value: "all", label: "Any" },
            { value: "full-need", label: "Full need met", description: "Meets 100% of demonstrated need", icon: <CoinMini /> },
            { value: "some", label: "Some aid", description: "Partial or merit-based support", icon: <CoinMini /> },
          ]}
        />
        <PremiumSelect
          value={testFilter}
          onChange={(v) => setTestFilter(v as TestFilter)}
          label="Tests"
          options={[
            { value: "all", label: "Any" },
            { value: "required", label: "Required", description: "SAT/ACT scores required", icon: <TestMini /> },
            { value: "optional", label: "Optional", description: "Test-optional policy", icon: <TestMini /> },
            { value: "none", label: "Not used", description: "Scores not considered", icon: <TestMini /> },
          ]}
        />

        <button
          onClick={() => setShortlistOnly((v) => !v)}
          className={cn(
            "h-9 text-[12px] font-medium px-3 rounded-xl ring-1 ring-inset transition-colors inline-flex items-center gap-1.5",
            shortlistOnly
              ? "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/20 dark:text-rose-100 dark:ring-rose-400/40"
              : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
          )}
        >
          <Heart filled={shortlistOnly} className="h-3 w-3" /> {wishlist.size}
        </button>
      </div>

      {/* ─── Card grid ─── */}
      {visible.length === 0 ? (
        <div className="app-glass rounded-2xl p-12 text-center">
          <div className="font-serif text-[18px] font-bold text-ink">No universities match</div>
          <p className="text-[12.5px] text-ink-dim mt-1.5">Loosen a filter or clear the search.</p>
        </div>
      ) : (
        <motion.div
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4"
        >
          {visible.map((u) => (
            <UniCard
              key={u.id}
              u={u}
              fit={fits[u.id]}
              saved={wishlist.has(u.id)}
              comparing={compareIds.includes(u.id)}
              notes={universityNotes}
              onOpen={() => { setDetailId(u.id); roadmapStore.emit("UNIVERSITY_VIEWED", `Viewed ${u.name}`); }}
              onSave={() => toggleWishlist(u)}
              onCompare={() => toggleCompare(u.id)}
            />
          ))}
        </motion.div>
      )}

      {/* ─── Compare bar ─── */}
      <AnimatePresence>
        {compareIds.length > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 app-glass-dark text-paper rounded-full pl-4 pr-2 py-2 shadow-pop flex items-center gap-3"
          >
            <span className="text-[12px] font-medium">{compareIds.length} selected</span>
            <div className="flex -space-x-2">
              {compareUnis.map((u) => (
                <span key={u.id} className="ring-2 ring-ink rounded-lg"><UniversityLogo id={u.id} name={u.name} size={26} /></span>
              ))}
            </div>
            <button
              onClick={() => setCompareOpen(true)}
              disabled={compareIds.length < 2}
              className="rounded-full bg-paper text-ink px-3.5 py-1.5 text-[12px] font-bold hover:bg-polaris-100 transition-colors disabled:opacity-40"
            >
              Compare →
            </button>
            <button onClick={() => setCompareIds([])} className="text-paper/60 hover:text-paper p-1" aria-label="Clear compare">
              <Icon.close size={12} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Modals + toast ─── */}
      <AnimatePresence>
        {detail && (
          <UniDetailModal
            key={detail.id}
            u={detail}
            fit={fits[detail.id]}
            saved={wishlist.has(detail.id)}
            onSave={() => toggleWishlist(detail)}
            onClose={() => setDetailId(null)}
            onImportDeadlines={() => setImportUni(detail)}
            inputs={inputs}
            onInputsChange={setInputs}
            onInputsReset={() => setInputs(initialInputs)}
          />
        )}
        {compareOpen && compareUnis.length >= 2 && (
          <CompareModal key="compare" unis={compareUnis} fits={fits} onClose={() => setCompareOpen(false)} />
        )}
        {importUni && (
          <ImportDeadlinesModal
            key={`import-${importUni.id}`}
            u={importUni}
            onClose={() => setImportUni(null)}
            onDone={(n) => {
              setImportUni(null);
              setToast(`${n} deadline${n === 1 ? "" : "s"} added to your calendar`);
              roadmapStore.emit("DEADLINES_IMPORTED", `Imported ${n} ${importUni.name} deadlines to the calendar`);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop"
          >
            ✦ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Card - 3D tilt, logo depth, urgency ring, fit band
 * ════════════════════════════════════════════════════════════════════════ */

function UniCard({
  u, fit, saved, comparing, notes, onOpen, onSave, onCompare,
}: {
  u: UniProfile;
  fit: ReturnType<typeof computeFit>;
  saved: boolean;
  comparing: boolean;
  notes: DiscoveryNotesController;
  onOpen: () => void;
  onSave: () => void;
  onCompare: () => void;
}) {
  const next = u.admissions?.deadlines
    .map((d) => ({ d, when: nextOccurrence(d) }))
    .sort((a, b) => a.when.getTime() - b.when.getTime())[0];
  const days = next ? daysUntil(next.when) : null;

  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
      whileHover={{ y: -6, rotateX: 2, rotateY: -2, transition: { duration: 0.25 } }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      className="group app-glass rounded-2xl p-4 relative overflow-hidden cursor-pointer"
      onClick={onOpen}
    >
      {/* gradient sheen on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-polaris-200/20 via-transparent to-aurora-200/15" />

      <div className="relative flex items-start gap-3">
        <span className="shrink-0 rounded-xl shadow-[0_6px_18px_-6px_rgba(0,0,0,0.35)] group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-300">
          <UniversityLogo id={u.id} name={u.name} size={46} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-serif text-[15.5px] font-bold text-ink leading-tight truncate">{u.name}</div>
          <div className="text-[11px] text-ink-muted mt-0.5 truncate flex items-center gap-1.5">
            <CountryBadge country={u.country} />
            <span className="truncate">{u.city}{u.city.includes(u.country) ? "" : `, ${u.country}`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1.5">
            {(u.admissions?.typeTags ?? u.tags.slice(0, 2)).slice(0, 3).map((t) => (
              <span key={t} className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted bg-paper-soft rounded px-1.5 py-[2px]">{t}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 flex flex-col items-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button onClick={onSave} aria-label={saved ? "Remove from shortlist" : "Shortlist"} className={cn("p-1 rounded-md transition-all", saved ? "text-rose-500 scale-110" : "text-ink-muted/50 hover:text-rose-500 hover:scale-110")}>
            <Heart filled={saved} className="h-4 w-4" />
          </button>
          <button
            onClick={onCompare}
            aria-label="Compare"
            title="Add to compare"
            className={cn(
              "h-5 w-5 rounded-md ring-1 ring-inset inline-flex items-center justify-center transition-colors",
              comparing ? "bg-ink text-paper ring-ink" : "text-ink-muted ring-ink-faint/40 hover:ring-polaris-400",
            )}
          >
            {comparing ? (
              <Icon.check size={9} />
            ) : (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16"/></svg>
            )}
          </button>
        </div>
      </div>

      <div className="relative mt-3.5 flex items-center gap-2 flex-wrap">
        <span className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset", BAND_STYLES[fit.band])} title="Estimated fit from your profile - not an official probability">
          {fit.band}
        </span>
        <span className="text-[10.5px] font-mono text-ink-muted">accepts {(u.acceptanceRate * 100).toFixed(1)}%</span>
        {next && days !== null && (
          <span className={cn(
            "ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-mono rounded-full px-2 py-0.5 ring-1 ring-inset",
            days <= 14 ? "text-rose-600 ring-rose-300/50 bg-rose-50 dark:text-rose-200 dark:bg-rose-400/15 dark:ring-rose-400/30"
              : days <= 45 ? "text-nova-600 ring-nova-400/40 bg-nova-100 dark:text-nova-100 dark:bg-nova-400/15"
              : "text-ink-muted ring-ink-faint/30 bg-paper-soft",
          )}>
            <UrgencyRing days={days} />
            {next.d.label.length > 18 ? next.d.label.slice(0, 16) + "…" : next.d.label} · {days}d
          </span>
        )}
      </div>

      <div className="relative mt-2.5 flex items-center gap-2 text-[10.5px] text-ink-muted">
        <span className="truncate">{u.admissions?.applicationSystems.join(" / ") ?? "-"}</span>
        {u.admissions && (u.admissions.aid.toLowerCase().includes("need-blind") || u.admissions.aid.toLowerCase().includes("full")) && (
          <span className="ml-auto shrink-0 inline-flex items-center gap-1 text-aurora-600 dark:text-aurora-200 font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora-500" /> aid
          </span>
        )}
      </div>

      <DiscoveryNoteField entityId={u.id} controller={notes} />
    </motion.div>
  );
}

/** Mini countdown ring for deadline urgency. */
function UrgencyRing({ days }: { days: number }) {
  const pct = Math.max(0, Math.min(1, 1 - days / 90));
  const r = 4.5, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 12 12" className="h-3 w-3 -rotate-90">
      <circle cx="6" cy="6" r={r} fill="none" strokeWidth="1.6" className="stroke-current opacity-25" />
      <circle cx="6" cy="6" r={r} fill="none" strokeWidth="1.6" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="stroke-current" />
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Detail modal - product page
 * ════════════════════════════════════════════════════════════════════════ */

function UniDetailModal({
  u, fit, saved, onSave, onClose, onImportDeadlines,
  inputs, onInputsChange, onInputsReset,
}: {
  u: UniProfile;
  fit: ReturnType<typeof computeFit>;
  saved: boolean;
  onSave: () => void;
  onClose: () => void;
  onImportDeadlines: () => void;
  inputs: ProbabilityInputs;
  onInputsChange: (next: ProbabilityInputs) => void;
  onInputsReset: () => void;
}) {
  function askStrategist() {
    roadmapStore.emit("UNIVERSITY_VIEWED", `Asked Strategist about ${u.name} (fit: ${fit.band})`);
    window.dispatchEvent(new CustomEvent("polaris:openAgentRail", {
      detail: { draft: `How do I improve my chances for ${u.name}? My estimated fit is "${fit.band}" - biggest gap: ${fit.biggestGap ?? "unknown"}. ` },
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
        className="relative w-full max-w-[680px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* Hero */}
        <div className="relative px-6 pt-6 pb-5 border-b border-polaris-500/10 dark:border-white/[0.08] overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-polaris-200/25 via-transparent to-aurora-200/20 dark:from-polaris-400/10 dark:to-aurora-400/10 pointer-events-none" />
          <div className="relative flex items-start gap-4">
            <span className="shrink-0 rounded-2xl shadow-[0_10px_26px_-8px_rgba(0,0,0,0.4)]">
              <UniversityLogo id={u.id} name={u.name} size={64} />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-[24px] leading-tight font-bold tracking-tight text-ink">{u.name}</h2>
              <div className="text-[12px] text-ink-dim mt-0.5 flex items-center gap-1.5">
                <CountryBadge country={u.country} />
                <span>{u.city}{u.city.includes(u.country) ? "" : `, ${u.country}`} · accepts {(u.acceptanceRate * 100).toFixed(1)}%</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                <span className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset", BAND_STYLES[fit.band])}>{fit.band}</span>
                {(u.admissions?.typeTags ?? []).map((t) => (
                  <span key={t} className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted bg-paper-soft rounded px-1.5 py-[2px]">{t}</span>
                ))}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <button onClick={onSave} className={cn("p-2 rounded-lg transition-all", saved ? "text-rose-500 bg-rose-50 dark:bg-rose-400/15" : "text-ink-muted hover:text-rose-500")} aria-label="Shortlist">
                <Heart filled={saved} className="h-4.5 w-4.5 h-[18px] w-[18px]" />
              </button>
              <button onClick={onClose} className="text-ink-muted hover:text-ink p-2" aria-label="Close"><Icon.close /></button>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          <p className="text-[13px] text-ink leading-relaxed">{u.summary}</p>

          {/* Acceptance-probability engine: the score, why it is what it is,
              and live what-if sliders. */}
          <section>
            <SectionHead title="Why this score" />
            <FitBreakdown
              fit={fit}
              inputs={inputs}
              onChange={onInputsChange}
              onReset={onInputsReset}
            />
          </section>

          {/* Deadlines */}
          {u.admissions && u.admissions.deadlines.length > 0 && (
            <section>
              <SectionHead title="Deadlines" action={
                <button onClick={onImportDeadlines} className="text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline">
                  + Add to my calendar
                </button>
              }/>
              <ul className="space-y-1.5">
                {u.admissions.deadlines.map((d) => {
                  const when = nextOccurrence(d);
                  const days = daysUntil(when);
                  return (
                    <li key={d.label} className="flex items-center gap-2.5 rounded-xl bg-paper-soft px-3 py-2 text-[12.5px]">
                      <span className={cn("h-2 w-2 rounded-full shrink-0", days <= 14 ? "bg-rose-500" : days <= 45 ? "bg-nova-500" : "bg-aurora-500")} />
                      <span className="font-medium text-ink flex-1 min-w-0 truncate">{d.label}</span>
                      <span className="font-mono text-[11px] text-ink-dim shrink-0">
                        {when.toLocaleDateString("en-US", { month: "short", day: "numeric" })} · {days}d
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* Requirements grid */}
          <section>
            <SectionHead title="Requirements" />
            <div className="grid sm:grid-cols-2 gap-2.5">
              <InfoTile label="Application" value={u.admissions?.applicationSystems.join(" / ") ?? "Not available"} />
              <InfoTile label="Test policy" value={u.admissions?.testPolicy ?? u.requirements.tests ?? "Not available"} />
              <InfoTile label="English" value={u.admissions?.english ?? "Not available"} />
              <InfoTile label="Academics" value={u.requirements.gpa ?? "Not available"} />
              <InfoTile label="Essays" value={u.requirements.essays ?? "Not available"} />
              <InfoTile label="Recommendations" value={u.requirements.recs ?? "Not available"} />
            </div>
            {u.requirements.differentiators && (
              <div className="mt-2.5 rounded-xl bg-polaris-100/50 dark:bg-polaris-400/10 ring-1 ring-inset ring-polaris-400/30 px-3.5 py-2.5 text-[12px] text-ink leading-relaxed">
                <span className="font-bold text-polaris-700 dark:text-polaris-200">What actually moves the needle:</span> {u.requirements.differentiators}
              </div>
            )}
          </section>

          {/* Money */}
          <section>
            <SectionHead title="Cost & aid" />
            <div className="grid sm:grid-cols-2 gap-2.5">
              <InfoTile label="International tuition" value={u.admissions?.tuitionIntl ?? "Not available"} />
              <InfoTile label="Financial aid" value={u.admissions?.aid ?? "Not available"} />
            </div>
            {u.admissions?.scholarships && (
              <div className="mt-2.5 text-[12px] text-ink-dim"><span className="font-semibold text-ink">Scholarships:</span> {u.admissions.scholarships}</div>
            )}
          </section>

          {/* Programs */}
          <section>
            <SectionHead title="Strong programs" />
            <div className="flex flex-wrap gap-1.5">
              {u.topPrograms.map((p) => (
                <span key={p} className="text-[11.5px] font-medium text-ink bg-paper-soft rounded-full px-2.5 py-1 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/10">{p}</span>
              ))}
            </div>
          </section>

          {/* Sources */}
          <section className="rounded-xl bg-paper-soft px-3.5 py-3 text-[11.5px] text-ink-dim leading-relaxed">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 text-aurora-700 dark:text-aurora-200 font-bold text-[10px] uppercase tracking-wider">
                <Icon.check size={10} /> Official sources
              </span>
              <span className="font-mono text-[10.5px]">last checked {u.lastUpdated}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
              {u.admissions?.officialWebsite && <a href={u.admissions.officialWebsite} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline">Official site ↗</a>}
              {u.admissions?.admissionsUrl && <a href={u.admissions.admissionsUrl} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline">Admissions ↗</a>}
              {(u.admissions?.sourceUrls ?? []).map((s) => (
                <a key={s} href={s} target="_blank" rel="noopener noreferrer" className="text-ink-muted hover:text-ink hover:underline truncate max-w-[260px]">{new URL(s).hostname} ↗</a>
              ))}
            </div>
            <div className="mt-1 text-[10.5px] italic">{u.verifyNote}</div>
          </section>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-3.5 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2">
          <button
            onClick={onSave}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors",
              saved ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100" : "bg-ink text-paper hover:bg-polaris-700",
            )}
          >
            <Heart filled={saved} className="h-3.5 w-3.5" /> {saved ? "Shortlisted" : "Shortlist"}
          </button>
          <button onClick={askStrategist} className="text-[12.5px] text-polaris-600 dark:text-polaris-300 hover:underline font-medium">
            Ask Strategist →
          </button>
          {u.admissions?.admissionsUrl && (
            <a href={u.admissions.admissionsUrl} target="_blank" rel="noopener noreferrer" className="ml-auto text-[12px] text-ink-muted hover:text-ink">
              Apply on official site ↗
            </a>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SectionHead({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium">{title}</div>
      {action}
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-paper-soft px-3 py-2.5">
      <div className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted mb-0.5">{label}</div>
      <div className="text-[12px] text-ink leading-snug">{value}</div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Compare modal
 * ════════════════════════════════════════════════════════════════════════ */

function CompareModal({
  unis, fits, onClose,
}: {
  unis: UniProfile[];
  fits: Record<string, ReturnType<typeof computeFit>>;
  onClose: () => void;
}) {
  const rows: Array<{ label: string; get: (u: UniProfile) => string }> = [
    { label: "Fit (estimate)", get: (u) => fits[u.id]?.band ?? "-" },
    { label: "Acceptance", get: (u) => `${(u.acceptanceRate * 100).toFixed(1)}%` },
    { label: "Application", get: (u) => u.admissions?.applicationSystems.join(", ") ?? "Not available" },
    { label: "Next deadline", get: (u) => {
        const next = u.admissions?.deadlines.map((d) => ({ d, when: nextOccurrence(d) })).sort((a, b) => a.when.getTime() - b.when.getTime())[0];
        return next ? `${next.d.label} - ${next.when.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not available";
      } },
    { label: "Tests", get: (u) => u.admissions?.testPolicy ?? "Not available" },
    { label: "English", get: (u) => u.admissions?.english ?? "Not available" },
    { label: "Tuition (intl)", get: (u) => u.admissions?.tuitionIntl ?? "Not available" },
    { label: "Aid", get: (u) => u.admissions?.aid ?? "Not available" },
    { label: "Scholarships", get: (u) => u.admissions?.scholarships ?? "Not available" },
    { label: "Academics", get: (u) => u.requirements.gpa ?? "Not available" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 12, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[860px] max-h-[88vh] overflow-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        <div className="sticky top-0 z-10 bg-paper-card/90 backdrop-blur-md px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-3">
          <h2 className="font-serif text-[20px] font-bold tracking-tight text-ink">Side-by-side</h2>
          <button onClick={onClose} className="ml-auto text-ink-muted hover:text-ink p-1.5" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="px-6 py-5 overflow-x-auto">
          <table className="w-full text-[12px] min-w-[560px]">
            <thead>
              <tr>
                <th className="text-left w-[140px]" />
                {unis.map((u) => (
                  <th key={u.id} className="text-left pb-3 pr-4">
                    <div className="flex items-center gap-2">
                      <UniversityLogo id={u.id} name={u.name} size={34} />
                      <div>
                        <div className="font-serif text-[13.5px] font-bold text-ink leading-tight">{u.name}</div>
                        <div className="text-[10px] font-mono text-ink-muted flex items-center gap-1"><CountryBadge country={u.country} /> {u.country}</div>
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="align-top">
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-polaris-500/10 dark:border-white/[0.06]">
                  <td className="py-2.5 pr-3 text-[10.5px] uppercase tracking-wider font-bold text-ink-muted whitespace-nowrap">{r.label}</td>
                  {unis.map((u) => (
                    <td key={u.id} className="py-2.5 pr-4 text-ink leading-snug">
                      {r.label === "Fit (estimate)" ? (
                        <span className={cn("text-[10px] uppercase tracking-wider font-bold rounded-full px-2 py-0.5 ring-1 ring-inset", BAND_STYLES[(fits[u.id]?.band ?? "Target") as FitBand])}>
                          {r.get(u)}
                        </span>
                      ) : r.get(u)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
 * Import deadlines modal - confirm before adding to the calendar
 * ════════════════════════════════════════════════════════════════════════ */

const APP_CHECKLIST = [
  "Application form", "Essays", "Transcript", "Recommendation letters",
  "Test scores sent", "Financial aid documents",
];

function ImportDeadlinesModal({
  u, onClose, onDone,
}: {
  u: UniProfile;
  onClose: () => void;
  onDone: (added: number) => void;
}) {
  const items = useMemo(
    () => (u.admissions?.deadlines ?? []).map((d) => ({ d, when: nextOccurrence(d) })),
    [u],
  );
  const [picked, setPicked] = useState<Set<string>>(new Set(items.map((i) => i.d.label)));
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    let added = 0;
    try {
      for (const it of items) {
        if (!picked.has(it.d.label)) continue;
        const iso = `${it.when.getFullYear()}-${String(it.when.getMonth() + 1).padStart(2, "0")}-${String(it.when.getDate()).padStart(2, "0")}`;
        const res = await fetch("/api/deadlines", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            date: iso,
            title: `${u.name} - ${it.d.label}`,
            kind: "hard",
            type: "application",
            priority: "high",
            universityId: u.id,
            universityName: u.name,
            officialLink: u.admissions?.admissionsUrl,
            reminderDays: [7, 3, 1],
            checklist: APP_CHECKLIST.map((text, i) => ({ id: `c${i}`, text, done: false })),
          }),
        });
        if (res.ok) added++;
      }
      onDone(added);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[55] flex items-center justify-center bg-ink/45 backdrop-blur-sm p-6"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10, opacity: 0 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="bg-paper-card rounded-3xl shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12] max-w-[460px] w-full p-6"
      >
        <div className="flex items-center gap-3 mb-3">
          <UniversityLogo id={u.id} name={u.name} size={38} />
          <div>
            <h2 className="font-serif text-[17px] font-bold tracking-tight text-ink leading-tight">
              {u.name} has {items.length} key deadline{items.length === 1 ? "" : "s"}
            </h2>
            <p className="text-[11.5px] text-ink-muted">Add them to your calendar with an application checklist?</p>
          </div>
        </div>
        <ul className="space-y-1.5 mb-4">
          {items.map((it) => {
            const on = picked.has(it.d.label);
            return (
              <li key={it.d.label}>
                <button
                  onClick={() => setPicked((s) => { const n = new Set(s); if (on) n.delete(it.d.label); else n.add(it.d.label); return n; })}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-xl px-3 py-2 text-left ring-1 ring-inset transition-colors text-[12.5px]",
                    on ? "bg-polaris-100/60 dark:bg-polaris-400/10 ring-polaris-400/40" : "bg-paper-soft ring-transparent opacity-60",
                  )}
                >
                  <span className={cn("h-[16px] w-[16px] shrink-0 rounded ring-1 ring-inset flex items-center justify-center", on ? "bg-polaris-500 ring-polaris-500 text-white" : "ring-ink-faint")}>
                    {on && <Icon.check size={9} />}
                  </span>
                  <span className="flex-1 font-medium text-ink truncate">{it.d.label}</span>
                  <span className="font-mono text-[11px] text-ink-dim shrink-0">
                    {it.when.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} disabled={busy} className="text-[13px] text-ink-dim hover:text-ink px-3 py-2">Not now</button>
          <button
            onClick={() => void add()}
            disabled={busy || picked.size === 0}
            className="inline-flex items-center gap-2 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors disabled:opacity-50"
          >
            {busy ? (
              <><span className="h-3.5 w-3.5 rounded-full border-2 border-paper/30 border-t-paper animate-spin" /> Adding…</>
            ) : (
              <>Add {picked.size} to calendar</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ─── shared glyph ─── */
function Heart({ filled, className }: { filled: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

/** Compact styled select - one control per filter keeps the row clean. */
/* Mini glyphs for dropdown options. */
function GlobeMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-ink-muted">
      <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function CoinMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="text-aurora-600 dark:text-aurora-300">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v10M9.5 9.5c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.5-2.5 1.9-2.5.9-2.5 1.9 1.1 1.7 2.5 1.7 2.5-.7 2.5-1.7" />
    </svg>
  );
}
function TestMini() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-polaris-600 dark:text-polaris-300">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 13l2 2 4-4" />
    </svg>
  );
}
