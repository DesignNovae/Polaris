/**
 * /universities - university discovery + fit engine. Free for every signed-in
 * student: the directory, acceptance-rate benchmarks, and requirement
 * summaries are part of the Free plan promise. Merges the KB rows with the
 * admissions enrichment dataset (official links, application systems,
 * deadline patterns, test policy, tuition, aid, sources) and hands the full
 * profiles to the client, which renders the 3D card grid, filters, detail
 * modal, comparison, and the live fit bands computed from the student's
 * real profile inputs.
 */

import { requireSession } from "@/lib/authz";
import { getUniversities } from "@/lib/content";
import { getProfile } from "@/lib/db/collections";
import { profileToInputs, type UniversityForModel } from "@/lib/ml/probability";
import { toUniProfile } from "@/lib/admissions";
import { UniversitiesClient } from "@/components/app/UniversitiesClient";

export const dynamic = "force-dynamic";

// Abroad-focused page: regional/local-market schools stay in the KB for the
// Strategist but aren't shown on the discovery grid.
const VALID_TIERS: UniversityForModel["tier"][] = ["elite", "top10", "top50", "top100", "top200"];

export default async function UniversitiesPage() {
  const user = await requireSession();
  const [raw, profile] = await Promise.all([getUniversities(), getProfile(user.id)]);

  const universities = (raw as Array<Record<string, unknown>>)
    .map(toUniProfile)
    .filter((u) => u.id && VALID_TIERS.includes(u.tier));

  return <UniversitiesClient universities={universities} initialInputs={profileToInputs(profile)} />;
}
