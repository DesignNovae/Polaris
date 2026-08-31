/**
 * /community - verified student community. Channel registry is config; the
 * client polls messages per channel. Open to every signed-in user (any
 * plan); safety rules are enforced by the messages API.
 */

import { requireSession } from "@/lib/authz";
import { CommunityClient } from "@/components/app/CommunityClient";

export const metadata = { title: "Community" };
export const dynamic = "force-dynamic";

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  const user = await requireSession();
  const { channel } = await searchParams;
  return (
    <CommunityClient
      initialChannel={channel ?? "general"}
      me={{ id: user.id, name: user.name ?? "Student", role: user.role }}
    />
  );
}
