import type { Metadata } from "next";
import { ExamPreflight } from "@/components/exams/ExamPreflight";
export const metadata: Metadata = { title: "IELTS Speaking Practice | Polaris" };
export default function Page() { return <ExamPreflight mode="ielts-speaking" />; }
