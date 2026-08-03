"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Icon } from "@/components/app/ui";
import { useLang } from "@/lib/i18n/LangProvider";
import type { ActionLabTab } from "@/lib/action-lab/types";
import { cn } from "@/lib/cn";
import { GemmaEssayStudio, GemmaKeyCard } from "@/components/app/GemmaStudioPanels";

const COPY = {
  en: {
    eyebrow: "Polaris Action Lab",
    title: "Decide, prove, practise, repeat.",
    subtitle: "A living student operating system. Test a decision, turn claims into evidence, practise under pressure, and protect the time to follow through.",
    tabs: {
      essay: ["Essay Studio", "Write, reflect, refine"],
    },
    gemmaReady: "Gemma 4 reasoning layer",
  },
  bn: {
    eyebrow: "Polaris অ্যাকশন ল্যাব",
    title: "সিদ্ধান্ত নিন, প্রমাণ গড়ুন, অনুশীলন করুন।",
    subtitle: "শিক্ষার্থীর জন্য একটি জীবন্ত কাজের ব্যবস্থা। সিদ্ধান্তের প্রভাব যাচাই করুন, দাবিকে প্রমাণে রূপ দিন, পরীক্ষার অনুশীলন করুন এবং কাজ শেষ করার সময় নিশ্চিত করুন।",
    tabs: {
      essay: ["রচনা স্টুডিও", "লিখুন, ভাবুন, উন্নত করুন"],
    },
    gemmaReady: "Gemma 4 বিশ্লেষণ ব্যবস্থা",
  },
} as const;

export function ActionLabClient() {
  const { lang } = useLang();
  const copy = COPY[lang];
  const [tab, setTab] = useState<ActionLabTab>("essay");

  const chooseTab = (id: ActionLabTab) => {
    setTab(id);
  };

  return (
    <div className="relative min-h-full overflow-hidden">
      <style jsx global>{`
        .action-lab-grid {
          background-image:
            linear-gradient(rgba(196, 125, 78, .12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(196, 125, 78, .12) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: linear-gradient(to bottom, black, transparent);
        }
      `}</style>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 right-[-10%] h-[420px] w-[420px] rounded-full bg-polaris-500/[0.10] blur-[100px]" />
        <div className="absolute top-[35%] -left-24 h-[320px] w-[320px] rounded-full bg-aurora-500/[0.08] blur-[90px]" />
        <div className="absolute inset-x-0 top-0 h-44 opacity-[0.16] action-lab-grid" />
      </div>

      <div className="relative mx-auto max-w-[1240px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="mb-5 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-polaris-500">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-polaris-500/10 text-polaris-500"><Icon.spark size={14} /></span>
              {copy.eyebrow}
            </div>
            <h1 className="max-w-3xl font-serif text-[34px] font-bold leading-[1.04] tracking-tight text-ink sm:text-[43px]">
              {copy.title}
            </h1>
            <p className="mt-3 max-w-3xl text-[13.5px] leading-relaxed text-ink-dim">{copy.subtitle}</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-aurora-500/25 bg-aurora-500/[0.08] px-3 py-2 text-[11px] font-medium text-aurora-700 dark:text-aurora-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-500 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-500" />
            </span>
            {copy.gemmaReady}
          </div>
        </header>

        <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-ink-faint/20 bg-paper-card/80 p-2 shadow-card backdrop-blur-xl md:grid-cols-4 xl:grid-cols-7">
          {(Object.keys(copy.tabs) as ActionLabTab[]).map((id) => {
            const [label, hint] = copy.tabs[id as keyof typeof copy.tabs];
            return (
              <button
                key={id}
                type="button"
                onClick={() => chooseTab(id)}
                className={cn(
                  "relative rounded-xl px-3 py-3 text-left transition-colors",
                  tab === id ? "text-paper" : "text-ink-dim hover:bg-paper-deep/60 hover:text-ink",
                )}
              >
                {tab === id && (
                  <motion.span
                    layoutId="action-tab"
                    className="absolute inset-0 rounded-xl bg-ink shadow-pop"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative block text-[12.5px] font-semibold">{label}</span>
                <span className={cn("relative mt-0.5 hidden text-[10px] md:block", tab === id ? "text-paper/55" : "text-ink-muted")}>{hint}</span>
              </button>
            );
          })}
        </div>

        <details className="group mb-5 ml-auto max-w-xl rounded-2xl border border-aurora-500/15 bg-paper-card/65 p-2 open:shadow-card">
          <summary className="cursor-pointer list-none px-2 py-1 text-right text-[10.5px] font-semibold text-aurora-700 dark:text-aurora-100">
            {lang === "bn" ? "নিজের Gemma API key ব্যবহার করুন" : "Use your own Gemma API key"}
          </summary>
          <div className="mt-2"><GemmaKeyCard lang={lang} compact /></div>
        </details>

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22 }}
          >
            {tab === "essay" && <GemmaEssayStudio lang={lang} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
