import type { Metadata } from "next";
import { ExamPreflight } from "@/components/exams/ExamPreflight";
export const metadata: Metadata = { title: "IELTS Academic Writing Practice | Polaris" };
export default function Page() { return <ExamPreflight mode="ielts-writing" />; }
