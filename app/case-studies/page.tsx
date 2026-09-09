"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { GemmaDiscoveryRefresh } from "@/components/app/GemmaDiscoveryRefresh";
import { GArrow, NorthStarMark, useTilt } from "@/components/landing/shared";
import { cn } from "@/lib/cn";

type CaseStudy = {
  id: string;
  title: string;
  locked?: boolean;
  profile: {
    country: string;
    school: string;
    gpa?: string;
    tests?: string;
    ecs?: string[];
    tier: string;
  };
  whatWorked?: string;
  tags: string[];
};

type CaseStudyResponse = {
  items?: CaseStudy[];
  locked?: boolean;
  upgradeMessage?: string;
};

const TIER_LABELS: Record<string, string> = {
  elite: "Elite global",
  top10: "Top 10",
  top50: "Top 50",
  top100: "Top 100",
  top200: "Top 200",
  regional: "Regional",
};

const TIERS = ["All", "elite", "top10", "top50", "top100", "top200"];

type InstitutionSource = {
  name: string;
  domain: string;
  sourceLabel: string;
  sourceUrl: string;
};

// The student narratives are illustrative. These links point to the current
// official institution/program pages so requirements can be checked at source.
const INSTITUTION_SOURCES: Record<string, InstitutionSource> = {
  "cs-mit-1": {
    name: "MIT",
    domain: "mit.edu",
    sourceLabel: "MIT Admissions",
    sourceUrl: "https://mitadmissions.org/apply/",
  },
  "cs-stanford-1": {
    name: "Stanford University",
    domain: "stanford.edu",
    sourceLabel: "Stanford Admission",
    sourceUrl: "https://admission.stanford.edu/apply/first-year/",
  },
  "cs-cmu-1": {
    name: "Carnegie Mellon SCS",
    domain: "cmu.edu",
    sourceLabel: "SCS Admissions",
    sourceUrl: "https://www.cs.cmu.edu/education/undergraduate/admissions",
  },
  "cs-cambridge-1": {
    name: "University of Cambridge",
    domain: "cam.ac.uk",
    sourceLabel: "Mathematics course",
    sourceUrl: "https://www.undergraduate.study.cam.ac.uk/courses/mathematics-ba-hons-mmath",
  },
  "cs-oxford-1": {
    name: "University of Oxford",
    domain: "ox.ac.uk",
    sourceLabel: "Official PPE course",
    sourceUrl: "https://www.ox.ac.uk/admissions/undergraduate/courses/course-listing/philosophy-politics-and-economics",
  },
  "cs-uwaterloo-1": {
    name: "University of Waterloo",
    domain: "uwaterloo.ca",
    sourceLabel: "Computer Science program",
    sourceUrl: "https://uwaterloo.ca/future-students/programs/computer-science",
  },
  "cs-toronto-1": {
    name: "University of Toronto",
    domain: "utoronto.ca",
    sourceLabel: "Engineering Science",
    sourceUrl: "https://discover.engineering.utoronto.ca/programs/engineering-programs/engineering-science/",
  },
  "cs-nus-1": {
    name: "NUS Computing",
    domain: "nus.edu.sg",
    sourceLabel: "Computer Science program",
    sourceUrl: "https://www.comp.nus.edu.sg/programmes/ug/cs/",
  },
  "cs-fulbright-1": {
    name: "Fulbright",
    domain: "fulbrightonline.org",
    sourceLabel: "Foreign Student Program",
    sourceUrl: "https://foreign.fulbrightonline.org/",
  },
  "cs-rhodes-1": {
    name: "Rhodes Trust",
    domain: "rhodeshouse.ox.ac.uk",
    sourceLabel: "Rhodes Scholarship",
    sourceUrl: "https://www.rhodeshouse.ox.ac.uk/scholarships/the-rhodes-scholarship/",
  },
  "cs-tum-1": {
    name: "Technical University of Munich",
    domain: "tum.de",
    sourceLabel: "Informatics B.Sc.",
    sourceUrl: "https://www.tum.de/en/studies/degree-programs/detail/informatics-bachelor-of-science-bsc",
  },
  "cs-imperial-1": {
    name: "Imperial College London",
    domain: "imperial.ac.uk",
    sourceLabel: "Computing program",
    sourceUrl: "https://www.imperial.ac.uk/computing/prospective-students/courses/ug/beng-meng-computing/",
  },
  "cs-knight-hennessy-1": {
    name: "Knight-Hennessy Scholars",
    domain: "knight-hennessy.stanford.edu",
    sourceLabel: "Official admission guide",
    sourceUrl: "https://knight-hennessy.stanford.edu/admission",
  },
  "cs-gates-cam-1": {
    name: "Gates Cambridge",
    domain: "gatescambridge.org",
    sourceLabel: "Cambridge funding guide",
    sourceUrl: "https://www.postgraduate.study.cam.ac.uk/funding/applying-university-funding",
  },
  "cs-budget-1": {
    name: "University of Toronto",
    domain: "utoronto.ca",
    sourceLabel: "Awards and scholarships",
    sourceUrl: "https://future.utoronto.ca/scholarships",
  },
};

