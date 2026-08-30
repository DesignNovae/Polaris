import type { Metadata } from "next";
import { ExamRunner } from "@/components/exams/ExamRunner";

export const metadata: Metadata = { title: "Exam in progress | Polaris" };

export default async function ExamSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ExamRunner sessionId={id} />;
}

