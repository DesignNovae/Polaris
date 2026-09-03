import { getProfile, getLatestRoadmap, type LinkRelationship } from "@/lib/db/collections";
import { listDeadlines } from "@/lib/deadlines/service";
import { getPassport } from "@/lib/passport/service";

/**
 * What each kind of viewer is allowed to see.
 *
 * A teacher asked to write a recommendation needs the evidence and the dates,
 * and nothing else. Giving them the parent view - the whole workspace, chat
 * included - would be both a privacy failure and a worse experience, because
 * the thing they came for would be buried.
 *
 * Scope is enforced here, once, on the server. The viewer UI reads the shape
 * this returns rather than deciding for itself what to hide, so a change to
 * the policy cannot be defeated by a component that forgot.
 */

export type ViewerScope = {
  relationship: LinkRelationship;
  /** Verified claims and their artifacts. */
  evidence: boolean;
  /** Deadlines and their dates. */
  deadlines: boolean;
  /** Roadmap milestones and progress. */
  progress: boolean;
  /** Test scores and GPA. */
  academics: boolean;
  /** Strategist conversations. Never shared with anyone. */
  chat: false;
};

export const SCOPES: Record<LinkRelationship, ViewerScope> = {
  parent: {
    relationship: "parent",
    evidence: true, deadlines: true, progress: true, academics: true, chat: false,
  },
  partner: {
    relationship: "partner",
    evidence: false, deadlines: true, progress: true, academics: false, chat: false,
  },
  // Narrowest by design: what a recommendation actually rests on.
  teacher: {
    relationship: "teacher",
    evidence: true, deadlines: true, progress: false, academics: true, chat: false,
  },
};

export type ScopedView = {
  scope: ViewerScope;
  studentName: string;
  evidence: {
    headline: string;
    summary: string;
    verified: {
      claim: string;
      proofType: string;
      proofUrl?: string;
      verifiedSignal?: string;
      gap?: string;
      verifiedAt?: string;
    }[];
    unevidencedCount: number;
    coverage: number;
  } | null;
  deadlines: {
    date: string;
    title: string;
    universityName?: string;
    priority: string;
    daysAway: number;
  }[];
  academics: {
    grade?: string;
    curriculum?: string;
    targetTier?: string;
    country?: string;
    testScores?: Record<string, number>;
  } | null;
  progress: { total: number; done: number; percent: number } | null;
};

function daysAway(iso: string): number {
  const target = Date.parse(`${iso}T00:00:00Z`);
  const today = Date.now();
  return Math.ceil((target - today) / 86_400_000);
}

/**
 * Build the view a linked viewer is entitled to.
 *
 * Every branch is gated on the scope, so adding a field to `ScopedView` without
 * gating it is a visible omission rather than a silent leak.
 */
export async function buildScopedView(
  studentId: string,
  studentName: string,
  relationship: LinkRelationship,
): Promise<ScopedView> {
  const scope = SCOPES[relationship];

  const [profile, roadmap, passport, deadlines] = await Promise.all([
    scope.academics ? getProfile(studentId) : null,
    scope.progress ? getLatestRoadmap(studentId) : null,
    scope.evidence ? getPassport(studentId) : null,
    scope.deadlines
      ? listDeadlines(studentId, { from: new Date().toISOString().slice(0, 10) })
      : [],
  ]);

  let evidence: ScopedView["evidence"] = null;
  if (scope.evidence && passport) {
    const verified = passport.claims.filter((c) => c.status === "verified");
    evidence = {
      headline: passport.headline,
      summary: passport.summary,
      verified: verified.map((c) => ({
        claim: c.claim,
        proofType: c.proofType,
        proofUrl: c.proofUrl,
        verifiedSignal: c.verifiedSignal,
        gap: c.gap,
        verifiedAt: c.verifiedAt?.toISOString(),
      })),
      unevidencedCount: passport.claims.length - verified.length,
      coverage: passport.claims.length
        ? Math.round((verified.length / passport.claims.length) * 100)
        : 0,
    };
  }

  let progress: ScopedView["progress"] = null;
  if (scope.progress && roadmap) {
    const milestones = roadmap.roadmap?.milestones ?? [];
    const done = milestones.filter((m) => m.status === "done").length;
    progress = {
      total: milestones.length,
      done,
      percent: milestones.length ? Math.round((done / milestones.length) * 100) : 0,
    };
  }

  return {
    scope,
    studentName,
    evidence,
    deadlines: (deadlines ?? [])
      .slice(0, 25)
      .map((d) => ({
        date: d.date,
        title: d.title,
        universityName: d.universityName,
        priority: d.priority ?? "medium",
        daysAway: daysAway(d.date),
      }))
      .sort((a, b) => a.daysAway - b.daysAway),
    academics:
      scope.academics && profile
        ? {
            grade: profile.grade,
            curriculum: profile.curriculum,
            targetTier: profile.targetTier,
            country: profile.country,
            testScores: profile.testScores,
          }
        : null,
    progress,
  };
}
