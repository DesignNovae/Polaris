/**
 * /achievements - effort points and the evidence shelf.
 *
 * Server-rendered with the real state already in the HTML: a page whose whole
 * job is to show what you have earned should not open on a spinner.
 */

import { requireSession } from "@/lib/authz";
import { getXpState } from "@/lib/xp/service";
import { getBadgeShelf } from "@/lib/badges/service";
import { getWalletView } from "@/lib/coins/service";
import { getPassport } from "@/lib/passport/service";
import { AchievementsClient } from "@/components/app/AchievementsClient";

export const metadata = { title: "Achievements" };
export const dynamic = "force-dynamic";

export default async function AchievementsPage() {
  const user = await requireSession();
  const [xp, badges, wallet, passport] = await Promise.all([
    getXpState(user.id),
    getBadgeShelf(user.id),
    getWalletView(user.id),
    getPassport(user.id),
  ]);

  return (
    <AchievementsClient
      xp={xp}
      badges={badges}
      wallet={wallet}
      passportPublished={Boolean(passport?.published)}
      passportSlug={passport?.slug ?? null}
    />
  );
}
