/**
 * /consultants - verified consultant marketplace. It is plan-independent:
 * free users can browse, match, and book the same as Pro/Elite users.
 */

import { requireSession } from "@/lib/authz";
import { getProfile, getRoadmapV2 } from "@/lib/db/collections";
import { listDeadlines } from "@/lib/deadlines/service";
import {
  ensureConsultantsSeeded,
  listConsultants,
  ratingSummaries,
  availableSlots,
  freeSessionEligible,
} from "@/lib/consultants/service";
import { matchConsultants } from "@/lib/consultants/matching";
import { ConsultantsClient, type ConsultantView } from "@/components/app/ConsultantsClient";

export const metadata = { title: "Consultants" };
export const dynamic = "force-dynamic";

export default async function ConsultantsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string }>;
}) {
  const user = await requireSession();
  const { open } = await searchParams;

  await ensureConsultantsSeeded();
  const [consultants, ratings, profile, roadmap, deadlines] = await Promise.all([
    listConsultants(),
    ratingSummaries(),
    getProfile(user.id),
    getRoadmapV2(user.id).catch(() => null),
    listDeadlines(user.id).catch(() => []),
  ]);

  const soon = Date.now() + 45 * 24 * 60 * 60 * 1000;
  const upcoming = deadlines
    .filter((deadline) => {
      const due = deadline.date;
      return Boolean(due && new Date(due).getTime() < soon);
    })
    .map((deadline) => deadline.title ?? "")
    .filter(Boolean);

  const matches = matchConsultants(
    { profile, roadmap, upcomingDeadlines: upcoming },
    consultants,
  );

  const views: ConsultantView[] = await Promise.all(
    consultants.map(async (consultant) => ({
      id: consultant.id,
      name: consultant.name,
      headline: consultant.headline,
      bio: consultant.bio,
      countries: consultant.countries,
      background: consultant.background,
      services: consultant.services,
      languages: consultant.languages,
      types: consultant.types,
      priceMinor: consultant.priceMinor,
      sessionMinutes: consultant.sessionMinutes,
      freeFirstSession: consultant.freeFirstSession,
      verification: consultant.verification,
      responseHours: consultant.responseHours,
      studentsGuided: consultant.studentsGuided,
      avatarTone: consultant.avatarTone,
      rating: ratings[consultant.id] ?? null,
      slots: consultant.verification === "verified" || consultant.verification === "featured"
        ? await availableSlots(consultant)
        : [],
      freeSessionEligible: await freeSessionEligible(user.id, consultant),
    })),
  );

  return <ConsultantsClient consultants={views} matches={matches} initialOpenId={open ?? null} />;
}
