"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Stats = {
  totalUsers: number;
  plans: { free: number; pro: number; elite: number };
  roles: { student: number; parent: number; partner: number; admin: number };
  roadmaps: number;
  links: number;
  profiles: number;
};

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.stats && setStats(d.stats))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-ink-dim">Loading…</p>;
  if (!stats) return <p className="text-ink-dim">Failed to load stats.</p>;

  const paid = stats.plans.pro + stats.plans.elite;
  const conversion = stats.totalUsers ? Math.round((paid / stats.totalUsers) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total users" value={stats.totalUsers} />
        <Stat label="Paid users" value={paid} sub={`${conversion}% conversion`} accent />
        <Stat label="Roadmaps" value={stats.roadmaps} />
        <Stat label="Parent/partner links" value={stats.links} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Breakdown
          title="Plan distribution"
          rows={[
            { label: "Free", value: stats.plans.free, color: "bg-polaris-300" },
            { label: "Pro", value: stats.plans.pro, color: "bg-polaris-500" },
            { label: "Elite", value: stats.plans.elite, color: "bg-aurora-500" },
          ]}
          total={stats.totalUsers}
        />
        <Breakdown
          title="Role distribution"
          rows={[
            { label: "Student", value: stats.roles.student, color: "bg-polaris-400" },
            { label: "Parent", value: stats.roles.parent, color: "bg-nova-400" },
            { label: "Partner", value: stats.roles.partner, color: "bg-aurora-400" },
            { label: "Admin", value: stats.roles.admin, color: "bg-nova-500" },
          ]}
          total={stats.totalUsers}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: boolean }) {
  return (
    <div className={cn("glass rounded-2xl p-5", accent && "border border-polaris-400/30")}>
      <div className="text-xs uppercase tracking-[0.15em] text-ink-muted">{label}</div>
      <div className="mt-1 text-3xl font-serif font-bold text-ink tabular-nums">{value}</div>
      {sub && <div className="mt-1 text-xs text-aurora-500">{sub}</div>}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  total,
}: {
  title: string;
  rows: { label: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <div className="glass-strong rounded-2xl p-6">
      <div className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-4">{title}</div>
      <div className="space-y-3">
        {rows.map((r) => {
          const pct = total ? Math.round((r.value / total) * 100) : 0;
          return (
            <div key={r.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-ink">{r.label}</span>
                <span className="text-ink-dim tabular-nums">{r.value} · {pct}%</span>
              </div>
              <div className="h-2 rounded-full bg-polaris-100 overflow-hidden">
                <div className={cn("h-full rounded-full transition-all", r.color)} style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

