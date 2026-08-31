/** /community/[channel] - deep link into a specific channel. */
import { redirect } from "next/navigation";

export default async function CommunityChannelDeepLink({
  params,
}: {
  params: Promise<{ channel: string }>;
}) {
  const { channel } = await params;
  redirect(`/community?channel=${encodeURIComponent(channel)}`);
}

