import type { MetadataRoute } from "next";
import { appOrigin } from "@/lib/env";

/**
 * Everything behind the auth gate is disallowed - not as a security control
 * (middleware is that), but so crawl budget goes to the pages that can
 * actually rank, and signed-out redirect chains stay out of the index.
 */
export default function robots(): MetadataRoute.Robots {
  const origin = appOrigin();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/account",
          "/billing",
          "/settings",
          "/transactions",
          "/roadmap",
          "/strategist",
          "/deadlines",
          "/universities",
          "/resources",
          "/connections",
          "/action-lab",
          "/passport",
          "/cohort",
          "/affordability",
          // Public passports are unlisted by design - shared by the student,
          // not published to the web.
          "/p/",
          "/exams",
          "/partners",
          "/consultants",
          "/community",
          "/bookings",
          "/family",
          "/monitor",
          "/portal",
          "/dashboard",
          "/onboard",
          "/signin",
          "/signup",
          "/signout",
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
