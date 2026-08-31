import { Suspense } from "react";
import SignInForm from "./SignInForm";

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center px-4">
          <div className="text-sm text-ink-dim">Loading…</div>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
