import { requireSession } from "@/lib/authz";
import { CohortClient } from "@/components/app/CohortClient";

export const metadata = { title: "Benchmarks" };
export const dynamic = "force-dynamic";

export default async function CohortPage() {
  await requireSession();
  return <CohortClient />;
}
