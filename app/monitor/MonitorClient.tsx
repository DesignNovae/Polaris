"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { CompassLogo } from "@/components/Nav";

const MOCK_MILESTONES = [
  { title: "Register for SAT and begin prep", status: "in-progress", due: "Q3 2025" },
  { title: "Draft Common App personal essay", status: "pending", due: "Q4 2025" },
  { title: "Finalize university shortlist", status: "pending", due: "Q1 2026" },
  { title: "Take SAT and achieve target score", status: "pending", due: "Q1 2026" },
];

const MOCK_DEADLINES = [
  { title: "SAT registration", due: "2025-08-15" },
  { title: "Recommendation letter request", due: "2025-09-10" },
  { title: "Personal essay first draft", due: "2025-09-30" },
];

type MonitorInvite = {
  email: string;
  role: string;
  studentName: string;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  acceptedEmail?: string | null;
};

type MonitorConnection = {
  studentName: string;
  studentId: string;
  role: string;
  acceptedAt: string | null;
  acceptedEmail?: string | null;
};

export default function MonitorClient() {
  const params = useSearchParams();
  const token = params.get("token");
  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState<MonitorInvite | null>(null);
  const [connections, setConnections] = useState<MonitorConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [status, setStatus] = useState<"ready" | "accepted" | "failed">("ready");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      setMessage("");

      if (token) {
        try {
          const res = await fetch(`/api/monitor?token=${encodeURIComponent(token)}`);
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || "Unable to fetch invite");
          }
          const data = await res.json();
          setInvite(data.invite);
        } catch (err) {
          setStatus("failed");
          setError(err instanceof Error ? err.message : "Something went wrong");
        } finally {
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch("/api/monitor");
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Unable to load connections");
        }
        const data = await res.json();
        setConnections(data.connections ?? []);
        if (data.connections?.length) {
          setSelectedConnection(data.connections[0].studentId);
        }
      } catch (err) {
        setStatus("failed");
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [token]);

  const selectedStudentName = useMemo(() => {
    if (token && invite) return invite.studentName;
    const student = connections.find((c) => c.studentId === selectedConnection);
    return student?.studentName ?? null;
  }, [token, invite, connections, selectedConnection]);

  async function acceptInvite() {
    if (!token) return;
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const res = await fetch("/api/monitor", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to accept invite");
      }
      setStatus("accepted");
      setMessage("Invite accepted. Refreshing your dashboard...");
      setTimeout(() => {
        window.location.search = "";
      }, 1300);
    } catch (err) {
      setStatus("failed");
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  async function signInWithCallback() {
    if (!token) return;
    await signIn("credentials", { callbackUrl: `/monitor?token=${encodeURIComponent(token)}` });
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-12 text-ink">
      <div className="mx-auto max-w-5xl rounded-3xl border border-polaris-200/70 bg-white/95 p-8 shadow-pop backdrop-blur-xl">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <CompassLogo />
              <h1 className="text-3xl font-serif font-bold">Monitoring dashboard</h1>
            </div>
            <p className="text-sm text-ink-dim">
              Secure read-only access for parents and partners to follow student roadmap progress.
            </p>
          </div>
          <Link
            href="/roadmap"
            className="rounded-full border border-polaris-300 bg-paper px-4 py-2 text-sm text-ink hover:bg-polaris-50 transition-colors"
          >
            Student roadmap
          </Link>
        </div>

        {loading ? (
          <p className="text-ink-dim">Loading…</p>
        ) : status === "failed" ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700">
            <p className="font-medium">Issue loading monitor access</p>
            <p className="mt-2">
              {error || "Please sign in with the invited email or ask the student to resend the link."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="/signin" className="rounded-full border border-polaris-300 bg-paper px-4 py-2 text-sm text-ink hover:bg-polaris-50 transition-colors">
                Sign in
              </Link>
              <Link href="/signup" className="rounded-full border border-polaris-300 bg-paper px-4 py-2 text-sm text-ink hover:bg-polaris-50 transition-colors">
                Sign up
              </Link>
            </div>
          </div>
        ) : token && invite ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-polaris-200/70 bg-paper-card p-5">
              <div className="text-sm text-ink-muted">Student invite</div>
              <div className="mt-2 text-lg font-semibold text-ink">{invite.studentName}</div>
              <div className="mt-3 text-sm text-ink-muted">
                {invite.acceptedAt ? "This invite was accepted." : `Invited as a ${invite.role}.`}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <SummaryRow label="Invite email" value={invite.email} />
                <SummaryRow label="Expires" value={new Date(invite.expiresAt).toLocaleDateString()} />
              </div>
            </div>
            {invite.acceptedAt ? (
              <div className="rounded-2xl border border-aurora-200 bg-aurora-50 p-5 text-sm text-aurora-700">
                This invite is already accepted. Refresh the page after signing in with the invited email to access the monitoring dashboard.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={acceptInvite}
                  className="rounded-full bg-polaris-500 px-5 py-3 text-sm font-semibold text-white hover:bg-polaris-600 transition-colors"
                >
                  Accept invite
                </button>
                <button
                  type="button"
                  onClick={signInWithCallback}
                  className="rounded-full border border-polaris-300 bg-paper px-5 py-3 text-sm text-ink hover:bg-polaris-50 transition-colors"
                >
                  Sign in with invite email
                </button>
              </div>
            )}
            {message && <p className="rounded-2xl border border-aurora-200 bg-aurora-50 p-4 text-sm text-aurora-700">{message}</p>}
          </div>
        ) : connections.length === 0 ? (
          <div className="rounded-2xl border border-polaris-200/70 bg-paper-card p-5 text-sm text-ink-dim">
            <p className="font-semibold text-ink">No students connected yet.</p>
            <p className="mt-2">Ask your student to send an invite link so you can monitor their roadmap and deadlines.</p>
          </div>
        ) : (
          <div className="grid gap-8">
            <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
              <section className="rounded-2xl border border-polaris-200/70 bg-paper-card p-5">
                <div className="text-sm text-ink-muted">Connected students</div>
                <div className="mt-4 space-y-3">
                  {connections.map((connection) => (
                    <button
                      key={connection.studentId}
                      onClick={() => setSelectedConnection(connection.studentId)}
                      className={`w-full text-left rounded-2xl px-4 py-3 transition-colors ${
                        selectedConnection === connection.studentId
                          ? "bg-polaris-100 text-ink"
                          : "bg-white/80 text-ink-dim hover:bg-polaris-50"
                      }`}
                    >
                      <div className="font-semibold">{connection.studentName}</div>
                      <div className="text-[12px] text-ink-muted">{connection.role} monitor</div>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-polaris-200/70 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm text-ink-muted">Viewing</div>
                    <div className="text-xl font-semibold text-ink">{selectedStudentName}</div>
                  </div>
                  <span className="rounded-full bg-polaris-100 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-ink">Read-only</span>
                </div>
                <div className="mt-6 space-y-6">
                  <ProgressBlock />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Panel title="Upcoming deadlines">
                      <ul className="space-y-3">
                        {MOCK_DEADLINES.map((deadline) => (
                          <li key={deadline.title} className="rounded-2xl border border-polaris-200 bg-paper p-4">
                            <div className="font-semibold text-ink">{deadline.title}</div>
                            <div className="mt-1 text-[13px] text-ink-muted">Due {deadline.due}</div>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                    <Panel title="Milestone progress">
                      <ul className="space-y-3">
                        {MOCK_MILESTONES.map((milestone) => (
                          <li key={milestone.title} className="rounded-2xl border border-polaris-200 bg-paper p-4">
                            <div className="flex items-center justify-between gap-3">
                              <div className="font-semibold text-ink">{milestone.title}</div>
                              <span className="rounded-full bg-polaris-100 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-ink">
                                {milestone.status}
                              </span>
                            </div>
                            <div className="mt-2 text-[12.5px] text-ink-muted">Due {milestone.due}</div>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/90 border border-polaris-200/80 p-4">
      <div className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">{label}</div>
      <div className="mt-2 text-sm text-ink">{value}</div>
    </div>
  );
}

function ProgressBlock() {
  const done = 2;
  const total = 4;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="rounded-2xl border border-polaris-200 bg-paper p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm text-ink-muted">Roadmap completion</div>
          <div className="mt-2 text-2xl font-semibold text-ink">{pct}%</div>
        </div>
        <div className="rounded-full bg-aurora-50 px-3 py-1 text-sm font-semibold text-aurora-700">{done}/{total} milestones done</div>
      </div>
      <div className="mt-4 h-3 rounded-full bg-polaris-100 overflow-hidden">
        <div className="h-full bg-aurora-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-polaris-200 bg-paper p-5">
      <div className="text-sm font-semibold text-ink mb-4">{title}</div>
      {children}
    </div>
  );
}
