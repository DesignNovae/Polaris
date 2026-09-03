import type { Metadata } from "next";

/**
 * The list page is a client component (filters, live fit scoring), so its
 * metadata lives here. The detail pages override this with their own
 * `generateMetadata`.
 */
export const metadata: Metadata = {
  title: "University directory: acceptance rates & requirements",
  description:
    "Browse sourced universities with published acceptance rates, GPA and test requirements, top programs, and an acceptance estimate scored from your own academic profile.",
  alternates: { canonical: "/university" },
};

export default function UniversityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
