/**
 * Source layer for the knowledge base.
 *
 * Reads the *database* content collections (so admin edits reach retrieval)
 * and falls back to the bundled JSON when Mongo is unreachable - the public
 * /demo route relies on that fallback. Admissions enrichment is folded in as
 * its own source: deadlines, test policy, tuition and aid are the questions
 * students actually ask, and they live nowhere else in the index.
 */

import universitiesJson from "@/data/universities.json";
import scholarshipsJson from "@/data/scholarships.json";
import caseStudiesJson from "@/data/case-studies.json";
import { admissionsFor, admissionsMeta } from "@/lib/admissions";
import { COUNTRY_COSTS, HUB_META } from "@/lib/resources/hub";
import { LEARNING_VIDEOS, PRACTICE_QUESTIONS } from "@/lib/action-lab/data";
import { getContent } from "@/lib/content";
import { documentRagDocs } from "./documents";
import { hashText, splitText } from "./chunk";
import { ragCacheVersion, RAG_CACHE_TTL_MS } from "./cache";
import type { RagChunk, RagDoc } from "./types";

type Row = Record<string, any>;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function universityDoc(u: Row): RagDoc {
  return {
    id: `uni:${u.id}`,
    source: "university",
    title: u.name,
    text: [
      `${u.name} (${u.country}, ${u.city}).`,
      `Tier: ${u.tier}. Acceptance rate: ${(Number(u.acceptanceRate) * 100).toFixed(1)}%.`,
      `Top programs: ${(u.topPrograms ?? []).join(", ")}.`,
      `GPA: ${u.requirements?.gpa}.`,
      `Tests: ${u.requirements?.tests}.`,
      `Essays: ${u.requirements?.essays}.`,
      `Recommendations: ${u.requirements?.recs}.`,
      `Differentiators: ${u.requirements?.differentiators}.`,
      `Summary: ${u.summary}`,
    ].join(" "),
    metadata: { universityId: u.id, country: u.country, tier: u.tier, tags: u.tags },
  };
}

function scholarshipDoc(s: Row): RagDoc {
  return {
    id: `sch:${s.id}`,
    source: "scholarship",
    title: s.name,
    text: [
      `${s.name} hosted at ${s.host}.`,
      `Level: ${s.level}. Value: ${s.value}.`,
      `Eligibility: ${s.eligibility}.`,
      `Tags: ${(s.tags ?? []).join(", ")}.`,
      `Summary: ${s.summary}`,
    ].join(" "),
    metadata: { scholarshipId: s.id, level: s.level, tags: s.tags },
  };
}

function caseStudyDoc(c: Row): RagDoc {
  return {
    id: `case:${c.id}`,
    source: "case-study",
    title: c.title,
    text: [
      `Case study: ${c.title}.`,
      `Profile country: ${c.profile?.country}. School: ${c.profile?.school}.`,
      `GPA: ${c.profile?.gpa}. Tests: ${c.profile?.tests}.`,
      `Extracurriculars: ${(c.profile?.ecs ?? []).join("; ")}.`,
      `Tier: ${c.profile?.tier}.`,
      `What worked: ${c.whatWorked}`,
    ].join(" "),
    metadata: { caseId: c.id, country: c.profile?.country, tier: c.profile?.tier, tags: c.tags },
  };
}

/** Admissions enrichment, one doc per university that has an entry. */
function admissionsDoc(u: Row): RagDoc | null {
  const a = admissionsFor(String(u.id));
  if (!a) return null;
  const deadlines = (a.deadlines ?? [])
    .map((d) => `${d.label} on ${MONTHS[d.month - 1]} ${d.day}`)
    .join("; ");
  return {
    id: `adm:${u.id}`,
    source: "admissions",
    title: `${u.name} - admissions, deadlines and cost`,
    text: [
      `How to apply to ${u.name} (${u.country}).`,
      `Application systems: ${(a.applicationSystems ?? []).join(", ")}.`,
      deadlines ? `Application deadlines: ${deadlines}. Dates repeat annually.` : "",
      `Standardized test policy: ${a.testPolicy}.`,
      `English language requirement: ${a.english}.`,
      `Indicative international tuition: ${a.tuitionIntl}.`,
      `Financial aid: ${a.aid}.`,
      `Scholarships: ${a.scholarships}.`,
      `Institution type: ${(a.typeTags ?? []).join(", ")}.`,
      `Official admissions page: ${a.admissionsUrl}.`,
    ]
      .filter(Boolean)
      .join(" "),
    metadata: {
      universityId: u.id,
      country: u.country,
      admissionsUrl: a.admissionsUrl,
      sourceUrls: a.sourceUrls,
      lastUpdated: admissionsMeta().lastUpdated,
    },
  };
}

/**
 * Officially published living-cost benchmarks (visa maintenance requirements,
 * blocked-account figures). These answer the affordability questions students
 * actually lead with, and nothing else in the index carries them.
 */
