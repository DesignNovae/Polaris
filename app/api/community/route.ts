/**
 * /api/community  - the whole backend for Community, in one file.
 *
 * GET  /api/community?channel=visa   -> all messages of that channel
 * POST /api/community                -> save one new message
 */

import { NextResponse } from "next/server";
import { getOptionalSession } from "@/lib/authz";
import { getDb } from "@/lib/db/mongodb";

export const dynamic = "force-dynamic";

/* ─── READ ─── */

export async function GET(req: Request) {
  const channel = new URL(req.url).searchParams.get("channel") || "general";

  const db = await getDb();
  const messages = await db
    .collection("community_messages")
    .find({ channel })            // only this channel's messages
    .sort({ createdAt: 1 })       // oldest first, like a chat
    .toArray();

  return NextResponse.json(messages);
}

/* ─── WRITE ─── */

export async function POST(req: Request) {
  // Who is posting? Read it from the login session, never from the request.
  const session = await getOptionalSession();
  if (!session) {
    return NextResponse.json({ error: "Please sign in" }, { status: 401 });
  }

  const { channel, text } = await req.json();

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Write something first" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Keep it under 500 characters" }, { status: 400 });
  }
  if (text.includes("http")) {
    return NextResponse.json({ error: "Links are not allowed" }, { status: 400 });
  }

  const message = {
    channel,
    userName: session.name,
    userRole: session.role,   // "student" | "partner" | "admin"
    text: text.trim(),
    createdAt: new Date(),
  };

  const db = await getDb();
  await db.collection("community_messages").insertOne(message);

  return NextResponse.json(message);
}
