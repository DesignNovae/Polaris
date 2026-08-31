"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { useLang } from "@/lib/i18n/LangProvider";
import { cn } from "@/lib/cn";

type Uni = {
  id: string;
  name: string;
  country: string;
  city: string;
  tier: string;
  acceptanceRate: number;
  topPrograms: string[];
  summary: string;
  tags: string[];
};

const TIER_LABEL: Record<string, string> = {
  elite: "Elite global",
  top10: "Top 10 global",
  top50: "Top 50 global",
  top100: "Top 100",
  top200: "Top 200",
  regional: "Regional",
};

export default function UniversityListPage() {
  const { t } = useLang();
  const [list, setList] = useState<Uni[]>([]);

  useEffect(() => {
    fetch("/api/content/universities")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setList((d.items ?? []) as Uni[]))
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
          {t.uni.title}
        </h1>
        <p className="mt-3 text-ink-dim max-w-2xl">{t.uni.subtitle}</p>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((u) => (
            <Link
              key={u.id}
              href={`/university/${u.id}`}
              className="glass rounded-2xl p-5 hover:border-polaris-400/30 hover:shadow-md transition group"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-ink group-hover:text-gradient transition">
                    {u.name}
                  </div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {u.city} · {u.country}
                  </div>
                </div>
                <span className={cn(
                  "text-[10px] uppercase tracking-wide rounded-full px-2 py-0.5",
                  u.tier === "elite"
                    ? "bg-nova-500/15 text-nova-500 border border-nova-500/30"
                    : "bg-polaris-500/10 text-polaris-500 border border-polaris-400/25"
                )}>
                  {TIER_LABEL[u.tier] ?? u.tier}
                </span>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-ink-muted">Acceptance</span>
                <span className="font-semibold text-ink tabular-nums">
                  {(u.acceptanceRate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {u.topPrograms.slice(0, 3).map((p) => (
                  <span
                    key={p}
                    className="text-[11px] rounded-full border border-polaris-500/20 px-2 py-0.5 text-ink-dim"
                  >
                    {p}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>
      <Footer />
    </main>
  );
}

