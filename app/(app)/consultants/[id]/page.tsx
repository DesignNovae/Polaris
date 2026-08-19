/** /consultants/[id] - deep link that opens the profile on the marketplace. */
import { redirect } from "next/navigation";

export default async function ConsultantDeepLink({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/consultants?open=${encodeURIComponent(id)}`);
}


