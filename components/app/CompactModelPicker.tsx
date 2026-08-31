"use client";

import { cn } from "@/lib/cn";
import { useLang } from "@/lib/i18n/LangProvider";

type Tier = "free" | "paid" | "local";

export type CmpRouteMode = "fast" | "balanced" | "advanced" | "reasoning";
export type CmpModel = {
  providerId: string;
  providerName: string;
  modelId: string;
  modelLabel: string;
  tier: Tier;
  legacy: boolean;
};
export type CmpProvider = {
  id: string;
  name: string;
  configured: boolean;
  models: Array<{ id: string; label: string; tier: Tier; legacy?: boolean }>;
};
export type CmpChoice = { providerId: string; modelId: string } | "auto";

type Props = {
  model: CmpChoice;
  setModel: (m: CmpChoice) => void;
  availableModels: CmpModel[];
  providers: CmpProvider[];
  allowPaid: boolean;
  setAllowPaid: (b: boolean) => void;
  offline: boolean;
  setOffline: (b: boolean) => void;
  onRefresh: () => Promise<void> | void;
  theme: "light" | "dark";
  modeChip?: string;
  direction?: "up" | "down";
  routeMode?: CmpRouteMode;
  setRouteMode?: (m: CmpRouteMode) => void;
};

const PRESETS: Array<{ id: CmpRouteMode; en: string; bn: string }> = [
  { id: "fast", en: "Fast", bn: "দ্রুত" },
  { id: "balanced", en: "Balanced", bn: "ভারসাম্যপূর্ণ" },
  { id: "reasoning", en: "Deep", bn: "গভীর" },
];

/**
 * Competition model control. The server independently enforces the same
 * Gemma-only boundary, so persisted legacy preferences cannot change models.
 */
export function CompactModelPicker({
  theme,
  modeChip,
  routeMode = "balanced",
  setRouteMode,
}: Props) {
  const dark = theme === "dark";
  const { lang, translate } = useLang();
  const localizedMode = modeChip ? translate(modeChip) : "";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2",
        dark
          ? "border-white/15 bg-white/[0.05] text-paper"
          : "border-polaris-200 bg-paper-card text-ink",
      )}
      aria-label={lang === "bn" ? "Polaris AI নিয়ন্ত্রণ" : "Polaris AI controls"}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-400 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-500" />
          </span>
          <span className="truncate text-[12px] font-semibold" data-no-translate>Polaris AI</span>
          <span className="rounded-full bg-aurora-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-aurora-500">
            {lang === "bn" ? "একমাত্র ভাষা মডেল" : "Only LLM"}
          </span>
        </div>
        <div className={cn("mt-0.5 text-[10px]", dark ? "text-paper/50" : "text-ink-muted")}>
          {localizedMode ? `${localizedMode} · ` : ""}
          {lang === "bn" ? "Google-এ হোস্ট করা উন্মুক্ত মডেল" : "Google-hosted open model"}
        </div>
      </div>
      <div className="flex shrink-0 items-center rounded-lg bg-black/[0.04] p-0.5 dark:bg-white/[0.06]">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => setRouteMode?.(preset.id)}
            className={cn(
              "rounded-md px-2 py-1 text-[9px] font-semibold transition-colors",
              routeMode === preset.id || (preset.id === "reasoning" && routeMode === "advanced")
                ? "bg-polaris-500 text-white shadow-sm"
                : dark
                  ? "text-paper/55 hover:text-paper"
                  : "text-ink-muted hover:text-ink",
            )}
          >
            {lang === "bn" ? preset.bn : preset.en}
          </button>
        ))}
      </div>
    </div>
  );
}
