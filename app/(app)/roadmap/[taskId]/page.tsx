/**
 * /roadmap/[taskId] - task detail panel rendered as a Next.js route.
 * Using a sibling route (not @modal) keeps deep-links shareable.
 */

import { notFound } from "next/navigation";
import { requireSession } from "@/lib/authz";
import { listMilestones } from "@/lib/tasks/service";
import { TaskPanel } from "@/components/app/TaskPanel";

export const dynamic = "force-dynamic";

export default async function TaskDetailPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  const user = await requireSession();
  const milestones = await listMilestones(user.id);
  const task = milestones.find(m => m.id === taskId);
  if (!task) notFound();
  return <TaskPanel task={task}/>;
}

