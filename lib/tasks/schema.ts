import { z } from "zod";

export const MilestoneStatusSchema = z.enum(["pending", "in-progress", "done"]);

export const TaskPatchSchema = z.object({
  status: MilestoneStatusSchema.optional(),
  deadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  // Optional inline note (audit-trail use).
  note: z.string().max(500).optional(),
}).refine(
  (v) => v.status !== undefined || v.deadline !== undefined || v.note !== undefined,
  { message: "At least one field must be provided" },
);

export type TaskPatch = z.infer<typeof TaskPatchSchema>;

export const TaskIdSchema = z.string().regex(/^[a-z0-9]{6,12}$/, "Invalid task id");

