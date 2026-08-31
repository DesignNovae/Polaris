import type { Metadata } from "next";
import { ExamPreflight } from "@/components/exams/ExamPreflight";

export const metadata: Metadata = {
  title: "SAT Math Module Practice | Polaris",
  description: "A timed, unofficial SAT-style Math practice module with autosave and domain analytics.",
};

export default function SatMathPreflightPage() {
  return <ExamPreflight />;
}
