import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getContent } from "@/lib/content";
import { appOrigin } from "@/lib/env";
import { UniversityDetailClient, type Uni } from "./UniversityDetailClient";

/**
 * One indexable page per university.
 *
 * This was a client component that fetched after hydration with no
 * `generateMetadata`, so every university page served a crawler an empty shell
 * with the same generic title - on what is the product's largest body of
 * long-tail, sourced content. It is now rendered on the server, statically
 * generated at build time, and revalidated daily so admin content edits land
 * without a redeploy.
 */
export const revalidate = 86_400;

async function getUniversity(id: string): Promise<Uni | null> {
  const items = (await getContent("universities")) as unknown as Uni[];
  return items.find((u) => u.id === id) ?? null;
}

export async function generateStaticParams() {
  try {
    const items = (await getContent("universities")) as unknown as Uni[];
    return items.map((u) => ({ id: u.id }));
  } catch {
    // No database at build time - pages still render on demand.
    return [];
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const uni = await getUniversity(id).catch(() => null);
  if (!uni) return { title: "University not found" };

  const rate = (uni.acceptanceRate * 100).toFixed(1);
  const title = `${uni.name} - acceptance rate, requirements & fit`;
  const description =
    `${uni.name} in ${uni.city}, ${uni.country} admits ${rate}% of applicants. ` +
    `See GPA and test requirements, top programs, and an acceptance estimate for your own profile.`;

  return {
    title,
    description,
    alternates: { canonical: `/university/${uni.id}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `${appOrigin()}/university/${uni.id}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const uni = await getUniversity(id);
  if (!uni) notFound();

  // Structured data so the acceptance rate and location can be understood
  // rather than merely crawled.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollegeOrUniversity",
    name: uni.name,
    description: uni.summary,
    address: {
      "@type": "PostalAddress",
      addressLocality: uni.city,
      addressCountry: uni.country,
    },
    url: `${appOrigin()}/university/${uni.id}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <UniversityDetailClient uni={uni} />
    </>
  );
}
