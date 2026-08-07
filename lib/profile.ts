export type GradeLevel =
  | "middle"
  | "early-hs"
  | "late-hs"
  | "undergrad"
  | "recent-grad";

export type Country =
  | "Bangladesh"
  | "India"
  | "Pakistan"
  | "Nepal"
  | "Other South Asia"
  | "Other";

export type Degree = "undergrad" | "masters" | "phd" | "undecided";

export type ECCategory =
  | "Olympiads"
  | "Research"
  | "Leadership"
  | "Community"
  | "Sports/Arts"
  | "Internships";

export type Tier = "elite" | "top50" | "top200" | "regional";

/* ─── New: curriculum + results ────────────────────────────────────────── */

export type Curriculum =
  | "bangla-medium"
  | "english-version"
  | "english-medium"
  | "madrasa"
  | "other";

export const CURRICULUM_LABELS: Record<Curriculum, string> = {
  "bangla-medium":   "Bangla Medium",
  "english-version": "English Version",
  "english-medium":  "English Medium (O / A Level)",
  madrasa:           "Madrasa",
  other:             "Other",
};

// English Medium uses A* / A grade counts; the rest report GPA on a 0-5 scale.
export function curriculumUsesAStars(c: Curriculum | undefined): boolean {
  return c === "english-medium";
}

export type ScholarshipType =
  | "talent-pool"
  | "general"
  | "board"
  | "other";

export const SCHOLARSHIP_LABELS: Record<ScholarshipType, string> = {
  "talent-pool": "Talent Pool Scholarship",
  general:       "General Scholarship",
  board:         "Board Scholarship",
  other:         "Other",
};

export type Scholarship = {
  id: string;
  type: ScholarshipType;
  title?: string;   // freeform label (required for "other")
  year?: number;
};

export type Achievement = {
  id: string;
  title: string;
  year?: number;
};

export type StudentProfile = {
  grade: GradeLevel;
  country: Country;
  degree: Degree;
  gpa: number; // 0–4.0 (kept for backwards compatibility with the
              // probability engine + existing roadmap pipeline).
  ecs: ECCategory[];
  targetTier: Tier;
  // Optional probability-engine sliders (default from profile)
  testPercentile?: number; // 0–100
  ecCount?: number; // 0–10
  research?: number; // 0–10

  /* ─── Extended academic profile ──────────────────────────────────── */
  curriculum?: Curriculum;
  sscGpa?: number;        // 0–5, used for Bangla/English Version/Madrasa/Other
  sscAStars?: number;     // 0–20, used for English Medium (O Level A* count)
  sscEquivalentGpa?: number; // optional GPA equivalent for English Medium
  hscGpa?: number;        // 0–5
  hscAStars?: number;     // 0–20, used for English Medium (A Level A* count)
  hscEquivalentGpa?: number;
  scholarships?: Scholarship[];
  achievements?: Achievement[];

  /* ─── Undergraduate (only when grade = undergrad / recent-grad) ───── */
  /** Current undergraduate CGPA on a 0–4 scale (US convention) - derived. */
  undergradCgpa?: number;
  /** Raw CGPA on the student's home scale (0–4, 0–5, or 0–10). */
  undergradCgpaRaw?: number;
  /** Scale of `undergradCgpaRaw`. Defaults to 4 when omitted. */
  undergradCgpaScale?: 4 | 5 | 10;
  /** University / institute name. */
  undergradInstitution?: string;
  /** Major / department / program. */
  undergradMajor?: string;
  /** Standardized test scores: e.g. { SAT: 1500, GRE: 325, IELTS: 7.5 }. */
  testScores?: Record<string, number>;
};

export const PROFILE_KEY = "polaris.profile";
export const ROADMAP_KEY = "polaris.roadmap";

/* ─── Profile completeness + engine-input derivation ─────────────────── */

export type MissingField =
  | "name"
  | "phone"
  | "curriculum"
  | "sscResult"
  | "hscResult"
  | "ugCgpa"
  | "targetTier"
  | "targetDegree";

export const MISSING_FIELD_LABELS: Record<MissingField, string> = {
  name:         "Full name",
  phone:        "Phone number",
  curriculum:   "Curriculum",
  sscResult:    "SSC / O-Level result",
  hscResult:    "HSC / A-Level result",
  ugCgpa:       "Undergraduate CGPA",
  targetTier:   "Target university tier",
  targetDegree: "Target degree",
};

/** Whether the student has a meaningful SSC/HSC result for their curriculum. */
function hasResult(
  curriculum: Curriculum | undefined,
  gpa: number | undefined,
  aStars: number | undefined,
): boolean {
  if (!curriculum) return false;
  if (curriculumUsesAStars(curriculum)) return aStars !== undefined && aStars >= 0;
  return gpa !== undefined && gpa > 0;
}

