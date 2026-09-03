import { z } from "zod";
import { ok, withErrorHandling, parseJson } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import { assessAffordability, supportedCountries } from "@/lib/affordability/model";
import { rankScholarships } from "@/lib/affordability/scholarships";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Affordability assessment plus the awards that would close the gap it finds.
 *
 * Deterministic - no model call - so it is fast, free to run on every keystroke
 * the client debounces, and produces the same answer twice for the same input.
 */
const bodySchema = z.object({
  country: z.string().trim().min(2).max(40),
  tier: z.enum(["elite", "top10", "top50", "top100", "top200", "regional"]),
  annualBudgetBdt: z.number().min(0).max(50_000_000),
  aidRatio: z.number().min(0).max(1).default(0),
  years: z.number().int().min(1).max(6).default(4),
});

export const GET = withErrorHandling(async () => {
  await requireSession();
  return ok({ countries: supportedCountries() });
});

export const POST = withErrorHandling(async (req) => {
  await requireSession();
  const input = bodySchema.parse(await parseJson(req));

  const assessment = assessAffordability(input);
  const scholarships = assessment.supported
    ? await rankScholarships(input.country, assessment.gapAnnualBdt)
    : [];

  return ok({ assessment, scholarships });
});
