"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SettingsShell, type SettingsSectionId } from "@/components/app/SettingsShell";
import { SettingsAppearance, SettingsMarketplace, SettingsNotifications } from "@/components/app/SettingsTogglePanels";
import { Card, Pill, Tag } from "@/components/app/ui";
import { GemmaKeyCard } from "@/components/app/GemmaStudioPanels";
import { DEMO_USER } from "@/lib/demo/polaris";
import { clearDemoStrategistHistory, listDemoStrategistThreads } from "@/lib/demo/strategist-history";
import { cn } from "@/lib/cn";
import { useLang } from "@/lib/i18n/LangProvider";
import { toBengaliDigits } from "@/lib/i18n/bengali";

const PROFILE_KEY = "polaris.demo.profile";
const MEMORY_KEY = "polaris.demo.memory";

type DemoProfile = {
  name: string; email: string; phone: string; country: string; level: string; curriculum: string;
  gpa: string; sat: string; ielts: string; degree: string; tier: string; activities: string[];
};

type MemoryFact = { id: string; text: string; category: string };

const initialProfile: DemoProfile = {
  name: DEMO_USER.name,
  email: DEMO_USER.email,
  phone: "+880 1700 000000",
  country: "Bangladesh",
  level: "Higher secondary",
  curriculum: "National curriculum",
  gpa: "3.80",
  sat: "1320",
  ielts: "7.0",
  degree: "Computer Science",
  tier: "Elite tier",
  activities: ["Coding", "Research", "Community service"],
};

const initialMemory: MemoryFact[] = [
  { id: "goal", text: "Targeting an elite Computer Science program", category: "Goal" },
  { id: "constraint", text: "Needs scholarship and financial aid options", category: "Constraint" },
  { id: "preference", text: "Prefers a weekly plan with measurable tasks", category: "Preference" },
];

export function DemoSettingsClient() {
  const [profile, setProfile] = useState(initialProfile);
  const [memory, setMemory] = useState(initialMemory);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    try {
      const savedProfile = localStorage.getItem(PROFILE_KEY);
      const savedMemory = localStorage.getItem(MEMORY_KEY);
      if (savedProfile) setProfile({ ...initialProfile, ...JSON.parse(savedProfile) });
      if (savedMemory) setMemory(JSON.parse(savedMemory));
    } catch {}
  }, []);

  function saveProfile() {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  function saveMemory(next: MemoryFact[]) {
    setMemory(next);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(next));
  }

  const sections: Partial<Record<SettingsSectionId, React.ReactNode>> = {
    profile: <Section title="Profile and academic identity" desc="The complete student context used by the roadmap and Polaris Strategist."><ProfilePanel value={profile} onChange={setProfile} onSave={saveProfile} saved={saved} /></Section>,
    security: <Section title="Password and security" desc="Session and device controls from the original Polaris account center."><SecurityPanel /></Section>,
    memory: <Section title="Strategist memory" desc="Review, add, or remove the durable facts used to personalize future guidance."><MemoryPanel facts={memory} onChange={saveMemory} /></Section>,
    usage: <Section title="Polaris AI usage" desc="A visible audit of the AI assistance used across your workspace."><UsagePanel /></Section>,
    notifications: <Section title="Notifications" desc="Choose which progress and deadline signals should reach you."><SettingsNotifications /></Section>,
    appearance: <Section title="Appearance" desc="Apply the workspace theme and glass intensity immediately."><SettingsAppearance /></Section>,
    connected: <Section title="Connected accounts" desc="Review the services that can ground the roadmap with student-owned data."><ConnectionsPanel /></Section>,
    family: <Section title="Family and viewers" desc="Invite-scoped, read-only access for parents, counselors, and reviewers."><FamilyPanel /></Section>,
    billing: <Section title="Billing and plan" desc="The public competition workspace exposes the complete feature set without payment."><BillingPanel /></Section>,
    marketplace: <Section title="Marketplace" desc="Control whether matched student offers appear in the workspace."><SettingsMarketplace /></Section>,
    data: <Section title="Privacy and data" desc="Export or clear this browser-local public demo state."><DataPanel profile={profile} memory={memory} /></Section>,
  };

  const snapshot = (
    <Card className="p-4 bg-paper-soft shadow-none dark:bg-white/[0.04]">
      <div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted font-semibold">Account snapshot</div>
      <div className="mt-3 flex items-center gap-2"><div className="h-9 w-9 rounded-full bg-polaris-500 text-white grid place-items-center font-serif text-[12px] font-bold">PS</div><div><div className="text-[13px] font-semibold text-ink">{profile.name}</div><div className="text-[10.5px] text-ink-muted">Public judge workspace</div></div></div>
      <dl className="mt-3 space-y-2 text-[11.5px]"><Row k="Plan" v={<Pill tone="aurora">Elite</Pill>} /><Row k="Profile" v="100% complete" /><Row k="Memory" v={`${memory.length} facts`} /><Row k="Language" v="English and Bengali" /></dl>
    </Card>
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1120px] mx-auto">
      <header className="mb-6"><div className="text-[10px] uppercase tracking-[0.22em] text-ink-muted font-semibold">Account control center</div><h1 className="mt-1 font-serif text-[30px] sm:text-[36px] font-bold tracking-tight text-ink">Settings that actually work.</h1><p className="mt-2 max-w-2xl text-[13px] text-ink-dim leading-relaxed">Edit the demo profile, memory, notifications, appearance, offers, and privacy controls. Changes stay on this device and never require an account.</p></header>
      <SettingsShell sections={sections} snapshot={snapshot} basePath="/demo" />
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return <Card className="p-5 sm:p-6"><div className="mb-5"><h2 className="font-serif text-[20px] font-bold text-ink">{title}</h2><p className="mt-1 text-[12px] text-ink-dim leading-relaxed">{desc}</p></div>{children}</Card>;
}

