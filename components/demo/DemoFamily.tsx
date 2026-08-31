"use client";

import { useState, type FormEvent } from "react";
import { Card, Btn, Pill, Icon } from "@/components/app/ui";
import { RelationshipSelect } from "@/components/app/RelationshipSelect";

export function DemoFamily() {
  const [invited, setInvited] = useState<string[]>([]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    if (email) setInvited((items) => [...items, email]);
    event.currentTarget.reset();
  }
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1200px] mx-auto">
      <div className="mb-6">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Ecosystem</div>
        <h1 className="font-serif text-[34px] leading-[1.05] font-bold tracking-tight text-ink">Your <span className="grad-text">support circle</span>, in the loop.</h1>
        <p className="text-[13.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">Parents, counselors, and partners can monitor your roadmap with read-only access. You pick what they see - and they get a weekly digest from the Strategist, not a firehose.</p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-4">
          {invited.map((email) => <Card key={email} className="p-4 flex items-center gap-3"><div className="h-9 w-9 rounded-full bg-polaris-500 text-white grid place-items-center font-serif font-bold">{email.slice(0,2).toUpperCase()}</div><div><div className="text-[13px] font-semibold text-ink">{email}</div><div className="text-[11px] text-ink-muted">Invite pending</div></div><Pill tone="nova" className="ml-auto">pending</Pill></Card>)}
          <Card className="p-5 border-dashed border border-polaris-300 shadow-none bg-transparent">
            <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">Invite</div>
            <div className="font-serif text-[16px] font-bold text-ink mt-1">Add a parent, counselor, or peer reviewer</div>
            <div className="text-[12.5px] text-ink-dim mt-1">Send a scoped invite. They never sign your roadmap - only you do.</div>
            <form onSubmit={submit} className="mt-3 flex items-center gap-2"><input name="email" type="email" required placeholder="email@example.com" className="flex-1 h-9 px-3 rounded-lg bg-paper-card hairline text-[13px] outline-none placeholder-ink-muted"/><RelationshipSelect/><Btn size="md" variant="primary" type="submit">Send invite</Btn></form>
          </Card>
          <Card className="p-5 bg-paper-soft shadow-none">
            <div className="flex items-center gap-2 mb-3"><span className="text-polaris-500"><Icon.spark size={14}/></span><div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">This week&apos;s digest (preview)</div><Pill tone="aurora" className="ml-auto">Auto-send · Sundays</Pill></div>
            <div className="font-serif text-[18px] font-bold text-ink leading-tight">Pro has closed 1 of 9 milestones · Elite probability 45%.</div>
            <div className="text-[12.5px] text-ink-dim mt-2 leading-relaxed">The Strategist composes a single readable paragraph each Sunday. Parents get the signal, not the noise - and a link to the live roadmap if they want depth.</div>
            <div className="mt-3 grid grid-cols-3 gap-3">{[["45%","Elite prob"],["1 / 9","closed"],[String(invited.length),"in the loop"]].map(([v,l])=><div key={l} className="bg-paper-card rounded-lg p-3 hairline"><div className="font-serif text-[20px] font-bold text-ink">{v}</div><div className="text-[10px] text-ink-muted">{l}</div></div>)}</div>
          </Card>
        </div>
        <Card className="p-0 overflow-hidden h-fit"><div className="px-4 py-3 border-b border-polaris-500/10 flex items-center gap-2"><Icon.spark size={13}/><div className="text-[12px] font-semibold text-ink">Shared activity</div><span className="ml-auto text-[10px] text-ink-muted">live</span></div><div className="p-4 space-y-5">{[["Pro","Completed: Submit applications + scholarships"],["Pro","In progress: Push GPA toward 3.9+"],["Strategist","Elite acceptance probability now 45%."]].map(([who,text],index)=><div key={text} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 rounded-full ${index===2?"bg-polaris-500":"bg-aurora-500"}`}/><div><div className="text-[10px] text-ink-muted">{who}</div><div className="text-[12.5px] text-ink mt-1">{text}</div></div></div>)}</div><div className="px-4 py-3 border-t border-polaris-500/10 text-[10.5px] text-ink-muted">Visible only to people you&apos;ve explicitly invited.</div></Card>
      </div>
    </div>
  );
}
