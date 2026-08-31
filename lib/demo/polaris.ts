import type { PathSummary } from "@/types/app";
import type { RoadmapDoc, RoadmapNode } from "@/lib/roadmap/types";
import type { UiDeadline } from "@/components/app/DeadlinesClient";
import type { HubEntryDto } from "@/components/app/ConnectionsClient";
import type { ConsultantView } from "@/components/app/ConsultantsClient";
import type { ConsultantMatch } from "@/lib/consultants/matching";
import type { BookingView } from "@/components/app/BookingsClient";
import type { TxDto } from "@/components/app/TransactionsClient";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { CONSULTANT_SEED } from "@/lib/consultants/registry";

export const DEMO_USER = {
  id: "polaris-demo-student",
  name: "Pro Student",
  email: "demo@polaris.education",
  initials: "PS",
  grade: "late-hs",
  country: "Bangladesh",
  plan: "elite" as const,
};

export const DEMO_PATHS: PathSummary[] = [{
  id: "demo-cs",
  name: "Over the next 6–18 months, focus on CS",
  target: "Elite global Computer Science programs",
  degree: "masters",
  horizon: "Active",
  probability: 0.41,
  color: "polaris",
}];

function mission(input: Partial<RoadmapNode> & Pick<RoadmapNode, "id" | "title" | "description" | "type" | "phase" | "status">): RoadmapNode {
  return {
    why: "This creates verifiable evidence for a competitive, internationally focused application.",
    how: "Block focused time each week, complete the checklist in order, and keep one concrete artifact or score as evidence.",
    priority: "high",
    difficulty: 3,
    estimatedHoursPerWeek: 4,
    tasks: [
      { id: `${input.id}-1`, text: "Record the current baseline", done: false },
      { id: `${input.id}-2`, text: "Complete the focused work block", done: false },
      { id: `${input.id}-3`, text: "Save measurable evidence", done: false },
    ],
    topics: [],
    resources: [],
    scoreInputs: [],
    completionCriteria: "One month of focused blocks plus a measurable improvement",
    strategistContext: input.description,
    impact: "+ Application strength",
    progress: 0,
    notes: [],
    ...input,
  };
}

const stamp = new Date("2026-07-25T12:00:00.000Z");
export const DEMO_ROADMAP_DOC: RoadmapDoc = {
  roadmapId: "polaris-demo-roadmap",
  title: "CS - 730-day plan",
  config: {
    educationLevel: "hsc",
    currentYear: "Class 12",
    targetGoal: "CS",
    durationDays: 730,
    timelineMode: "yearly",
    exams: ["SAT", "IELTS"],
    availableHoursPerWeek: 14,
    weakAreas: "Research evidence, standardized testing, and a flagship project",
    academicTarget: "GPA 3.9+",
    currentScores: { "sat-total": 1320, "ielts-overall": 6.5 },
  },
  phases: ["Year 1", "Year 2"],
  branches: [
    {
      id: "academics", title: "Academic excellence", category: "Academics", priority: "high", tone: "polaris",
      nodes: [
        mission({ id: "result-lock", title: "Result target lock-in", description: "Raise the academic ceiling with weekly diagnostics and protected study blocks.", type: "study", phase: 0, status: "current", impact: "+ Academic ceiling", topics: ["board-prep", "study-skills"] }),
        mission({ id: "academic-depth", title: "Advanced subject depth", description: "Complete a university-level CS or mathematics sequence and document mastery.", type: "study", phase: 1, status: "locked", priority: "medium", impact: "+ Academic rigor" }),
      ],
    },
    {
      id: "projects", title: "Signature projects & leadership", category: "Projects", priority: "high", tone: "rose",
      nodes: [
        mission({ id: "original-project", title: "Original flagship project", description: "Ship one useful public product with real users and a documented problem statement.", type: "project", phase: 0, status: "current", impact: "+ Technical proof" }),
        mission({ id: "leadership", title: "Leadership with outcomes", description: "Lead a student initiative with a measurable beneficiary and published result.", type: "activity", phase: 1, status: "locked", impact: "+ Leadership evidence" }),
        mission({ id: "competition", title: "Competitive validation", description: "Enter a credible national or international technical competition.", type: "activity", phase: 1, status: "locked", priority: "medium", impact: "+ External validation" }),
      ],
    },
    {
      id: "applications", title: "Applications & funding", category: "Applications", priority: "high", tone: "aurora",
      nodes: [
        mission({ id: "application-system", title: "Application evidence system", description: "Build the essay, recommender, university, and scholarship evidence pack early.", type: "application", phase: 1, status: "locked", impact: "+ Application readiness" }),
      ],
    },
  ],
  scores: [],
  adaptations: [],
  createdAt: stamp,
  updatedAt: stamp,
};

export const DEMO_DEADLINES: UiDeadline[] = [
  { id: "ielts", date: "2026-07-25", title: "IELTS", kind: "hard", type: "exam", priority: "high", status: "pending", notes: "Official test date", checklist: [{ id: "mock", text: "Complete final mock", done: false }], reminderDays: [14, 7, 1], source: "user" },
];

export const DEMO_CONNECTIONS: HubEntryDto[] = INTEGRATIONS.map((def) => ({
  def,
  status: def.baseStatus,
  account: null,
  imported: [],
  insights: [],
  error: null,
  lastSyncAt: null,
}));

export const DEMO_CONSULTANTS: ConsultantView[] = CONSULTANT_SEED.map((person) => ({
  id: person.id,
  name: person.name,
  headline: person.headline,
  bio: person.bio,
  countries: person.countries,
  background: person.background,
  services: person.services,
  languages: person.languages,
  types: person.types,
  priceMinor: person.priceMinor,
  sessionMinutes: person.sessionMinutes,
  freeFirstSession: person.freeFirstSession,
  verification: person.verification,
  responseHours: person.responseHours,
  studentsGuided: person.studentsGuided,
  avatarTone: person.avatarTone,
  rating: person.verification === "pending" ? null : { average: 4.9, count: 18 },
  slots: person.verification === "pending" ? [] : ["2026-07-27T10:00:00.000Z", "2026-07-29T14:00:00.000Z"],
  freeSessionEligible: person.freeFirstSession,
}));

export const DEMO_CONSULTANT_MATCHES: ConsultantMatch[] = DEMO_CONSULTANTS.slice(0, 3).map((person, index) => ({
  consultantId: person.id,
  score: 95 - index * 5,
  reasons: [index === 0 ? "A general strategy session maps your next two months" : "Matched to your roadmap and deadlines"],
}));

export const DEMO_BOOKINGS: BookingView[] = [{
  id: "demo-booking", consultantId: "tanvir-germany", consultantName: "Tanvir Ahmed",
  service: "university-selection", type: "video", slotIso: "2026-07-30T10:00:00.000Z",
  sessionMinutes: 45, status: "confirmed", priceMinor: 0, currency: "BDT",
  freeSession: true, platformFeeMinor: 0, consultantPayoutMinor: 0,
  transactionId: null, refundNote: null,
}];

export const DEMO_TRANSACTIONS: TxDto[] = [{
  id: "demo-access", reference: "POLARIS-DEMO", method: "card", amount: 0,
  currency: "BDT", description: "Public hackathon demonstration access",
  status: "succeeded", maskedAccount: "No payment required", cardBrand: "demo",
  createdAt: "2026-07-25T12:00:00.000Z",
}];
