"use client";

/**
 * Settings → Password change. PATCH /api/account with currentPassword +
 * newPassword. Server verifies the current password before applying.
 */

import { useState } from "react";
import { Btn } from "./ui";

export function SettingsPasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const [error, setError] = useState("");

  const mismatch = confirm.length > 0 && next !== confirm;
  const tooShort = next.length > 0 && next.length < 8;
  const valid = current.length > 0 && next.length >= 8 && next === confirm;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to update");
      }
      setStatus("ok");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus("idle"), 2400);
    }
  }

  const inputCls =
    "w-full h-10 px-3 rounded-lg bg-paper-card ring-1 ring-inset ring-polaris-500/15 text-[13.5px] text-ink outline-none focus:ring-polaris-400 transition";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12.5px] font-medium text-ink">Current password</span>
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="text-[11px] text-polaris-500 hover:text-polaris-600"
          >
            {show ? "Hide" : "Show"} passwords
          </button>
        </div>
        <input
          type={show ? "text" : "password"}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          className={inputCls}
        />
      </div>

      <div>
        <div className="text-[12.5px] font-medium text-ink mb-1">New password</div>
        <div className="text-[11.5px] text-ink-muted mb-2">At least 8 characters.</div>
        <input
          type={show ? "text" : "password"}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className={inputCls}
        />
        {tooShort && <div className="mt-1 text-[11.5px] text-rose-600">Use at least 8 characters.</div>}
      </div>

      <div>
        <div className="text-[12.5px] font-medium text-ink mb-1">Confirm new password</div>
        <input
          type={show ? "text" : "password"}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          className={inputCls}
        />
        {mismatch && <div className="mt-1 text-[11.5px] text-rose-600">Passwords don&apos;t match.</div>}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Btn variant="primary" disabled={!valid || saving} type="submit">
          {saving ? "Updating…" : "Update password"}
        </Btn>
        {status === "ok" && <span className="text-[12px] text-aurora-600">Updated ✓</span>}
        {status === "error" && <span className="text-[12px] text-rose-600">{error}</span>}
      </div>
    </form>
  );
}

