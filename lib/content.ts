import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import universitiesJson from "@/data/universities.json";
import scholarshipsJson from "@/data/scholarships.json";
import caseStudiesJson from "@/data/case-studies.json";

/**
 * DB-backed content with JSON seed + fallback.
 *
 * On first access a collection is seeded from the bundled JSON. Public readers
 * get the DB data (so admin edits go live); if the DB is unavailable we fall
 * back to the JSON so the site never breaks.
 *
 * RAG embeddings (lib/rag) intentionally still read the JSON - they're built
 * offline, so admin content edits won't change retrieval until re-embedded.
 */

export type ContentType = "universities" | "scholarships" | "case-studies";

type Item = Record<string, unknown>;

const COLLECTION: Record<ContentType, string> = {
  universities: "content_universities",
  scholarships: "content_scholarships",
  "case-studies": "content_case_studies",
};

const SEED: Record<ContentType, Item[]> = {
  universities: universitiesJson as Item[],
  scholarships: scholarshipsJson as Item[],
  "case-studies": caseStudiesJson as Item[],
};

export function isContentType(t: string): t is ContentType {
  return t === "universities" || t === "scholarships" || t === "case-studies";
}

async function ensureSeeded(type: ContentType) {
  const db = await getDb();
  const col = db.collection(COLLECTION[type]);
  const count = await col.countDocuments({});
  if (count === 0 && SEED[type].length) {
    await col.insertMany(SEED[type].map((item) => ({ ...item })));
  }
}

/** Public read: returns items without Mongo _id (keeps the original `id`). */
export async function getContent(type: ContentType): Promise<Item[]> {
  try {
    await ensureSeeded(type);
    const db = await getDb();
    const items = await db.collection(COLLECTION[type]).find({}).toArray();
    return items.map(({ _id, ...rest }) => rest);
  } catch {
    return SEED[type];
  }
}

export const getUniversities = () => getContent("universities");
export const getScholarships = () => getContent("scholarships");
export const getCaseStudies = () => getContent("case-studies");

/** Admin read: includes stringified _id for editing. */
export async function getContentAdmin(type: ContentType): Promise<Item[]> {
  await ensureSeeded(type);
  const db = await getDb();
  const items = await db.collection(COLLECTION[type]).find({}).toArray();
  return items.map((d) => ({ ...d, _id: d._id.toString() }));
}

export async function createContentItem(type: ContentType, item: Item) {
  const db = await getDb();
  // never let the client set _id
  const { _id, ...clean } = item;
  void _id;
  const res = await db.collection(COLLECTION[type]).insertOne(clean);
  return res.insertedId.toString();
}

export async function updateContentItem(type: ContentType, id: string, item: Item) {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  const { _id, ...clean } = item;
  void _id;
  await db
    .collection(COLLECTION[type])
    .replaceOne({ _id: new ObjectId(id) }, clean);
}

export async function deleteContentItem(type: ContentType, id: string) {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection(COLLECTION[type]).deleteOne({ _id: new ObjectId(id) });
}
