/**
 * /partners - the Partner Marketplace. Plan-gated to Pro+.
 *
 * Server derives the matching context from live data - education level +
 * roadmap topics + weak scores from the roadmap doc, deadline types due in
 * the next 30 days, and the elite-tier university ids (the client combines
 * those with the localStorage shortlist) - then hands off to the client
 * marketplace. The offer registry itself contains only real, source-backed
 * offers; matching + rendering happen client-side.
 */

import { requireSession } from "@/lib/authz";
import { planMeets } from "@/lib/features";
import { getRoadmapV2 } from "@/lib/db/collections";
import { listDeadlines } from "@/lib/deadlines/service";
import { getUniversities } from "@/lib/content";
import { PartnersClient } from "@/components/app/PartnersClient";
import type { EducationLevel } from "@/lib/roadmap/types";
import { UpgradeCard } from "@/components/PlanGate";

export const metadata = { title: "Partner Offers" };
export const dynamic = "force-dynamic";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default async function PartnersPage() {
  const user = await requireSession();
  if (!planMeets(user.plan, "pro")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <UpgradeCard
          title="Unlock matched student offers with Pro"
          description="See verified free tools and offers ranked against your roadmap, scores, and upcoming deadlines."
        />
      </div>
    );
  }

  const today = new Date();
  const soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);

  const [doc, deadlines, rawUnis] = await Promise.all([
    getRoadmapV2(user.id).catch(() => null),
    listDeadlines(user.id, { from: iso(today), to: iso(soon) }).catch(() => []),
    getUniversities().catch(() => []),
  ]);

  const level: EducationLevel = doc?.config.educationLevel ?? "hsc";
  const roadmapTopics = doc
    ? [...new Set(doc.branches.flatMap((b) => b.nodes.flatMap((n) => n.topics)))]
    : [];
  const weakScores = (doc?.scores ?? [])
    .filter((s) => s.value / s.max < 0.6)
    .slice(-5)
    .map((s) => ({ key: s.key, label: s.label, ratio: s.value / s.max }));
  const deadlineTypesSoon = [...new Set(deadlines.map((d) => d.type ?? "custom"))];
  const eliteUniIds = (rawUnis as Array<Record<string, unknown>>)
    .filter((u) => u.tier === "elite" || u.tier === "top10")
    .map((u) => String(u.id));

  return (
    <PartnersClient
      level={level}
      roadmapTopics={roadmapTopics}
      weakScores={weakScores}
      deadlineTypesSoon={deadlineTypesSoon}
      eliteUniIds={eliteUniIds}
    />
  );
}
