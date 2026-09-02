import type { NextRequest } from "next/server";
import { z } from "zod";
import { parseJson, withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  listDiscoveryNotes,
  saveDiscoveryNote,
} from "@/lib/discovery/notes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entityTypeSchema = z.enum(["university", "scholarship"]);
const saveSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.string().trim().min(1).max(120),
  note: z.string().max(240),
});

/** Return notes scoped to the current student and requested card type. */
export const GET = withErrorHandling(async (req: NextRequest) => {
  const user = await requireSession();
  const entityType = entityTypeSchema.parse(req.nextUrl.searchParams.get("entityType"));
  return Response.json({ notes: await listDiscoveryNotes(user.id, entityType) });
});

/** Save or clear the current student's note for one university/scholarship. */
export const PUT = withErrorHandling(async (req: NextRequest) => {
  const user = await requireSession();
  const body = saveSchema.parse(await parseJson(req));
  return Response.json({ note: await saveDiscoveryNote({ userId: user.id, ...body }) });
});