function ProfilePanel({ value, onChange, onSave, saved }: { value: DemoProfile; onChange: (value: DemoProfile) => void; onSave: () => void; saved: boolean }) {
  const update = (key: keyof DemoProfile, next: string | string[]) => onChange({ ...value, [key]: next });
  const activities = ["Coding", "Research", "Community service", "Leadership", "Olympiad", "Arts"];
  return <div className="space-y-6">
    <div className="grid sm:grid-cols-2 gap-3"><Field label="Display name"><Input value={value.name} onChange={(v) => update("name", v)} /></Field><Field label="Email"><Input value={value.email} disabled /></Field><Field label="Phone"><Input value={value.phone} onChange={(v) => update("phone", v)} /></Field><Field label="Country"><Input value={value.country} onChange={(v) => update("country", v)} /></Field></div>
    <Group title="Academic profile"><div className="grid sm:grid-cols-2 gap-3"><Field label="Education level"><Select value={value.level} onChange={(v) => update("level", v)} options={["Secondary", "Higher secondary", "Undergraduate", "Graduate"]} /></Field><Field label="Curriculum"><Select value={value.curriculum} onChange={(v) => update("curriculum", v)} options={["National curriculum", "English medium", "IB", "Other"]} /></Field><Field label="GPA or CGPA"><Input value={value.gpa} onChange={(v) => update("gpa", v)} /></Field><Field label="SAT score"><Input value={value.sat} onChange={(v) => update("sat", v)} /></Field><Field label="IELTS band"><Input value={value.ielts} onChange={(v) => update("ielts", v)} /></Field><Field label="Target degree"><Input value={value.degree} onChange={(v) => update("degree", v)} /></Field><Field label="Target tier"><Select value={value.tier} onChange={(v) => update("tier", v)} options={["Elite tier", "Top 10", "Top 50", "Top 100", "Best fit"]} /></Field></div></Group>
    <Group title="Activities"><div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{activities.map((item) => { const active = value.activities.includes(item); return <button type="button" key={item} onClick={() => update("activities", active ? value.activities.filter((x) => x !== item) : [...value.activities, item])} className={cn("rounded-xl border px-3 py-2 text-[12px] transition-colors", active ? "border-polaris-400 bg-polaris-100 text-ink dark:bg-polaris-400/20" : "border-polaris-500/15 bg-paper-soft text-ink-dim hover:text-ink")}>{active ? "✓ " : ""}{item}</button>; })}</div></Group>
    <div className="flex items-center gap-3"><button type="button" onClick={onSave} className="rounded-full bg-ink px-5 py-2.5 text-[12.5px] font-semibold text-paper hover:bg-polaris-700">Save profile</button>{saved && <span className="text-[12px] text-aurora-700">Saved to this device ✓</span>}</div>
  </div>;
}

