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

