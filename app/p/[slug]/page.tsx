import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicPassport, recordView } from "@/lib/passport/service";
import { appOrigin } from "@/lib/env";
import { CompassLogo } from "@/components/Nav";

/**
 * The public passport.
 *
 * Server-rendered so a link opens with the content already in the HTML - a
 * recommender or a committee member opening this on a bad connection should not
 * be looking at a spinner.
 *
 * Deliberately `noindex`: this page is a student's own record, shared by them
 * with specific people. It is unlisted, not published to the web, and it stays
 * out of the sitemap for the same reason.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const passport = await getPublicPassport(slug).catch(() => null);
  if (!passport) return { title: "Passport not found", robots: { index: false, follow: false } };

  const title = `${passport.displayName} - verified student passport`;
  const description =
    passport.headline ||
    `${passport.stats.verified} of ${passport.stats.total} claims backed by an artifact.`;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "profile",
      title,
      description,
      url: `${appOrigin()}/p/${passport.slug}`,
    },
  };
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  });
}

export default async function PassportPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const passport = await getPublicPassport(slug);
  if (!passport) notFound();

  // Never let analytics block the render.
  void recordView(slug).catch(() => {});

  const { stats } = passport;

  return (
    <main className="min-h-screen bg-paper text-ink">
      {/* ── Header ── */}
      <header className="border-b border-polaris-500/12 bg-ink text-paper">
        <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
          <Link href="/" className="inline-flex items-center gap-2 text-paper/70 transition-colors hover:text-paper">
            <CompassLogo />
            <span className="font-serif text-[15px] font-bold">Polaris</span>
          </Link>

          <h1 className="mt-8 font-serif text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
            {passport.displayName}
          </h1>
          {passport.headline && (
            <p className="mt-3 text-[17px] leading-relaxed text-polaris-200">
              {passport.headline}
            </p>
          )}
          {passport.summary && (
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-paper/65">
              {passport.summary}
            </p>
          )}

          {/* Coverage - the honest headline number */}
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
            <div>
              <div className="font-serif text-[32px] font-bold leading-none tabular-nums text-paper">
                {stats.verified}
                <span className="text-paper/40">/{stats.total}</span>
              </div>
              <div className="mt-1.5 text-[11px] uppercase tracking-[0.18em] text-paper/45">
                Claims with proof
              </div>
            </div>
            <div className="h-10 w-px bg-white/15" />
            <div className="min-w-[180px] flex-1">
              <div className="flex justify-between text-[11.5px] text-paper/55">
                <span>Evidence coverage</span>
                <span className="font-semibold tabular-nums text-paper">{stats.coverage}%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-polaris-400 to-aurora-400"
                  style={{ width: `${stats.coverage}%` }}
                />
              </div>
            </div>
          </div>

          <p className="mt-6 text-[11.5px] text-paper/40">
            Last updated {formatDate(passport.updatedAt)} · Every claim below links to the
            artifact behind it, or is marked as having none.
          </p>
        </div>
      </header>

      {/* ── Claims ── */}
      <section className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <h2 className="flex items-center gap-3 font-serif text-[22px] font-bold">
          Verified
          <span className="rounded-full bg-aurora-500/12 px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-aurora-700">
            {passport.verified.length}
          </span>
        </h2>

        {passport.verified.length === 0 ? (
          <p className="mt-4 text-[14px] text-ink-dim">
            Nothing has been evidenced yet.
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {passport.verified.map((c) => (
              <li
                key={c.id}
                className="rounded-2xl border border-aurora-500/25 bg-aurora-500/[0.04] p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-aurora-500 text-paper">
                    <svg width="11" height="11" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M2 7.5l3.5 3.5L12 3.5" />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold leading-snug">{c.claim}</p>

                    {c.verifiedSignal && (
                      <p className="mt-2 text-[13.5px] leading-relaxed text-ink-dim">
                        <span className="font-medium text-ink">Signal:</span> {c.verifiedSignal}
                      </p>
                    )}
                    {c.gap && (
                      <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-dim">
                        <span className="font-medium text-ink">Does not establish:</span> {c.gap}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12px]">
                      <span className="rounded bg-ink/[0.06] px-2 py-0.5 font-medium text-ink-dim">
                        {c.proofType}
                      </span>
                      {c.proofUrl && (
                        <a
                          href={c.proofUrl}
                          target="_blank"
                          // noopener/noreferrer because these are links a
                          // student supplied and a stranger is clicking.
                          rel="noopener noreferrer nofollow"
                          className="font-semibold text-polaris-700 hover:underline"
                        >
                          Open the artifact ↗
                        </a>
                      )}
                      {c.verifiedAt && (
                        <span className="text-ink-dim">
                          Verified {formatDate(c.verifiedAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* The part that makes the page worth trusting. */}
        {passport.showUnevidenced && passport.unevidenced.length > 0 && (
          <>
            <h2 className="mt-12 flex items-center gap-3 font-serif text-[22px] font-bold">
              Not yet evidenced
              <span className="rounded-full bg-ink/[0.07] px-2.5 py-0.5 text-[12px] font-bold tabular-nums text-ink-dim">
                {passport.unevidenced.length}
              </span>
            </h2>
            <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-ink-dim">
              These are claimed but have no artifact behind them yet. They are
              shown rather than hidden - that is the point of the page.
            </p>
            <ul className="mt-5 space-y-2.5">
              {passport.unevidenced.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-3 rounded-xl border border-dashed border-polaris-500/25 bg-paper-soft p-4"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ink/25" />
                  <div>
                    <p className="text-[14.5px] font-medium leading-snug">{c.claim}</p>
                    <p className="mt-1 text-[12px] text-ink-dim">
                      Expected proof: {c.proofType}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}

        {!passport.showUnevidenced && (
          <p className="mt-10 rounded-xl border border-polaris-500/15 bg-paper-soft p-4 text-[13px] text-ink-dim">
            This student has chosen to show only evidenced claims. The list above
            is filtered.
          </p>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-polaris-500/12">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-3 px-6 py-10 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12.5px] text-ink-dim">
            Claims and artifacts are supplied by the student. Polaris records what
            was attached and when - it does not independently audit the artifact.
          </p>
          <Link
            href="/signup"
            className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-[13px] font-semibold text-paper transition-colors hover:bg-ink/90"
          >
            Build yours
          </Link>
        </div>
      </footer>
    </main>
  );
}
