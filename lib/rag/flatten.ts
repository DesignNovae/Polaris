import universities from "@/data/universities.json";
import scholarships from "@/data/scholarships.json";
import caseStudies from "@/data/case-studies.json";
import type { RagDoc } from "./types";

export function flattenAllDocs(): RagDoc[] {
  const uniDocs: RagDoc[] = (universities as any[]).map((u) => ({
    id: `uni:${u.id}`,
    source: "university",
    title: u.name,
    text: [
      `${u.name} (${u.country}, ${u.city}).`,
      `Tier: ${u.tier}. Acceptance rate: ${(u.acceptanceRate * 100).toFixed(1)}%.`,
      `Top programs: ${u.topPrograms.join(", ")}.`,
      `GPA: ${u.requirements.gpa}.`,
      `Tests: ${u.requirements.tests}.`,
      `Essays: ${u.requirements.essays}.`,
      `Recommendations: ${u.requirements.recs}.`,
      `Differentiators: ${u.requirements.differentiators}.`,
      `Summary: ${u.summary}`,
    ].join(" "),
    metadata: { universityId: u.id, country: u.country, tier: u.tier, tags: u.tags },
  }));

  const schDocs: RagDoc[] = (scholarships as any[]).map((s) => ({
    id: `sch:${s.id}`,
    source: "scholarship",
    title: s.name,
    text: [
      `${s.name} hosted at ${s.host}.`,
      `Level: ${s.level}. Value: ${s.value}.`,
      `Eligibility: ${s.eligibility}.`,
      `Tags: ${s.tags.join(", ")}.`,
      `Summary: ${s.summary}`,
    ].join(" "),
    metadata: { scholarshipId: s.id, level: s.level, tags: s.tags },
  }));

  const csDocs: RagDoc[] = (caseStudies as any[]).map((c) => ({
    id: `case:${c.id}`,
    source: "case-study",
    title: c.title,
    text: [
      `Case study: ${c.title}.`,
      `Profile country: ${c.profile.country}. School: ${c.profile.school}.`,
      `GPA: ${c.profile.gpa}. Tests: ${c.profile.tests}.`,
      `Extracurriculars: ${c.profile.ecs.join("; ")}.`,
      `Tier: ${c.profile.tier}.`,
      `What worked: ${c.whatWorked}`,
    ].join(" "),
    metadata: { caseId: c.id, country: c.profile.country, tier: c.profile.tier, tags: c.tags },
  }));

  return [...uniDocs, ...schDocs, ...csDocs];
}
