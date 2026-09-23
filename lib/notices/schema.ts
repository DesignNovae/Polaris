import { z } from "zod";

export const NOTICE_ROLES = ["student", "parent", "partner", "admin"] as const;
export const NOTICE_PLANS = ["free", "pro", "elite"] as const;
export const audienceSchema = z
  .object({
    roles: z.array(z.enum(NOTICE_ROLES)).min(1).max(4),
    plans: z.array(z.enum(NOTICE_PLANS)).min(1).max(3),
  })
  .strict();
const media = z
  .string()
  .regex(/^\/api\/notices\/media\/[a-f0-9]{24}$/)
  .or(z.literal(""));
export function safeNoticeLink(value: string) {
  if (!value) return true;
  if (/^\/(?!\/)/.test(value) && !/[\\\s\x00-\x1f]/.test(value)) return true;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
}
export const noticeSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    summary: z.string().trim().min(3).max(280),
    body: z.string().trim().min(3).max(12000),
    category: z
      .enum(["Announcement", "Academic", "Event", "Maintenance"])
      .default("Announcement"),
    priority: z.enum(["normal", "important"]).default("normal"),
    imageUrl: media.default(""),
    imageAlt: z.string().trim().max(200).default(""),
    logoUrl: media.default(""),
    linkUrl: z
      .string()
      .trim()
      .max(2000)
      .refine(safeNoticeLink, "Use a local path or an HTTPS link")
      .default(""),
    linkLabel: z.string().trim().max(60).default(""),
    audience: audienceSchema,
    status: z.enum(["draft", "published", "archived"]),
    expiresAt: z.iso.datetime().nullable().default(null),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.imageUrl && !v.imageAlt)
      ctx.addIssue({
        code: "custom",
        path: ["imageAlt"],
        message: "Describe the image for readers using assistive technology",
      });
    if (v.linkUrl && !v.linkLabel)
      ctx.addIssue({
        code: "custom",
        path: ["linkLabel"],
        message: "Add a label for the link",
      });
  });
export type NoticeInput = z.infer<typeof noticeSchema>;
export type Notice = NoticeInput & {
  id: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  read?: boolean;
};
export type NoticeViewer = {
  id: string;
  role: (typeof NOTICE_ROLES)[number];
  plan: (typeof NOTICE_PLANS)[number];
};

export function canReadNotice(
  notice: Pick<Notice, "status" | "audience" | "expiresAt">,
  user: NoticeViewer,
  now = Date.now(),
) {
  return (
    notice.status === "published" &&
    (!notice.expiresAt || Date.parse(notice.expiresAt) > now) &&
    notice.audience.roles.includes(user.role) &&
    notice.audience.plans.includes(user.plan)
  );
}

export function emptyNotice(): NoticeInput {
  return {
    title: "",
    summary: "",
    body: "",
    category: "Announcement",
    priority: "normal",
    imageUrl: "",
    imageAlt: "",
    logoUrl: "",
    linkUrl: "",
    linkLabel: "",
    audience: { roles: [...NOTICE_ROLES], plans: [...NOTICE_PLANS] },
    status: "draft",
    expiresAt: null,
  };
}
