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

const ORBIT_POINTS = Array.from({ length: 18 }, (_, index) => ({
  left: `${9 + ((index * 37) % 82)}%`,
  top: `${8 + ((index * 53) % 82)}%`,
  delay: (index % 7) * 0.22,
  size: index % 5 === 0 ? 4 : 2,
}));

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

      <CaseStudiesHero caseStudies={caseStudies} loading={loading} />

      <section
        id="evidence-library"
        data-section-theme="light"
        className="relative scroll-mt-24 bg-paper px-4 py-20 sm:px-6 sm:py-24"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[linear-gradient(to_bottom,rgba(44,24,16,0.08),transparent)]"
        />

        <div className="relative mx-auto max-w-6xl">
          <div className="grid gap-6 border-b border-ink/10 pb-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <h2 className="max-w-3xl text-balance font-sans text-4xl font-bold leading-[1.03] tracking-[-0.03em] text-ink sm:text-5xl lg:text-[58px]">
                Find the story that looks like your next move<span className="text-signal-rose">.</span>
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-ink-dim sm:text-base">
                Compare the grades, tests, activities, and decisions behind each profile. Filter by region or ambition, then open a story to see what carried the application.
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

function CaseStudiesHero({ caseStudies, loading }: { caseStudies: CaseStudy[]; loading: boolean }) {
  const reduceMotion = useReducedMotion();
  const countryCount = new Set(caseStudies.map((study) => study.profile.country)).size;
  const tierCount = new Set(caseStudies.map((study) => study.profile.tier)).size;

  return (
    <section
      data-section-theme="dark"
      className="relative -mt-16 min-h-[760px] overflow-hidden bg-[#241510] px-4 pb-20 pt-36 text-paper sm:px-6 sm:pb-24 sm:pt-40"
    >
      <HeroAtmosphere />

      <div className="relative mx-auto grid min-h-[590px] max-w-7xl items-center gap-14 lg:grid-cols-[0.92fr_1.08fr] lg:gap-8">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0.84, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 max-w-2xl"
        >
          <h1 className="text-balance font-sans text-[44px] font-bold leading-[0.98] tracking-[-0.035em] text-paper sm:text-6xl lg:text-[72px]">
            Every acceptance leaves a trail. <em className="font-serif font-normal italic text-[#F5C0C9]">Learn to read it</em><span className="text-signal-rose">.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-paper/70 sm:text-lg">
            Real stories from accepted students. See what worked, what they had, and how they got in.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#evidence-library"
              className="group inline-flex items-center gap-2 rounded-full bg-paper px-5 py-3 text-sm font-semibold text-ink shadow-[0_14px_38px_-18px_rgba(250,246,240,0.55)] transition-transform hover:-translate-y-0.5"
            >
              Explore the evidence
              <span className="transition-transform duration-200 group-hover:translate-x-1">
                <GArrow s={14} />
              </span>
            </Link>
            <Link
              href="/#how"
              className="rounded-full bg-white/[0.07] px-5 py-3 text-sm font-medium text-paper ring-1 ring-inset ring-white/15 backdrop-blur-md transition-colors hover:bg-white/[0.12]"
            >
              How Polaris works
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-paper/50">
            <span>{loading ? "Loading the library" : `${caseStudies.length} accepted-student profiles`}</span>
            {!loading && caseStudies.length > 0 && (
              <>
                <span aria-hidden className="h-1 w-1 rounded-full bg-polaris-300/60" />
                <span>{countryCount} countries</span>
                <span aria-hidden className="h-1 w-1 rounded-full bg-polaris-300/60" />
                <span>{tierCount} admission tiers</span>
              </>
            )}
          </div>
        </motion.div>

        <HeroEvidenceDeck caseStudies={caseStudies.slice(0, 3)} loading={loading} />
      </div>

      <div aria-hidden className="absolute inset-x-0 bottom-0 h-28 bg-[linear-gradient(to_bottom,transparent,#FAF6F0)]" />
    </section>
  );
}

