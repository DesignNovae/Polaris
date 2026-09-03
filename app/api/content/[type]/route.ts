import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { getContent, isContentType } from "@/lib/content";
import { getOptionalSession } from "@/lib/authz";
import { planMeets } from "@/lib/features";

export const dynamic = "force-dynamic";

/**
 * Public content reads.
 *
 * `universities` and `scholarships` are deliberately open: they are the
 * indexable, shareable surface the product acquires students through.
 *
 * `case-studies` is not. FEATURE_ACCESS.caseStudyDetail declares minPlan "pro",
 * but this handler had no session or plan check, so the full accepted-student
 * write-ups were readable signed out - the gate existed only in the map that
 * nothing consulted. The list stays visible (it is the reason to upgrade); the
 * detail fields are stripped for anyone below Pro and the item is marked
 * `locked` so the client can render the upgrade prompt instead of an empty card.
 */

/** Fields that constitute the paid "detail" of a case study. */
const CASE_STUDY_DETAIL_FIELDS = ["whatWorked", "timeline", "essays", "interview"] as const;

function redactCaseStudy(item: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...item, locked: true };
  for (const field of CASE_STUDY_DETAIL_FIELDS) delete out[field];

  // Keep enough of the profile to make the teaser meaningful without giving
  // away the paid comparison detail.
  const profile = item.profile as Record<string, unknown> | undefined;
  if (profile && typeof profile === "object") {
    out.profile = {
      country: profile.country,
      tier: profile.tier,
      school: profile.school,
    };
  }
  return out;
}

export const GET = withErrorHandling(async (_req, ctx) => {
  const { type } = await (ctx as { params: Promise<{ type: string }> }).params;
  if (!isContentType(type)) throw new HttpError(404, "Unknown content type");

  const items = await getContent(type);

  if (type !== "case-studies") return ok({ items });

  const user = await getOptionalSession();
  const unlocked = planMeets(user?.plan ?? "free", "pro");
  if (unlocked) return ok({ items, locked: false });

  return ok({
    items: items.map((item) => redactCaseStudy(item as Record<string, unknown>)),
    locked: true,
    upgradeMessage:
      "Upgrade to Pro to read full accepted-student case studies.",
  });
});
