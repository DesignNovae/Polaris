"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/cn";

type MonitorMilestone = {
  id: string;
  title: string;
  category: string;
  status: "pending" | "in-progress" | "done";
  quarter: string;
  priority: "high" | "medium" | "low";
};

type MonitorStudent = {
  studentId: string;
  studentName: string;
  relationship: "parent" | "partner";
  summary: string | null;
  gaps: string[];
  progress: { done: number; total: number; pct: number };
  milestones: MonitorMilestone[];
};

export default function MonitorPage() {
  const [students, setStudents] = useState<MonitorStudent[] | null>(null);

  // Parent/partner invite acceptance lives here now - relocated from the old
  // /family page, which became the student-only workspace under app/(app).
  const [acceptToken, setAcceptToken] = useState("");
  const [acceptMsg, setAcceptMsg] = useState("");
  const [accepting, setAccepting] = useState(false);

  const loadStudents = useCallback(() => {
    fetch("/api/monitor")
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => setStudents(d.students ?? []))
      .catch(() => setStudents([]));
  }, []);

  useEffect(() => {
    loadStudents();
    const token = new URLSearchParams(window.location.search).get("accept");
    if (token) setAcceptToken(token);
  }, [loadStudents]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setAcceptMsg("");
    setAccepting(true);
    try {
      const res = await fetch("/api/links/accept", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: acceptToken.trim() }),
      });
      if (res.ok) {
        setAcceptMsg("Linked! The student now appears below.");
        setAcceptToken("");
        loadStudents();
      } else {
        const d = await res.json().catch(() => ({}));
        setAcceptMsg(d.error || "Could not accept invite");
      }
    } finally {
      setAccepting(false);
    }
  }

  return (
    <main className="min-h-screen">
      <Nav />
      <section className="mx-auto max-w-5xl px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">
          Monitoring
        </h1>
        <p className="mt-3 text-ink-dim">
          A read-only view of the students who have linked you to their journey.
        </p>

        {/* Accept an invite (parent / partner side) */}
        <div className="mt-8 glass rounded-2xl p-6">
          <div className="text-sm font-semibold text-ink mb-2">Accept an invite</div>
          <p className="text-xs text-ink-muted mb-4">
            Paste an invite token (or the part after <code>?accept=</code> in your invite link).
            You must be signed in with the invited email.
          </p>
          <form onSubmit={accept} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              placeholder="invite token"
              value={acceptToken}
              onChange={(e) => setAcceptToken(e.target.value)}
              className="flex-1 rounded-xl border border-polaris-200 bg-white px-4 py-2.5 text-sm focus:border-polaris-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={accepting}
              className="rounded-full border border-polaris-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-polaris-50 hover:border-polaris-400 transition-colors duration-150 disabled:opacity-50"
            >
              {accepting ? "…" : "Accept"}
            </button>
          </form>
          {acceptMsg && <p className="mt-3 text-sm text-ink-dim">{acceptMsg}</p>}
        </div>

        {students === null ? (
          <p className="mt-10 text-ink-dim">Loading…</p>
        ) : students.length === 0 ? (
          <div className="mt-12 glass rounded-3xl p-8 sm:p-12 text-center">
            <div className="text-ink font-semibold mb-2">No linked students yet</div>
            <p className="text-sm text-ink-dim">
              Ask the student to invite your email from their{" "}
              <Link href="/family" className="text-polaris-500 hover:text-polaris-600">
                Family &amp; Partners
              </Link>{" "}
              page, then accept the invite.
            </p>
          </div>
        ) : (
          <div className="mt-10 space-y-8">
            {students.map((s) => (
              <div key={s.studentId} className="glass-strong rounded-2xl p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-ink-muted">
                      {s.relationship}
                    </div>
                    <div className="text-xl font-serif font-bold text-ink">
                      {s.studentName}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-ink tabular-nums">
                    {s.progress.done}/{s.progress.total} ({s.progress.pct}%)
                  </div>
                </div>

                <div className="mt-3 h-2 rounded-full bg-polaris-100 overflow-hidden">
                  <div
                    className="h-full bg-aurora-500 rounded-full transition-all duration-500"
                    style={{ width: `${s.progress.pct}%` }}
                  />
                </div>

                {s.summary && (
                  <p className="mt-4 text-sm text-ink leading-relaxed">{s.summary}</p>
                )}

                {s.milestones.length > 0 && (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {s.milestones.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center gap-2 rounded-xl border border-polaris-200 bg-white px-3 py-2 text-sm"
                      >
                        <StatusDot status={m.status} />
                        <span
                          className={cn(
                            "flex-1 text-ink-dim truncate",
                            m.status === "done" && "line-through text-ink-muted",
                          )}
                          title={m.title}
                        >
                          {m.title}
                        </span>
                        <span className="text-[10px] text-ink-muted">{m.category}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.milestones.length === 0 && (
                  <p className="mt-4 text-sm text-ink-muted">
                    This student hasn&apos;t generated a roadmap yet.
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
      <Footer />
    </main>
  );
}

function StatusDot({ status }: { status: "pending" | "in-progress" | "done" }) {
  const color =
    status === "done"
      ? "bg-aurora-500"
      : status === "in-progress"
        ? "bg-polaris-400"
        : "bg-polaris-200";
  return <span className={cn("h-2 w-2 flex-none rounded-full", color)} />;
}

