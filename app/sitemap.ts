import type { MetadataRoute } from "next";
import { getContent } from "@/lib/content";
import { appOrigin } from "@/lib/env";

/**
 * The product's crawlable surface.
 *
 * Only pages that render real content without a session belong here: the
 * marketing page, the demo, and the university and scholarship corpus. The
 * workspace is gated and must never be listed.
 */
export const revalidate = 86_400;

type Item = { id?: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = appOrigin();
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/demo`, lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: `${origin}/university`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${origin}/case-studies`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];

  try {
    const unis = (await getContent("universities")) as unknown as Item[];
    return [
      ...staticRoutes,
      ...unis
        .filter((u): u is { id: string } => typeof u.id === "string")
        .map((u) => ({
          url: `${origin}/university/${u.id}`,
          lastModified: now,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        })),
    ];
  } catch {
    // The database being unavailable must not break the sitemap entirely.
    return staticRoutes;
  }
}
