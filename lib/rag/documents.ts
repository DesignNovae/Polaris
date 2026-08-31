/**
 * Long-form knowledge documents.
 *
 * The seed corpus is 114 short records, none of which is long enough to split
 * into more than one chunk. That is a data limit, not an architecture limit,
 * and it cannot be fixed by inventing facts about real universities - the
 * numbers a student acts on have to come from somewhere accountable.
 *
 * So it becomes a product surface instead: an admin pastes the real thing -
 * a scholarship's eligibility page, a university's essay guidance, a visa
 * financial-requirements page - with its source URL, and it enters retrieval
 * on the next re-embed. These documents are long, so they exercise the
 * chunking and overlap path that short records never reach.
 *
 * Every document carries a `sourceUrl` and `verifiedAt` because the whole
 * pipeline's value rests on a student being able to check a claim at its
 * origin. A document with no source is worse than no document.
 */

import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";
import { invalidateRagCaches } from "./cache";
import type { RagDoc } from "./types";

const COLLECTION = "kb_documents";

/** Guardrails: long enough to be worth chunking, short enough to stay sane. */
export const MIN_BODY_CHARS = 120;
export const MAX_BODY_CHARS = 60_000;
export const MAX_DOCUMENTS = 2_000;

export type KbDocument = {
  _id?: ObjectId;
  /** Stable slug used in citations: kb://doc:<slug>. */
  slug: string;
  title: string;
  body: string;
  /** Where a student can verify this. Required. */
  sourceUrl: string;
  /** Free-form tags that also get indexed, e.g. ["germany", "visa"]. */
  tags: string[];
  /** When a human last confirmed this against the source. */
  verifiedAt: string;
  createdAt: Date;
  updatedAt: Date;
};

export type KbDocumentInput = {
  title: string;
  body: string;
  sourceUrl: string;
  tags?: string[];
  verifiedAt?: string;
};

export class DocumentValidationError extends Error {}

/** URL-safe, collision-resistant slug derived from the title. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base || "document"}-${suffix}`;
}

function validate(input: KbDocumentInput): KbDocumentInput {
  const title = input.title?.trim() ?? "";
  const body = input.body?.trim() ?? "";
  const sourceUrl = input.sourceUrl?.trim() ?? "";

  if (title.length < 3 || title.length > 200) {
    throw new DocumentValidationError("Title must be between 3 and 200 characters");
  }
  if (body.length < MIN_BODY_CHARS) {
    throw new DocumentValidationError(
      `Body must be at least ${MIN_BODY_CHARS} characters - shorter facts belong in the structured content collections`,
    );
  }
  if (body.length > MAX_BODY_CHARS) {
    throw new DocumentValidationError(`Body must be under ${MAX_BODY_CHARS} characters`);
  }
  // A claim a student cannot trace is not worth retrieving.
  let parsed: URL;
  try {
    parsed = new URL(sourceUrl);
  } catch {
    throw new DocumentValidationError("A valid source URL is required");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new DocumentValidationError("Source URL must be http(s)");
  }

  const tags = (input.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);

  const verifiedAt = (input.verifiedAt ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
    throw new DocumentValidationError("verifiedAt must be an ISO date (YYYY-MM-DD)");
  }

  return { title, body, sourceUrl, tags, verifiedAt };
}

/** Admin view - `_id` is stringified for the client. */
export type KbDocumentRow = Omit<KbDocument, "_id"> & { _id: string };

export async function listDocuments(): Promise<KbDocumentRow[]> {
  const db = await getDb();
  const rows = await db
    .collection<KbDocument>(COLLECTION)
    .find({})
    .sort({ updatedAt: -1 })
    .limit(MAX_DOCUMENTS)
    .toArray();
  return rows.map(({ _id, ...rest }) => ({ ...rest, _id: _id!.toString() }));
}

export async function createDocument(input: KbDocumentInput): Promise<string> {
  const clean = validate(input);
  const db = await getDb();
  if ((await db.collection(COLLECTION).countDocuments({})) >= MAX_DOCUMENTS) {
    throw new DocumentValidationError(`Document limit (${MAX_DOCUMENTS}) reached`);
  }
  const now = new Date();
  const doc: KbDocument = {
    slug: slugify(clean.title),
    title: clean.title,
    body: clean.body,
    sourceUrl: clean.sourceUrl,
    tags: clean.tags ?? [],
    verifiedAt: clean.verifiedAt!,
    createdAt: now,
    updatedAt: now,
  };
  const result = await db.collection<KbDocument>(COLLECTION).insertOne(doc);
  invalidateRagCaches();
  return result.insertedId.toString();
}

export async function updateDocument(id: string, input: KbDocumentInput): Promise<void> {
  if (!ObjectId.isValid(id)) throw new DocumentValidationError("Unknown document");
  const clean = validate(input);
  const db = await getDb();
  await db.collection<KbDocument>(COLLECTION).updateOne(
    { _id: new ObjectId(id) },
    {
      $set: {
        title: clean.title,
        body: clean.body,
        sourceUrl: clean.sourceUrl,
        tags: clean.tags ?? [],
        verifiedAt: clean.verifiedAt!,
        updatedAt: new Date(),
      },
    },
  );
  invalidateRagCaches();
}

export async function deleteDocument(id: string): Promise<void> {
  if (!ObjectId.isValid(id)) return;
  const db = await getDb();
  await db.collection<KbDocument>(COLLECTION).deleteOne({ _id: new ObjectId(id) });
  invalidateRagCaches();
}

/**
 * Retrieval view. The source URL and verification date ride inside the text
 * as well as the metadata, so a model quoting this passage has the provenance
 * in front of it rather than having to be told about it separately.
 */
export async function documentRagDocs(): Promise<RagDoc[]> {
  try {
    const db = await getDb();
    const rows = await db
      .collection<KbDocument>(COLLECTION)
      .find({})
      .limit(MAX_DOCUMENTS)
      .toArray();
    return rows.map((row) => ({
      id: `doc:${row.slug}`,
      source: "document" as const,
      title: row.title,
      text: [
        row.body,
        row.tags?.length ? `Topics: ${row.tags.join(", ")}.` : "",
        `Source: ${row.sourceUrl}. Verified ${row.verifiedAt}.`,
      ]
        .filter(Boolean)
        .join(" "),
      metadata: {
        slug: row.slug,
        sourceUrl: row.sourceUrl,
        tags: row.tags ?? [],
        verifiedAt: row.verifiedAt,
      },
    }));
  } catch (err) {
    // Documents are additive; retrieval still works without them.
    console.error("[rag] documents unavailable:", (err as Error).message);
    return [];
  }
}
