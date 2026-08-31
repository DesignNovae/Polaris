import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import universitiesJson from "@/data/universities.json";
import scholarshipsJson from "@/data/scholarships.json";
import caseStudiesJson from "@/data/case-studies.json";
import { UniversitiesClient } from "@/components/app/UniversitiesClient";
import { ResourcesClient, type HubCaseStudy, type HubScholarship } from "@/components/app/ResourcesClient";
import { PartnersClient } from "@/components/app/PartnersClient";
import { DeadlinesClient } from "@/components/app/DeadlinesClient";
import { ConnectionsClient } from "@/components/app/ConnectionsClient";
import { ConsultantsClient } from "@/components/app/ConsultantsClient";
import { CommunityClient } from "@/components/app/CommunityClient";
import { StrategistClient, type GapRow } from "@/components/app/StrategistClient";
import { ActionLabClient } from "@/components/app/ActionLabClient";
import { BookingsClient } from "@/components/app/BookingsClient";
import { BillingClient } from "@/components/app/BillingClient";
import { TransactionsClient } from "@/components/app/TransactionsClient";
import { LiveFamily } from "@/components/demo/LiveFamily";
import { DemoSettingsClient } from "@/components/demo/DemoSettingsClient";
import { toUniProfile } from "@/lib/admissions";
import type { UniversityForModel } from "@/lib/ml/probability";
import {
  DEMO_BOOKINGS, DEMO_CONNECTIONS, DEMO_CONSULTANTS, DEMO_CONSULTANT_MATCHES,
  DEMO_DEADLINES, DEMO_TRANSACTIONS, DEMO_USER,
} from "@/lib/demo/polaris";

const SECTIONS = new Set(["strategist", "deadlines", "universities", "resources", "action-lab", "connections", "partners", "consultants", "community", "family", "bookings", "billing", "transactions", "settings"]);
const VALID_TIERS: UniversityForModel["tier"][] = ["elite", "top10", "top50", "top100", "top200"];

export function generateStaticParams() { return [...SECTIONS].map((section) => ({ section })); }

export default async function DemoSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (section === "roadmap") redirect("/demo");
  if (!SECTIONS.has(section)) notFound();

  const universities = (universitiesJson as Array<Record<string, unknown>>).map(toUniProfile);
  if (section === "universities") return <UniversitiesClient universities={universities.filter((item) => item.id && VALID_TIERS.includes(item.tier))} initialInputs={{ gpa: 3.8, testPercentile: 84, ecCount: 3, research: 1 }} />;
  if (section === "resources") return <ResourcesClient caseStudies={caseStudiesJson as HubCaseStudy[]} scholarships={scholarshipsJson as HubScholarship[]} universities={universities.filter((item) => item.admissions !== null)} level="hsc" />;
  if (section === "action-lab") return <ActionLabClient />;
  if (section === "partners") return <PartnersClient level="hsc" roadmapTopics={["SAT", "IELTS", "research", "portfolio", "essays", "scholarships"]} weakScores={[{ key: "research", label: "Research evidence", ratio: 0.2 }, { key: "testing", label: "Testing", ratio: 0.48 }]} deadlineTypesSoon={["test-exam", "scholarship", "essay"]} eliteUniIds={universities.filter((item) => item.tier === "elite" || item.tier === "top10").map((item) => item.id)} />;
  if (section === "deadlines") return <DeadlinesClient initial={DEMO_DEADLINES} demo />;
  if (section === "connections") return <ConnectionsClient initial={DEMO_CONNECTIONS} demo />;
  if (section === "consultants") return <ConsultantsClient consultants={DEMO_CONSULTANTS} matches={DEMO_CONSULTANT_MATCHES} initialOpenId={null} demo basePath="/demo" />;
  if (section === "community") return <CommunityClient initialChannel="general" me={{ id: DEMO_USER.id, name: DEMO_USER.name, role: "student" }} demo />;
  if (section === "family") return <LiveFamily />;
  if (section === "bookings") return <BookingsClient initial={DEMO_BOOKINGS} demo basePath="/demo" />;
  if (section === "strategist") return <StrategistClient studentName={DEMO_USER.name} initials={DEMO_USER.initials} grade={DEMO_USER.grade} contextRows={[{ k: "GPA", v: "3.80" }, { k: "Target", v: "Elite-tier" }, { k: "Probability", v: "41%" }, { k: "Country", v: "Bangladesh" }]} gapRows={GAPS} eyebrow="Strategist · grounded · Elite-tier target" demo />;
  if (section === "transactions") return <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1000px] mx-auto"><Header eyebrow="Account" title="Transactions" blurb="Every payment with its live status, reference id, and printable receipt."/><TransactionsClient rows={DEMO_TRANSACTIONS} userName={DEMO_USER.name} userEmail={DEMO_USER.email}/></div>;
  if (section === "billing") return <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1080px] mx-auto"><Header eyebrow="Account" title="Billing & plan" blurb="The public demonstration has full Elite access and never asks judges for payment."/><BillingClient plan="elite" subscription={{ status: "active", planId: "elite", billingCycle: "yearly", startedAt: "2026-07-25", renewsAt: "2027-07-25", priceMinor: 0, currency: "BDT" }} methods={[]} lifetimeSpend={[]} succeededCount={0}/></div>;
  if (section === "settings") return <Suspense fallback={<div className="p-8 text-[13px] text-ink-muted">Loading settings...</div>}><DemoSettingsClient /></Suspense>;
  notFound();
}

const GAPS: GapRow[] = [
  { signal: "GPA / academic ceiling", you: "3.80", admit: "3.90", move: "Lift toward a 3.9+ ceiling" },
  { signal: "Standardized testing", you: "84%ile", admit: "95%ile", move: "Structured prep → higher percentile" },
  { signal: "Strong extracurriculars", you: "3", admit: "7", move: "Deepen 1–2 sustained activities" },
  { signal: "Original research / shipped work", you: "1", admit: "6", move: "Land a research seat or ship a project" },
];

function Header({ eyebrow, title, blurb }: { eyebrow: string; title: string; blurb: string }) { return <header className="mb-6"><div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">{eyebrow}</div><h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink"><span className="grad-text">{title}</span></h1><p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">{blurb}</p></header>; }

