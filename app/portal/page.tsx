import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/authz";
import { ViewerPortal } from "@/components/app/ViewerPortal";

export const metadata: Metadata = {
  title: "Shared with you",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

/**
 * Where a linked parent, partner or teacher lands.
 *
 * Separate from the student workspace on purpose: a teacher signing in should
 * never see a roadmap builder, and routing them through /monitor's invite flow
 * every time would be worse than giving them their own front door.
 */
export default async function PortalPage() {
  const session = await getOptionalSession();
  if (!session) redirect("/signin?redirect_url=%2Fportal");
  return (
    <div className="min-h-screen bg-paper text-ink">
      <ViewerPortal />
    </div>
  );
}
