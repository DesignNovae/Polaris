import { z } from "zod";
import type { LearningVideo } from "@/lib/action-lab/types";

export type LibraryVideo = LearningVideo & {
  durationSeconds: number;
  level: "Foundation" | "Practice" | "Advanced";
  skill: string;
  checkedAt: string;
};
export type LearningPath = { id: string; title: string; description: string; exam: "IELTS" | "SAT"; videoIds: string[] };
export type VideoProgress = { saved?: boolean; completed?: boolean; position?: number; duration?: number; updatedAt?: string };
export type LibraryProgress = Record<string, VideoProgress>;
export const progressPatchSchema = z.object({
  videoId: z.string().regex(/^[a-zA-Z0-9_-]{1,90}$/),
  saved: z.boolean().optional(),
  completed: z.boolean().optional(),
  position: z.number().finite().min(0).max(7200).optional(),
  duration: z.number().finite().positive().max(7200).optional(),
}).strict().refine((v) => v.saved !== undefined || v.completed !== undefined || v.position !== undefined, "No update supplied")
  .refine((v) => v.position === undefined || (v.duration !== undefined && v.position <= v.duration), "Position must be within the recording");

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return total >= 3600 ? `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`
    : `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function resumePosition(progress?: VideoProgress): number {
  if (!progress || progress.completed || !progress.duration || !Number.isFinite(progress.position)) return 0;
  return Math.max(0, Math.min(progress.position || 0, progress.duration - 1));
}

export type LibraryFilters = { exam: string; topic: string; query: string; level: string; length: string; view: string; sort: string };
export function filterLibrary(videos: LibraryVideo[], filters: LibraryFilters, progress: LibraryProgress): LibraryVideo[] {
  const words = filters.query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const result = videos.filter((v) => {
    const record = progress[v.id];
    const searchable = `${v.title} ${v.source} ${v.topic} ${v.skill} ${v.exam}`.toLocaleLowerCase();
    return (filters.exam === "All" || filters.exam === v.exam)
      && (filters.topic === "All" || filters.topic === v.topic)
      && (filters.level === "All" || filters.level === v.level)
      && (filters.length === "All" || (filters.length === "short" ? v.durationSeconds < 600 : filters.length === "medium" ? v.durationSeconds >= 600 && v.durationSeconds < 1800 : v.durationSeconds >= 1800))
      && (filters.view === "all" || (filters.view === "saved" ? record?.saved : filters.view === "continue" ? resumePosition(record) >= 5 : record?.completed))
      && words.every((word) => searchable.includes(word));
  });
  if (filters.sort === "shortest") result.sort((a, b) => a.durationSeconds - b.durationSeconds);
  else if (filters.sort === "title") result.sort((a, b) => a.title.localeCompare(b.title));
  else if (filters.view === "continue") result.sort((a, b) => (progress[b.id]?.updatedAt || "").localeCompare(progress[a.id]?.updatedAt || ""));
  return result;
}
