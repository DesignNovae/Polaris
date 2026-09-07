/**
 * Evidence badges - awarding and reading.
 *
 * Badges are stored in their own collection rather than written into the
 * passport's `claims` array, and that separation is deliberate. A passport
 * claim is what the *student* asserts, verified by an artifact they linked. A
 * badge is what *Polaris* attests, verified by its own records. Merging them
 * would either make Polaris's attestations editable by the student, or make
 * the student's claims un-editable - and it would break `resolveStatus`, which
 * marks a claim verified only when a proof URL is present. A badge has no URL
 * because the proof is the platform.
 *
 * So the public passport renders two sections from two sources, and the
 * distinction is visible to the reader, which is the honest presentation
 * anyway.
 *
 * Awarding is idempotent: a unique index on (userId, badgeId) means a
 * re-evaluation cannot duplicate a badge, and a badge once earned is never
 * revoked even if a counter were somehow to move backwards.
 */

import { getDb } from "@/lib/db/mongodb";
import { getCounters } from "@/lib/progress/counters";
import { getPassport } from "@/lib/passport/service";
import {
  BADGES,
  BADGE_BY_ID,
  earnedIds,
  type BadgeContext,
  type BadgeDefinition,
} from "./catalog";

export type DbBadge = {
  userId: string;
  badgeId: string;
  earnedAt: Date;
  /** The count that satisfied it, frozen at award time for the record. */
  atCount: number;
};

async function badges() {
  const db = await getDb();
  return db.collection<DbBadge>("badges_earned");
}

/** Everything the criteria read, assembled from its three sources. */
export async function buildContext(userId: string): Promise<BadgeContext> {
  const db = await getDb();
  const [counters, streak, passport] = await Promise.all([
    getCounters(userId),
    db.collection<{ longest?: number }>("streaks").findOne({ userId }),
    getPassport(userId),
  ]);

  return {
    counters,
    streakLongest: streak?.longest ?? 0,
    verifiedClaims:
      passport?.claims.filter((c) => c.status === "verified").length ?? 0,
  };
}

/**
 * Award anything newly satisfied. Returns only the badges earned by *this*
 * call, so a caller can celebrate exactly what just happened.
 *
 * Never throws - a badge is not worth failing a student's exam submission over.
 */
export async function evaluateBadges(userId: string): Promise<BadgeDefinition[]> {
  try {
    const ctx = await buildContext(userId);
    const qualified = earnedIds(ctx);
    if (qualified.length === 0) return [];

    const col = await badges();
    const already = new Set(
      (await col.find({ userId, badgeId: { $in: qualified } }).toArray()).map(
        (row) => row.badgeId,
      ),
    );

    const fresh = qualified.filter((id) => !already.has(id));
    if (fresh.length === 0) return [];

    const now = new Date();
    const docs: DbBadge[] = fresh.map((badgeId) => ({
      userId,
      badgeId,
      earnedAt: now,
      atCount: BADGE_BY_ID.get(badgeId)?.progress(ctx).need ?? 0,
    }));

    // ordered:false so one duplicate - a concurrent evaluation winning the
    // race - does not stop the rest from being written.
    await col.insertMany(docs, { ordered: false }).catch(() => {});

    // Re-read rather than trusting the insert: whichever call won the race,
    // this returns only what is genuinely new to this one.
    const confirmed = await col
      .find({ userId, badgeId: { $in: fresh }, earnedAt: now })
      .toArray();

    return confirmed
      .map((row) => BADGE_BY_ID.get(row.badgeId))
      .filter((def): def is BadgeDefinition => Boolean(def));
  } catch (err) {
    console.error("[badges] evaluation failed for", userId, err);
    return [];
  }
}

export type EarnedBadge = {
  id: string;
  title: string;
  claim: string;
  signal: string;
  gap: string;
  tier: BadgeDefinition["tier"];
  earnedAt: string;
};

export type BadgeShelfEntry = EarnedBadge | {
  id: string;
  title: string;
  claim: string;
  signal: string;
  gap: string;
  tier: BadgeDefinition["tier"];
  earnedAt: null;
  have: number;
  need: number;
};

/** Earned badges only, newest first. Used by the passport surfaces. */
export async function listEarnedBadges(userId: string): Promise<EarnedBadge[]> {
  const col = await badges();
  const rows = await col.find({ userId }).sort({ earnedAt: -1 }).toArray();
  return rows
    .map((row) => {
      const def = BADGE_BY_ID.get(row.badgeId);
      if (!def) return null;
      return {
        id: def.id,
        title: def.title,
        claim: def.claim,
        signal: def.signal,
        gap: def.gap,
        tier: def.tier,
        earnedAt: row.earnedAt.toISOString(),
      };
    })
    .filter((b): b is EarnedBadge => b !== null);
}

/**
 * The whole catalogue with this student's state against it - earned badges
 * carry a date, unearned ones carry how far along they are.
 *
 * Showing the locked ones is the point: a badge nobody can see the shape of
 * motivates nobody, and the progress number is the part that pulls.
 */
export async function getBadgeShelf(userId: string): Promise<BadgeShelfEntry[]> {
  const [ctx, earned] = await Promise.all([
    buildContext(userId),
    listEarnedBadges(userId),
  ]);
  const earnedById = new Map(earned.map((b) => [b.id, b]));

  return BADGES.map((def) => {
    const hit = earnedById.get(def.id);
    if (hit) return hit;
    const { have, need } = def.progress(ctx);
    return {
      id: def.id,
      title: def.title,
      claim: def.claim,
      signal: def.signal,
      gap: def.gap,
      tier: def.tier,
      earnedAt: null,
      have,
      need,
    };
  });
}

/** Earned badges for a public passport, by the passport's owner id. */
export async function publicBadgesFor(userId: string): Promise<EarnedBadge[]> {
  return listEarnedBadges(userId);
}
