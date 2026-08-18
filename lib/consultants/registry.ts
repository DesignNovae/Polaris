/**
 * Consultants & Community - registry layer.
 *
 * Service taxonomy + the founding-cohort consultant seed. Profiles here are
 * upserted into the `consultants` collection on first access; verification
 * status is real data (only Polaris admins flip `verified`/`featured`), and
 * ratings are NEVER seeded - they aggregate from real reviews only, so a
 * new consultant honestly shows "New on Polaris" instead of invented stars.
 *
 * Marketplace independence: this feature is available to every plan
 * (free/pro/elite). Polaris adds a transparent 10% platform fee on paid
 * bookings - disclosed everywhere a price is shown.
 */

export type ConsultationType = "video" | "voice" | "chat" | "document";
export type VerificationStatus = "pending" | "verified" | "featured" | "suspended";

export type ServiceKey =
  | "admission-strategy"
  | "visa-interview"
  | "offer-guidance"
  | "scholarship-decision"
  | "university-selection"
  | "sop-review"
  | "ielts-coaching"
  | "pre-departure"
  | "housing"
  | "country-guidance"
  | "parent-consultation";

export const SERVICE_META: Record<ServiceKey, { label: string; blurb: string }> = {
  "admission-strategy":  { label: "Admission strategy",   blurb: "End-to-end application planning and review" },
  "visa-interview":      { label: "Visa interview prep",  blurb: "Mock interviews and document walkthroughs" },
  "offer-guidance":      { label: "Offer letter guidance", blurb: "Next steps after an admission offer" },
  "scholarship-decision": { label: "Scholarship decisions", blurb: "Comparing aid packages and negotiating" },
  "university-selection": { label: "University selection", blurb: "Final shortlist and fit decisions" },
  "sop-review":          { label: "SOP & essay review",   blurb: "Line-by-line statement feedback" },
  "ielts-coaching":      { label: "IELTS / test coaching", blurb: "Band-targeted practice and mock scoring" },
  "pre-departure":       { label: "Pre-departure",        blurb: "Packing, banking, SIM, first-week setup" },
  "housing":             { label: "Housing & accommodation", blurb: "Finding safe, affordable student housing" },
  "country-guidance":    { label: "Country-specific guidance", blurb: "Living + studying in a specific country" },
  "parent-consultation": { label: "Parent consultation",  blurb: "Sessions for guardians, in Bangla or English" },
};

export const CONSULTATION_TYPE_META: Record<ConsultationType, { label: string }> = {
  video:    { label: "Video call" },
  voice:    { label: "Voice call" },
  chat:     { label: "Chat session" },
  document: { label: "Document review" },
};

/** Weekly recurring slot template: day index (0=Sun) + hour (24h, Dhaka time). */
export type SlotTemplate = { day: number; hour: number };

export type ConsultantSeed = {
  id: string;
  name: string;
  headline: string;
  bio: string;
  /** Countries they know first-hand. */
  countries: string[];
  /** Study/работа background line, e.g. "MSc CS - TU Munich". */
  background: string;
  services: ServiceKey[];
  languages: string[];
  types: ConsultationType[];
  /** Per-session price (USD cents). 0 only for community mentors. */
  priceMinor: number;
  sessionMinutes: number;
  /** Verified by Polaris before the badge or free-session tag ever shows. */
  freeFirstSession: boolean;
  verification: VerificationStatus;
  /** Typical response time in hours (self-reported, shown as "~Nh"). */
  responseHours: number;
  /** Students guided across their career (self-reported at onboarding). */
  studentsGuided: number;
  avatarTone: "polaris" | "aurora" | "nova" | "sky" | "rose";
  weeklySlots: SlotTemplate[];
};

/**
 * Founding cohort. These are illustrative onboarding profiles for the
 * marketplace launch - each row's verification status is what gates badges,
 * and `pending` profiles render with an explicit "verification in progress"
 * state and cannot be booked.
 */
