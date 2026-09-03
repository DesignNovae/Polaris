import { randomBytes } from "crypto";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db/mongodb";

/**
 * Verified Student Passport.
 *
 * Everything a student builds in Polaris was trapped inside Polaris. A CV says
 * "led a robotics team"; nobody can check it. The passport is one permalinked
 * page where each claim sits next to the artifact that proves it, with the date
 * it was verified - and where the claims that have nothing behind them are
 * listed as such rather than quietly omitted.
 *
 * That last rule is the whole point. A page that only shows the good half is a
 * CV with extra steps; a page that shows the gaps is evidence that the student
 * is being straight with you, which is what makes it worth sending to a
 * recommender or a scholarship committee.
 */

export type ClaimStatus = "verified" | "unevidenced";

export type PassportClaim = {
  id: string;
  /** What the student says they did. */
  claim: string;
  /** What kind of artifact backs it - "certificate", "repository", "score report". */
  proofType: string;
  /** Public link to the artifact. Absent means the claim is unevidenced. */
  proofUrl?: string;
  /** The specific, checkable signal the artifact carries. */
  verifiedSignal?: string;
  /** What the artifact does *not* establish. Shown on the public page. */
  gap?: string;
  status: ClaimStatus;
  addedAt: Date;
  verifiedAt?: Date;
};

export type DbPassport = {
  _id?: ObjectId;
  userId: string;
  /** URL segment. Unpredictable, so an unlisted passport stays unlisted. */
  slug: string;
  published: boolean;
  displayName: string;
  headline: string;
  summary: string;
  claims: PassportClaim[];
  /**
   * Whether unevidenced claims appear publicly. Defaults on - a student may
   * turn it off, but the page then says the list is filtered, because silently
   * hiding them would defeat the purpose.
   */
  showUnevidenced: boolean;
  views: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PublicPassport = {
  slug: string;
  displayName: string;
  headline: string;
  summary: string;
  verified: PassportClaim[];
  unevidenced: PassportClaim[];
  showUnevidenced: boolean;
  updatedAt: Date;
  stats: { total: number; verified: number; coverage: number };
};

async function passports() {
  const db = await getDb();
  return db.collection<DbPassport>("passports");
}

/**
 * Slug for a public URL. Random rather than derived from the name: the page is
 * "unlisted until published", and a guessable slug would make that meaningless.
 */
function newSlug(displayName: string): string {
  const stem =
    displayName
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "student";
  return `${stem}-${randomBytes(4).toString("hex")}`;
}

export function claimId(): string {
  return randomBytes(8).toString("hex");
}

/** A claim counts as verified only when an artifact link is actually present. */
export function resolveStatus(claim: Pick<PassportClaim, "proofUrl">): ClaimStatus {
  return claim.proofUrl && claim.proofUrl.trim().length > 0
    ? "verified"
    : "unevidenced";
}

export async function getPassport(userId: string): Promise<DbPassport | null> {
  const col = await passports();
  return col.findOne({ userId });
}

export async function ensurePassport(
  userId: string,
  displayName: string,
): Promise<DbPassport> {
  const col = await passports();
  const existing = await col.findOne({ userId });
  if (existing) return existing;

  const doc: DbPassport = {
    userId,
    slug: newSlug(displayName),
    published: false,
    displayName,
    headline: "",
    summary: "",
    claims: [],
    showUnevidenced: true,
    views: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  try {
    const res = await col.insertOne(doc);
    return { ...doc, _id: res.insertedId };
  } catch {
    // Unique index on userId rejected a concurrent create - read the winner.
    const winner = await col.findOne({ userId });
    if (winner) return winner;
    throw new Error("Could not create passport");
  }
}

export async function updatePassport(
  userId: string,
  patch: Partial<Pick<DbPassport, "headline" | "summary" | "published" | "showUnevidenced" | "displayName">>,
): Promise<void> {
  const col = await passports();
  await col.updateOne(
    { userId },
    { $set: { ...patch, updatedAt: new Date() } },
  );
}

export async function upsertClaim(
  userId: string,
  input: {
    id?: string;
    claim: string;
    proofType: string;
    proofUrl?: string;
    verifiedSignal?: string;
    gap?: string;
  },
): Promise<PassportClaim> {
  const col = await passports();
  const status = resolveStatus(input);
  const now = new Date();

  if (input.id) {
    const existing = await col.findOne(
      { userId, "claims.id": input.id },
      { projection: { "claims.$": 1 } },
    );
    const previous = existing?.claims?.[0];

    const updated: PassportClaim = {
      id: input.id,
      claim: input.claim,
      proofType: input.proofType,
      proofUrl: input.proofUrl || undefined,
      verifiedSignal: input.verifiedSignal || undefined,
      gap: input.gap || undefined,
      status,
      addedAt: previous?.addedAt ?? now,
      // Verification is dated from when the artifact first appeared, so a later
      // edit to the wording doesn't reset the clock on the proof.
      verifiedAt:
        status === "verified"
          ? previous?.status === "verified"
            ? previous.verifiedAt ?? now
            : now
          : undefined,
    };
    await col.updateOne(
      { userId, "claims.id": input.id },
      { $set: { "claims.$": updated, updatedAt: now } },
    );
    return updated;
  }

  const created: PassportClaim = {
    id: claimId(),
    claim: input.claim,
    proofType: input.proofType,
    proofUrl: input.proofUrl || undefined,
    verifiedSignal: input.verifiedSignal || undefined,
    gap: input.gap || undefined,
    status,
    addedAt: now,
    verifiedAt: status === "verified" ? now : undefined,
  };
  await col.updateOne(
    { userId },
    { $push: { claims: created }, $set: { updatedAt: now } },
  );
  return created;
}

export async function deleteClaim(userId: string, id: string): Promise<void> {
  const col = await passports();
  await col.updateOne(
    { userId },
    { $pull: { claims: { id } }, $set: { updatedAt: new Date() } },
  );
}

/**
 * The public view. Returns null for an unpublished slug so an unlisted URL
 * behaves exactly like one that never existed.
 */
export async function getPublicPassport(slug: string): Promise<PublicPassport | null> {
  const col = await passports();
  const doc = await col.findOne({ slug, published: true });
  if (!doc) return null;

  const verified = doc.claims.filter((c) => c.status === "verified");
  const unevidenced = doc.claims.filter((c) => c.status === "unevidenced");

  return {
    slug: doc.slug,
    displayName: doc.displayName,
    headline: doc.headline,
    summary: doc.summary,
    verified,
    unevidenced: doc.showUnevidenced ? unevidenced : [],
    showUnevidenced: doc.showUnevidenced,
    updatedAt: doc.updatedAt,
    stats: {
      total: doc.claims.length,
      verified: verified.length,
      coverage: doc.claims.length
        ? Math.round((verified.length / doc.claims.length) * 100)
        : 0,
    },
  };
}

/**
 * Count a view. Deliberately fire-and-forget at the call site: a failure to
 * record a view must never stop the page rendering.
 */
export async function recordView(slug: string): Promise<void> {
  const col = await passports();
  await col.updateOne({ slug, published: true }, { $inc: { views: 1 } });
}

/*
 * There is deliberately no "list published passports" helper.
 *
 * A published passport is unlisted, not public: the student shares the link
 * with specific people. Anything that enumerates slugs - a sitemap entry, a
 * directory, an admin browse view - would quietly turn a private record into a
 * discoverable one, so the capability does not exist rather than existing and
 * being carefully avoided.
 */
