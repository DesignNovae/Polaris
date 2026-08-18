/**
 * /connections - Integration Hub Server Page.
 * 
 * VIVA NOTE: Loads user session, checks plan (Free, Pro, Elite), fetches current
 * hub state from database via hubState(user.id), and renders ConnectionsClient.
 */

import { requireSession } from "@/lib/authz";
import { hubState } from "@/lib/integrations/service";
import { ConnectionsClient, type HubEntryDto } from "@/components/app/ConnectionsClient";

export const dynamic = "force-dynamic";

export default async function ConnectionsPage() {
  // VIVA NOTE: Requires user to be signed in
  const user = await requireSession();
  
  // VIVA NOTE: Assembles catalog merged with user's connection status
  const entries = (await hubState(user.id)) as HubEntryDto[];
  
  return <ConnectionsClient initial={entries} userPlan={user.plan} />;
}
