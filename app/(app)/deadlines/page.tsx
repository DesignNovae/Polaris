/**
 * /deadlines - server page. Loads the user's full deadline horizon (past 90
 * days → next 18 months) for the initial paint, then hands off to
 * DeadlinesClient: Agenda countdown cards, Month calendar, and the Risk
 * board, plus workload insights and the rich detail modal - all backed by
 * /api/deadlines.
 */

import { requireSession } from "@/lib/authz";
import { listDeadlines, type DbDeadline } from "@/lib/deadlines/service";
import { DeadlinesClient, type UiDeadline } from "@/components/app/DeadlinesClient";

export const metadata = { title: "Deadlines" };
export const dynamic = "force-dynamic";

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function toUi(d: DbDeadline): UiDeadline {
  return {
    id: d._id?.toString() ?? "",
    date: d.date,
    title: d.title,
    kind: d.kind,
    milestoneId: d.milestoneId,
    type: d.type ?? "custom",
    priority: d.priority ?? "medium",
    status: d.status ?? "pending",
    universityId: d.universityId,
    universityName: d.universityName,
    officialLink: d.officialLink,
    notes: d.notes ?? "",
    checklist: d.checklist ?? [],
    reminderDays: d.reminderDays ?? [],
    source: d.source,
  };
}

export default async function DeadlinesPage() {
  const user = await requireSession();
  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 90);
  const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 550);

  const items = await listDeadlines(user.id, { from: iso(from), to: iso(to) });
  return <DeadlinesClient initial={items.map(toUi)} />;
}
