import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/authz";
import { Nav } from "@/components/Nav";
import { AdminTabs } from "@/components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getOptionalSession();
  if (!session) redirect("/signin?redirect_url=/admin");
  if (session.role !== "admin") redirect("/dashboard");

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
            Admin
          </h1>
          <span className="text-[10px] uppercase tracking-wide rounded-full border border-nova-500/40 bg-nova-500/10 px-2 py-0.5 text-nova-500">
            control panel
          </span>
        </div>
        <AdminTabs />
        <div className="mt-6">{children}</div>
      </section>
    </main>
  );
}

