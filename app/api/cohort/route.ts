import { ok, withErrorHandling, HttpError } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { getProfile } from "@/lib/db/collections";
import { buildCohort } from "@/lib/cohort/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cohort statistics for the caller's own target tier.
 *
 * The cohort is always derived from the caller's stored profile - it is not a
 * parameter. Letting a client pass an arbitrary tier and country would turn
 * this into a query tool for probing the population, which is exactly what the
 * k-anonymity floor exists to prevent.
 */
export const GET = withErrorHandling(async (req) => {
  const user = await requireSession();
  const profile = await getProfile(user.id);
  if (!profile?.targetTier) {
    throw new HttpError(
      400,
      "Set a target university tier in your profile to see where you stand.",
    );
  }

  const matchCountry =
    new URL(req.url).searchParams.get("country") === "1";

  const cohort = await buildCohort(profile, { matchCountry });
  return ok({ cohort });
});
