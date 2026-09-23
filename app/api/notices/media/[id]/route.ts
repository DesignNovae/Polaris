import { type Binary } from "mongodb";
import { HttpError, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getDb } from "@/lib/db/mongodb";
import {
  audienceFilter,
  noticeId,
  type StoredNotice,
} from "@/lib/notices/service";

export const dynamic = "force-dynamic";
export const GET = withErrorHandling(
  async (_req, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireSession();
    const { id } = await ctx.params;
    const _id = noticeId(id);
    const db = await getDb();
    if (user.role !== "admin") {
      const url = `/api/notices/media/${id}`;
      const notice = await db
        .collection<StoredNotice>("notices")
        .findOne({
          $and: [
            audienceFilter(user),
            { $or: [{ imageUrl: url }, { logoUrl: url }] },
          ],
        });
      if (!notice) throw new HttpError(404, "Image not found");
    }
    const media = await db.collection("notice_media").findOne({ _id });
    if (!media) throw new HttpError(404, "Image not found");
    return new Response(new Uint8Array((media.data as Binary).buffer), {
      headers: {
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store",
        "Content-Disposition": "inline",
      },
    });
  },
);