function SecurityPanel() {
  const [autoLock, setAutoLock] = useLocalBoolean("polaris.demo.autoLock", true);
  const [privateMode, setPrivateMode] = useLocalBoolean("polaris.demo.privateMode", true);
  return <div className="space-y-3"><InfoRow title="Public demo session" body="No password, authentication cookie, or paid account is created." badge="Protected" /><Toggle title="Auto-lock private account sessions" body="Require a fresh sign-in after extended inactivity in the account-backed workspace." checked={autoLock} onChange={setAutoLock} /><Toggle title="Private memory mode" body="Keep public demo memories on this device only." checked={privateMode} onChange={setPrivateMode} /><InfoRow title="Password management" body="Password changes remain available in the authenticated Polaris account workspace." badge="Account only" /></div>;
}

function MemoryPanel({ facts, onChange }: { facts: MemoryFact[]; onChange: (facts: MemoryFact[]) => void }) {
  const [text, setText] = useState(""); const [category, setCategory] = useState("Background");
  function add() { if (text.trim().length < 3) return; onChange([...facts, { id: crypto.randomUUID(), text: text.trim(), category }]); setText(""); }
  return <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-[1fr_150px_auto]"><Input value={text} onChange={setText} placeholder="Tell Polaris a goal, preference, or constraint" /><Select value={category} onChange={setCategory} options={["Goal", "Preference", "Constraint", "Background", "Interest"]} /><button onClick={add} className="rounded-xl bg-ink px-4 py-2 text-[12px] font-semibold text-paper disabled:opacity-50" disabled={text.trim().length < 3}>Remember</button></div><div className="space-y-2">{facts.map((fact) => <div key={fact.id} className="flex items-start gap-3 rounded-xl bg-paper-soft p-3 ring-1 ring-inset ring-polaris-500/10"><Tag tone={fact.category === "Constraint" ? "nova" : fact.category === "Goal" ? "polaris" : "aurora"}>{fact.category}</Tag><span className="flex-1 text-[12.5px] text-ink">{fact.text}</span><button onClick={() => onChange(facts.filter((item) => item.id !== fact.id))} className="text-[11px] text-ink-muted hover:text-rose-600">Forget</button></div>)}</div>{facts.length > 0 && <button onClick={() => onChange([])} className="text-[12px] font-medium text-rose-600">Forget everything</button>}</div>;
}

