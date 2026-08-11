import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { createThread, listThreads } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ title: z.string().min(1).max(120).optional() });

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const threads = await listThreads(session.id);
  return ok({
    threads: threads.map((thread) => ({
      id: thread._id?.toString(),
      title: thread.title,
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt,
      createdAt: thread.createdAt,
      mode: thread.lastMode,
    })),
  });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const body = createSchema.parse(await parseJson(req).catch(() => ({})));
  const thread = await createThread(session.id, body.title ?? "New chat");
  return ok({
    thread: {
      id: thread._id?.toString(),
      title: thread.title,
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt,
      createdAt: thread.createdAt,
    },
  });
});
