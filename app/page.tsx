import Link from "next/link";
import { CompassLogo } from "@/components/Nav";

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 w-full">
        <div className="pt-4 px-4 sm:px-6">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <CompassLogo />
              <span className="font-serif text-[17px] font-bold tracking-tight text-ink">
                Polaris
              </span>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href="/signin"
                className="text-[13px] font-medium text-ink-dim hover:text-ink transition-colors px-3.5 py-2 rounded-full"
              >
                Sign in
              </Link>
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-ink px-4 py-2 text-[13px] font-semibold text-paper hover:bg-polaris-700 transition-colors duration-150 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)]"
              >
                <span className="relative inline-flex">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-aurora-400 opacity-75 animate-ping" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-400" />
                </span>
                Start free
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="max-w-2xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-polaris-500/10 px-4 py-1.5 text-xs font-medium text-polaris-500">
            <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 animate-pulse" />
            AI-Powered Academic Strategy
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-serif font-bold tracking-tight text-ink leading-[1.1]">
            Your north star for{" "}
            <span className="text-gradient">academic strategy</span>
          </h1>
          <p className="mt-6 text-lg text-ink-dim leading-relaxed max-w-xl mx-auto">
            Polaris maps your academic journey from where you are to where you want to be — powered by AI that understands global education.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-polaris-500 px-8 py-3.5 text-sm font-semibold text-white hover:bg-polaris-600 active:bg-polaris-700 transition-colors duration-150 shadow-[0_10px_30px_-12px_rgba(139,94,60,0.4)]"
            >
              Get started — it&apos;s free
            </Link>
            <Link
              href="/signin"
              className="rounded-full border border-polaris-300 bg-white px-8 py-3.5 text-sm font-medium text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150"
            >
              Sign in
            </Link>
          </div>

          {/* Feature pills */}
          <div className="mt-16 flex flex-wrap items-center justify-center gap-2">
            {[
              "AI Roadmap",
              "Milestone Tracking",
              "University Fit",
              "Strategist Chat",
              "Deadline Radar",
              "Case Studies",
            ].map((f) => (
              <span
                key={f}
                className="rounded-full border border-polaris-200 bg-white/80 px-3.5 py-1.5 text-xs text-ink-dim font-medium"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-polaris-200/60 py-8 px-4 text-center text-xs text-ink-muted">
        <p>© {new Date().getFullYear()} Polaris by Team Arcane. All rights reserved.</p>
      </footer>
    </main>
  );
}
