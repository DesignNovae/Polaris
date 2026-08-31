import { scoreProbability, type ProbabilityInputs, type UniversityForModel } from "@/lib/ml/probability";
import { getUniversities } from "@/lib/content";
import { ok, withErrorHandling, parseJson, HttpError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type UniversityRaw = {
  id: string;
  tier: UniversityForModel["tier"];
  acceptanceRate: number;
};

export const POST = withErrorHandling(async (req) => {
  const body = (await parseJson(req)) as {
    universityId?: string;
    inputs?: ProbabilityInputs;
  };

  const { universityId, inputs } = body;
  if (!universityId || !inputs) {
    throw new HttpError(400, "Missing universityId or inputs");
  }

  const universities = (await getUniversities()) as unknown as UniversityRaw[];
  const uni = universities.find((u) => u.id === universityId);
  if (!uni) {
    throw new HttpError(404, "Unknown university");
  }

  const result = scoreProbability(inputs, {
    id: uni.id,
    tier: uni.tier,
    acceptanceRate: uni.acceptanceRate,
  });

  return ok(result);
});

