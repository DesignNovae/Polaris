/**
 * /family - support-circle monitoring, ported to prototype parity. Members
 * come from the real `links` collection; the weekly digest preview is computed
 * from the student's real milestones + the probability engine; the invite form
 * posts (form-encoded) to the wired /api/links route. Parents/partners accept
 * invites and view progress from /monitor (the (app) shell is student-only).
 */

import { requireSession } from "@/lib/authz";
import { getLinksForStudent, getUserById, getProfile } from "@/lib/db/collections";
import { listMilestones } from "@/lib/tasks/service";
import { scoreProbability, profileToInputs, type UniversityForModel } from "@/lib/ml/probability";
import { Card, Pill, Tag, Avatar, Icon } from "@/components/app/ui";
import { FamilyInviteForm, FamilyMemberActions } from "@/components/app/FamilyControls";

export const metadata = { title: "Family" };
export const dynamic = "force-dynamic";

const TARGET: Record<string, { tier: UniversityForModel["tier"]; rate: number; label: string }> = {
  elite: { tier: "elite", rate: 0.05, label: "Elite" },
  top50: { tier: "top50", rate: 0.18, label: "Top-50" },
  top200: { tier: "top200", rate: 0.35, label: "Top-200" },
  regional: { tier: "regional", rate: 0.6, label: "Regional" },
};

const colorFor = (rel: string) => (rel === "parent" ? "polaris" : "aurora") as "polaris" | "aurora";

export default async function FamilyPage() {
  const user = await requireSession();
  const [links, u, profile, milestones] = await Promise.all([
    getLinksForStudent(user.id),
    getUserById(user.id),
    getProfile(user.id),
    listMilestones(user.id),
  ]);

  const total = milestones.length;
  const done = milestones.filter((m) => m.status === "done").length;
  const target = TARGET[profile?.targetTier ?? "elite"] ?? TARGET.elite;
  const probPct = Math.round(scoreProbability(profileToInputs(profile), { id: "t", tier: target.tier, acceptanceRate: target.rate }).probability * 100);
  const firstName = (u?.name ?? "You").split(/\s+/)[0];

  const activity = [
    ...milestones.filter((m) => m.status === "done").slice(0, 3).map((m) => ({ who: firstName, text: `Completed: ${m.title}` })),
    ...milestones.filter((m) => m.status === "in-progress").slice(0, 2).map((m) => ({ who: firstName, text: `In progress: ${m.title}` })),
    { who: "Strategist", text: `${target.label} acceptance probability now ${probPct}%.` },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1200px] mx-auto">
      <div className="flex items-end justify-between gap-6 mb-6">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Ecosystem</div>
          <h1 className="font-serif text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
            Your <span className="grad-text">support circle</span>, in the loop.
          </h1>
          <p className="text-[13.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
            Parents, counselors, and partners can monitor your roadmap with read-only access. You pick what they see -
            and they get a weekly digest from the Strategist, not a firehose. They accept invites and view progress from /monitor.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Members + invite + digest */}
        <div className="space-y-4">
          {links.map((l) => (
            <Card key={l._id?.toString()} className="p-5 flex items-start gap-4">
              <Avatar initials={l.viewerEmail.slice(0, 2).toUpperCase()} color={colorFor(l.relationship)} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-serif text-[16px] font-bold text-ink truncate">{l.viewerEmail}</div>
                  <Pill tone={l.relationship === "parent" ? "polaris" : "aurora"}>{l.relationship}</Pill>
                  {l.status === "pending" && <Pill tone="nova">pending</Pill>}
                  <span className="ml-auto text-[10.5px] font-mono text-ink-muted">since {l.createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Tag tone="ink">{l.status === "accepted" ? "Read-only · Roadmap, Deadlines" : "Awaiting acceptance"}</Tag>
                </div>
                {l._id && <FamilyMemberActions id={l._id.toString()} relationship={l.relationship} />}
              </div>
            </Card>
          ))}

          {/* Invite */}
          <Card className="p-5 border-dashed border border-polaris-300 shadow-none bg-transparent">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">Invite</div>
            <div className="font-serif text-[16px] font-bold text-ink mt-1">Add a parent, counselor, or peer reviewer</div>
            <div className="text-[12.5px] text-ink-dim mt-1">Send a scoped invite. They never sign your roadmap - only you do.</div>
            <FamilyInviteForm />
          </Card>

          {/* Weekly digest */}
          <Card className="p-5 bg-paper-soft shadow-none">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-polaris-500"><Icon.spark size={14} /></span>
              <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">This week&apos;s digest (preview)</div>
              <Pill tone="aurora" className="ml-auto">Digest preview</Pill>
            </div>
            <div className="font-serif text-[18px] font-bold text-ink leading-tight">
              {firstName} has closed {done} of {total} milestones · {target.label} probability {probPct}%.
            </div>
            <div className="text-[12.5px] text-ink-dim mt-2 leading-relaxed">
              The Strategist composes one readable paragraph for the weekly digest. Parents get the signal, not the noise - and a link to the live roadmap if they want depth.
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {[
                { v: `${probPct}%`, l: `${target.label} prob` },
                { v: `${done} / ${total}`, l: "closed" },
                { v: String(links.filter((l) => l.status === "accepted").length), l: "in the loop" },
              ].map((s) => (
                <div key={s.l} className="bg-paper-card rounded-lg p-3 hairline">
                  <div className="font-serif text-[20px] font-bold text-ink leading-none">{s.v}</div>
                  <div className="text-[10.5px] text-ink-muted font-mono mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Activity feed */}
        <Card className="p-0 overflow-hidden self-start">
          <div className="px-4 py-3 border-b border-polaris-500/10 flex items-center gap-2">
            <Icon.bolt size={14} />
            <div className="text-[12px] font-semibold text-ink">Shared activity</div>
            <span className="ml-auto text-[10.5px] font-mono text-ink-muted">live</span>
          </div>
          <ol className="px-4 py-3 space-y-3.5">
            {activity.map((e, i) => (
              <li key={i} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <span className={`h-2 w-2 rounded-full ${e.who === "Strategist" ? "bg-polaris-500" : "bg-aurora-500"}`} />
                  {i < activity.length - 1 && <span className="flex-1 w-px bg-polaris-500/15 mt-1" />}
                </div>
                <div className="pb-1 min-w-0">
                  <div className="text-[10.5px] font-mono text-ink-muted">{e.who}</div>
                  <div className="text-[12.5px] text-ink mt-0.5">{e.text}</div>
                </div>
              </li>
            ))}
            {activity.length === 0 && <li className="text-[12px] text-ink-muted">No shared activity yet.</li>}
          </ol>
          <div className="px-4 py-3 border-t border-polaris-500/10 text-[11px] text-ink-muted">
            Visible only to people you&apos;ve explicitly invited.
          </div>
        </Card>
      </div>
    </div>
  );
}
