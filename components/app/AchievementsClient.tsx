"use client";

/**
 * The achievements surface.
 *
 * Two halves that answer different questions. Points answer "am I doing
 * enough this week"; badges answer "what can I show for it". The second is the
 * one that matters outside the app, so it gets the room.
 */

import Link from "next/link";
import { motion } from "framer-motion";
import { SectionTitle, Card, Pill } from "./ui";
import { XpPanel, type XpDto } from "./XpPanel";
import { AchievementShelf, type ShelfBadge } from "./AchievementShelf";
import { CoinShop, type WalletDto } from "./CoinShop";

export function AchievementsClient({
  xp,
  badges,
  wallet,
  passportPublished,
  passportSlug,
  demo = false,
}: {
  xp: XpDto;
  badges: ShelfBadge[];
  wallet: WalletDto;
  passportPublished: boolean;
  passportSlug: string | null;
  demo?: boolean;
}) {
  const earned = badges.filter((b) => b.earnedAt !== null);
  const locked = badges.filter((b) => b.earnedAt === null);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <SectionTitle
        eyebrow="Progress"
        title="What you have earned"
        sub="Points measure the effort you put in this week. Achievements are what Polaris can attest to on your behalf - and they go on your passport, where a recommender will read them."
      />

      <XpPanel initial={xp} />

      <div className="mt-4">
        <CoinShop initial={wallet} demo={demo} />
      </div>

      <div className="mt-12">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-[22px] font-bold leading-tight text-ink">
              Evidence achievements
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13.5px] text-ink-dim">
              Each one states a countable fact about work you actually did, with
              what it does not prove written next to it. That is what makes it
              worth putting in front of someone.
            </p>
          </div>
          <Pill tone="ink">
            {earned.length} of {badges.length} earned
          </Pill>
        </div>

        {earned.length > 0 && (
          <div className="mb-8">
            <AchievementShelf badges={earned} />
          </div>
        )}

        {locked.length > 0 && (
          <>
            <h3 className="mb-4 text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-muted">
              Still to earn
            </h3>
            <AchievementShelf badges={locked} />
          </>
        )}

        {earned.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="mt-8 p-6">
              <p className="text-[13.5px] leading-relaxed text-ink-dim">
                Nothing earned yet, which is exactly what an empty record should
                say. Sit a timed practice section or complete a roadmap
                milestone - the first achievements are within a week of ordinary
                work, and they appear here the moment they are met.
              </p>
            </Card>
          </motion.div>
        )}
      </div>

      {/* Where the badges end up. The point of the whole system. */}
      <Card className="mt-10 p-6">
        <h3 className="text-[15px] font-semibold text-ink">On your passport</h3>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-dim">
          Achievements appear on your public passport in their own section,
          separate from the claims you write yourself. The distinction is
          deliberate: your claims are backed by artifacts you link, and these are
          backed by Polaris&apos;s own record of what you did.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Link
            href="/passport"
            className="inline-flex h-9 items-center rounded-full bg-ink px-4 text-[12.5px] font-semibold text-paper transition-colors hover:bg-polaris-700"
          >
            Open your passport
          </Link>
          {passportPublished && passportSlug ? (
            <span className="text-[12px] text-ink-muted">
              Published at <span className="font-mono">/p/{passportSlug}</span>
            </span>
          ) : (
            <span className="text-[12px] text-ink-muted">
              Your passport is unpublished, so nothing here is visible to anyone yet.
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
