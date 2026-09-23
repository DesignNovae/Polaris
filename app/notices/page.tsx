import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/authz";
export const dynamic = "force-dynamic";
export const metadata = { title: "Notices" };
export default async function NoticesPage() {
  const user = await getOptionalSession();
  if (!user) redirect("/signin?redirect_url=/notices");
  redirect(`${user.role === "parent" || user.role === "partner" ? "/portal" : "/roadmap"}?notices=1`);
}
