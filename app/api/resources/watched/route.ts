/**
 * /api/resources/watched - the backend for Curated Video Learning.
 *
 * GET  -> ["dQw4w9WgXcQ", "..."]  the refs this student has already opened
 * POST { ref, title } -> saves one "I watched this" row
 *
 * One MongoDB collection: watched_resources.
 */

import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/authz";
import { getDb } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

/* ─── READ: which videos has this student watched? ─── */

export async function GET() {
  const session = await getOptionalSession();
  if (!session) return NextResponse.json([]); // signed out -> nothing watched

  const db = await getDb();
  const rows = await db
    .collection("watched_resources")
    .find({ userId: session.id })            // only MY rows
    .sort({ lastWatchedAt: -1 })             // most recently watched first
    .limit(50)
    .toArray();

  // Send the whole history, not just the ids - the page shows a list.
  return NextResponse.json(
    rows.map((row) => ({
      ref: row.ref,
      title: row.title,
      plays: row.plays ?? 1,
      lastWatchedAt: row.lastWatchedAt,
    })),
  );
}

/* ─── WRITE: mark one video as watched ─── */

export async function POST(req: Request) {
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const { ref, title } = await req.json();
  if (!ref || typeof ref !== "string") {
    return NextResponse.json({ error: "Missing resource ref" }, { status: 400 });
  }

  const db = await getDb();
  await db.collection("watched_resources").updateOne(
    { userId: session.id, ref },                            // find this student + this video
    {
      $set: { lastWatchedAt: new Date() },                  // always refresh the time
      $inc: { plays: 1 },                                   // count repeat views
      $setOnInsert: {                                       // only on the first watch
        userId: session.id,
        ref,
        title: String(title ?? "").slice(0, 120),
        firstWatchedAt: new Date(),
      },
    },
    { upsert: true },                                       // insert if it isn't there yet
  );

  return NextResponse.json({ ok: true, ref });
}
