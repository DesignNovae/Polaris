/**
 * App-shell layout. Wraps every authenticated workspace route with:
 *   ┌────────────┬───────────────────┬────────────┐
 *   │ LeftNav    │  TopBar           │ AgentChat  │
 *   │            ├───────────────────┤            │
 *   │            │  children         │            │
 *   └────────────┴───────────────────┴────────────┘
 *
 * Runs as a server component so we can fetch the session, plan, profile,
 * and path summaries server-side and feed them into the client islands.
 */

import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProfile, getLatestRoadmap, getUserById } from "@/lib/db/collections";
import { LeftNav } from "@/components/app/LeftNav";
import { TopBar } from "@/components/app/TopBar";
import { AgentChat } from "@/components/app/AgentChat";
import { StrategistLockedRail } from "@/components/app/StrategistLocked";
import type { PathSummary } from "@/types/app";

export const dynamic = "force-dynamic"; // session-bound - never cache the shell

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  // Repo auth route is /signin (NextAuth pages.signIn), not /login.
  if (!session?.user) redirect("/signin?callbackUrl=%2Froadmap");

  const userId = (session.user as { id: string }).id;
  const [user, profile, roadmap] = await Promise.all([
    getUserById(userId),
    getProfile(userId),
    getLatestRoadmap(userId),
  ]);

  if (!user) redirect("/signin");
  // The (app) shell is the student workspace. Parents/partners use /monitor.
  // Students WITHOUT a profile are allowed in: /roadmap's first-time setup is
  // the onboarding now and creates the profile on first generation.
  if (user.role === "parent" || user.role === "partner") redirect("/monitor");

  const initials = user.name
    .split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");

  // For now we surface a single derived "path" per user. This is the
  // extension point where a Paths collection plugs in.
  const paths: PathSummary[] = [
    {
      id: "primary",
      name: roadmap?.roadmap.summary?.slice(0, 60) ?? "Active strategy",
      target: profile?.targetTier ?? "unset",
      degree: profile?.degree ?? "undecided",
      horizon: "Active",
      probability: 0.41, // TODO: pull from ML service (lib/ml/probability.ts)
      color: "polaris",
    },
  ];

  return (
    // h-screen + overflow-hidden locks the whole app shell to the viewport.
    // Each column owns its own scroll context (LeftNav, main, AgentChat) so
    // the strategist rail stays pinned at full height regardless of how far
    // the roadmap / deadlines / universities scroll inside the middle pane.
    <div className="polaris-workspace-shell h-[100dvh] min-h-0 flex bg-bg overflow-hidden" data-agent-open="true">
      <LeftNav
        plan={user.plan}
        studentName={user.name}
        studentInitials={initials}
        studentGrade={profile?.grade ?? "getting started"}
        paths={paths}
        activePathId={paths[0].id}
      />

      <div className="flex-1 min-w-0 flex flex-col h-full">
        <TopBar/>
        <main className="polaris-scrollbar flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</main>
      </div>

      {user.plan === "free" ? (
        // Free plan: the Strategist rail shows the honest locked state - the
        // working chat (and its API) are Pro/Elite.
        <StrategistLockedRail />
      ) : (
        <AgentChat
          studentInitials={initials}
          pathLabel={paths[0].name}
          contextChips={[
            `Plan ${user.plan}`,
            ...(profile ? [`${profile.grade}`, profile.country] : ["new student"]),
          ]}
        />
      )}
    </div>
  );
}
