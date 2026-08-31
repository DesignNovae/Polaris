/**
 * Knowledge Hub data layer.
 *
 * Enriches the existing seed datasets (data/scholarships.json,
 * data/case-studies.json, data/university-admissions.json) with the
 * source-transparency fields the hub renders:
 *   - real official application URLs per scholarship
 *   - scholarship type + typical deadline window (month-level, labelled
 *     "typical - verify", because exact dates shift every cycle)
 *   - officially-sourced living-cost figures per country (visa maintenance
 *     requirements / blocked accounts - real published numbers)
 *
 * Nothing here is invented: where a value isn't published, the UI shows
 * "Not available from verified source".
 */

export const HUB_META = {
  lastUpdated: "2026-06-11",
  verifyNote: "Figures follow the most recent published cycle. Always confirm on the official page before relying on them.",
};

/* ─── scholarship enrichment (keyed by data/scholarships.json id) ─── */

export type ScholarshipType =
  | "merit" | "need" | "full-ride" | "government" | "university" | "external";

export type ScholarshipMeta = {
  officialUrl: string;
  type: ScholarshipType;
  /** Typical opening/deadline window, month-level only. */
  typicalWindow: string;
  /** Month (1-12) the typical deadline lands in - for "Add deadline". */
  windowMonth: number;
  difficulty: "extreme" | "high" | "moderate";
};

export const SCHOLARSHIP_META: Record<string, ScholarshipMeta> = {
  "rhodes":          { officialUrl: "https://www.rhodeshouse.ox.ac.uk/scholarships/applications/", type: "full-ride", typicalWindow: "Opens Jun · closes Jul–Sep by country", windowMonth: 8, difficulty: "extreme" },
  "chevening":       { officialUrl: "https://www.chevening.org/apply/", type: "government", typicalWindow: "Opens Aug · closes early Nov", windowMonth: 11, difficulty: "high" },
  "commonwealth":    { officialUrl: "https://cscuk.fcdo.gov.uk/scholarships/", type: "government", typicalWindow: "Opens Sep · closes mid Oct–Dec", windowMonth: 10, difficulty: "high" },
  "daad":            { officialUrl: "https://www.daad.de/en/studying-in-germany/scholarships/", type: "government", typicalWindow: "Most programmes close Oct–Nov", windowMonth: 10, difficulty: "high" },
  "fulbright":       { officialUrl: "https://foreign.fulbrightonline.org/", type: "government", typicalWindow: "Country deadlines ~Feb–May", windowMonth: 5, difficulty: "extreme" },
  "knight-hennessy": { officialUrl: "https://knight-hennessy.stanford.edu/admission", type: "full-ride", typicalWindow: "Closes early Oct", windowMonth: 10, difficulty: "extreme" },
  "schwarzman":      { officialUrl: "https://www.schwarzmanscholars.org/admissions/", type: "full-ride", typicalWindow: "Closes mid Sep", windowMonth: 9, difficulty: "extreme" },
  "gates-cambridge": { officialUrl: "https://www.gatescambridge.org/apply/", type: "full-ride", typicalWindow: "Closes Dec–early Jan with course app", windowMonth: 12, difficulty: "extreme" },
  "nus-asean":       { officialUrl: "https://www.nus.edu.sg/oam/scholarships", type: "university", typicalWindow: "With admission app · Nov–Mar", windowMonth: 2, difficulty: "high" },
  "agh-poland":      { officialUrl: "https://nawa.gov.pl/en/students", type: "government", typicalWindow: "Spring window ~Mar–Apr", windowMonth: 4, difficulty: "moderate" },
  "manaaki":         { officialUrl: "https://www.nzscholarships.govt.nz/", type: "government", typicalWindow: "Opens Feb · closes Mar", windowMonth: 3, difficulty: "high" },
  "australia-awards": { officialUrl: "https://www.dfat.gov.au/people-to-people/australia-awards", type: "government", typicalWindow: "Opens Feb · closes Apr–May", windowMonth: 4, difficulty: "high" },
  "erasmus-mundus":  { officialUrl: "https://www.eacea.ec.europa.eu/scholarships/erasmus-mundus-catalogue_en", type: "external", typicalWindow: "Most consortia close Jan–Feb", windowMonth: 1, difficulty: "high" },
  "kgsp":            { officialUrl: "https://www.studyinkorea.go.kr/en/sub/gks/allnew_invite.do", type: "government", typicalWindow: "Undergrad ~Sep–Oct · Grad ~Feb–Mar", windowMonth: 9, difficulty: "high" },
  "swedish-institute": { officialUrl: "https://si.se/en/apply/scholarships/", type: "government", typicalWindow: "Opens Nov · closes Feb", windowMonth: 2, difficulty: "high" },
  "kaist-undergrad": { officialUrl: "https://admission.kaist.ac.kr/intl-undergraduate/", type: "university", typicalWindow: "Early ~Sep · Regular ~Jan", windowMonth: 1, difficulty: "high" },
  "yale-need-based": { officialUrl: "https://finaid.yale.edu/costs-affordability/international-students", type: "need", typicalWindow: "With admission app (REA Nov 1 / RD Jan 2)", windowMonth: 1, difficulty: "extreme" },
  "mit-need-based":  { officialUrl: "https://sfs.mit.edu/undergraduate-students/the-cost-of-attendance/", type: "need", typicalWindow: "With admission app (EA Nov 1 / RA Jan 6)", windowMonth: 1, difficulty: "extreme" },
};

