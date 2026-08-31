"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Icon, Pill } from "@/components/app/ui";
import { useLang } from "@/lib/i18n/LangProvider";

type Invite = {
  id: string;
  email: string;
  relationship: string;
  token: string;
  status: "pending" | "accepted";
};

const KEY = "polaris.family.invites.v1";

export function LiveFamily() {
  const { lang } = useLang();
  const bn = lang === "bn";
  const [invites, setInvites] = useState<Invite[]>([]);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    try { setInvites(JSON.parse(localStorage.getItem(KEY) || "[]") as Invite[]); } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(invites)); } catch {}
  }, [invites]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim().toLowerCase();
    const relationship = String(form.get("relationship") || "Parent");
    if (!email || invites.some((item) => item.email === email)) return;
    setInvites((current) => [{
      id: crypto.randomUUID(),
      email,
      relationship,
      token: crypto.randomUUID().replaceAll("-", ""),
      status: "pending",
    }, ...current]);
    event.currentTarget.reset();
  };

  const copy = async (invite: Invite) => {
    await navigator.clipboard.writeText(`${window.location.origin}/monitor?accept=${invite.token}`);
    setCopied(invite.id);
    setTimeout(() => setCopied(""), 1600);
  };

  return (
    <div className="mx-auto max-w-[1140px] px-5 py-7 lg:px-10">
      <div className="mb-6">
        <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-[0.22em] text-ink-muted">{bn ? "সহায়তার পরিধি" : "Support circle"}</div>
        <h1 className="font-serif text-[30px] font-bold leading-tight text-ink sm:text-[36px]">{bn ? <>আপনার <span className="grad-text">বিশ্বস্ত মানুষদের</span> সঙ্গে অগ্রগতি ভাগ করুন</> : <>Keep your <span className="grad-text">trusted people</span> in the loop</>}</h1>
        <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-ink-dim">{bn ? "অভিভাবক, পরামর্শক বা সহপাঠী পর্যালোচককে শুধু দেখার লিংক দিন। আমন্ত্রণ ব্রাউজারে সংরক্ষিত থাকে এবং পর্যবেক্ষণ পাতায় খোলা যায়।" : "Give a parent, counselor, or peer reviewer a scoped read-only link. Invites stay in this browser and open in the monitor view."}</p>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.5fr_0.7fr]">
        <div className="space-y-4">
          <Card className="border border-dashed border-polaris-400/70 p-5">
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-ink-muted">{bn ? "নতুন আমন্ত্রণ" : "New invite"}</div>
            <h2 className="mt-1 font-serif text-[20px] font-bold text-ink">{bn ? "অভিভাবক, পরামর্শক বা সহপাঠী পর্যালোচক যোগ করুন" : "Add a parent, counselor, or peer reviewer"}</h2>
            <form onSubmit={submit} className="mt-4 grid gap-2 sm:grid-cols-[1fr_170px_auto]">
              <input name="email" type="email" required placeholder="email@example.com" className="h-10 rounded-xl bg-paper-card px-3 text-[13px] outline-none hairline placeholder-ink-muted" />
              <select name="relationship" className="h-10 rounded-xl bg-paper-card px-3 text-[12.5px] text-ink outline-none hairline"><option value="Parent">{bn ? "অভিভাবক" : "Parent"}</option><option value="Counselor">{bn ? "পরামর্শক" : "Counselor"}</option><option value="Peer reviewer">{bn ? "সহপাঠী পর্যালোচক" : "Peer reviewer"}</option><option value="Teacher">{bn ? "শিক্ষক" : "Teacher"}</option></select>
              <Btn size="md" variant="primary" type="submit">{bn ? "আমন্ত্রণ তৈরি করুন" : "Create invite"}</Btn>
            </form>
            <p className="mt-2 text-[10px] text-ink-muted">{bn ? "পাবলিক ডেমোতে ইমেইল পাঠানো হয় না। তৈরি করা লিংক কপি করে সরাসরি শেয়ার করুন।" : "The public demo does not send email. Copy the generated link and share it directly."}</p>
          </Card>
          <div className="space-y-2.5">
            {invites.length === 0 && <Card className="p-8 text-center"><h3 className="font-serif text-[18px] font-bold text-ink">{bn ? "এখনও কাউকে আমন্ত্রণ জানানো হয়নি" : "No one invited yet"}</h3><p className="mt-1 text-[11.5px] text-ink-dim">{bn ? "প্রথম শুধু-পঠনযোগ্য অগ্রগতি লিংক তৈরি করুন।" : "Create the first read-only progress link."}</p></Card>}
            {invites.map((invite) => (
              <Card key={invite.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-polaris-500 text-sm font-bold text-white">{invite.email.slice(0, 2).toUpperCase()}</div>
                <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{invite.email}</div><div className="mt-0.5 text-[10.5px] text-ink-muted">{bn ? ({ Parent: "অভিভাবক", Counselor: "পরামর্শক", "Peer reviewer": "সহপাঠী পর্যালোচক", Teacher: "শিক্ষক" }[invite.relationship] || invite.relationship) : invite.relationship} · {bn ? (invite.status === "accepted" ? "গৃহীত" : "অপেক্ষমাণ") : invite.status}</div></div>
                <Pill tone={invite.status === "accepted" ? "aurora" : "nova"}>{bn ? (invite.status === "accepted" ? "গৃহীত" : "অপেক্ষমাণ") : invite.status}</Pill>
                <Btn size="sm" variant="outline" onClick={() => void copy(invite)}>{copied === invite.id ? (bn ? "কপি হয়েছে" : "Copied") : (bn ? "লিংক কপি" : "Copy link")}</Btn>
                <button aria-label={bn ? "আমন্ত্রণ সরান" : "Remove invite"} onClick={() => setInvites((current) => current.filter((item) => item.id !== invite.id))} className="grid h-8 w-8 place-items-center rounded-lg text-ink-muted hover:bg-signal-rose/10 hover:text-signal-rose"><Icon.close size={12} /></button>
              </Card>
            ))}
          </div>
        </div>
        <Card className="h-fit overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-polaris-500/10 px-4 py-3"><Icon.spark size={13} /><div className="text-[12px] font-semibold text-ink">{bn ? "শেয়ার করা কার্যক্রম" : "Shared activity"}</div><span className="ml-auto text-[10px] text-ink-muted">{bn ? "লাইভ" : "live"}</span></div>
          <div className="space-y-5 p-4">
            {[[bn ? "শিক্ষার্থী" : "Student", bn ? "স্কলারশিপের সংক্ষিপ্ত তালিকা সম্পন্ন করেছে" : "Completed scholarship shortlist"], [bn ? "শিক্ষার্থী" : "Student", bn ? "GPA লক্ষ্য 3.9+ এখন চলমান" : "GPA target 3.9+ is in progress"], ["Polaris", bn ? "রোডম্যাপের ঝুঁকি পুনর্মূল্যায়ন করেছে" : "Recalculated roadmap risk"]].map(([who, text], index) => <div key={text} className="flex gap-3"><span className={`mt-1.5 h-2 w-2 rounded-full ${index === 2 ? "bg-polaris-500" : "bg-aurora-500"}`} /><div><div className="text-[10px] text-ink-muted">{who}</div><div className="mt-1 text-[12.5px] text-ink">{text}</div></div></div>)}
          </div>
          <div className="border-t border-polaris-500/10 px-4 py-3 text-[10.5px] text-ink-muted">{bn ? "শুধু আপনার তৈরি লিংক থাকা ব্যক্তিরা এটি দেখতে পারবেন।" : "Visible only to people with a link you created."}</div>
        </Card>
      </div>
    </div>
  );
}
