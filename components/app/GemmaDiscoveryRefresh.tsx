"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Btn, Card, Icon, Pill } from "@/components/app/ui";
import { gemmaHeaders } from "@/lib/gemma/browser-key";
import { useLang } from "@/lib/i18n/LangProvider";

type Item = {
  title: string;
  subtitle: string;
  why: string;
  action: string;
  sourceLabel: string;
};

export function GemmaDiscoveryRefresh({
  surface,
  defaultQuery,
  compact = false,
}: {
  surface: "universities" | "resources" | "case-studies";
  defaultQuery: string;
  compact?: boolean;
}) {
  const { lang } = useLang();
  const bn = lang === "bn";
  const bengaliDefault = surface === "universities"
    ? "বাংলাদেশি শিক্ষার্থীর জন্য আর্থিক সহায়তা, কম্পিউটার সায়েন্স ও বাস্তবসম্মত বিশ্ববিদ্যালয়"
    : surface === "resources"
      ? "বাংলাদেশি শিক্ষার্থীর জন্য স্কলারশিপ, অফিসিয়াল পরীক্ষা প্রস্তুতি, খরচ ও আবেদন নির্দেশিকা"
      : "বাংলাদেশ ও দক্ষিণ এশিয়ার শিক্ষার্থীদের প্রমাণভিত্তিক ভর্তি সাফল্যের ধরন";
  const [query, setQuery] = useState(defaultQuery);
  useEffect(() => { setQuery(lang === "bn" ? bengaliDefault : defaultQuery); }, [lang, defaultQuery, bengaliDefault]);
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [trace, setTrace] = useState("");
  const [error, setError] = useState("");

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/gemma-studio", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-polaris-language": lang, ...gemmaHeaders() },
        body: JSON.stringify({ kind: "discover", surface, query }),
      });
      const data = await response.json() as { items?: Item[]; source?: string; model?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Refresh failed");
      setItems(data.items || []);
      setTrace(data.source === "gemma4" ? `Gemma 4 · ${data.model}` : (bn ? "প্রমাণের প্রিভিউ" : "Evidence preview"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (bn ? "হালনাগাদ করা যায়নি।" : "Could not refresh."));
    } finally { setBusy(false); }
  };

  return (
    <Card className={compact ? "border border-aurora-500/20 p-3.5" : "mb-5 border border-aurora-500/20 bg-gradient-to-r from-aurora-500/[0.06] via-paper-card to-polaris-500/[0.05] p-4"}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-[270px]">
          <div className="flex items-center gap-2"><Pill tone="aurora"><Icon.spark size={11} /> Gemma 4</Pill>{trace && <span className="text-[9px] text-ink-muted">{trace}</span>}</div>
          <h3 className="mt-2 font-serif text-[17px] font-bold text-ink">{bn ? "প্রমাণভিত্তিক তালিকা হালনাগাদ করুন" : "Refresh the evidence-backed list"}</h3>
        </div>
        <div className="flex min-w-0 flex-1 gap-2">
          <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void refresh(); }} className="h-10 min-w-0 flex-1 rounded-xl border border-ink-faint/20 bg-bg/70 px-3 text-[12px] text-ink outline-none focus:border-aurora-500" />
          <Btn variant="accent" disabled={busy || query.trim().length < 2} onClick={() => void refresh()} icon={<Icon.spark size={12} />}>{busy ? (bn ? "Gemma খুঁজছে…" : "Refreshing…") : (bn ? "Gemma দিয়ে হালনাগাদ" : "Refresh with Gemma")}</Btn>
        </div>
      </div>
      {error && <p className="mt-2 text-[10.5px] text-signal-rose">{error}</p>}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            {items.map((item, index) => (
              <div key={`${item.title}-${index}`} className="rounded-xl border border-ink-faint/15 bg-bg/55 p-3">
                <div className="text-[9px] font-semibold uppercase tracking-wider text-aurora-600">{item.sourceLabel}</div>
                <h4 className="mt-1 text-[12px] font-semibold leading-snug text-ink">{item.title}</h4>
                <p className="mt-1 text-[10px] text-ink-muted">{item.subtitle}</p>
                <p className="mt-2 text-[10.5px] leading-relaxed text-ink-dim">{item.why}</p>
                <div className="mt-2 rounded-lg bg-polaris-500/[0.06] px-2.5 py-2 text-[10px] font-medium leading-relaxed text-polaris-700 dark:text-polaris-100">{item.action}</div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
