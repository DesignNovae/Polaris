import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getLinksForViewer, getLatestRoadmap } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

/**
 * Read-only progress for every student who has accepted this viewer's link.
 * Used by the parent/partner monitoring dashboard.
 */
export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  if (!user.email) throw new HttpError(400, "Your account has no email");

  const links = await getLinksForViewer(user.email);

  const students = await Promise.all(
    links.map(async (link) => {
      const roadmap = await getLatestRoadmap(link.studentId).catch(() => null);
      const milestones = roadmap?.roadmap.milestones ?? [];
      const done = milestones.filter((m) => m.status === "done").length;
      return {
        studentId: link.studentId,
        studentName: link.studentName ?? "Student",
        relationship: link.relationship,
        summary: roadmap?.roadmap.summary ?? null,
        gaps: roadmap?.roadmap.gaps ?? [],
        progress: {
          done,
          total: milestones.length,
          pct: milestones.length
            ? Math.round((done / milestones.length) * 100)
            : 0,
        },
        milestones: milestones.map((m) => ({
          id: m.id,
          title: m.title,
          category: m.category,
          status: m.status,
          quarter: m.quarter,
          priority: m.priority,
        })),
      };
    }),
  );

  return ok({ students });
});

