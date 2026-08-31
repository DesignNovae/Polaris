"use client";

/**
 * Settings → Notifications + Appearance + Marketplace toggles.
 *
 * Notification preferences and the marketplace mute toggle persist to the
 * signed-in account and keep a local copy for immediate hydration.
 *
 * Theme: "light" / "dark" / "auto". Writes `data-theme` on <html> and
 * stores the choice in localStorage. The dark-mode CSS variables for the
 * workspace are still being filled in - the toggle is functional, the
 * visual coverage is a follow-up pass (see MIGRATION_NOTES).
 */

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { useTheme, type ThemePreference } from "@/components/app/ThemeProvider";

const LS_NOTIFY = "polaris.prefs.notify";
const LS_MARKETPLACE = "polaris.prefs.marketplace";

export type NotifyPrefs = {
  weeklyDigest: boolean;
  deadlineReminders: boolean;
  strategistInsights: boolean;
  familyDigest: boolean;
};
const DEFAULT_NOTIFY: NotifyPrefs = {
  weeklyDigest: true,
  deadlineReminders: true,
  strategistInsights: true,
  familyDigest: true,
};

export function SettingsNotifications({ initial }: { initial?: Partial<NotifyPrefs> }) {
  const [prefs, setPrefs] = useState<NotifyPrefs>({ ...DEFAULT_NOTIFY, ...initial });
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_NOTIFY);
      if (raw && !initial) setPrefs({ ...DEFAULT_NOTIFY, ...JSON.parse(raw) });
    } catch { /* ignore */ }
    setHydrated(true);
  }, [initial]);

  async function update<K extends keyof NotifyPrefs>(key: K, value: NotifyPrefs[K]) {
    const next = { ...prefs, [key]: value };
    setPrefs(next);
    try { localStorage.setItem(LS_NOTIFY, JSON.stringify(next)); } catch { /* ignore */ }
    setStatus("Saving…");
    try {
      const response = await fetch("/api/account/preferences", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ notifications: next }),
      });
      if (!response.ok) throw new Error();
      setStatus("Saved");
    } catch {
      setStatus("Could not sync");
    }
  }

  const rows: { k: keyof NotifyPrefs; label: string; hint: string }[] = [
    { k: "weeklyDigest",       label: "Weekly digest",        hint: "Sunday summary of progress + next-week focus." },
    { k: "deadlineReminders",  label: "Deadline reminders",   hint: "Pings 7 / 3 / 1 day before any hard deadline." },
    { k: "strategistInsights", label: "Strategist insights",  hint: "Push when the agent flags a probability shift or replan." },
    { k: "familyDigest",       label: "Family digest",         hint: "Weekly digest the Strategist sends to your linked viewers." },
  ];

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <ToggleRow
          key={r.k}
          label={r.label}
          hint={r.hint}
          checked={prefs[r.k]}
          onChange={(v) => void update(r.k, v)}
          disabled={!hydrated}
        />
      ))}
      <div className="mt-3 text-[11.5px] text-ink-muted italic">
        Preferences sync to your Polaris account. {status}
      </div>
    </div>
  );
}

export function SettingsAppearance() {
  const { preference, set: setTheme } = useTheme();
  const [glass, setGlass] = useState<"soft" | "default" | "strong">("default");

  useEffect(() => {
    try {
      const g = (localStorage.getItem("polaris.prefs.glass") as typeof glass | null) ?? "default";
      setGlass(g);
      document.documentElement.dataset.glass = g;
    } catch { /* ignore */ }
  }, []);

  function pickGlass(g: typeof glass) {
    setGlass(g);
    try { localStorage.setItem("polaris.prefs.glass", g); } catch { /* ignore */ }
    document.documentElement.dataset.glass = g;
  }

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[12.5px] font-medium text-ink mb-2">Theme</div>
        <Segment
          value={preference}
          onChange={(v) => setTheme(v as ThemePreference)}
          options={[
            { value: "light", label: "Light" },
            { value: "dark",  label: "Dark" },
            { value: "auto",  label: "System" },
          ]}
        />
        <div className="mt-2 text-[11.5px] text-ink-muted">
          Your choice stays active while you move between workspace pages.
        </div>
      </div>

      <div>
        <div className="text-[12.5px] font-medium text-ink mb-2">Glass intensity</div>
        <Segment
          value={glass}
          onChange={(v) => pickGlass(v as typeof glass)}
          options={[
            { value: "soft",    label: "Soft" },
            { value: "default", label: "Default" },
            { value: "strong",  label: "Strong" },
          ]}
        />
        <div className="mt-2 text-[11.5px] text-ink-muted">
          Adjust the backdrop-blur strength on floating panels (nav, agent rail, modals).
        </div>
      </div>
    </div>
  );
}

export function SettingsMarketplace({ initial = false }: { initial?: boolean }) {
  const [mute, setMute] = useState(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      if (!initial) setMute(localStorage.getItem(LS_MARKETPLACE) === "muted");
    } catch { /* ignore */ }
    setHydrated(true);
  }, [initial]);

  async function toggle(v: boolean) {
    setMute(v);
    try { localStorage.setItem(LS_MARKETPLACE, v ? "muted" : "shown"); } catch { /* ignore */ }
    await fetch("/api/account/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hidePartnerOffers: v }),
    }).catch(() => undefined);
  }

  return (
    <ToggleRow
      label="Hide partner offers"
      hint="Mutes the Partner offers strip and the /partners page recommendations. The Strategist won't surface a partner in chat either."
      checked={mute}
      onChange={(value) => void toggle(value)}
      disabled={!hydrated}
    />
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────────── */

function ToggleRow({
  label, hint, checked, onChange, disabled,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-4 p-3 rounded-xl border transition-colors cursor-pointer",
        checked ? "bg-paper-card border-polaris-500/15" : "bg-paper-soft border-transparent",
        disabled && "opacity-50 cursor-default",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-ink">{label}</div>
        {hint && <div className="text-[11.5px] text-ink-dim mt-0.5 leading-relaxed">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "shrink-0 mt-0.5 h-5 w-9 rounded-full ring-1 ring-inset transition-colors relative",
          checked ? "bg-aurora-500 ring-aurora-600" : "bg-paper-deep ring-polaris-500/20",
        )}
      >
        <span
          className={cn(
            // left-0 anchors the knob: without it, the button's centered
            // static position pushed the knob outside the track when checked.
            "absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-[18px]" : "translate-x-0.5",
          )}
        />
      </button>
    </label>
  );
}

function Segment<T extends string>({
  options, value, onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex p-0.5 bg-paper-soft rounded-lg ring-1 ring-inset ring-polaris-500/10">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-8 px-3 text-[12.5px] font-medium rounded-md transition-colors",
            value === o.value ? "bg-paper-card text-ink shadow-sm" : "text-ink-dim hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