export default function CaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [filterCountry, setFilterCountry] = useState("All");
  const [filterTier, setFilterTier] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [upgradeMessage, setUpgradeMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/content/case-studies", { signal: controller.signal })
      .then(async (response) => {
        const data = (await response.json()) as CaseStudyResponse;
        if (!response.ok) throw new Error("The evidence library could not be loaded.");
        setCaseStudies(data.items ?? []);
        setUpgradeMessage(data.upgradeMessage ?? "");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "The evidence library could not be loaded.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, []);

  const countries = useMemo(
    () => ["All", ...new Set(caseStudies.map((study) => study.profile.country))],
    [caseStudies],
  );

  const filtered = useMemo(() => {
    return caseStudies.filter((study) => {
      if (filterCountry !== "All" && study.profile.country !== filterCountry) return false;
      if (filterTier !== "All" && study.profile.tier !== filterTier) return false;
      return true;
    });
  }, [caseStudies, filterCountry, filterTier]);

  const resetFilters = () => {
    setFilterCountry("All");
    setFilterTier("All");
    setExpanded(null);
  };

  const filtersActive = filterCountry !== "All" || filterTier !== "All";

  return (
    <main className="min-h-screen overflow-hidden bg-paper text-ink selection:bg-signal-rose selection:text-white">
      <Nav />

      <section
        id="evidence-library"
        data-section-theme="light"
        className="relative scroll-mt-24 bg-paper px-4 pb-20 pt-12 sm:px-6 sm:pb-24 sm:pt-16"
      >
        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-6 border-b border-ink/10 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="max-w-3xl text-balance font-sans text-4xl font-bold leading-[1.03] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[58px]">
                Find the story that looks like your next move<span className="text-signal-rose">.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-dim sm:text-base">
                Compare illustrative student profiles, then verify current requirements through the official university and scholarship sources linked on every card.
              </p>
            </div>

            <div className="flex items-center gap-3 text-sm">
              <span className="tabular-nums text-ink-dim" aria-live="polite">
                {loading ? "Loading profiles" : `${filtered.length} of ${caseStudies.length} profiles`}
              </span>
              {filtersActive && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full bg-paper-card px-3 py-1.5 text-xs font-semibold text-polaris-600 shadow-[0_8px_24px_-16px_rgba(44,24,16,0.55)] transition-colors hover:text-ink"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-paper-card p-4 shadow-[0_20px_60px_-42px_rgba(44,24,16,0.5)] sm:p-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_1.08fr] xl:items-start">
              <FilterGroup
                label="Country"
                options={countries}
                value={filterCountry}
                onChange={(value) => {
                  setFilterCountry(value);
                  setExpanded(null);
                }}
              />
              <FilterGroup
                label="University tier"
                options={TIERS}
                value={filterTier}
                getLabel={(value) => (value === "All" ? "All" : TIER_LABELS[value] ?? value)}
                onChange={(value) => {
                  setFilterTier(value);
                  setExpanded(null);
                }}
              />
            </div>
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl shadow-[0_20px_60px_-42px_rgba(44,24,16,0.45)]">
            <GemmaDiscoveryRefresh
              surface="case-studies"
              defaultQuery="Evidence-backed admission patterns for students from Bangladesh and South Asia"
              compact
            />
          </div>

          {error ? (
            <ErrorState message={error} />
          ) : loading ? (
            <CaseStudySkeletons />
          ) : filtered.length > 0 ? (
            <motion.div layout className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence initial={false} mode="popLayout">
                {filtered.map((study, index) => (
                  <CaseStudyCard
                    key={study.id}
                    study={study}
                    index={index}
                    expanded={expanded === study.id}
                    upgradeMessage={upgradeMessage}
                    onToggle={() => setExpanded(expanded === study.id ? null : study.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <EmptyState onReset={resetFilters} />
          )}
        </div>
      </section>

      <Footer />
    </main>
  );
}

function FilterGroup({
  label,
  options,
  value,
  onChange,
  getLabel = (option) => option,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  getLabel?: (value: string) => string;
}) {
  return (
    <fieldset>
      <legend className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition-[background-color,color,box-shadow,transform] duration-200",
                active
                  ? "bg-ink text-paper shadow-[0_8px_22px_-14px_rgba(44,24,16,0.8)]"
                  : "bg-paper-soft text-ink-dim hover:-translate-y-px hover:bg-paper-deep hover:text-ink",
              )}
            >
              {getLabel(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function CaseStudyCard({
  study,
  index,
  expanded,
  upgradeMessage,
  onToggle,
}: {
  study: CaseStudy;
  index: number;
  expanded: boolean;
  upgradeMessage: string;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tilt = useTilt(4.25);
  const tier = TIER_LABELS[study.profile.tier] ?? study.profile.tier;
  const source = INSTITUTION_SOURCES[study.id] ?? {
    name: study.tags[0] ?? "Institution",
    domain: "",
    sourceLabel: "Official information",
    sourceUrl: "",
  };
  const atmospheres = [
    "bg-polaris-300/24",
    "bg-aurora-400/22",
    "bg-rose-300/24",
  ];

  return (
    <motion.div
      layout="position"
      initial={reduceMotion ? false : { opacity: 0.72, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.035, ease: [0.16, 1, 0.3, 1] }}
      className="h-full [perspective:1200px]"
    >
      <motion.article
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        whileHover={reduceMotion ? undefined : { y: -7, scale: 1.01 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        style={{
          rotateX: reduceMotion ? 0 : tilt.rotateX,
          rotateY: reduceMotion ? 0 : tilt.rotateY,
          transformStyle: "preserve-3d",
        }}
        className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-paper-card p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_20px_58px_-38px_rgba(44,24,16,0.62)] transition-shadow duration-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.84),0_34px_72px_-38px_rgba(44,24,16,0.72)] sm:p-6"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full opacity-60 blur-3xl transition-[opacity,transform] duration-500 group-hover:scale-110 group-hover:opacity-100",
            atmospheres[index % atmospheres.length],
          )}
        />

        <div className="relative flex items-start justify-between gap-3" style={{ transform: "translateZ(34px)" }}>
          <div className="flex min-w-0 items-center gap-3">
            <InstitutionMark source={source} />
            <div className="min-w-0">
              <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-aurora-700">Official institution</div>
              <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-tight text-ink-dim">{source.name}</div>
            </div>
          </div>
          <span className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
            study.profile.tier === "elite" ? "bg-[#F5DDE3] text-signal-rose" : "bg-polaris-100 text-polaris-700",
          )}>
            {tier}
          </span>
        </div>

        <div className="relative" style={{ transform: "translateZ(24px)" }}>
          <h3 className="mt-6 text-balance font-serif text-lg font-bold leading-snug text-ink sm:text-[19px]">
            {study.title}
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {study.profile.school} <span aria-hidden>·</span> {study.profile.country}
          </p>
          {source.sourceUrl ? (
            <a
              href={source.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-aurora-700 underline decoration-aurora-500/30 underline-offset-4 transition-colors hover:text-ink focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aurora-500/50"
              aria-label={`Open ${source.sourceLabel} on the official website`}
            >
              {source.sourceLabel}
              <span aria-hidden className="-rotate-45"><GArrow s={11} /></span>
            </a>
          ) : (
            <span className="mt-3 block text-[10.5px] font-medium text-ink-muted">Source link pending</span>
          )}
        </div>

        <div className="relative mt-5 flex flex-wrap gap-1.5" style={{ transform: "translateZ(18px)" }}>
          {study.tags.slice(0, 5).map((tag) => (
            <span key={tag} className="rounded-full bg-paper-soft px-2.5 py-1 text-[10.5px] text-ink-dim">
              {tag}
            </span>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {expanded && !study.locked && (
            <motion.div
              initial={reduceMotion ? false : { height: 0, opacity: 0, filter: "blur(4px)" }}
              animate={{ height: "auto", opacity: 1, filter: "blur(0px)" }}
              exit={{ height: 0, opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: reduceMotion ? 0 : 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-6 border-t border-ink/10 pt-5">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <ProfileFact label="Academic record" value={study.profile.gpa} />
                  <ProfileFact label="Tests" value={study.profile.tests} />
                </dl>

                {study.profile.ecs && study.profile.ecs.length > 0 && (
                  <div className="mt-5">
                    <div className="text-[10px] font-semibold uppercase tracking-[0.17em] text-ink-muted">Activities</div>
                    <ul className="mt-2.5 space-y-2">
                      {study.profile.ecs.map((activity) => (
                        <li key={activity} className="flex gap-2.5 text-xs leading-relaxed text-ink-dim">
                          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aurora-500" />
                          {activity}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {study.whatWorked && (
                  <div className="mt-5 rounded-xl bg-aurora-100/65 p-4">
                    <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.17em] text-aurora-700">
                      <NorthStarMark s={13} /> What moved the decision
                    </div>
                    <p className="mt-2.5 text-[13px] leading-relaxed text-ink">{study.whatWorked}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative mt-auto border-t border-ink/10 pt-4" style={{ transform: "translateZ(22px)" }}>
          {study.locked ? (
            <Link
              href="/#pricing"
              className="group/link flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-polaris-600 transition-colors hover:text-ink"
              title={upgradeMessage || "Upgrade to Pro to read the full analysis"}
            >
              <span className="flex items-center gap-2">
                <LockIcon /> Unlock the full analysis
              </span>
              <span className="transition-transform group-hover/link:translate-x-1"><GArrow s={13} /></span>
            </Link>
          ) : (
            <button
              type="button"
              aria-expanded={expanded}
              onClick={onToggle}
              className="flex w-full items-center justify-between gap-3 text-left text-xs font-semibold text-polaris-600 transition-colors hover:text-ink"
            >
              <span>{expanded ? "Close analysis" : "Read the full analysis"}</span>
              <ChevronIcon open={expanded} />
            </button>
          )}
        </div>
      </motion.article>
    </motion.div>
  );
}

function InstitutionMark({ source }: { source: InstitutionSource }) {
  const initials = source.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const logoUrl = source.domain
    ? `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(`https://${source.domain}`)}&sz=128`
    : "";

  return (
    <span className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white text-[11px] font-bold text-polaris-700 shadow-[0_14px_28px_-18px_rgba(44,24,16,0.5)] ring-1 ring-inset ring-ink/[0.08]">
      <span aria-hidden>{initials}</span>
      {logoUrl && (
        // The favicon service fetches the mark published by the institution's
        // own domain. Initials remain underneath as a resilient fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          aria-hidden
          src={logoUrl}
          width="38"
          height="38"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute h-[38px] w-[38px] object-contain"
          onError={(event) => { event.currentTarget.hidden = true; }}
        />
      )}
    </span>
  );
}

function ProfileFact({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] font-semibold uppercase tracking-[0.17em] text-ink-muted">{label}</dt>
      <dd className="mt-1.5 text-xs leading-relaxed text-ink">{value}</dd>
    </div>
  );
}

function CaseStudySkeletons() {
  return (
    <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading case studies">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="rounded-2xl bg-paper-card p-6 shadow-[0_18px_55px_-38px_rgba(44,24,16,0.58)]">
          <div className="flex justify-between">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-paper-deep motion-reduce:animate-none" />
            <div className="h-5 w-20 animate-pulse rounded-full bg-paper-deep motion-reduce:animate-none" />
          </div>
          <div className="mt-6 h-5 w-11/12 animate-pulse rounded-md bg-paper-deep motion-reduce:animate-none" />
          <div className="mt-2 h-5 w-3/5 animate-pulse rounded-md bg-paper-deep motion-reduce:animate-none" />
          <div className="mt-4 h-3 w-2/3 animate-pulse rounded-full bg-paper-soft motion-reduce:animate-none" />
          <div className="mt-6 flex gap-2">
            <div className="h-6 w-16 animate-pulse rounded-full bg-paper-soft motion-reduce:animate-none" />
            <div className="h-6 w-20 animate-pulse rounded-full bg-paper-soft motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-10 rounded-2xl bg-paper-card px-6 py-14 text-center shadow-[0_18px_55px_-38px_rgba(44,24,16,0.58)]">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-paper-soft text-polaris-600">
        <NorthStarMark s={21} />
      </div>
      <h3 className="mt-5 font-serif text-xl font-bold text-ink">No profiles match that route yet.</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-dim">
        Try a broader country or university tier to bring more accepted-student evidence back into view.
      </p>
      <button
        type="button"
        onClick={onReset}
        className="mt-5 rounded-full bg-ink px-4 py-2.5 text-xs font-semibold text-paper transition-transform hover:-translate-y-0.5"
      >
        Show every profile
      </button>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-10 rounded-2xl bg-[#F5DDE3] px-6 py-8 text-center text-signal-rose">
      <h3 className="font-serif text-lg font-bold">The evidence library is temporarily unavailable.</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed">{message} Refresh the page to try again.</p>
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.svg
      aria-hidden
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      animate={{ rotate: open ? 180 : 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <path d="M6 9l6 6 6-6" />
    </motion.svg>
  );
}

function LockIcon() {
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  );
}
