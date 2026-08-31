/**
 * /api/memory
 *
 * Lets the signed-in student inspect, add, or forget what the Strategist
 * has learned about them. Three verbs:
 *
 *   GET    →  { facts: UserMemoryFact[] }
 *   POST   →  { text, category? }  → adds an explicit fact
 *   DELETE →  ?id=<factId>          → removes one
 *           or ?clear=1             → wipes all memory (with care)
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { HttpError, ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  getUserMemory,
  addMemoryFacts,
  deleteMemoryFact,
  clearMemory,
  type MemoryFactCategory,
} from "@/lib/db/collections";
import { makeExplicitFact } from "@/lib/strategist/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CATEGORIES: MemoryFactCategory[] = [
  "goal",
  "preference",
  "constraint",
  "background",
  "interest",
];

const addSchema = z.object({
  text: z.string().min(3).max(240),
  category: z.enum(CATEGORIES as [MemoryFactCategory, ...MemoryFactCategory[]]).optional(),
});

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const mem = await getUserMemory(session.id);
  return ok({
    facts: mem?.facts ?? [],
    updatedAt: mem?.updatedAt ?? null,
  });
});

export const POST = withErrorHandling(async (req) => {
  const session = await requireSession();
  const { text, category } = addSchema.parse(await parseJson(req));
  const fact = makeExplicitFact(text, category ?? "background");
  const added = await addMemoryFacts(session.id, [fact]);
  if (added.length === 0) {
    throw new HttpError(409, "That fact is already on file.");
  }
  return ok({ fact: added[0] });
});

export const DELETE = withErrorHandling(async (req) => {
  const session = await requireSession();
  const url = new URL(req.url);

  if (url.searchParams.get("clear") === "1") {
    await clearMemory(session.id);
    return ok({ cleared: true });
  }

  const id = url.searchParams.get("id");
  if (!id) {
    return NextResponse.json(
      { error: "Missing ?id=<factId>" },
      { status: 400 },
    );
  }
  await deleteMemoryFact(session.id, id);
  return ok({ deleted: id });
});