function UsagePanel() {
  const { lang } = useLang();
  return <div className="space-y-4"><div className="grid sm:grid-cols-3 gap-3"><Metric n="Polaris AI" label="Integrated assistance" /><Metric n="17" label="AI-assisted surfaces" /><Metric n="100%" label="Traceable model routes" /></div><GemmaKeyCard lang={lang} />
<div className="overflow-hidden rounded-xl ring-1 ring-inset ring-polaris-500/10"><table className="w-full text-left text-[12px]"><thead className="bg-paper-soft text-ink-muted"><tr><th className="px-3 py-2">Surface</th><th className="px-3 py-2">Polaris role</th><th className="px-3 py-2">Status</th></tr></thead><tbody className="divide-y divide-polaris-500/10">{[["Full-page Strategist","Grounded reasoning and cited action plan"],["Sidebar Strategist","Synchronized contextual guidance"],["Roadmap","Structured diagnosis and milestones"],["Research mode","Evidence synthesis with visible sources"],["Decision Twin","Constraint comparison"],["Evidence Graph","Claim and proof audit"],["Mock generation and grading","Original questions and skill feedback"],["Video learning","Evidence-grounded lesson curation"],["Knowledge notes","Reusable feedback memory"],["Essay Studio","Voice-preserving writing coaching"],["Handwriting extraction","Bengali and English multimodal transcription"],["Essay translation","Faithful Bengali-to-English conversion"],["University and resource refresh","Grounded discovery synthesis"],["Case Studies","Pattern extraction from evidence"],["Smart Routine","Natural language schedule parsing"],["Offer radar","Official-page synthesis"],["Student memory","Durable goal and preference extraction"]].map(([surface, role]) => <tr key={surface}><td className="px-3 py-2 font-semibold text-ink">{surface}</td><td className="px-3 py-2 text-ink-dim">{role}</td><td className="px-3 py-2"><Tag tone="aurora">Active</Tag></td></tr>)}</tbody></table></div></div>;
}

