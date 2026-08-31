"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Btn } from "@/components/app/ui";
import { RelationshipSelect } from "@/components/app/RelationshipSelect";
import type { LinkRelationship } from "@/lib/db/collections";

export function FamilyMemberActions({
  id,
  relationship,
}: {
  id: string;
  relationship: LinkRelationship;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function changeRelationship() {
    setBusy(true);
    setError("");
    const next: LinkRelationship = relationship === "parent" ? "partner" : "parent";
    try {
      const response = await fetch(`/api/links?id=${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ relationship: next }),
      });
      if (!response.ok) throw new Error("Could not update access");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update access");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm("Remove this viewer from your support circle?")) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/links?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not remove viewer");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove viewer");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Btn size="sm" variant="ghost" disabled={busy} onClick={() => void changeRelationship()}>
          Change to {relationship === "parent" ? "partner" : "parent"}
        </Btn>
        <Btn size="sm" variant="link" disabled={busy} onClick={() => void remove()} className="text-signal-rose hover:text-signal-rose">
          Remove
        </Btn>
      </div>
      {error && <p className="mt-1 text-[11px] text-signal-rose" role="alert">{error}</p>}
    </div>
  );
}

export function FamilyInviteForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(formData: FormData) {
    setBusy(true);
    setError("");
    setInviteUrl("");
    setCopied(false);
    try {
      const response = await fetch("/api/links", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: formData.get("email"),
          relationship: formData.get("relationship"),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "Could not create invite");
      setInviteUrl(`${window.location.origin}/monitor?accept=${encodeURIComponent(body.inviteToken)}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create invite");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <div className="mt-3">
      <form action={(data) => void submit(data)} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input name="email" type="email" required placeholder="email@example.com" className="h-9 min-w-0 flex-1 rounded-lg bg-paper-card px-3 text-[13px] outline-none hairline placeholder-ink-muted" />
        <RelationshipSelect />
        <Btn size="md" variant="primary" type="submit" disabled={busy}>{busy ? "Creating…" : "Create invite"}</Btn>
      </form>
      {inviteUrl && (
        <div className="mt-3 rounded-xl bg-paper-card p-3 hairline">
          <div className="text-[11px] font-semibold text-ink">Invite created</div>
          <div className="mt-1 break-all font-mono text-[10.5px] text-ink-dim">{inviteUrl}</div>
          <Btn size="sm" variant="outline" className="mt-2" onClick={() => void copyInvite()}>{copied ? "Copied" : "Copy invite link"}</Btn>
        </div>
      )}
      {error && <p className="mt-2 text-[11px] text-signal-rose" role="alert">{error}</p>}
    </div>
  );
}
