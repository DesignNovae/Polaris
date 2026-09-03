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
import { resolveSessionOutcome } from "@/lib/authz";
import { WorkspaceUnavailable } from "@/components/app/WorkspaceUnavailable";
import { getProfile, getLatestRoadmap, getUserById } from "@/lib/db/collections";
import { LeftNav } from "@/components/app/LeftNav";
import { TopBar } from "@/components/app/TopBar";
import { AgentChat } from "@/components/app/AgentChat";
import { StrategistLockedRail } from "@/components/app/StrategistLocked";
import type { PathSummary } from "@/types/app";
import { scoreProbabilityForTier } from "@/lib/ml/probability";

export const dynamic = "force-dynamic"; // session-bound - never cache the shell

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Middleware already gated this path; this resolves the application user
  // (plan, role) behind the Clerk session.
  const outcome = await resolveSessionOutcome();
  if (outcome.state === "signed-out") redirect("/signin?redirect_url=%2Froadmap");
  // Signed in but unprovisioned: show the problem. Redirecting to /signin here
  // would bounce forever, because /signin sees the Clerk session and sends
  // them straight back.
  if (outcome.state === "unprovisioned") {
    return <WorkspaceUnavailable reason={outcome.reason} />;
  }

  const session = outcome.user;
  const userId = session.id;
  const [user, profile, roadmap] = await Promise.all([
    getUserById(userId),
    getProfile(userId),
    getLatestRoadmap(userId),
  ]);

  if (!user) redirect("/signin");
  // The (app) shell is the student workspace. Accounts created explicitly as a
  // parent or partner get the scoped viewer portal instead.
  // Students WITHOUT a profile are allowed in: /roadmap's first-time setup is
  // the onboarding now and creates the profile on first generation.
  if (user.role === "parent" || user.role === "partner") redirect("/portal");

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
      // Scored from the student's own profile against their target tier.
      // Null when there is no profile yet - the switcher renders "-" rather
      // than inventing a figure.
      probability: scoreProbabilityForTier(profile),
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
