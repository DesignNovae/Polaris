/**
 * /connections - the Integration Hub. Plan-gated to Pro+.
 *
 * Server assembles the honest hub state (registry × per-user rows ×
 * env-credential availability) and hands off to the client: status
 * dashboard, Integration Orbit, 3D cards, connect/manage/coming-soon
 * modals. Codeforces + GitHub imports are fully functional today;
 * Google/Facebook OAuth activates when server credentials exist.
 */

import { requireSession } from "@/lib/authz";
import { planMeets } from "@/lib/features";
import { hubState } from "@/lib/integrations/service";
import { ConnectionsClient, type HubEntryDto } from "@/components/app/ConnectionsClient";
import { UpgradeCard } from "@/components/PlanGate";

export const metadata = { title: "Connections" };
export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  const user = await requireSession();
  if (!planMeets(user.plan, "pro")) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
        <UpgradeCard
          title="Connect your learning tools with Pro"
          description="Import GitHub and Codeforces progress, connect supported calendars, and let those signals inform your roadmap."
        />
      </div>
    );
  }
  const entries = (await hubState(user.id)) as HubEntryDto[];
  return <ConnectionsClient initial={entries} />;
}
