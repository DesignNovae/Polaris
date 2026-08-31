"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { CompassLogo } from "@/components/Nav";

export default function SignInForm() {
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/roadmap";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError(
          res.error === "CredentialsSignin"
            ? "Invalid email or password."
            : "Sign-in is temporarily unavailable. Please try again later.",
        );
        setLoading(false);
        return;
      }

      window.location.href = callbackUrl;
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <CompassLogo />
            <span className="font-serif font-bold text-xl text-ink">Polaris</span>
          </Link>
          <h1 className="text-2xl font-serif font-bold text-ink">Welcome back</h1>
          <p className="mt-1 text-sm text-ink-dim">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-polaris-200/50 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-polaris-400 focus:outline-none transition-colors"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-polaris-200/50 bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-polaris-400 focus:outline-none transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-nova-500/40 bg-nova-500/10 px-4 py-3 text-sm text-ink">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`w-full rounded-full py-3 text-sm font-semibold transition-colors duration-150 ${
              loading
                ? "bg-polaris-200 text-ink-dim cursor-wait"
                : "bg-polaris-500 text-white hover:bg-polaris-600 active:bg-polaris-700"
            }`}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-dim">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-polaris-500 hover:text-polaris-600 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
