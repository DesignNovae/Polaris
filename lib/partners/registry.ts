/**
 * Partner Marketplace registry - the honest catalog.
 *
 * Offer types are real:
 *   - free_student_benefit   → official student programs (GitHub Pack, Notion
 *                              Education, JetBrains…) with official source URLs
 *   - curated_no_commission  → genuinely useful tools we recommend with ZERO
 *                              commission, clearly labeled
 *   - official_student_offer → an official discount published by the vendor
 *   - affiliate / referral   → supported by the model, but NONE are active -
 *                              Polaris has no affiliate deals yet and we don't
 *                              fake codes or links
 *   - coming_soon            → partnerships we want but don't have; request
 *                              buttons, no fake discounts
 *
 * Every visible offer carries sourceUrl + lastVerifiedAt. No invented codes,
 * discounts, or commission terms anywhere.
 */

export type PartnerOfferType =
  | "affiliate" | "referral" | "official_student_offer"
  | "free_student_benefit" | "curated_no_commission" | "coming_soon";

export type PartnerCategory =
  | "ielts" | "sat" | "essay" | "mock_test" | "tutoring" | "olympiad"
  | "coding" | "portfolio" | "research" | "productivity" | "design"
  | "cloud" | "scholarship" | "mentorship" | "visa" | "books";

export type PartnerOffer = {
  id: string;
  title: string;
  partnerName: string;
  /** BrandLogos key when a real vector exists in-repo; monogram otherwise. */
  brand?: string;
  color: string;
  partnerWebsite: string;
  category: PartnerCategory;
  offerType: PartnerOfferType;
  status: "active" | "coming_soon";
  description: string;
  benefits: string[];
  eligibility: string;
  countries: string;
  /** Education levels the offer suits (empty = all). */
  educationLevels?: Array<"early-school" | "middle-school" | "ssc" | "hsc" | "gap-applicant">;
  /** Roadmap topic tags this boosts (sat-math, ielts-writing, coding…). */
  topics: string[];
  /** Real coupon/referral code - null unless an actual code exists. */
  couponCode: string | null;
  /** Real affiliate URL - null unless an actual program exists. */
  affiliateUrl: string | null;
  officialOfferUrl: string;
  estimatedValue?: string;
  commission: boolean;
  sourceUrl: string;
  sourceName: string;
  lastVerifiedAt: string;
  comingSoonReason?: string;
};

export const PARTNER_DISCLOSURE =
  "Polaris may earn a commission on some partner offers - every such offer is labeled. Right now no affiliate deals are active: everything below is an official student benefit, a free resource, or a no-commission recommendation. Free options are always shown before paid ones.";

const V = "2026-06-11";