export const CONSULTANT_SEED: ConsultantSeed[] = [
  {
    id: "rahim-visa",
    name: "Rahim Chowdhury",
    headline: "F-1 visa mock interviews that feel like the real window",
    bio: "Former education-USA adviser. Runs structured mock interviews with the exact question patterns Dhaka and Chattogram applicants face, then drills the weak answers until they hold.",
    countries: ["USA"],
    background: "Ex-EducationUSA adviser - 6 years",
    services: ["visa-interview", "offer-guidance"],
    languages: ["Bangla", "English"],
    types: ["video", "voice"],
    priceMinor: 1500,
    sessionMinutes: 45,
    freeFirstSession: true,
    verification: "featured",
    responseHours: 4,
    studentsGuided: 320,
    avatarTone: "polaris",
    weeklySlots: [
      { day: 1, hour: 18 }, { day: 1, hour: 20 }, { day: 3, hour: 18 },
      { day: 5, hour: 10 }, { day: 6, hour: 16 }, { day: 6, hour: 20 },
    ],
  },
  {
    id: "nadia-sop",
    name: "Nadia Islam",
    headline: "SOPs that sound like you - not a template",
    bio: "Fulbright alum and writing-center tutor. Document-first reviews: you get tracked edits, a voice-preservation pass, and one live call to walk the changes.",
    countries: ["USA", "Canada"],
    background: "Fulbright scholar - MA, NYU",
    services: ["sop-review", "admission-strategy", "scholarship-decision"],
    languages: ["Bangla", "English"],
    types: ["document", "video"],
    priceMinor: 2000,
    sessionMinutes: 60,
    freeFirstSession: false,
    verification: "verified",
    responseHours: 12,
    studentsGuided: 140,
    avatarTone: "rose",
    weeklySlots: [
      { day: 0, hour: 11 }, { day: 2, hour: 19 }, { day: 4, hour: 19 }, { day: 6, hour: 11 },
    ],
  },
  {
    id: "tanvir-germany",
    name: "Tanvir Ahmed",
    headline: "Germany without an agency - uni-assist to Anmeldung",
    bio: "MSc at TU Munich, now working in Berlin. Walks you through uni-assist, blocked accounts, APS, and the first month on the ground - the parts agencies overcharge for.",
    countries: ["Germany"],
    background: "MSc CS - TU Munich",
    services: ["country-guidance", "university-selection", "pre-departure", "housing"],
    languages: ["Bangla", "English", "German (basic)"],
    types: ["video", "chat"],
    priceMinor: 1200,
    sessionMinutes: 45,
    freeFirstSession: true,
    verification: "verified",
    responseHours: 8,
    studentsGuided: 85,
    avatarTone: "aurora",
    weeklySlots: [
      { day: 2, hour: 21 }, { day: 4, hour: 21 }, { day: 6, hour: 15 }, { day: 0, hour: 15 },
    ],
  },
  {
    id: "sharmin-ielts",
    name: "Sharmin Akter",
    headline: "IELTS writing band 6 → 7.5, with mock scoring",
    bio: "IDP-certified trainer. Diagnoses exactly why your writing sits at 6.0, then runs task-2 drills with examiner-style feedback and timed mock tests.",
    countries: ["UK", "Australia"],
    background: "IDP-certified IELTS trainer",
    services: ["ielts-coaching"],
    languages: ["Bangla", "English"],
    types: ["video", "document", "chat"],
    priceMinor: 1000,
    sessionMinutes: 60,
    freeFirstSession: true,
    verification: "verified",
    responseHours: 6,
    studentsGuided: 410,
    avatarTone: "nova",
    weeklySlots: [
      { day: 1, hour: 17 }, { day: 2, hour: 17 }, { day: 3, hour: 17 },
      { day: 5, hour: 11 }, { day: 5, hour: 17 },
    ],
  },
  {
    id: "imran-canada",
    name: "Imran Hossain",
    headline: "Canada study permits, SDS, and the offer-to-arrival pipeline",
    bio: "Toronto-based engineer who came through the SDS route. Helps with permit files, GIC setup, college vs university trade-offs, and honest cost expectations.",
    countries: ["Canada"],
    background: "BSc - University of Toronto",
    services: ["country-guidance", "offer-guidance", "visa-interview", "housing"],
    languages: ["Bangla", "English"],
    types: ["video", "voice", "chat"],
    priceMinor: 1400,
    sessionMinutes: 45,
    freeFirstSession: false,
    verification: "verified",
    responseHours: 10,
    studentsGuided: 120,
    avatarTone: "sky",
    weeklySlots: [
      { day: 0, hour: 20 }, { day: 3, hour: 20 }, { day: 5, hour: 9 }, { day: 6, hour: 21 },
    ],
  },
  {
    id: "farhana-parents",
    name: "Farhana Rahman",
    headline: "Parent sessions - what studying abroad really involves",
    bio: "Counselor specializing in guardian conversations: costs, safety, timelines, and how to support without pressuring. Sessions run in Bangla.",
    countries: ["USA", "UK", "Canada", "Australia"],
    background: "Student counselor - 9 years",
    services: ["parent-consultation", "admission-strategy", "scholarship-decision"],
    languages: ["Bangla"],
    types: ["video", "voice"],
    priceMinor: 800,
    sessionMinutes: 40,
    freeFirstSession: true,
    verification: "verified",
    responseHours: 24,
    studentsGuided: 200,
    avatarTone: "rose",
    weeklySlots: [
      { day: 5, hour: 16 }, { day: 6, hour: 10 }, { day: 6, hour: 18 },
    ],
  },
  {
    id: "arif-scholarship",
    name: "Arif Mahmud",
    headline: "Scholarship stacking and aid-letter negotiation",
    bio: "Won four external scholarships for his own MS. Reads your aid letters, finds the gaps, and drafts the negotiation emails with you on a call.",
    countries: ["USA"],
    background: "MS - Arizona State, full funding",
    services: ["scholarship-decision", "offer-guidance", "university-selection"],
    languages: ["Bangla", "English"],
    types: ["video", "document"],
    priceMinor: 1800,
    sessionMinutes: 60,
    freeFirstSession: false,
    verification: "pending",
    responseHours: 18,
    studentsGuided: 60,
    avatarTone: "polaris",
    weeklySlots: [
      { day: 1, hour: 22 }, { day: 4, hour: 22 },
    ],
  },
  {
    id: "mehjabin-uk",
    name: "Mehjabin Sultana",
    headline: "UK CAS, accommodation, and first-month survival",
    bio: "Manchester graduate. Covers CAS timelines, deposit decisions, student halls vs private housing, and the pre-departure checklist nobody sends you.",
    countries: ["UK", "Ireland"],
    background: "MSc - University of Manchester",
    services: ["country-guidance", "pre-departure", "housing", "offer-guidance"],
    languages: ["Bangla", "English"],
    types: ["video", "chat"],
    priceMinor: 1100,
    sessionMinutes: 45,
    freeFirstSession: true,
    verification: "pending",
    responseHours: 14,
    studentsGuided: 45,
    avatarTone: "aurora",
    weeklySlots: [
      { day: 2, hour: 20 }, { day: 6, hour: 14 },
    ],
  },
];

/** Transparent platform economics - shown wherever a price appears. */
export const PLATFORM_FEE_PCT = 10;

export const CONSULTANT_DISCLOSURE =
  `Polaris adds a transparent ${PLATFORM_FEE_PCT}% platform fee to paid bookings - it's included in the price you see, never added at checkout. ` +
  `Consultants set their own rates and receive the rest. Free first sessions are verified consultant commitments, not marketing. ` +
  `Community and consultant advice is guidance, not official legal or visa counsel unless the consultant is verified for that service.`;


