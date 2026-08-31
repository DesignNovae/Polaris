import { requireSession } from "@/lib/authz";
import { getProfile, getUserById } from "@/lib/db/collections";
import { scoreProbability, profileToInputs } from "@/lib/ml/probability";
import { StrategistClient, type GapRow } from "@/components/app/StrategistClient";
import { getTargetBenchmark } from "@/lib/admissions/benchmarks";

export const metadata = { title: "Strategist" };
export const dynamic = "force-dynamic";

export default async function StrategistPage() {
  const user = await requireSession();

  const [profile, account] = await Promise.all([getProfile(user.id), getUserById(user.id)]);
  const inputs = profileToInputs(profile);
  const target = await getTargetBenchmark(profile?.targetTier ?? "elite");
  const probability = target.medianAcceptanceRate === null
    ? null
    : scoreProbability(inputs, {
        id: "target",
        tier: profile?.targetTier ?? "elite",
        acceptanceRate: target.medianAcceptanceRate,
      }).probability;
  const name = account?.name ?? user.name ?? "Student";
  const initials = name.split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase() ?? "").join("") || "P";
  const contextRows = [
    { k: "GPA", v: inputs.gpa.toFixed(2) },
    { k: "Target", v: `${target.label} · ${target.sampleSize} schools` },
    { k: "Probability", v: probability === null ? "Unavailable" : `${Math.round(probability * 100)}% estimate` },
    { k: "Country", v: profile?.country ?? "-" },
  ];
  const gapRows: GapRow[] = [
    {
      signal: "GPA / academic ceiling",
      you: inputs.gpa.toFixed(2),
      reference: target.gpaReference,
      move: target.gpaBenchmark !== null && inputs.gpa < target.gpaBenchmark
        ? "Lift your academic ceiling"
        : "Maintain the ceiling",
    },
    {
      signal: "Standardized testing",
      you: `${inputs.testPercentile}%ile`,
      reference: target.testingReference,
      move: target.testingBenchmarkPercentile !== null && inputs.testPercentile < target.testingBenchmarkPercentile
        ? "Build a stronger verified test signal"
        : "Hold your testing level",
    },
    {
      signal: "Strong extracurriculars",
      you: String(inputs.ecCount),
      reference: "Not measured",
      move: inputs.ecCount === 0 ? "Start one sustained activity" : "Deepen 1–2 sustained activities",
    },
    {
      signal: "Original research / shipped work",
      you: String(inputs.research),
      reference: "Not measured",
      move: profile?.ecs?.includes("Research") ? "Keep shipping and document the outcome" : "Land a verifiable research or project outcome",
    },
  ];

  return (
    <StrategistClient
      studentName={name}
      initials={initials}
      grade={profile?.grade ?? ""}
      contextRows={contextRows}
      gapRows={gapRows}
      benchmarkNote={`${target.source}. References are shown only where the dataset has a comparable structured field; the probability is a transparent model estimate, not an admission promise.`}
      eyebrow={`Strategist · grounded · ${target.label} target`}
    />
  );
}