export const PARTNER_OFFERS: PartnerOffer[] = [
  /* ─── Free student benefits (official programs) ─── */
  {
    id: "github-pack",
    title: "GitHub Student Developer Pack",
    partnerName: "GitHub Education",
    brand: "github",
    color: "#24292F",
    partnerWebsite: "https://github.com",
    category: "coding",
    offerType: "free_student_benefit",
    status: "active",
    description: "Dozens of paid developer tools free while you're a student - domains, cloud credits, IDEs, learning platforms - verified with proof of enrollment.",
    benefits: ["Free domains + cloud credits", "JetBrains, Copilot & dev tool access", "The standard portfolio-building kit"],
    eligibility: "Enrolled students 13+, verified via GitHub Education",
    countries: "Worldwide",
    topics: ["coding", "portfolio"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://education.github.com/pack",
    estimatedValue: "Hundreds of dollars of tools, free",
    commission: false,
    sourceUrl: "https://education.github.com/pack",
    sourceName: "GitHub Education",
    lastVerifiedAt: V,
  },
  {
    id: "notion-edu",
    title: "Notion for Education",
    partnerName: "Notion",
    brand: "notion",
    color: "#111111",
    partnerWebsite: "https://notion.so",
    category: "productivity",
    offerType: "free_student_benefit",
    status: "active",
    description: "Notion's Education Plus plan free with a school email - the standard for application tracking, study systems, and note databases.",
    benefits: ["Education Plus plan free", "Unlimited pages + blocks", "Application tracker templates"],
    eligibility: "Students with a school email address",
    countries: "Worldwide",
    topics: ["study-skills", "applications"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.notion.so/product/notion-for-education",
    commission: false,
    sourceUrl: "https://www.notion.so/product/notion-for-education",
    sourceName: "Notion",
    lastVerifiedAt: V,
  },
  {
    id: "figma-edu",
    title: "Figma for Education",
    partnerName: "Figma",
    color: "#A259FF",
    partnerWebsite: "https://figma.com",
    category: "design",
    offerType: "free_student_benefit",
    status: "active",
    description: "Figma's professional plan free for verified students - design portfolios, posters for clubs, and product mockups.",
    benefits: ["Professional plan free", "Unlimited files", "FigJam included"],
    eligibility: "Students 13+, education verification",
    countries: "Worldwide",
    topics: ["portfolio", "coding"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.figma.com/education/",
    commission: false,
    sourceUrl: "https://www.figma.com/education/",
    sourceName: "Figma",
    lastVerifiedAt: V,
  },
  {
    id: "jetbrains-student",
    title: "JetBrains Student License",
    partnerName: "JetBrains",
    color: "#000000",
    partnerWebsite: "https://jetbrains.com",
    category: "coding",
    offerType: "free_student_benefit",
    status: "active",
    description: "All JetBrains professional IDEs (IntelliJ Ultimate, PyCharm Pro, CLion…) free for students - renewable yearly.",
    benefits: ["All professional IDEs free", "Renewable while enrolled"],
    eligibility: "Students with school email / GitHub Pack / ISIC",
    countries: "Worldwide",
    topics: ["coding", "portfolio"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.jetbrains.com/community/education/#students",
    commission: false,
    sourceUrl: "https://www.jetbrains.com/community/education/#students",
    sourceName: "JetBrains",
    lastVerifiedAt: V,
  },
  {
    id: "ms-education",
    title: "Microsoft 365 Education",
    partnerName: "Microsoft",
    color: "#5E5E5E",
    partnerWebsite: "https://microsoft.com",
    category: "productivity",
    offerType: "free_student_benefit",
    status: "active",
    description: "Word, Excel, PowerPoint, OneNote and Teams free with an eligible school email address.",
    benefits: ["Office apps free", "1TB OneDrive storage"],
    eligibility: "Eligible school email address",
    countries: "Worldwide (school must be enrolled)",
    topics: ["study-skills", "essay"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.microsoft.com/en-us/education/products/office",
    commission: false,
    sourceUrl: "https://www.microsoft.com/en-us/education/products/office",
    sourceName: "Microsoft Education",
    lastVerifiedAt: V,
  },
  {
    id: "canva-edu",
    title: "Canva for Education",
    partnerName: "Canva",
    color: "#00C4CC",
    partnerWebsite: "https://canva.com",
    category: "design",
    offerType: "free_student_benefit",
    status: "active",
    description: "Canva Pro features free for eligible K-12 students and teachers - club posters, science-fair boards, presentation polish.",
    benefits: ["Pro features free (K-12)", "Templates + brand kits"],
    eligibility: "K-12 students/teachers via school verification",
    countries: "Worldwide",
    educationLevels: ["early-school", "middle-school", "ssc"],
    topics: ["science-fair", "leadership"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.canva.com/education/",
    commission: false,
    sourceUrl: "https://www.canva.com/education/",
    sourceName: "Canva",
    lastVerifiedAt: V,
  },
  {
    id: "coursera-aid",
    title: "Coursera Financial Aid",
    partnerName: "Coursera",
    color: "#0056D2",
    partnerWebsite: "https://coursera.org",
    category: "scholarship",
    offerType: "free_student_benefit",
    status: "active",
    description: "Most Coursera courses offer full financial aid - certificates for strong applications without the fee.",
    benefits: ["Course fees waived on approval", "Real certificates for your profile"],
    eligibility: "Per-course application with a short statement",
    countries: "Worldwide",
    topics: ["research", "coding", "study-skills"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.coursera.org/about/payments-finaid",
    commission: false,
    sourceUrl: "https://www.coursera.org/about/payments-finaid",
    sourceName: "Coursera",
    lastVerifiedAt: V,
  },

  /* ─── Curated, no commission (free official prep first) ─── */
  {
    id: "khan-sat",
    title: "Official Digital SAT Prep",
    partnerName: "Khan Academy",
    brand: "khan",
    color: "#14BF96",
    partnerWebsite: "https://khanacademy.org",
    category: "sat",
    offerType: "curated_no_commission",
    status: "active",
    description: "The official, completely free SAT prep platform - adaptive practice tied to College Board. Use this before paying for anything.",
    benefits: ["100% free, official", "Topic-level mastery tracking", "Full practice integration"],
    eligibility: "Everyone",
    countries: "Worldwide",
    educationLevels: ["ssc", "hsc", "gap-applicant"],
    topics: ["sat-math", "sat-reading", "sat-writing"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.khanacademy.org/test-prep/v2-sat-math",
    commission: false,
    sourceUrl: "https://www.khanacademy.org/test-prep",
    sourceName: "Khan Academy",
    lastVerifiedAt: V,
  },
  {
    id: "bluebook",
    title: "Bluebook Official Practice Tests",
    partnerName: "College Board",
    color: "#1E1E50",
    partnerWebsite: "https://satsuite.collegeboard.org",
    category: "mock_test",
    offerType: "curated_no_commission",
    status: "active",
    description: "Free full-length adaptive digital SAT practice tests in the official Bluebook app - the only mock that matches test day exactly.",
    benefits: ["Official full-length adaptive mocks", "Free"],
    eligibility: "Everyone",
    countries: "Worldwide",
    educationLevels: ["ssc", "hsc", "gap-applicant"],
    topics: ["sat-math", "sat-reading"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://satsuite.collegeboard.org/sat/practice-preparation/practice-tests",
    commission: false,
    sourceUrl: "https://satsuite.collegeboard.org",
    sourceName: "College Board",
    lastVerifiedAt: V,
  },
  {
    id: "ielts-official-prep",
    title: "IELTS Official Free Prep",
    partnerName: "IELTS.org",
    color: "#E31837",
    partnerWebsite: "https://ielts.org",
    category: "ielts",
    offerType: "curated_no_commission",
    status: "active",
    description: "Official sample questions and band descriptors for all four skills, straight from the test maker - your baseline before any paid course.",
    benefits: ["Official samples, all 4 skills", "Real band descriptors", "Free"],
    eligibility: "Everyone",
    countries: "Worldwide",
    educationLevels: ["ssc", "hsc", "gap-applicant"],
    topics: ["ielts-listening", "ielts-reading", "ielts-writing", "ielts-speaking"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://ielts.org/take-a-test/preparation-resources",
    commission: false,
    sourceUrl: "https://ielts.org",
    sourceName: "IELTS Partners",
    lastVerifiedAt: V,
  },
  {
    id: "aops",
    title: "Art of Problem Solving",
    partnerName: "AoPS",
    color: "#1B5E20",
    partnerWebsite: "https://artofproblemsolving.com",
    category: "olympiad",
    offerType: "curated_no_commission",
    status: "active",
    description: "The standard Olympiad training ground - free community + contest archives; paid books/classes if you go deep. We earn nothing recommending it.",
    benefits: ["Free contest archives + community", "The canonical Olympiad path"],
    eligibility: "Everyone",
    countries: "Worldwide",
    topics: ["olympiad-math", "math-foundation"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://artofproblemsolving.com",
    commission: false,
    sourceUrl: "https://artofproblemsolving.com",
    sourceName: "AoPS",
    lastVerifiedAt: V,
  },
  {
    id: "essay-guy",
    title: "College Essay Guy Free Guides",
    partnerName: "College Essay Guy",
    color: "#F2A03D",
    partnerWebsite: "https://collegeessayguy.com",
    category: "essay",
    offerType: "curated_no_commission",
    status: "active",
    description: "The most-cited free personal-statement guides and annotated example essays. Start here before paying for review services.",
    benefits: ["Free annotated example essays", "Structure frameworks", "Supplemental essay guides"],
    eligibility: "Everyone",
    countries: "Worldwide",
    educationLevels: ["hsc", "gap-applicant"],
    topics: ["essay", "applications"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://www.collegeessayguy.com/blog/personal-statement-examples",
    commission: false,
    sourceUrl: "https://www.collegeessayguy.com",
    sourceName: "College Essay Guy",
    lastVerifiedAt: V,
  },
  {
    id: "scholarships360",
    title: "Scholarships360 Database",
    partnerName: "Scholarships360",
    color: "#2563EB",
    partnerWebsite: "https://scholarships360.org",
    category: "scholarship",
    offerType: "curated_no_commission",
    status: "active",
    description: "Free, searchable international scholarship database - vetted listings, no signup paywall.",
    benefits: ["Free scholarship search", "International filters"],
    eligibility: "Everyone",
    countries: "Worldwide",
    topics: ["scholarships", "applications"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "https://scholarships360.org/scholarships/international-students/",
    commission: false,
    sourceUrl: "https://scholarships360.org",
    sourceName: "Scholarships360",
    lastVerifiedAt: V,
  },

  /* ─── Coming-soon partnerships (honest, no fake discounts) ─── */
  {
    id: "ielts-mock-partner",
    title: "IELTS Writing Evaluation Partner",
    partnerName: "Polaris Partners",
    color: "#C47451",
    partnerWebsite: "https://ielts.org",
    category: "mock_test",
    offerType: "coming_soon",
    status: "coming_soon",
    description: "Human band-scored IELTS Writing evaluation with examiner feedback, matched to your target band and exam date.",
    benefits: ["Examiner-graded Task 1/2", "Band-gap analysis", "Polaris score sync"],
    eligibility: "TBD with partner",
    countries: "TBD",
    topics: ["ielts-writing"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "",
    commission: true,
    sourceUrl: "",
    sourceName: "",
    lastVerifiedAt: V,
    comingSoonReason: "We're negotiating with evaluation providers. No deal is live, so no discount is shown.",
  },
  {
    id: "mentor-marketplace",
    title: "Verified Mentor Marketplace",
    partnerName: "Polaris Partners",
    color: "#5B8C6D",
    partnerWebsite: "",
    category: "mentorship",
    offerType: "coming_soon",
    status: "coming_soon",
    description: "Verified admits from MIT, Oxbridge, NUS and more - essay reads, mock interviews, and strategy calls.",
    benefits: ["Verified admit mentors", "Essay + interview help"],
    eligibility: "TBD",
    countries: "TBD",
    topics: ["essay", "applications", "leadership"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "",
    commission: true,
    sourceUrl: "",
    sourceName: "",
    lastVerifiedAt: V,
    comingSoonReason: "Mentor verification (admit proof + background checks) is being built before launch.",
  },
  {
    id: "essay-review-partner",
    title: "Professional Essay Review",
    partnerName: "Polaris Partners",
    color: "#D9A441",
    partnerWebsite: "",
    category: "essay",
    offerType: "coming_soon",
    status: "coming_soon",
    description: "Line-by-line personal statement review with track-changes feedback, turnaround matched to your deadlines.",
    benefits: ["Line-edit feedback", "Deadline-matched turnaround"],
    eligibility: "TBD",
    countries: "TBD",
    topics: ["essay", "applications"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "",
    commission: true,
    sourceUrl: "",
    sourceName: "",
    lastVerifiedAt: V,
    comingSoonReason: "Reviewer quality bar isn't met yet - we won't launch with unvetted editors.",
  },
  {
    id: "visa-docs-partner",
    title: "Visa & Document Services",
    partnerName: "Polaris Partners",
    color: "#1F8ACB",
    partnerWebsite: "",
    category: "visa",
    offerType: "coming_soon",
    status: "coming_soon",
    description: "Transcript translation, notarization, and visa document checklists for your destination country.",
    benefits: ["Translation + notarization", "Country-specific checklists"],
    eligibility: "TBD",
    countries: "TBD",
    topics: ["applications"],
    couponCode: null,
    affiliateUrl: null,
    officialOfferUrl: "",
    commission: true,
    sourceUrl: "",
    sourceName: "",
    lastVerifiedAt: V,
    comingSoonReason: "Vetting document providers per-country; launching with Bangladesh + India first.",
  },
];

export const OFFER_TYPE_META: Record<PartnerOfferType, { label: string; tone: "aurora" | "polaris" | "nova" | "ink" | "rose" }> = {
  free_student_benefit:   { label: "Free student benefit", tone: "aurora" },
  curated_no_commission:  { label: "Curated · no commission", tone: "polaris" },
  official_student_offer: { label: "Official student offer", tone: "nova" },
  affiliate:              { label: "Affiliate offer", tone: "rose" },
  referral:               { label: "Referral offer", tone: "rose" },
  coming_soon:            { label: "Coming soon", tone: "ink" },
};

/** Honest link resolution - null means "no working link, don't fake a CTA". */
export function resolveOfferLink(o: PartnerOffer): string | null {
  if (o.status !== "active") return null;
  if (o.affiliateUrl) return o.affiliateUrl;
  if (o.officialOfferUrl) return o.officialOfferUrl;
  return null;
}

