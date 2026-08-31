"use client";

import { useState, useMemo, useEffect } from "react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/cn";
import { GemmaDiscoveryRefresh } from "@/components/app/GemmaDiscoveryRefresh";

type CaseStudy = {
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

const TIER_LABELS: Record<string, string> = {
  elite: "Elite global",
  top10: "Top 10",
  top50: "Top 50",
  top100: "Top 100",
  top200: "Top 200",
  regional: "Regional",
};

const TIERS = ["All", "elite", "top10", "top50", "top100", "top200"];

export default function CaseStudiesPage() {
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [filterCountry, setFilterCountry] = useState("All");
  const [filterTier, setFilterTier] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/content/case-studies")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setCaseStudies((d.items ?? []) as CaseStudy[]))
      .catch(() => {});
  }, []);

  const COUNTRIES = useMemo(
    () => ["All", ...new Set(caseStudies.map((c) => c.profile.country))],
    [caseStudies],
  );

  const filtered = useMemo(() => {
    return caseStudies.filter((c) => {
      if (filterCountry !== "All" && c.profile.country !== filterCountry) return false;
      if (filterTier !== "All" && c.profile.tier !== filterTier) return false;
      return true;
    });
  }, [caseStudies, filterCountry, filterTier]);

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
          Case Studies
        </h1>
        <p className="mt-3 text-ink-dim max-w-2xl">
          Real stories from accepted students. See what worked, what they had, and how they got in.
        </p>

        {/* Filters */}
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted uppercase tracking-wider">Country</span>
            <div className="flex flex-wrap gap-1">
              {COUNTRIES.map((c) => (
                <button
                  key={c}
                  onClick={() => setFilterCountry(c)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border transition-colors duration-150",
                    filterCountry === c
                      ? "bg-polaris-100 border-polaris-400 text-ink"
                      : "bg-white border-polaris-200 text-ink-dim hover:border-polaris-300",
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-muted uppercase tracking-wider">Tier</span>
            <div className="flex flex-wrap gap-1">
              {TIERS.map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTier(t)}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs border transition-colors duration-150",
                    filterTier === t
                      ? "bg-polaris-100 border-polaris-400 text-ink"
                      : "bg-white border-polaris-200 text-ink-dim hover:border-polaris-300",
                  )}
                >
                  {t === "All" ? "All" : TIER_LABELS[t] ?? t}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 text-xs text-ink-muted">{filtered.length} case studies</div>

        <div className="mt-5"><GemmaDiscoveryRefresh surface="case-studies" defaultQuery="Evidence-backed admission patterns for students from Bangladesh and South Asia" compact /></div>

        {/* Cards */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((cs) => (
            <div
              key={cs.id}
              className="glass rounded-2xl p-5 hover:border-polaris-400/30 hover:shadow-md transition cursor-pointer"
              onClick={() => setExpanded(expanded === cs.id ? null : cs.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="font-semibold text-ink text-sm leading-snug">
                  {cs.title}
                </div>
                <span
                  className={cn(
                    "flex-none text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5 border",
                    cs.profile.tier === "elite"
                      ? "bg-nova-500/15 text-nova-500 border-nova-500/30"
                      : "bg-polaris-500/10 text-polaris-500 border-polaris-400/25",
                  )}
                >
                  {TIER_LABELS[cs.profile.tier] ?? cs.profile.tier}
                </span>
              </div>

              <div className="mt-2 text-xs text-ink-muted">
                {cs.profile.school} · {cs.profile.country}
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {cs.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    className="text-[11px] rounded-full border border-polaris-500/20 px-2 py-0.5 text-ink-dim"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {expanded === cs.id && (
                <div className="mt-4 pt-4 border-t border-polaris-500/15 space-y-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">
                      Profile
                    </div>
                    <div className="text-xs text-ink-dim space-y-1">
                      <div><span className="font-medium text-ink">GPA:</span> {cs.profile.gpa}</div>
                      <div><span className="font-medium text-ink">Tests:</span> {cs.profile.tests}</div>
                      <div>
                        <span className="font-medium text-ink">Activities:</span>{" "}
                        {cs.profile.ecs.join(" · ")}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-aurora-500 mb-1">
                      What worked
                    </div>
                    <p className="text-sm text-ink leading-relaxed">{cs.whatWorked}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 glass rounded-3xl p-8 text-center">
            <div className="text-ink-dim">No case studies match your filters.</div>
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}

