import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { groupedByDate, KIND_LABEL, type ChangeKind } from "@/lib/changelog";

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What shipped in Polaris and when: new tools, improvements, fixes and security changes, written from the student's side of the screen.",
  alternates: { canonical: "/changelog" },
};

/**
 * Server-rendered so it is indexable and so a shared link shows the entries
 * rather than an empty shell.
 */
const KIND_STYLES: Record<ChangeKind, string> = {
  feature: "bg-polaris-500/12 text-polaris-700 ring-polaris-500/25 dark:bg-polaris-400/15 dark:text-polaris-200 dark:ring-polaris-400/30",
  improvement: "bg-aurora-500/12 text-aurora-700 ring-aurora-500/25 dark:bg-aurora-400/15 dark:text-aurora-200 dark:ring-aurora-400/30",
  fix: "bg-ink/[0.06] text-ink-dim ring-ink/12 dark:bg-white/[0.07] dark:text-paper/65 dark:ring-white/15",
  security: "bg-rose-500/12 text-rose-700 ring-rose-500/25 dark:bg-rose-400/15 dark:text-rose-200 dark:ring-rose-400/30",
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function ChangelogPage() {
  const groups = groupedByDate();

  return (
    <main className="min-h-screen bg-paper text-ink">
      <Nav />

      <section className="mx-auto max-w-3xl px-6 pb-24 pt-32 sm:pt-36">
        <p className="text-[11px] uppercase tracking-[0.22em] text-polaris-600">
          Changelog
        </p>
        <h1 className="mt-5 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
          What shipped, and when
        </h1>
        <p className="mt-5 max-w-xl text-[16px] leading-relaxed text-ink-dim">
          Only things you can actually do differently today. Refactors and
          dependency bumps stay out of it.
        </p>

        <div className="mt-16 space-y-14">
          {groups.map((group) => (
            <section key={group.date}>
              <div className="flex items-center gap-4">
                <h2 className="shrink-0 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-dim">
                  <time dateTime={group.date}>{formatDate(group.date)}</time>
                </h2>
                <span className="h-px flex-1 bg-polaris-500/12" />
              </div>

              <ul className="mt-6 space-y-6">
                {group.entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="rounded-2xl border border-polaris-500/12 bg-paper-card p-5 shadow-[0_1px_2px_rgba(44,24,16,0.04)] sm:p-6"
                  >
                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.12em] ring-1 ring-inset ${KIND_STYLES[entry.kind]}`}
                      >
                        {KIND_LABEL[entry.kind]}
                      </span>
                      <h3 className="font-serif text-[19px] font-bold leading-snug">
                        {entry.title}
                      </h3>
                    </div>
                    <p className="mt-2.5 text-[14.5px] leading-relaxed text-ink-dim">
                      {entry.body}
                    </p>
                    {entry.href && (
                      <Link
                        href={entry.href}
                        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-polaris-700 hover:text-polaris-800 dark:text-polaris-300"
                      >
                        Open it
                        <span aria-hidden>→</span>
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
