import type { Metadata } from "next";
import { ExamPreflight } from "@/components/exams/ExamPreflight";
export const metadata: Metadata = { title: "Full Adaptive SAT-Style Mock | Polaris" };
export default function Page() { return <ExamPreflight mode="sat-full" />; }
