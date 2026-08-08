import { Suspense } from "react";
import MonitorClient from "./MonitorClient";

export default function MonitorPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="text-sm text-ink-dim">Loading…</div>
        </main>
      }
    >
      <MonitorClient />
    </Suspense>
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