function HeroAtmosphere() {
  const reduceMotion = useReducedMotion();

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <motion.div
        className="absolute -left-[18%] top-[8%] h-[560px] w-[560px] rounded-full bg-polaris-400/20 blur-[120px]"
        animate={reduceMotion ? undefined : { x: [0, 42, 0], y: [0, 24, 0], scale: [1, 1.08, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute -right-[12%] top-[16%] h-[520px] w-[520px] rounded-full bg-aurora-500/15 blur-[130px]"
        animate={reduceMotion ? undefined : { x: [0, -36, 0], y: [0, -30, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute left-[58%] top-[44%] h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.05]" />
      <div className="absolute left-[58%] top-[44%] h-[410px] w-[410px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-polaris-300/[0.08]" />
      {ORBIT_POINTS.map((point, index) => (
        <motion.span
          key={index}
          className="absolute rounded-full bg-polaris-200"
          style={{ left: point.left, top: point.top, width: point.size, height: point.size }}
          animate={reduceMotion ? undefined : { opacity: [0.18, 0.75, 0.18], scale: [0.8, 1.35, 0.8] }}
          transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: point.delay }}
        />
      ))}
    </div>
  );
}

function HeroEvidenceDeck({ caseStudies, loading }: { caseStudies: CaseStudy[]; loading: boolean }) {
  const tilt = useTilt(4.5);
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0.82, y: 28, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 1, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto h-[470px] w-full max-w-[620px]"
      style={{ perspective: 1200 }}
    >
      <motion.div
        onMouseMove={tilt.onMouseMove}
        onMouseLeave={tilt.onMouseLeave}
        style={{ rotateX: tilt.rotateX, rotateY: tilt.rotateY, transformStyle: "preserve-3d" }}
        className="absolute inset-0"
      >
        <motion.div
          className="absolute left-[7%] top-[8%] w-[78%] rounded-2xl bg-[#3A251D]/88 p-5 text-paper shadow-[0_34px_90px_-36px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-6"
          style={{ transform: "translateZ(-34px) rotate(-6deg)", transformOrigin: "center" }}
          animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
          transition={{ duration: 7.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <DeckCardContent study={caseStudies[1]} loading={loading} subdued />
        </motion.div>

        <motion.div
          className="absolute bottom-[8%] right-[3%] w-[72%] rounded-2xl bg-[#1A100D]/94 p-5 text-paper shadow-[0_42px_100px_-42px_rgba(0,0,0,0.95)] ring-1 ring-inset ring-white/10 backdrop-blur-xl sm:p-6"
          style={{ transform: "translateZ(20px) rotate(5deg)", transformOrigin: "center" }}
          animate={reduceMotion ? undefined : { y: [0, 8, 0] }}
          transition={{ duration: 8.5, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        >
          <DeckCardContent study={caseStudies[2]} loading={loading} subdued />
        </motion.div>

        <div
          className="absolute left-[12%] top-[25%] z-20 w-[80%] rounded-2xl bg-paper-card p-5 text-ink shadow-[0_45px_110px_-38px_rgba(0,0,0,0.9)] sm:p-7"
          style={{ transform: "translateZ(66px) rotate(-1.25deg)", transformOrigin: "center" }}
        >
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-ink/10 pb-4">
            <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-polaris-600">
              <NorthStarMark s={16} /> Evidence profile
            </span>
            <span className="h-2 w-2 rounded-full bg-aurora-500 shadow-[0_4px_14px_rgba(91,140,109,0.55)]" />
          </div>
          <DeckCardContent study={caseStudies[0]} loading={loading} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function DeckCardContent({
  study,
  loading,
  subdued = false,
}: {
  study?: CaseStudy;
  loading: boolean;
  subdued?: boolean;
}) {
  if (loading || !study) {
    return (
      <div className="space-y-3" aria-hidden>
        <div className={cn("h-3 w-24 rounded-full", subdued ? "bg-white/10" : "bg-ink/10")} />
        <div className={cn("h-5 w-4/5 rounded-md", subdued ? "bg-white/10" : "bg-ink/10")} />
        <div className={cn("h-3 w-3/5 rounded-full", subdued ? "bg-white/[0.07]" : "bg-ink/[0.07]")} />
      </div>
    );
  }

  const tier = TIER_LABELS[study.profile.tier] ?? study.profile.tier;
  return (
    <>
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em]", subdued ? "bg-white/[0.08] text-polaris-200" : "bg-polaris-100 text-polaris-700")}>
          {tier}
        </span>
        <span className={cn("truncate text-[10px]", subdued ? "text-paper/45" : "text-ink-muted")}>{study.profile.country}</span>
      </div>
      <h3 className={cn("mt-4 font-serif font-bold leading-snug", subdued ? "text-[15px] text-paper/88" : "text-xl text-ink sm:text-[22px]")}>
        {study.title}
      </h3>
      <p className={cn("mt-3 line-clamp-2 text-xs leading-relaxed", subdued ? "text-paper/45" : "text-ink-dim")}>
        {study.profile.school}
      </p>
      {!subdued && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {study.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-paper-soft px-2.5 py-1 text-[10px] text-ink-dim">
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
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
  const tier = TIER_LABELS[study.profile.tier] ?? study.profile.tier;
  const institution = study.tags[0] ?? study.profile.country;
  const initials = institution.slice(0, 2).toUpperCase();
  const tones = [
    "bg-polaris-100 text-polaris-700",
    "bg-aurora-100 text-aurora-700",
    "bg-[#F5DDE3] text-signal-rose",
  ];

  return (
    <motion.article
      layout="position"
      initial={reduceMotion ? false : { opacity: 0.72, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: reduceMotion ? 0 : 0.34, delay: reduceMotion ? 0 : Math.min(index, 5) * 0.035, ease: [0.16, 1, 0.3, 1] }}
      className="group flex h-fit flex-col overflow-hidden rounded-2xl bg-paper-card p-5 shadow-[0_18px_55px_-38px_rgba(44,24,16,0.58)] transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_26px_66px_-38px_rgba(44,24,16,0.66)] sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl font-serif text-sm font-bold", tones[index % tones.length])}>
          {initials}
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.12em]",
          study.profile.tier === "elite" ? "bg-[#F5DDE3] text-signal-rose" : "bg-polaris-100 text-polaris-700",
        )}>
          {tier}
        </span>
      </div>

      <h3 className="mt-5 text-balance font-serif text-lg font-bold leading-snug text-ink sm:text-[19px]">
        {study.title}
      </h3>
      <p className="mt-2 text-xs leading-relaxed text-ink-muted">
        {study.profile.school} <span aria-hidden>·</span> {study.profile.country}
      </p>

      <div className="mt-5 flex flex-wrap gap-1.5">
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

      <div className="mt-6 border-t border-ink/10 pt-4">
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