/**
 * Returns the list of required fields that are missing. HSC is only required
 * when the student is in late-hs / undergrad / recent-grad (someone in middle
 * school shouldn't have an HSC result yet).
 *
 * Pass `account` so the User-level fields (name, phone) can be checked too.
 */
export function getMissingFields(
  profile: StudentProfile | null,
  account: { name?: string; phone?: string } = {},
): MissingField[] {
  const missing: MissingField[] = [];
  if (!account.name || account.name.trim().length === 0) missing.push("name");
  if (!account.phone || account.phone.trim().length === 0) missing.push("phone");

  if (!profile) {
    missing.push("curriculum", "sscResult", "hscResult", "targetTier", "targetDegree");
    return missing;
  }

  if (!profile.curriculum) missing.push("curriculum");
  if (!hasResult(profile.curriculum, profile.sscGpa, profile.sscAStars)) missing.push("sscResult");

  const needsHsc =
    profile.grade === "late-hs" ||
    profile.grade === "undergrad" ||
    profile.grade === "recent-grad";
  if (needsHsc && !hasResult(profile.curriculum, profile.hscGpa, profile.hscAStars)) {
    missing.push("hscResult");
  }

  // Undergrad / recent-grad students also need their current UG CGPA.
  const needsUgCgpa = profile.grade === "undergrad" || profile.grade === "recent-grad";
  if (needsUgCgpa) {
    const hasUg = profile.undergradCgpaRaw !== undefined && profile.undergradCgpaRaw > 0;
    if (!hasUg) missing.push("ugCgpa");
  }

  if (!profile.targetTier) missing.push("targetTier");
  if (!profile.degree) missing.push("targetDegree");

  return missing;
}

export function isProfileComplete(
  profile: StudentProfile | null,
  account: { name?: string; phone?: string } = {},
): boolean {
  return getMissingFields(profile, account).length === 0;
}

/**
 * Derive the 0-4 engine GPA from the student's real SSC/HSC results. The
 * probability engine + roadmap pipeline still expect a 0-4 scale, so we
 * compute it from the highest-grade result the student has on file.
 *
 * Returns a sensible default (3.7) when nothing is available, so the engine
 * still produces a defensible estimate while the profile is incomplete.
 */
export function deriveEngineGpa(profile: StudentProfile | null): number {
  if (!profile) return 3.7;

  // Undergraduate students: their CURRENT CGPA is the relevant signal.
  if (
    (profile.grade === "undergrad" || profile.grade === "recent-grad") &&
    profile.undergradCgpaRaw !== undefined
  ) {
    const scale = profile.undergradCgpaScale ?? 4;
    return clamp((profile.undergradCgpaRaw / scale) * 4, 0, 4);
  }

  const usesAStars = curriculumUsesAStars(profile.curriculum);
  if (usesAStars) {
    // Prefer the more recent equivalent GPA if given, then estimate from A* count.
    const eq = profile.hscEquivalentGpa ?? profile.sscEquivalentGpa;
    if (eq !== undefined) return clamp(eq / 5 * 4, 0, 4);
    const aStars = profile.hscAStars ?? profile.sscAStars ?? 0;
    // 0 A* ≈ 3.0; 5 A* ≈ 3.65; 10+ A* ≈ 4.0
    return clamp(3.0 + Math.min(aStars, 10) / 10, 0, 4);
  }
  const gpa5 = profile.hscGpa ?? profile.sscGpa;
  if (gpa5 === undefined) return 3.7;
  return clamp(gpa5 / 5 * 4, 0, 4);
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function summarizeProfile(p: StudentProfile): string {
  const gradeMap: Record<GradeLevel, string> = {
    middle: "middle school",
    "early-hs": "early high school",
    "late-hs": "late high school (11–12)",
    undergrad: "undergraduate",
    "recent-grad": "recent graduate",
  };
  const degreeMap: Record<Degree, string> = {
    undergrad: "undergraduate (bachelor's)",
    masters: "master's",
    phd: "PhD",
    undecided: "still deciding",
  };
  const tierMap: Record<Tier, string> = {
    elite: "top global (Ivy / Oxbridge / MIT-tier)",
    top50: "top 50 global",
    top200: "strong international (top 200)",
    regional: "regional strong programs",
  };
  return [
    `Student is in ${gradeMap[p.grade]} in ${p.country}.`,
    `Targeting ${degreeMap[p.degree]} at ${tierMap[p.targetTier]} institutions.`,
    `Current academic standing: GPA ${p.gpa.toFixed(2)} / 4.0.`,
    `Current extracurricular categories: ${
      p.ecs.length ? p.ecs.join(", ") : "none reported yet"
    }.`,
  ].join(" ");
}
