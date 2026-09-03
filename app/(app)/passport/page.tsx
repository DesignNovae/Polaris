import { requireSession } from "@/lib/authz";
import { ensurePassport } from "@/lib/passport/service";
import { appOrigin } from "@/lib/env";
import { PassportClient } from "@/components/app/PassportClient";

export const metadata = { title: "Passport" };
export const dynamic = "force-dynamic";

/**
 * Provisions the passport on first visit so the builder always has a slug to
 * show, rather than the student having to "create" one before they can start.
 */
export default async function PassportPage() {
  const user = await requireSession();
  await ensurePassport(user.id, user.name ?? "Student");
  return <PassportClient origin={appOrigin()} />;
}
