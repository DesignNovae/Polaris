/**
 * /resources - the Admission Knowledge Hub.
 *
 * Server page assembles the hub's real datasets:
 *   - anonymized composite admit case studies (data/case-studies.json)
 *   - real scholarships + official URLs/windows (data/scholarships.json + lib/resources/hub)
 *   - university cost profiles (admissions enrichment + officially-sourced
 *     country living-cost benchmarks)
 *   - the student's education level for personalization
 * and hands off to the client hub (galaxy, explorers, exam hub).
 */

import { requireSession } from "@/lib/authz";
import { getProfile } from "@/lib/db/collections";
import { getCaseStudies, getScholarships, getUniversities } from "@/lib/content";
import { toUniProfile } from "@/lib/admissions";
import { ResourcesClient, type HubCaseStudy, type HubScholarship } from "@/components/app/ResourcesClient";
import type { EducationLevel } from "@/lib/roadmap/types";

export const metadata = { title: "Resources" };
export const dynamic = "force-dynamic";

const GRADE_TO_LEVEL: Record<string, EducationLevel> = {
  "middle": "middle-school",
  "early-hs": "ssc",
  "late-hs": "hsc",
  "undergrad": "gap-applicant",
  "recent-grad": "gap-applicant",
};

export default async function ResourcesPage() {
  const user = await requireSession();
  const [profile, rawCases, rawScholarships, rawUnis] = await Promise.all([
    getProfile(user.id),
    getCaseStudies(),
    getScholarships(),
    getUniversities(),
  ]);

  const caseStudies = rawCases as unknown as HubCaseStudy[];
  const scholarships = rawScholarships as unknown as HubScholarship[];
  const universities = (rawUnis as Array<Record<string, unknown>>)
    .map(toUniProfile)
    .filter((u) => u.admissions !== null);

  const level = GRADE_TO_LEVEL[profile?.grade ?? "late-hs"] ?? "hsc";

  return (
    <ResourcesClient
      caseStudies={caseStudies}
      scholarships={scholarships}
      universities={universities}
      level={level}
    />
  );
}