function costDocs(): RagDoc[] {
  return Object.values(COUNTRY_COSTS).map((c) => ({
    id: `cost:${c.country.toLowerCase().replace(/\s+/g, "-")}`,
    source: "cost" as const,
    title: `Cost of living for students in ${c.country}`,
    text: [
      `Living costs for an international student in ${c.country}: ${c.living}.`,
      c.livingNote,
      `This figure is what ${c.country} publishes officially, per ${c.sourceName}.`,
      `Budgeting for ${c.country} should treat this as the minimum on top of tuition.`,
      `Source: ${c.sourceUrl}. Last checked ${HUB_META.lastUpdated}. ${HUB_META.verifyNote}`,
    ].join(" "),
    metadata: {
      country: c.country,
      sourceName: c.sourceName,
      sourceUrl: c.sourceUrl,
      lastUpdated: HUB_META.lastUpdated,
    },
  }));
}

/** Worked practice items - grounding for study-mode explanations. */
function practiceDocs(): RagDoc[] {
  return PRACTICE_QUESTIONS.map((q) => ({
    id: `practice:${q.id}`,
    source: "practice" as const,
    title: `${q.exam} ${q.section}: ${q.skill} (${q.difficulty})`,
    text: [
      `${q.exam} ${q.section} practice question testing ${q.skill.toLowerCase()} at ${q.difficulty.toLowerCase()} level.`,
      q.passage ? `Passage: ${q.passage}` : "",
      `Question: ${q.prompt}`,
      `Options: ${q.options.map((option, i) => `(${i + 1}) ${option}`).join(" ")}`,
      `Correct answer: ${q.options[q.answer]}.`,
      `Why: ${q.explanation}`,
    ]
      .filter(Boolean)
      .join(" "),
    metadata: { exam: q.exam, section: q.section, skill: q.skill, difficulty: q.difficulty },
  }));
}

/** Curated official prep resources, each with its real source URL. */
function resourceDocs(): RagDoc[] {
  return LEARNING_VIDEOS.map((v) => ({
    id: `resource:${v.id}`,
    source: "resource" as const,
    title: v.title,
    text: [
      `${v.title} - a ${v.duration.toLowerCase()} for ${v.exam} ${v.topic} preparation.`,
      `Published by ${v.source}.`,
      `Use this when preparing the ${v.topic} section of the ${v.exam}.`,
      `Official preparation page: ${v.officialUrl}`,
    ].join(" "),
    metadata: {
      exam: v.exam,
      topic: v.topic,
      publisher: v.source,
      officialUrl: v.officialUrl,
      youtubeId: v.youtubeId,
    },
  }));
}

function assemble(
  universities: Row[],
  scholarships: Row[],
  caseStudies: Row[],
): RagDoc[] {
  return [
    ...universities.map(universityDoc),
    ...universities.map(admissionsDoc).filter((d): d is RagDoc => d !== null),
    ...scholarships.map(scholarshipDoc),
    ...caseStudies.map(caseStudyDoc),
    // Static, code-owned corpora - no admin surface, so they load the same
    // way in every path (no DB round trip, no fallback branch).
    ...costDocs(),
    ...practiceDocs(),
    ...resourceDocs(),
  ];
}

/** Synchronous JSON view. Used as the offline fallback and by tooling. */
export function flattenAllDocs(): RagDoc[] {
  return assemble(
    universitiesJson as Row[],
    scholarshipsJson as Row[],
    caseStudiesJson as Row[],
  );
}

/** Database-backed view (falls back to JSON inside getContent). */
export async function loadKbDocs(): Promise<RagDoc[]> {
  try {
    const [universities, scholarships, caseStudies, documents] = await Promise.all([
      getContent("universities"),
      getContent("scholarships"),
      getContent("case-studies"),
      documentRagDocs(),
    ]);
    return [
      ...assemble(universities as Row[], scholarships as Row[], caseStudies as Row[]),
      // Admin-authored long-form documents. These are the ones long enough to
      // actually split, so they exercise chunking and overlap in production.
      ...documents,
    ];
  } catch (err) {
    console.error("[rag] falling back to bundled JSON:", (err as Error).message);
    return flattenAllDocs();
  }
}

export function chunkDoc(doc: RagDoc): RagChunk[] {
  const windows = splitText(doc.text);
  return windows.map((text, chunkIndex) => ({
    ...doc,
    text,
    chunkId: windows.length === 1 ? doc.id : `${doc.id}#${chunkIndex}`,
    docId: doc.id,
    chunkIndex,
    hash: hashText(text),
  }));
}

let chunkCache: { at: number; version: number; chunks: RagChunk[] } | null = null;

/**
 * The lexical corpus. Deterministic and API-free, so BM25 works with no key,
 * no embeddings and no prior ingestion run. Shares `chunkId` with the vector
 * index, which is what lets the two rank lists fuse.
 */
export async function buildKbChunks(): Promise<RagChunk[]> {
  const version = ragCacheVersion();
  if (
    chunkCache &&
    chunkCache.version === version &&
    Date.now() - chunkCache.at < RAG_CACHE_TTL_MS
  ) {
    return chunkCache.chunks;
  }
  const docs = await loadKbDocs();
  const chunks = docs.flatMap(chunkDoc);
  chunkCache = { at: Date.now(), version, chunks };
  return chunks;
}
