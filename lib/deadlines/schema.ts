import { z } from "zod";

export const DeadlineKindSchema = z.enum(["hard", "soft", "repeat"]);

/** What kind of obligation this is - drives icons, colors, and checklists. */
export const DeadlineTypeSchema = z.enum([
  "application",
  "scholarship",
  "test-registration",
  "test-exam",
  "school-exam",
  "essay",
  "recommendation",
  "document",
  "interview",
  "visa",
  "olympiad",
  "project",
  "custom",
]);

export const ChecklistItemSchema = z.object({
  id: z.string().min(1).max(20),
  text: z.string().min(1).max(200),
  done: z.boolean(),
});

export const DeadlineCreateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  title: z.string().min(1).max(120),
  kind: DeadlineKindSchema.default("soft"),
  milestoneId: z.string().regex(/^[a-z0-9]{6,12}$/).optional(),
  // ── extended model ──
  type: DeadlineTypeSchema.default("custom"),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  universityId: z.string().max(40).optional(),
  universityName: z.string().max(120).optional(),
  officialLink: z.string().url().max(500).optional(),
  notes: z.string().max(2000).optional(),
  checklist: z.array(ChecklistItemSchema).max(20).optional(),
  /** Days-before reminders, e.g. [7, 3, 1]. UI state now; notification infra later. */
  reminderDays: z.array(z.number().int().min(0).max(90)).max(5).optional(),
});

export const DeadlinePatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  title: z.string().min(1).max(120).optional(),
  kind: DeadlineKindSchema.optional(),
  type: DeadlineTypeSchema.optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  status: z.enum(["pending", "done"]).optional(),
  notes: z.string().max(2000).optional(),
  checklist: z.array(ChecklistItemSchema).max(20).optional(),
  reminderDays: z.array(z.number().int().min(0).max(90)).max(5).optional(),
  officialLink: z.string().url().max(500).optional(),
}).refine(
  (v) => Object.keys(v).length > 0,
  { message: "At least one field must be provided" },
);

export type DeadlineType = z.infer<typeof DeadlineTypeSchema>;
export type ChecklistItem = z.infer<typeof ChecklistItemSchema>;
export type DeadlineCreate = z.infer<typeof DeadlineCreateSchema>;
export type DeadlinePatch = z.infer<typeof DeadlinePatchSchema>;

