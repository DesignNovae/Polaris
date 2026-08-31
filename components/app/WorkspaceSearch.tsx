"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { KBD } from "./ui";
import { cn } from "@/lib/cn";

type Lang = "en" | "bn";

const ITEMS = [
  { id: "roadmap", en: "Roadmap", bn: "রোডম্যাপ", keywords: "plan milestones missions goal", icon: "⌁" },
  { id: "strategist", en: "Strategist", bn: "স্ট্র্যাটেজিস্ট", keywords: "chat polaris ai advice research", icon: "✦" },
  { id: "deadlines", en: "Deadlines", bn: "সময়সীমা", keywords: "calendar application exam", icon: "◫" },
  { id: "universities", en: "Universities", bn: "বিশ্ববিদ্যালয়", keywords: "college fit shortlist compare", icon: "◇" },
  { id: "resources", en: "Resources", bn: "রিসোর্স", keywords: "scholarship costs guides cases", icon: "□" },
  { id: "action-lab", en: "Action Lab", bn: "অ্যাকশন ল্যাব", keywords: "mock IELTS SAT routine video notes essay", icon: "△" },
  { id: "family", en: "Family and partners", bn: "পরিবার ও পার্টনার", keywords: "invite monitor digest share", icon: "○" },
  { id: "settings", en: "Settings", bn: "সেটিংস", keywords: "profile api key language account", icon: "⚙" },
] as const;

export function WorkspaceSearch({ basePath, lang }: { basePath: string; lang: Lang }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const normalized = query.trim().toLowerCase();
  const results = useMemo(() => {
    if (!normalized) return ITEMS.slice(0, 5);
    return ITEMS.filter((item) => `${item.en} ${item.bn} ${item.keywords}`.toLowerCase().includes(normalized)).slice(0, 7);
  }, [normalized]);

  const go = (id: string) => {
    setOpen(false);
    setQuery("");
    router.push(`${basePath}/${id}`.replace(/\/+/g, "/"));
  };

  return (
    <div className="relative flex-1 max-w-[420px] sm:ml-6">
      <label className="flex h-9 items-center gap-2 rounded-xl bg-white/[0.06] px-3 text-paper/70 ring-1 ring-inset ring-white/[0.10] transition-all focus-within:bg-white/[0.09] focus-within:ring-polaris-400/70 focus-within:shadow-[0_0_0_3px_rgba(196,125,78,0.16),0_4px_16px_-6px_rgba(196,125,78,0.25)]">
        <SearchGlyph />
        <input
          id="top-search"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) { event.preventDefault(); go(results[0].id); }
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder={lang === "bn" ? "খুঁজুন বা খুলুন…" : "Search or open…"}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-paper outline-none placeholder:text-paper/40"
        />
        <span className="hidden md:inline-flex"><KBD>⌘K</KBD></span>
      </label>
      <AnimatePresence>
        {open && (
          <>
            <button aria-label="Close search" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
            <motion.div initial={{ opacity: 0, y: -6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.98 }} className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-2xl border border-white/[0.10] bg-[#1d1512]/95 p-2 shadow-2xl backdrop-blur-xl">
              <div className="px-2 pb-1.5 pt-1 text-[9px] font-semibold uppercase tracking-[0.2em] text-paper/40">{lang === "bn" ? "কর্মক্ষেত্রের ফলাফল" : "Workspace results"}</div>
              {results.map((item, index) => (
                <button key={item.id} onClick={() => go(item.id)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.08]", index === 0 && normalized && "bg-white/[0.05]")}>
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-polaris-400/10 text-polaris-200">{item.icon}</span>
                  <span className="min-w-0 flex-1"><span className="block text-[12px] font-semibold text-paper">{lang === "bn" ? item.bn : item.en}</span><span className="mt-0.5 block truncate text-[9.5px] text-paper/40">{item.keywords}</span></span>
                  <span className="text-[10px] text-paper/35">↵</span>
                </button>
              ))}
              {results.length === 0 && <div className="px-3 py-8 text-center text-[11.5px] text-paper/50">{lang === "bn" ? "কোনো কর্মক্ষেত্রের ফল পাওয়া যায়নি" : "No workspace result found"}</div>}
              {normalized && <button onClick={() => { setOpen(false); window.dispatchEvent(new CustomEvent("polaris:strategist-draft", { detail: { draft: query } })); }} className="mt-1 flex w-full items-center gap-3 rounded-xl border border-polaris-400/20 bg-polaris-400/[0.08] px-3 py-2.5 text-left text-[11.5px] font-semibold text-polaris-100"><span>✦</span>{lang === "bn" ? `Polaris-কে জিজ্ঞেস করুন: “${query}”` : `Ask Polaris: “${query}”`}</button>}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function SearchGlyph() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>;
}
