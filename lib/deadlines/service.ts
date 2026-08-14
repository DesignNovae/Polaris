import { getDb } from "@/lib/db/mongodb";

/** Minimal read model used by consultant matching. The full deadline UI is
 * not part of this project slice, but existing deadline rows can still make
 * marketplace recommendations more relevant. */
export type ConsultantDeadline = {
  title?: string;
  date?: string;
  dueAt?: string;
};

export async function listDeadlines(userId: string): Promise<ConsultantDeadline[]> {
  const db = await getDb();
  return db.collection<ConsultantDeadline>("deadlines")
    .find({ userId })
    .sort({ date: 1, dueAt: 1 })
    .toArray();
}