function ConnectionsPanel() { return <div className="grid sm:grid-cols-2 gap-3">{[["GitHub","Portfolio and coding evidence","Available"],["Google Calendar","Deadlines and routine blocks","Setup"],["Google Drive","Student-owned documents","Setup"],["Codeforces","Competitive programming signal","Available"]].map(([name, body, status]) => <div key={name} className="rounded-xl bg-paper-soft p-4 ring-1 ring-inset ring-polaris-500/10"><div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">{name}</span><Tag tone={status === "Available" ? "aurora" : "nova"}>{status}</Tag></div><p className="mt-2 text-[11.5px] text-ink-dim">{body}</p></div>)}<Link href="/demo/connections" className="sm:col-span-2 text-[12px] font-semibold text-polaris-600 hover:underline">Manage integrations →</Link></div>; }
function FamilyPanel() { return <div className="rounded-xl bg-paper-soft p-4 ring-1 ring-inset ring-polaris-500/10"><div className="flex items-center justify-between gap-4"><div><div className="text-[13px] font-semibold text-ink">No viewers linked in this public session</div><p className="mt-1 text-[11.5px] text-ink-dim">Invite a parent, counselor, or reviewer with scoped read-only access.</p></div><Link href="/demo/family" className="shrink-0 rounded-full bg-ink px-4 py-2 text-[11.5px] font-semibold text-paper">Open Family</Link></div></div>; }
function BillingPanel() { return <div className="rounded-2xl bg-gradient-to-br from-polaris-100 to-aurora-100 p-5 ring-1 ring-inset ring-polaris-500/15 dark:from-polaris-400/15 dark:to-aurora-400/10"><div className="flex flex-wrap items-center gap-4"><div className="flex-1"><div className="text-[10px] uppercase tracking-[0.2em] text-ink-muted">Current access</div><div className="mt-1 font-serif text-[24px] font-bold text-ink">Polaris Elite Demo</div><p className="mt-1 text-[11.5px] text-ink-dim">All judge-facing features are unlocked. No card, payment, or renewal is required.</p></div><Pill tone="aurora">Active</Pill></div></div>; }
function DataPanel({ profile, memory }: { profile: DemoProfile; memory: MemoryFact[] }) {
  const [cleared, setCleared] = useState(false);
  function exportData() { const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), profile, memory, conversations: listDemoStrategistThreads() }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "polaris-demo-data.json"; a.click(); URL.revokeObjectURL(url); }
  function clear() { [PROFILE_KEY, MEMORY_KEY, "polaris.prefs.notify", "polaris.prefs.marketplace"].forEach((key) => localStorage.removeItem(key)); clearDemoStrategistHistory(); setCleared(true); }
  return <div className="space-y-3"><InfoRow title="Browser-local demo data" body="Public demo edits stay on this device and are not attached to a real account." badge="Local only" /><div className="flex flex-wrap gap-2"><button onClick={exportData} className="rounded-full bg-ink px-4 py-2 text-[12px] font-semibold text-paper">Export JSON</button><button onClick={clear} className="rounded-full border border-rose-500/30 px-4 py-2 text-[12px] font-semibold text-rose-600">Clear demo data</button></div>{cleared && <div className="text-[12px] text-aurora-700">Browser-local demo data cleared. Reload to restore the default judge profile.</div>}</div>;
}

function Metric({ n, label }: { n: string; label: string }) { return <div className="rounded-xl bg-paper-soft p-4 ring-1 ring-inset ring-polaris-500/10"><div className="font-serif text-[21px] font-bold text-ink">{n}</div><div className="mt-1 text-[10.5px] text-ink-muted">{label}</div></div>; }
function InfoRow({ title, body, badge }: { title: string; body: string; badge: string }) { return <div className="flex items-start gap-3 rounded-xl bg-paper-soft p-4 ring-1 ring-inset ring-polaris-500/10"><div className="flex-1"><div className="text-[13px] font-semibold text-ink">{title}</div><p className="mt-1 text-[11.5px] text-ink-dim">{body}</p></div><Tag tone="aurora">{badge}</Tag></div>; }
function Toggle({ title, body, checked, onChange }: { title: string; body: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="flex items-start gap-3 rounded-xl bg-paper-soft p-4 ring-1 ring-inset ring-polaris-500/10 cursor-pointer"><div className="flex-1"><div className="text-[13px] font-semibold text-ink">{title}</div><p className="mt-1 text-[11.5px] text-ink-dim">{body}</p></div><button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-aurora-500" : "bg-paper-deep")}><span className={cn("absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform", checked && "translate-x-5")} /></button></label>; }
function Group({ title, children }: { title: string; children: React.ReactNode }) { return <div className="border-t border-polaris-500/10 pt-5"><div className="mb-3 text-[12.5px] font-semibold text-ink">{title}</div>{children}</div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><div className="mb-1.5 text-[11.5px] font-medium text-ink">{label}</div>{children}</label>; }
function Input({ value, onChange, disabled, placeholder }: { value: string; onChange?: (value: string) => void; disabled?: boolean; placeholder?: string }) { const { lang, translate } = useLang(); const shown = lang === "bn" && !value.includes("@") ? toBengaliDigits(translate(value)) : value; return <input value={shown} onChange={(event) => onChange?.(event.target.value)} disabled={disabled} placeholder={placeholder ? translate(placeholder) : undefined} className="h-10 w-full rounded-xl border border-polaris-500/15 bg-paper-card px-3 text-[12.5px] text-ink outline-none focus:border-polaris-400 disabled:bg-paper-soft disabled:text-ink-muted" />; }
function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: string[] }) { const { translate } = useLang(); return <select value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-xl border border-polaris-500/15 bg-paper-card px-3 text-[12.5px] text-ink outline-none focus:border-polaris-400">{options.map((option) => <option key={option} value={option}>{translate(option)}</option>)}</select>; }
function Row({ k, v }: { k: string; v: React.ReactNode }) { return <div className="flex items-center justify-between gap-3"><dt className="text-ink-muted">{k}</dt><dd className="text-right text-ink">{v}</dd></div>; }
function useLocalBoolean(key: string, initial: boolean): [boolean, (value: boolean) => void] { const [value, setValue] = useState(initial); useEffect(() => { const saved = localStorage.getItem(key); if (saved !== null) setValue(saved === "true"); }, [key]); return [value, (next) => { setValue(next); localStorage.setItem(key, String(next)); }]; }
