"use client";

import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function SignOutPage() {
  useEffect(() => {
    signOut({ callbackUrl: "/" });
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-ink-dim text-sm">Signing out…</p>
    </main>
  );
}
