/**
 * App-shell layout. Wraps every authenticated workspace route with:
 *   LeftNav + TopBar + main content area
 *
 * Simplified skeleton: no AgentChat rail, no profile/roadmap fetching.
 * Uses hardcoded demo data for the LeftNav props.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LeftNav } from "@/components/app/LeftNav";
import { TopBar } from "@/components/app/TopBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=%2Froadmap");

  const userName = session.user.name ?? "Student";
  const initials = userName
    .split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
  const plan = session.user.plan ?? "free";

  return (
    <div className="polaris-workspace-shell h-[100dvh] min-h-0 flex bg-bg overflow-hidden">
      <LeftNav
        plan={plan}
        studentName={userName}
        studentInitials={initials}
        studentGrade="getting started"
      />

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
