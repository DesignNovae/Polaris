import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accepted-student case studies",
  description:
    "Composite profiles of admitted students by country and university tier: the grades, tests and activities behind each acceptance, and what actually moved the decision.",
  alternates: { canonical: "/case-studies" },
};

export default function CaseStudiesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
