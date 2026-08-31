"use client";

import { useEffect, useState, useCallback } from "react";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { cn } from "@/lib/cn";

type Row = {
  id: string;
  name: string;
  email: string;
  role: "student" | "parent" | "partner" | "admin";
  plan: "free" | "pro" | "elite";
  createdAt: string;
};

const ROLES = ["student", "parent", "partner", "admin"] as const;
const PLANS = ["free", "pro", "elite"] as const;

export default function AdminUsersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    if (res.ok) {
      const d = await res.json();
      setRows(d.users ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function update(id: string, patch: Partial<Pick<Row, "role" | "plan">>) {
    setBusyId(id);
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id, ...patch }),
    });
    setBusyId(null);
  }

  async function remove(id: string, email: string) {
    if (!confirm(`Delete ${email}? This removes their profile, roadmaps, and links. This cannot be undone.`)) return;
    setBusyId(id);
    const res = await fetch("/api/admin/users", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: id }),
    });
    setBusyId(null);
    if (res.ok) {
      setRows((prev) => prev.filter((r) => r.id !== id));
    } else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Failed to delete");
    }
  }

  const filtered = rows.filter(
    (r) =>
      r.email.toLowerCase().includes(q.toLowerCase()) ||
      r.name.toLowerCase().includes(q.toLowerCase()),
  );

  if (loading) return <p className="text-ink-dim">Loading users…</p>;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or email…"
          className="w-64 max-w-full rounded-full border border-polaris-200 bg-white px-4 py-2 text-sm focus:border-polaris-400 focus:outline-none"
        />
        <span className="text-xs text-ink-muted">{filtered.length} users</span>
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-muted border-b border-polaris-500/15">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={cn("border-b border-polaris-500/10", busyId === r.id && "opacity-50")}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{r.name}</div>
                    <div className="text-xs text-ink-muted">{r.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <PremiumSelect
                      value={r.role}
                      onChange={(v) => update(r.id, { role: v as Row["role"] })}
                      size="sm"
                      options={ROLES.map((x) => ({ value: x, label: x }))}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <PremiumSelect
                      value={r.plan}
                      onChange={(v) => update(r.id, { plan: v as Row["plan"] })}
                      size="sm"
                      options={PLANS.map((x) => ({ value: x, label: x }))}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => remove(r.id, r.email)}
                      className="text-xs rounded-full border border-nova-500/40 text-nova-500 px-3 py-1 hover:bg-nova-500/10 transition-colors"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">
        Changing a plan here comps the user (no payment). Changing role to admin grants full control-panel access.
      </p>
    </div>
  );
}

