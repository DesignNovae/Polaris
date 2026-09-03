import { z } from "zod";

/** Mirrors StudentProfile in lib/profile.ts */
export const studentProfileSchema = z.object({
  grade: z.enum(["middle", "early-hs", "late-hs", "undergrad", "recent-grad"]),
  country: z.enum([
    "Bangladesh",
    "India",
    "Pakistan",
    "Nepal",
    "Other South Asia",
    "Other",
  ]),
  degree: z.enum(["undergrad", "masters", "phd", "undecided"]),
  gpa: z.number().min(0).max(4),
  ecs: z.array(
    z.enum([
      "Olympiads",
      "Research",
      "Leadership",
      "Community",
      "Sports/Arts",
      "Internships",
    ]),
  ),
  targetTier: z.enum(["elite", "top50", "top200", "regional"]),
  testPercentile: z.number().min(0).max(100).optional(),
  ecCount: z.number().min(0).max(10).optional(),
  research: z.number().min(0).max(10).optional(),
  /* ─── Extended academic profile (optional, additive) ─── */
  curriculum: z.enum(["bangla-medium", "english-version", "english-medium", "madrasa", "other"]).optional(),
  sscGpa: z.number().min(0).max(5).optional(),
  sscAStars: z.number().int().min(0).max(20).optional(),
  sscEquivalentGpa: z.number().min(0).max(5).optional(),
  hscGpa: z.number().min(0).max(5).optional(),
  hscAStars: z.number().int().min(0).max(20).optional(),
  hscEquivalentGpa: z.number().min(0).max(5).optional(),
  scholarships: z.array(z.object({
    id: z.string().min(1).max(64),
    type: z.enum(["talent-pool", "general", "board", "other"]),
    title: z.string().max(200).optional(),
    year: z.number().int().min(1990).max(2100).optional(),
  })).max(20).optional(),
  achievements: z.array(z.object({
    id: z.string().min(1).max(64),
    title: z.string().min(1).max(200),
    year: z.number().int().min(1990).max(2100).optional(),
  })).max(40).optional(),
  /* ─── Undergraduate ─── */
  undergradCgpa: z.number().min(0).max(4).optional(),
  undergradCgpaRaw: z.number().min(0).max(10).optional(),
  undergradCgpaScale: z.union([z.literal(4), z.literal(5), z.literal(10)]).optional(),
  undergradInstitution: z.string().max(200).optional(),
  undergradMajor: z.string().max(120).optional(),
  testScores: z.record(z.string().min(1).max(20), z.number().min(0).max(1600)).optional(),
});
export const roadmapBodySchema = z.object({
  profile: studentProfileSchema,
});

export const milestonePatchSchema = z.object({
  milestoneId: z.string().min(1),
  status: z.enum(["pending", "in-progress", "done"]).optional(),
  deadline: z.string().optional(),
});

export const checkoutSchema = z.object({
  tier: z.enum(["pro", "elite"]),
  cycle: z.enum(["monthly", "yearly"]).default("monthly"),
});

export const linkInviteSchema = z.object({
  viewerEmail: z.string().email(),
  relationship: z.enum(["parent", "partner"]),
});

export const linkAcceptSchema = z.object({
  token: z.string().min(1),
});

export const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["parent", "partner"]),
});

export const benchmarkBodySchema = z.object({
  profile: studentProfileSchema,
});

// Passwords are Clerk's now - there is no credential here to change.
export const accountUpdateSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  phone: z.string().max(30).optional(),
  avatarUrl: z.string().url("Avatar must be a valid URL").max(500).optional().or(z.literal("")),
});

export const adminUserUpdateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["student", "parent", "partner", "admin"]).optional(),
  plan: z.enum(["free", "pro", "elite"]).optional(),
});
