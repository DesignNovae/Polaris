import Link from "next/link";
import { CompassLogo } from "@/components/Nav";

export const metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

/**
 * Served by the service worker when a navigation fails and nothing for that
 * route is cached. Names what still works rather than apologising.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
      <div className="max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-paper/70">
          <CompassLogo />
          <span className="font-serif text-[15px] font-bold">Polaris</span>
        </Link>

        <h1 className="mt-8 font-serif text-4xl font-bold leading-tight">
          You&apos;re offline
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-paper/65">
          This page hasn&apos;t been saved for offline use yet. Your roadmap and
          this week&apos;s tasks are cached and still readable.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/roadmap"
            className="rounded-full bg-paper px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            Open your roadmap
          </Link>
          <Link
            href="/deadlines"
            className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13.5px] font-semibold text-paper transition-colors hover:bg-white/[0.12]"
          >
            Deadlines
          </Link>
        </div>

        <p className="mt-8 text-[12.5px] text-paper/40">
          Anything you change while offline is queued and sent when the
          connection returns.
        </p>
      </div>
    </main>
  );
}
