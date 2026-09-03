import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getLinksForViewer, getUserById } from "@/lib/db/collections";
import { buildScopedView } from "@/lib/links/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The scoped view of one student, for a linked viewer.
 *
 * Authorisation is the accepted link, not the request: the caller names a
 * student, and the handler will only serve one that appears in *their own*
 * accepted links. What comes back is then narrowed further by relationship
 * (lib/links/scope.ts), so a teacher and a parent asking for the same student
 * get materially different payloads.
 */
export const GET = withErrorHandling(async (req) => {
  const viewer = await requireSession();
  if (!viewer.email) throw new HttpError(403, "No viewer email on this account");

  const studentId = new URL(req.url).searchParams.get("studentId");
  const links = await getLinksForViewer(viewer.email);

  if (!studentId) {
    // The picker: which students this viewer may look at, and in what role.
    return ok({
      students: links.map((l) => ({
        studentId: l.studentId,
        studentName: l.studentName ?? "Student",
        relationship: l.relationship,
        note: l.viewerNote,
      })),
    });
  }

  const link = links.find((l) => l.studentId === studentId);
  if (!link) throw new HttpError(403, "You don't have access to this student");

  const student = await getUserById(link.studentId);
  const view = await buildScopedView(
    link.studentId,
    link.studentName ?? student?.name ?? "Student",
    link.relationship,
  );
  return ok({ view });
});
