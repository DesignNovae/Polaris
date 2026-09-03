"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { track } from "@/lib/analytics";

/**
 * Fires the acquisition and revenue events that can be observed from routing
 * alone, so the funnel is measurable without instrumenting every component:
 *
 *   /demo              -> demo_opened
 *   /demo/<section>    -> demo_section_viewed
 *   /signup            -> signup_started
 *   /roadmap?welcome=1 -> signup_completed   (Clerk's post-signup landing)
 *   /billing           -> upgrade_viewed
 *   /billing?payment=  -> checkout_completed / checkout_failed
 *
 * Activation events that depend on what actually happened (roadmap_generated,
 * exam_completed) are fired from their own handlers, not here.
 */
export function AnalyticsBoundary() {
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!pathname) return;

    if (pathname === "/demo") track("demo_opened");
    else if (pathname.startsWith("/demo/")) {
      track("demo_section_viewed", { section: pathname.slice("/demo/".length) });
    } else if (pathname.startsWith("/signup")) track("signup_started");
    else if (pathname.startsWith("/billing")) {
      const payment = params.get("payment");
      if (payment === "success") track("checkout_completed");
      else if (payment === "failed" || payment === "cancelled") {
        track("checkout_failed", { reason: payment });
      } else track("upgrade_viewed");
    } else if (pathname.startsWith("/roadmap") && params.get("welcome") === "1") {
      track("signup_completed");
    }
  }, [pathname, params]);

  return null;
}
