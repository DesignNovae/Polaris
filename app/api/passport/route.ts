import { z } from "zod";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  ensurePassport, updatePassport, upsertClaim, deleteClaim,
} from "@/lib/passport/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const claimSchema = z.object({
  id: z.string().length(16).optional(),
  claim: z.string().trim().min(3).max(220),
  proofType: z.string().trim().min(2).max(60),
  // Only http(s). A javascript: or data: URL here would be rendered as a link
  // on a public page that other people open.
  proofUrl: z.string().trim().url().startsWith("http").max(500).optional().or(z.literal("")),
  verifiedSignal: z.string().trim().max(300).optional(),
  gap: z.string().trim().max(300).optional(),
});

const settingsSchema = z.object({
  headline: z.string().trim().max(120).optional(),
  summary: z.string().trim().max(600).optional(),
  displayName: z.string().trim().min(1).max(80).optional(),
  published: z.boolean().optional(),
  showUnevidenced: z.boolean().optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("settings"), settings: settingsSchema }),
  z.object({ action: z.literal("claim"), claim: claimSchema }),
  z.object({ action: z.literal("delete-claim"), id: z.string().length(16) }),
]);

export const GET = withErrorHandling(async () => {
  const user = await requireSession();
  const passport = await ensurePassport(user.id, user.name ?? "Student");
  return ok({ passport });
});

export const POST = withErrorHandling(async (req) => {
  const user = await requireSession();
  await ensurePassport(user.id, user.name ?? "Student");
  const body = bodySchema.parse(await parseJson(req));

  switch (body.action) {
    case "settings":
      await updatePassport(user.id, body.settings);
      break;
    case "claim":
      await upsertClaim(user.id, {
        ...body.claim,
        proofUrl: body.claim.proofUrl || undefined,
      });
      break;
    case "delete-claim":
      await deleteClaim(user.id, body.id);
      break;
    default:
      throw new HttpError(400, "Unknown action");
  }

  const passport = await ensurePassport(user.id, user.name ?? "Student");
  return ok({ passport });
});
