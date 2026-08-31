"use client";

/**
 * Roadmap task card - server-rendered list item with a click target that
 * opens TaskPanel. Pure presentation; no fetching here.
 */

import Link from "next/link";
import type { DbMilestone } from "@/types/app";
import { Card, Progress, StatusBadge } from "./ui";
import { cn } from "@/lib/cn";

type CategoryStyle = { color: "polaris" | "nova" | "aurora"; glyph: string };
const CATEGORIES: Record<DbMilestone["category"], CategoryStyle> = {
  Academics:        { color: "polaris", glyph: "A" },
  Testing:          { color: "nova",    glyph: "T" },
  Extracurriculars: { color: "aurora",  glyph: "E" },
  Skills:           { color: "polaris", glyph: "S" },
  Applications:     { color: "aurora",  glyph: "P" },
};

export function TaskCard({
  task,
  progress = 0,
}: {
  task: DbMilestone;
  progress?: number;
}) {
  const cat = CATEGORIES[task.category];
  const dot = { polaris: "bg-polaris-500", nova: "bg-nova-500", aurora: "bg-aurora-500" }[cat.color];
  const accent = { polaris: "text-polaris-500", nova: "text-nova-600", aurora: "text-aurora-600" }[cat.color];

  return (
    <Card className="group hover:shadow-lg transition-shadow">
      <Link href={`/roadmap/${task.id}`} scroll={false} className="block p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 shrink-0 w-[140px]">
            <span className={cn("h-7 w-7 rounded-md text-white font-mono text-[11px] font-bold inline-flex items-center justify-center", dot)}>
              {cat.glyph}
            </span>
            <div className="min-w-0">
              <div className={cn("text-[11px] font-medium", accent)}>{task.category}</div>
              <div className="text-[10px] font-mono text-ink-muted">{task.priority}</div>
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge s={task.status}/>
              {task.deadline && <span className="text-[11px] text-ink-muted font-mono">· due {task.deadline}</span>}
            </div>
            <div className="font-serif text-[16px] font-bold text-ink leading-tight">{task.title}</div>
            <div className="text-[12.5px] text-ink-dim mt-0.5 line-clamp-1">{task.description}</div>
          </div>

          <div className="shrink-0 w-[200px] hidden lg:block">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium mb-1">Success metric</div>
            <div className="text-[12px] text-ink leading-tight line-clamp-2">{task.metric}</div>
          </div>

          <div className="shrink-0 flex items-center gap-2 w-[88px]">
            <Progress value={progress} tone={cat.color}/>
            <span className="text-[10.5px] font-mono text-ink-dim tabular-nums">{progress}%</span>
          </div>
        </div>
      </Link>
    </Card>
  );
}

