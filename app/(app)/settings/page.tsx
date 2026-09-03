/**
 * /settings - expanded account control center.
 *
 * Server component fetches session-bound data, server-renders every
 * section, then hands the lot to <SettingsShell> (client) which holds
 * the active-tab state and shows only that section's content.
 *
 * Sections (all wired through existing /api/account routes + Mongo):
 *   - Profile               → SettingsProfileForm
 *   - Password & security   → SettingsPasswordForm
 *   - Strategist memory     → SettingsMemory
 *   - Gemma 4 usage         - SettingsUsage
 *   - AI usage              → SettingsUsage
 *   - Notifications         → SettingsNotifications
 *   - Appearance            → SettingsAppearance
 *   - Connected accounts    → server-rendered list
 *   - Family & viewers      → server-rendered list
 *   - Billing & plan        → server-rendered card
 *   - Marketplace mute      → SettingsMarketplace
 *   - Privacy & data        → SettingsDataControls
 */

import { Suspense } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/authz";
import { getUserById, getProfile, getLinksForStudent } from "@/lib/db/collections";
import { getDb } from "@/lib/db/mongodb";
import { Card, Pill, Tag } from "@/components/app/ui";
import { SettingsProfileForm } from "@/components/app/SettingsProfileForm";
import { SettingsPasswordForm } from "@/components/app/SettingsPasswordForm";
import { SettingsReminders } from "@/components/app/SettingsReminders";
import {
  SettingsNotifications,
  SettingsAppearance,
  SettingsMarketplace,
} from "@/components/app/SettingsTogglePanels";
import { SettingsDataControls } from "@/components/app/SettingsDataControls";
import { SettingsMemory } from "@/components/app/SettingsMemory";
import { SettingsUsage } from "@/components/app/SettingsUsage";
import { BRAND_META, type BrandKey } from "@/components/app/BrandLogos";
import { SettingsShell, type SettingsSectionId } from "@/components/app/SettingsShell";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

const KNOWN_PROVIDERS = new Set<BrandKey>([
  "notion", "obsidian", "gcal", "github", "khan", "codeforces", "gdrive", "linkedin",
]);

type ConnectionRow = { provider: string; status?: string; lastSyncAt?: Date };

async function loadConnections(userId: string): Promise<ConnectionRow[]> {
  try {
    const db = await getDb();
    return db.collection<ConnectionRow>("connections").find({ userId }).toArray();
  } catch {
    return [];
  }
}

