"use client";

/**
 * Deadline reminder delivery.
 *
 * One rule shapes this panel: never accept a preference that cannot be
 * honoured. If no SMS gateway is configured on this deployment, the toggle
 * says so and stays disabled rather than saving a setting that silently does
 * nothing - which is exactly how "I turned reminders on and got nothing"
 * happens.
 */

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";

type Prefs = {
  email: boolean;
  sms: boolean;
  phone?: string;
  defaultOffsets: number[];
};

const OFFSETS = [30, 14, 7, 3, 1, 0];

const offsetLabel = (d: number) =>
  d === 0 ? "On the day" : d === 1 ? "1 day before" : `${d} days before`;

export function SettingsReminders() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [available, setAvailable] = useState({ email: false, sms: false });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        if (!res.ok) throw new Error("Could not load your reminder settings");
        const d = await res.json();
        setPrefs({
          email: d.prefs.email,
          sms: d.prefs.sms,
          phone: d.prefs.phone ?? "",
          defaultOffsets: d.prefs.defaultOffsets ?? [],
        });
        setAvailable(d.available);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    })();
  }, []);

  const save = useCallback(async (patch: Partial<Prefs>) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Could not save");
      const d = await res.json();
      setPrefs({
        email: d.prefs.email,
        sms: d.prefs.sms,
        phone: d.prefs.phone ?? "",
        defaultOffsets: d.prefs.defaultOffsets ?? [],
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, []);

  if (!prefs) {
    return <p className="text-[13px] text-ink-dim">{error || "Loading…"}</p>;
  }

  const offsets = prefs.defaultOffsets;

  function toggleOffset(d: number) {
    const next = offsets.includes(d)
      ? offsets.filter((x) => x !== d)
      : [...offsets, d];
    void save({ defaultOffsets: next });
  }

  return (
    <div>
      <h3 className="text-[14px] font-semibold text-ink">Deadline reminders</h3>
      <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-ink-dim">
        Sent once per deadline per channel. A missed scholarship deadline is the
        one thing this product cannot undo for you.
      </p>

      <div className="mt-4 space-y-2.5">
        <ChannelRow
          label="Email"
          hint="Goes to your account email."
          checked={prefs.email}
          available={available.email}
          onChange={(v) => save({ email: v })}
        />
        <ChannelRow
          label="SMS"
          hint="A text reaches you when an inbox does not."
          checked={prefs.sms}
          available={available.sms}
          onChange={(v) => save({ sms: v })}
        />
      </div>

      {prefs.sms && available.sms && (
        <label className="mt-4 block">
          <span className="text-[12px] font-semibold text-ink">Mobile number</span>
          <input
            type="tel"
            defaultValue={prefs.phone}
            onBlur={(e) => save({ phone: e.target.value })}
            placeholder="01712 345678"
            className="mt-1.5 w-full max-w-xs rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
          />
          <span className="mt-1 block text-[11.5px] text-ink-dim">
            Bangladeshi numbers, any format. Stored normalised.
          </span>
        </label>
      )}

      <div className="mt-5">
        <span className="text-[12px] font-semibold text-ink">When to remind you</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {OFFSETS.map((d) => {
            const on = offsets.includes(d);
            return (
              <button
                key={d}
                type="button"
                disabled={saving}
                onClick={() => toggleOffset(d)}
                aria-pressed={on}
                className={cn(
                  "rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-60",
                  on
                    ? "bg-polaris-500 text-paper"
                    : "bg-paper-soft text-ink-dim hover:text-ink dark:bg-white/[0.05]",
                )}
              >
                {offsetLabel(d)}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11.5px] text-ink-dim">
          A deadline with its own reminder schedule uses that instead.
        </p>
      </div>

      {error && <p className="mt-3 text-[12px] text-rose-600">{error}</p>}
      {saved && (
        <p className="mt-3 text-[12px] text-aurora-700 dark:text-aurora-300">Saved.</p>
      )}
    </div>
  );
}

function ChannelRow({
  label, hint, checked, available, onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  available: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-xl border p-3.5",
        available
          ? "cursor-pointer border-polaris-500/12 bg-paper-soft dark:bg-white/[0.03]"
          : "border-dashed border-polaris-500/15 opacity-70",
      )}
    >
      <input
        type="checkbox"
        checked={checked && available}
        disabled={!available}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 accent-polaris-500"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="block text-[12px] text-ink-dim">
          {available
            ? hint
            : `Not available on this deployment yet - no ${label.toLowerCase()} provider is configured.`}
        </span>
      </span>
    </label>
  );
}
