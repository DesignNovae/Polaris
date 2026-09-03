"use client";

/**
 * Client island for the Settings "Data controls" section. Export downloads
 * the user's data as JSON; delete cascades through deleteUserCascade and
 * signs the user out. Both hit auth-guarded routes under /api/account/*.
 */

import { useState } from "react";
import { useSignOut } from "@/components/SessionProvider";
import { Btn, Tag } from "./ui";

export function SettingsDataControls() {
  const signOut = useSignOut();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function exportData() {
    setError("");
    try {
      const res = await fetch("/api/account/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "polaris-data.json";
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  async function deleteAccount() {
    if (!confirm("This permanently deletes your roadmap, chat history, and connections. Continue?")) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete account");
      await signOut({ callbackUrl: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Btn variant="outline" size="sm" onClick={exportData} disabled={busy}>Export my data</Btn>
        <Btn variant="link" size="sm" className="text-rose-600 hover:text-rose-600" onClick={deleteAccount} disabled={busy}>
          Delete my account
        </Btn>
        <Tag tone="ink">Permanent</Tag>
      </div>
      {error && <span className="text-[11px] text-rose-600">{error}</span>}
    </div>
  );
}

