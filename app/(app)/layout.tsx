/**
 * App-shell layout. Wraps every authenticated workspace route with the
 * persistent PolarisBot Strategist surface.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProfile, getUserById } from "@/lib/db/collections";
import { LeftNav } from "@/components/app/LeftNav";
import { TopBar } from "@/components/app/TopBar";
import { AgentChat } from "@/components/app/AgentChat";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/signin?callbackUrl=%2Froadmap");

  const userId = (session.user as { id?: string }).id;
  const [account, profile] = userId
    ? await Promise.all([getUserById(userId), getProfile(userId)])
    : [null, null];
  const userName = account?.name ?? session.user.name ?? "Student";
  const initials = userName
    .split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
  const plan = account?.plan ?? session.user.plan ?? "free";

  return (
    <div className="polaris-workspace-shell h-[100dvh] min-h-0 flex bg-bg overflow-hidden" data-agent-open="true">
      <LeftNav
        plan={plan}
        studentName={userName}
        studentInitials={initials}
        studentGrade={profile?.grade ?? "getting started"}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <TopBar />
        <main className="flex-1 min-h-0 overflow-y-auto">{children}</main>
      </div>

      <AgentChat
        studentInitials={initials || "P"}
        pathLabel="Active strategy"
        contextChips={[`Plan ${plan}`, ...(profile ? [profile.grade, profile.country] : ["new student"])]}
      />
    </div>
  );
}
