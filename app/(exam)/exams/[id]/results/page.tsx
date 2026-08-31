import type { Metadata } from "next";
import { ExamResults } from "@/components/exams/ExamResults";

export const metadata: Metadata = { title: "Practice results | Polaris" };

export default async function ExamResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamResults sessionId={id} />;
}
