"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { useLang } from "@/lib/i18n/LangProvider";
import { CompassLogo } from "@/components/Nav";

const orbitDots = [
  { size: 9, x: "18%", y: "20%", delay: 0 },
  { size: 6, x: "74%", y: "18%", delay: 0.8 },
  { size: 8, x: "86%", y: "72%", delay: 1.4 },
  { size: 5, x: "42%", y: "82%", delay: 2.1 },
];

export function Footer() {
  const { t, lang } = useLang();
  const bn = lang === "bn";
  const copy = bn ? {
    kicker: "পরবর্তী পদক্ষেপটি এখনই নিন",
    title: "পরিকল্পনাকে অগ্রগতিতে পরিণত করুন।",
    body: "Gemma 4 দিয়ে আপনার লক্ষ্য, প্রমাণ, সময়সীমা ও দৈনিক কাজকে একই জীবন্ত পরিকল্পনায় আনুন।",
    primary: "আজই বিনামূল্যে শুরু করুন",
    secondary: "সাইন ইন",
    product: "প্রোডাক্ট",
    workspace: "ওয়ার্কস্পেস",
    account: "অ্যাকাউন্ট",
    status: "সিস্টেম সচল",
    gemma: "Gemma 4 দ্বারা চালিত",
    note: "শিক্ষার্থীর সিদ্ধান্ত সহায়তার জন্য তৈরি",
    links: {
      how: "কীভাবে কাজ করে", pricing: "মূল্য", roadmap: "রোডম্যাপ",
      strategist: "স্ট্র্যাটেজিস্ট", deadlines: "সময়সীমা", universities: "বিশ্ববিদ্যালয়", action: "অ্যাকশন ল্যাব",
      signup: "অ্যাকাউন্ট খুলুন", signin: "সাইন ইন", account: "অ্যাকাউন্ট", github: "সোর্স কোড",
    },
  } : {
    kicker: "Your next move starts here",
    title: "Turn planning into momentum.",
    body: "Bring goals, evidence, deadlines, and daily work into one living plan powered by Gemma 4.",
    primary: "Start for free today",
    secondary: "Sign in",
    product: "Product",
    workspace: "Workspace",
    account: "Access",
    status: "All systems operational",
    gemma: "Powered by Gemma 4",
    note: "Built for student decision support",
    links: {
      how: "How it works", pricing: "Pricing", roadmap: "Roadmap",
      strategist: "Strategist", deadlines: "Deadlines", universities: "Universities", action: "Action Lab",
      signup: "Create account", signin: "Sign in", account: "Account", github: "Source code",
    },
  };

  const groups = [
    { title: copy.product, links: [
      ["/#how", copy.links.how], ["/#pricing", copy.links.pricing], ["/roadmap", copy.links.roadmap],
    ] },
    { title: copy.workspace, links: [
      ["/strategist", copy.links.strategist], ["/deadlines", copy.links.deadlines], ["/universities", copy.links.universities], ["/action-lab", copy.links.action],
    ] },
    { title: copy.account, links: [
      ["/signup", copy.links.signup], ["/signin", copy.links.signin], ["/account", copy.links.account], ["https://github.com/DesignNovae/Polaris", copy.links.github],
    ] },
  ] as const;

  return (
    <footer id="footer" data-section-theme="light" className="relative overflow-hidden bg-paper text-ink border-t border-ink/10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 pt-10 sm:pt-14">
        <div className="relative overflow-hidden rounded-[28px] bg-ink text-paper shadow-[0_30px_80px_-38px_rgba(34,18,12,0.75)] ring-1 ring-white/10">
          <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(196,125,78,0.28),transparent_36%),radial-gradient(circle_at_82%_70%,rgba(87,145,111,0.20),transparent_34%)]" />
          <motion.div aria-hidden className="absolute -right-24 -top-28 h-80 w-80 rounded-full border border-white/10" animate={{ rotate: 360 }} transition={{ duration: 42, repeat: Infinity, ease: "linear" }} />
          <motion.div aria-hidden className="absolute -right-8 -top-12 h-48 w-48 rounded-full border border-polaris-300/20" animate={{ rotate: -360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
          {orbitDots.map((dot, index) => (
            <motion.span key={index} aria-hidden className="absolute rounded-full bg-polaris-300 shadow-[0_0_18px_rgba(221,166,124,0.8)]" style={{ width: dot.size, height: dot.size, left: dot.x, top: dot.y }} animate={{ y: [0, -8, 0], opacity: [0.45, 1, 0.45] }} transition={{ duration: 3.5, repeat: Infinity, delay: dot.delay, ease: "easeInOut" }} />
          ))}

          <div className="relative grid gap-8 px-6 py-8 sm:px-10 sm:py-11 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 text-[10px] uppercase tracking-[0.22em] text-paper/75">
                <span className="h-1.5 w-1.5 rounded-full bg-aurora-400 shadow-[0_0_10px_rgba(105,183,134,0.9)]" />
                {copy.kicker}
              </div>
              <h2 className="mt-4 font-serif text-[32px] font-bold leading-[1.02] tracking-tight sm:text-[44px] lg:text-[52px]">
                {copy.title}
              </h2>
              <p className="mt-4 max-w-xl text-[13.5px] leading-relaxed text-paper/68 sm:text-[15px]">{copy.body}</p>
              <div className="mt-5 flex flex-wrap gap-2 text-[10.5px] text-paper/65">
                {[copy.gemma, copy.status, bn ? "বাংলা ও English" : "English and Bengali"].map((item, index) => (
                  <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1.5">
                    <span className={index === 1 ? "h-1.5 w-1.5 rounded-full bg-aurora-400" : "text-polaris-300"}>{index === 1 ? "" : "✦"}</span>{item}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
              <FooterButton href="/signup" primary>{copy.primary}</FooterButton>
              <FooterButton href="/signin">{copy.secondary}</FooterButton>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-9 py-10 sm:py-12 md:grid-cols-5">
          <div className="col-span-2 max-w-sm">
            <AnimatedLogo />
            <p className="mt-3 text-[13px] leading-relaxed text-ink-dim">{t.footer.tagline}</p>
            <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-paper-card px-3 py-1.5 text-[10.5px] text-ink-dim ring-1 ring-inset ring-ink/10">
              <span className="relative flex h-1.5 w-1.5"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-500 opacity-70" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-aurora-500" /></span>
              {copy.status}
            </div>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-muted">{group.title}</div>
              <ul className="mt-3 space-y-2.5">
                {group.links.map(([href, label]) => (
                  <li key={href}><Link href={href} className="group inline-flex items-center gap-1 text-[13px] text-ink-dim transition-colors hover:text-ink">{label}<span className="translate-x-0 text-signal-rose opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100">→</span></Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-ink/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-5 text-center text-[11px] text-ink-muted sm:flex-row sm:text-left">
          <span>© {new Date().getFullYear()} Polaris. {copy.note}.</span>
          <span className="font-mono">EN / বাংলা · Gemma 4 · v1.0</span>
        </div>
      </div>
    </footer>
  );
}

function AnimatedLogo() {
  return (
    <Link href="/" className="inline-flex">
      <motion.span className="relative flex items-center gap-2.5" whileHover="hover" initial="rest">
        <motion.span aria-hidden className="absolute -inset-2 rounded-full bg-polaris-400/15 blur-xl" variants={{ rest: { opacity: 0 }, hover: { opacity: 1 } }} />
        <motion.span className="relative inline-flex" variants={{ rest: { rotate: 0 }, hover: { rotate: 360 } }} transition={{ duration: 1.2, ease: "easeInOut" }}><CompassLogo /></motion.span>
        <span className="relative font-serif text-[18px] font-bold tracking-tight text-ink">Polaris</span>
      </motion.span>
    </Link>
  );
}

function FooterButton({ href, primary, children }: { href: string; primary?: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={primary ? "group inline-flex min-w-[190px] items-center justify-between rounded-full bg-paper px-5 py-3 text-[13px] font-semibold text-ink shadow-lg transition-transform hover:-translate-y-0.5" : "group inline-flex min-w-[190px] items-center justify-between rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-white/[0.11]"}>
      <span>{children}</span><span className="transition-transform group-hover:translate-x-1">→</span>
    </Link>
  );
}