export const SCHOLARSHIP_TYPE_LABEL: Record<ScholarshipType, string> = {
  "merit": "Merit", "need": "Need-based", "full-ride": "Full ride",
  "government": "Government", "university": "University", "external": "External",
};

/* ─── country living costs (officially published figures) ─── */

export type CountryCost = {
  country: string;
  /** Official living-cost benchmark with its real source. */
  living: string;
  livingNote: string;
  sourceName: string;
  sourceUrl: string;
};

export const COUNTRY_COSTS: Record<string, CountryCost> = {
  "USA": {
    country: "USA",
    living: "$15k–$25k/yr",
    livingNote: "Varies by campus; each university publishes an official Cost of Attendance (housing, meals, books, insurance).",
    sourceName: "University CoA pages",
    sourceUrl: "https://studyinthestates.dhs.gov/students/prepare/financial-ability",
  },
  "UK": {
    country: "UK",
    living: "£10,224–£13,347/9mo",
    livingNote: "Official UKVI maintenance requirement: £1,136/mo outside London, £1,483/mo in London (9 months).",
    sourceName: "UKVI student visa requirements",
    sourceUrl: "https://www.gov.uk/student-visa/money",
  },
  "Canada": {
    country: "Canada",
    living: "CAD $20,635/yr + tuition",
    livingNote: "Official IRCC proof-of-funds requirement for a study permit (single applicant, outside Quebec).",
    sourceName: "IRCC study permit requirements",
    sourceUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/study-permit/get-documents/financial-support.html",
  },
  "Germany": {
    country: "Germany",
    living: "€11,904/yr blocked account",
    livingNote: "Official blocked-account (Sperrkonto) requirement for the German student visa.",
    sourceName: "Federal Foreign Office",
    sourceUrl: "https://www.auswaertiges-amt.de/en/visa-service/buergerservice/faq/-/606852",
  },
  "Singapore": {
    country: "Singapore",
    living: "SGD $10k–$15k/yr",
    livingNote: "University-published estimates for housing + meals + transport; hostel pricing is official per campus.",
    sourceName: "NUS/NTU cost pages",
    sourceUrl: "https://www.nus.edu.sg/oam/financial-aid/cost-of-attendance",
  },
  "India": {
    country: "India",
    living: "₹1–2 lakh/yr",
    livingNote: "IIT hostel + mess fees are published per institute and are heavily subsidized.",
    sourceName: "Institute fee pages",
    sourceUrl: "https://www.iitb.ac.in/newacadhome/fees.jsp",
  },
  "Bangladesh": {
    country: "Bangladesh",
    living: "Nominal (home country)",
    livingNote: "Public university residence costs are nominal.",
    sourceName: "University fee pages",
    sourceUrl: "https://www.buet.ac.bd/",
  },
};

/* ─── case-study presentation meta ─── */

export const CASE_STUDY_DISCLOSURE =
  "Anonymized composite case studies - admission patterns drawn from publicly documented admit profiles and official program criteria. Names and identifying details are removed or generalized.";

/** Map a case study's tags to a university id in the KB (for logos). */
export function caseStudyUniId(tags: string[]): string | null {
  const MAP: Record<string, string> = {
    "MIT": "mit", "Stanford": "stanford", "CMU": "cmu", "Cambridge": "cambridge",
    "Oxford": "oxford", "Waterloo": "uwaterloo", "Toronto": "toronto",
    "NUS": "nus", "TUM": "tum", "Imperial": "imperial", "Rhodes": "oxford",
    "Knight-Hennessy": "stanford", "Gates": "cambridge", "Fulbright": "harvard",
  };
  for (const t of tags) if (MAP[t]) return MAP[t];
  return null;
}

