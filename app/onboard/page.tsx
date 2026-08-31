/**
 * /onboard - retired. The roadmap builder at /roadmap is the onboarding now:
 * its first-time setup collects everything this page used to ask, creates
 * the student profile server-side, and generates the first roadmap in one
 * flow. The route stays only so old links and bookmarks keep working.
 */

import { redirect } from "next/navigation";

export default function OnboardPage() {
  redirect("/roadmap");
}

