import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { appendMessage, getMessages, getThread } from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sourceSchema = z.object({
  label: z.string().min(1).max(200),
  uri: z.string().min(1).max(500),
  kind: z.enum(["kb", "case", "web", "profile", "roadmap"]),
});
const appendSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().min(1).max(20000),
  sources: z.array(sourceSchema).max(40).optional(),
  providerId: z.string().max(40).optional(),
  modelId: z.string().max(120).optional(),
  mode: z.enum(["general", "research", "study", "coding"]).optional(),
  tokensIn: z.number().int().nonnegative().optional(),
  tokensOut: z.number().int().nonnegative().optional(),
});

export const GET = withErrorHandling(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const thread = await getThread(session.id, id);
  if (!thread) throw new HttpError(404, "Thread not found");
  const messages = await getMessages(session.id, id);
  return ok({
    thread: {
      id: thread._id?.toString(),
      title: thread.title,
      messageCount: thread.messageCount,
      lastMessageAt: thread.lastMessageAt,
    },
    messages: messages.map((message) => ({
      id: message._id?.toString(),
      role: message.role,
      text: message.text,
      sources: message.sources ?? [],
      providerId: message.providerId,
      modelId: message.modelId,
      mode: message.mode,
      createdAt: message.createdAt,
    })),
  });
});

export const POST = withErrorHandling(async (req, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireSession();
  const { id } = await ctx.params;
  const thread = await getThread(session.id, id);
  if (!thread) throw new HttpError(404, "Thread not found");
  const body = appendSchema.parse(await parseJson(req));
  const message = await appendMessage({
    threadId: id,
    userId: session.id,
    role: body.role,
    text: body.text,
    sources: body.sources,
    providerId: body.providerId,
    modelId: body.modelId,
    mode: body.mode,
    tokensIn: body.tokensIn,
    tokensOut: body.tokensOut,
  });
  return ok({ message: { id: message._id?.toString(), createdAt: message.createdAt } });
});
