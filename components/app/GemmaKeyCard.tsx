"use client";

import { useEffect, useState } from "react";
import { Btn, Card, Pill } from "@/components/app/ui";
import { cn } from "@/lib/cn";
import { getBrowserGemmaKey, setBrowserGemmaKey } from "@/lib/gemma/browser-key";

export function GemmaKeyCard({ lang, compact = false }: { lang: "en" | "bn"; compact?: boolean }) {
  const bn = lang === "bn";
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSaved(Boolean(getBrowserGemmaKey())); }, []);

  const save = () => {
    setBrowserGemmaKey(value);
    setSaved(Boolean(value.trim()));
    setValue("");
  };

  return (
    <Card className={cn("border border-aurora-500/20 bg-aurora-500/[0.045]", compact ? "p-3.5" : "p-5")}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aurora-500/15 text-aurora-600">✦</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12.5px] font-semibold text-ink">{bn ? "নিজের AI API key" : "Use your AI API key"}</h3>
            <Pill tone={saved ? "aurora" : "ink"}>{saved ? (bn ? "এই সেশনে সক্রিয়" : "Active this session") : (bn ? "ঐচ্ছিক" : "Optional")}</Pill>
          </div>
          <p className="mt-1 text-[10.5px] leading-relaxed text-ink-muted">{bn ? "শুধু এই ব্রাউজার ট্যাবের সেশন স্টোরেজে থাকে। সার্ভারে সংরক্ষণ বা লগ করা হয় না।" : "Stored only in this browser tab's session storage. It is never saved or logged by Polaris."}</p>
          <div className="mt-3 flex gap-2">
            <input type="password" autoComplete="off" value={value} onChange={(event) => setValue(event.target.value)} placeholder={saved ? "••••••••••••••••" : "AI API key"} className="h-9 min-w-0 flex-1 rounded-lg border border-ink-faint/20 bg-bg px-3 text-[11.5px] text-ink outline-none focus:border-aurora-500" />
            <Btn size="sm" variant="outline" onClick={save}>{value.trim() ? (bn ? "ব্যবহার করুন" : "Use key") : (bn ? "মুছুন" : "Clear")}</Btn>
          </div>
        </div>
      </div>
    </Card>
  );
}
