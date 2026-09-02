import type { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";

const NOTES = "discovery_notes";

export type DiscoveryEntityType = "university" | "scholarship";

type DbDiscoveryNote = {
  _id?: ObjectId;
  userId: string;
  entityType: DiscoveryEntityType;
  entityId: string;
  note: string;
  createdAt: Date;
  updatedAt: Date;
};

export type DiscoveryNote = {
  entityType: DiscoveryEntityType;
  entityId: string;
  note: string;
  updatedAt: string;
};

function publicNote(record: DbDiscoveryNote): DiscoveryNote {
  return {
    entityType: record.entityType,
    entityId: record.entityId,
    note: record.note,
    updatedAt: record.updatedAt.toISOString(),
  };
}

/** Load only the signed-in student's notes for one discovery surface. */
export async function listDiscoveryNotes(
  userId: string,
  entityType: DiscoveryEntityType,
): Promise<DiscoveryNote[]> {
  const db = await getDb();
  const records = await db.collection<DbDiscoveryNote>(NOTES)
    .find({ userId, entityType })
    .sort({ updatedAt: -1 })
    .toArray();
  return records.map(publicNote);
}

/**
 * Upsert one student + entity pair. An empty value clears that student's note
 * without affecting notes saved by any other student.
 */
export async function saveDiscoveryNote(input: {
  userId: string;
  entityType: DiscoveryEntityType;
  entityId: string;
  note: string;
}): Promise<DiscoveryNote | null> {
  const db = await getDb();
  const note = input.note.trim();

  if (!note) {
    await db.collection<DbDiscoveryNote>(NOTES).deleteOne({
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    });
    return null;
  }

  const now = new Date();
  const record = await db.collection<DbDiscoveryNote>(NOTES).findOneAndUpdate(
    {
      userId: input.userId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
    {
      $set: { note, updatedAt: now },
      $setOnInsert: {
        userId: input.userId,
        entityType: input.entityType,
        entityId: input.entityId,
        createdAt: now,
      },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (!record) throw new Error("The personal note could not be saved");
  return publicNote(record);
}
