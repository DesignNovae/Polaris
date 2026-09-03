import Link from "next/link";
import { redirect } from "next/navigation";
import { getOptionalSession } from "@/lib/authz";
import { Icon } from "@/components/app/ui";

export const dynamic = "force-dynamic";

export default async function ExamLayout({ children }: { children: React.ReactNode }) {
  const session = await getOptionalSession();
  // Middleware guards /exams and attaches the real callbackUrl; this is the
  // defence-in-depth check and cannot see the requested path.
  if (!session) redirect("/signin");

  return (
    <div className="flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-bg text-ink">
      <header className="z-40 shrink-0 border-b border-ink-faint/20 bg-paper-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-5 md:px-8">
          <div className="flex items-center gap-4">
            <Link href="/action-lab#exam" className="inline-flex items-center gap-2.5" aria-label="Polaris Exam Lab">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink shadow-card"><Icon.star size={17} /></span>
              <span className="font-serif text-[20px] font-bold tracking-tight text-ink">Polaris</span>
            </Link>
            <span className="hidden h-8 w-px bg-ink-faint/20 sm:block" />
            <div>
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-muted"><span>Action Lab</span><span className="text-polaris-500">/</span><span>Exam Lab</span></div>
              <div className="mt-0.5 text-[12px] font-semibold text-ink">Focused exam workspace</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full border border-aurora-500/25 bg-aurora-500/[0.07] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-aurora-700 md:inline-flex"><span className="h-1.5 w-1.5 rounded-full bg-aurora-500" /> Focus mode</span>
            <Link href="/action-lab#exam" className="rounded-lg border border-ink-faint/25 px-3 py-2 text-[11px] font-semibold text-ink-dim transition hover:bg-paper-deep hover:text-ink">Exit exam</Link>
          </div>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-polaris-500/[0.06] to-transparent" />
        <div className="relative h-full min-h-0">{children}</div>
      </div>
    </div>
  );
}
