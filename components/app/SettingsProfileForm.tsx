"use client";

/**
 * Settings → Profile form. PATCH /api/account with the new display name.
 * Email is read-only (identity field, changing it would invalidate the
 * Clerk session); same for role (controlled by admin).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "./ui";

export function SettingsProfileForm({
  initialName,
  email,
  role,
}: {
  initialName: string;
  email: string;
  role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() === initialName) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update");
      }
      setStatus("ok");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 2200);
    }
  }

  const dirty = name.trim() !== initialName && name.trim().length > 0;

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Display name" hint="Shown in greetings, family digests, and shared links.">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          className="w-full h-10 px-3 rounded-lg bg-paper-card ring-1 ring-inset ring-polaris-500/15 text-[13.5px] text-ink outline-none focus:ring-polaris-400 transition"
        />
      </Field>
      <Field label="Email" hint="Used for sign-in and invite addressing. Contact support to change.">
        <input
          type="email"
          value={email}
          readOnly
          className="w-full h-10 px-3 rounded-lg bg-paper-soft ring-1 ring-inset ring-polaris-500/10 text-[13.5px] text-ink-dim outline-none cursor-not-allowed"
        />
      </Field>
      <Field label="Role" hint="Determined by how you signed up; admin-controlled.">
        <input
          type="text"
          value={role}
          readOnly
          className="w-full h-10 px-3 rounded-lg bg-paper-soft ring-1 ring-inset ring-polaris-500/10 text-[13.5px] text-ink-dim outline-none cursor-not-allowed capitalize"
        />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <Btn variant="primary" disabled={!dirty || saving} type="submit">
          {saving ? "Saving…" : "Save profile"}
        </Btn>
        {status === "ok" && <span className="text-[12px] text-aurora-600">Saved ✓</span>}
        {status === "error" && <span className="text-[12px] text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium text-ink mb-1">{label}</div>
      {hint && <div className="text-[11.5px] text-ink-muted mb-2">{hint}</div>}
      {children}
    </label>
  );
}