export default async function SettingsPage() {
  const session = await requireSession();
  const [u, profile, links, connections] = await Promise.all([
    getUserById(session.id),
    getProfile(session.id),
    getLinksForStudent(session.id).catch(() => []),
    loadConnections(session.id),
  ]);
  if (!u) throw new Error("Account incomplete");
  const plan = u.plan ?? "free";
  const planTone = plan === "elite" ? "aurora" : plan === "pro" ? "polaris" : "ink";
  const connectedCount = connections.filter((c) => c.status === "connected").length;
  const acceptedLinks = links.filter((l) => l.status === "accepted").length;

  const sections: Partial<Record<SettingsSectionId, React.ReactNode>> = {
    profile: (
      <Section title="Profile" desc="The name Polaris greets you with and routes invites to.">
        <SettingsProfileForm initialName={u.name} email={u.email} role={u.role} />
      </Section>
    ),
    security: (
      <Section
        title="Sign-in & security"
        desc="Password, email addresses and two-factor authentication are managed in your Polaris account security panel."
      >
        <SettingsPasswordForm />
      </Section>
    ),
    memory: (
      <Section
        title="Strategist memory"
        desc="What Polaris has learned about you across conversations. Forget anything you don't want it to keep, or tell it something new directly."
      >
        <SettingsMemory />
      </Section>
    ),
    usage: (
      <Section
        title="AI usage"
        desc="Track which models the Strategist used, how often, and whether they fell back. Free + local calls are surfaced separately so you can see the cost-optimizer working."
      >
        <SettingsUsage />
      </Section>
    ),
    notifications: (
      <Section title="Notifications" desc="What you want Polaris to ping you about.">
        <SettingsNotifications initial={profile?.preferences?.notifications} />
        {/* Reminders that leave the app - a deadline has to reach you when you
            are not looking at Polaris, which is exactly when you forget. */}
        <div className="mt-8 border-t border-polaris-500/10 pt-8">
          <SettingsReminders />
        </div>
      </Section>
    ),
    appearance: (
      <Section title="Appearance" desc="Theme + glass intensity for the workspace shell.">
        <SettingsAppearance />
      </Section>
    ),
    connected: (
      <Section
        title="Connected accounts"
        desc="Third-party services Polaris is reading from. Manage scopes or disconnect anytime."
        action={<Link href="/connections" className="text-[12.5px] text-polaris-500 hover:text-polaris-600 font-medium">Manage on Connections →</Link>}
      >
        {connections.length === 0 ? (
          <div className="text-[13px] text-ink-muted">
            Nothing connected yet. Go to <Link href="/connections" className="text-polaris-500 hover:text-polaris-600">Connections</Link> to plug in your notes, calendar, or code.
          </div>
        ) : (
          <ul className="divide-y divide-polaris-500/10 dark:divide-white/10">
            {connections.map((c) => {
              const isBrand = KNOWN_PROVIDERS.has(c.provider as BrandKey);
              const meta = isBrand ? BRAND_META[c.provider as BrandKey] : null;
              return (
                <li key={c.provider} className="py-3 flex items-center gap-3">
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center text-white text-[11px] font-mono font-bold shrink-0"
                    style={{ background: meta?.color ?? "#A89888" }}
                  >
                    {meta ? meta.name.slice(0, 2).toUpperCase() : c.provider.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-ink">{meta?.name ?? c.provider}</div>
                    <div className="text-[11px] font-mono text-ink-muted">
                      {c.status ?? "connected"}
                      {c.lastSyncAt && ` · synced ${new Date(c.lastSyncAt).toLocaleString()}`}
                    </div>
                  </div>
                  <Tag tone={c.status === "connected" ? "aurora" : "ink"}>
                    {c.status ?? "connected"}
                  </Tag>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    ),
    family: (
      <Section
        title="Family & viewers"
        desc="People who can see your roadmap (read-only). Manage scopes from the Family page."
        action={<Link href="/family" className="text-[12.5px] text-polaris-500 hover:text-polaris-600 font-medium">Manage on Family →</Link>}
      >
        {links.length === 0 ? (
          <div className="text-[13px] text-ink-muted">
            No viewers linked. Invite a parent or counselor from the <Link href="/family" className="text-polaris-500 hover:text-polaris-600">Family</Link> page.
          </div>
        ) : (
          <ul className="divide-y divide-polaris-500/10 dark:divide-white/10">
            {links.map((l) => (
              <li key={l._id?.toString()} className="py-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-polaris-500 text-white inline-flex items-center justify-center font-serif font-semibold text-[12px] shrink-0">
                  {l.viewerEmail.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-ink truncate">{l.viewerEmail}</div>
                  <div className="text-[11px] text-ink-muted">{l.relationship}</div>
                </div>
                <Tag tone={l.status === "accepted" ? "aurora" : "nova"}>{l.status}</Tag>
              </li>
            ))}
          </ul>
        )}
      </Section>
    ),
    billing: (
      <Section
        title="Billing & plan"
        desc="Current plan, renewal, and upgrade path. Full controls on the Billing page."
        action={<Link href="/billing" className="text-[12.5px] text-polaris-500 hover:text-polaris-600 font-medium">Open Billing →</Link>}
      >
        <Card className="p-4 bg-paper-soft shadow-none flex items-center gap-4 dark:bg-white/[0.04]">
          <div className="min-w-0 flex-1">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">Current plan</div>
            <div className="font-serif text-[22px] font-bold text-ink mt-0.5">Polaris {plan[0].toUpperCase() + plan.slice(1)}</div>
            {u.subscription?.renewsAt && (
              <div className="text-[11.5px] text-ink-dim mt-1">
                Renews on {new Date(u.subscription.renewsAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <Pill tone={planTone}>{plan}</Pill>
          {plan === "free" && (
            <Link
              href="/billing"
              className="rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors"
            >
              Upgrade
            </Link>
          )}
        </Card>
      </Section>
    ),
    marketplace: (
      <Section
        title="Marketplace"
        desc="Control whether the Strategist surfaces partner offers anywhere in the app."
        action={<Link href="/partners" className="text-[12.5px] text-polaris-500 hover:text-polaris-600 font-medium">See partners →</Link>}
      >
        <SettingsMarketplace initial={profile?.preferences?.hidePartnerOffers} />
      </Section>
    ),
    data: (
      <Section
        title="Privacy & data"
        desc="Export everything Polaris holds about you, or permanently delete your account."
      >
        <SettingsDataControls />
        <div className="mt-4 text-[11.5px] text-ink-muted leading-relaxed">
          Data export ships as a single JSON file (profile, roadmap, links, audit). Account deletion is immediate and
          cascades through roadmaps, profiles, and family links. Connections + Strategist transcripts older than 90 days
          are TTL-purged automatically.
        </div>
      </Section>
    ),
  };

  const snapshot = (
    <Card className="p-4 bg-paper-soft shadow-none dark:bg-white/[0.04]">
      <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-2">
        Account snapshot
      </div>
      <dl className="space-y-1.5 text-[12.5px]">
        <Row k="Plan" v={<Pill tone={planTone}>{plan}</Pill>} />
        <Row k="Role" v={<span className="capitalize text-ink">{u.role}</span>} />
        <Row k="Member since" v={<span className="text-ink">{new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>} />
        <Row k="Connected" v={<span className="text-ink">{connectedCount} services</span>} />
        <Row k="Viewers" v={<span className="text-ink">{acceptedLinks} accepted</span>} />
      </dl>
    </Card>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1100px] mx-auto">
      <header className="mb-7">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Account</div>
        <h1 className="font-serif text-[34px] leading-[1.05] font-bold tracking-tight text-ink">Settings</h1>
        <p className="text-[13.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
          Identity, security, notifications, appearance, and connected services - all from one place.
        </p>
      </header>

      <Suspense fallback={<div className="text-[13px] text-ink-muted">Loading…</div>}>
        <SettingsShell sections={sections} snapshot={snapshot} />
      </Suspense>
    </div>
  );
}

function Section({
  title, desc, children, action,
}: {
  title: string;
  desc: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0">
          <div className="font-serif text-[20px] font-bold text-ink leading-tight">{title}</div>
          <div className="text-[12.5px] text-ink-dim mt-1 leading-relaxed">{desc}</div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="mt-3">{children}</div>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="text-ink-dim flex items-center gap-2">{v}</dd>
    </div>
  );
}
