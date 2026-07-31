"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { CompassLogo } from "@/components/Nav";

type Role = "student" | "parent" | "partner";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<Role>("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Registration failed");
        setLoading(false);
        return;
      }

      const signInRes = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInRes?.error) {
        setError("Account created but sign-in failed. Please sign in manually.");
        setLoading(false);
        return;
      }

      window.location.href = "/roadmap";
    } catch {
      setError("Something went wrong");
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
          <h1 className="text-2xl font-serif font-bold text-ink">Create your account</h1>
          <p className="mt-1 text-sm text-ink-dim">Start your academic journey</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              I am a…
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["student", "parent", "partner"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={
                    "rounded-xl border px-2 py-2 text-sm capitalize transition-colors duration-150 " +
                    (role === r
                      ? "bg-polaris-100 border-polaris-400 text-ink"
                      : "bg-white border-polaris-200 text-ink-dim hover:border-polaris-300")
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-ink mb-1.5">
              Full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-polaris-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-polaris-400 focus:outline-none transition-colors"
              placeholder="Your name"
            />
          </div>

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
              className="w-full rounded-xl border border-polaris-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-polaris-400 focus:outline-none transition-colors"
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
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-polaris-200 bg-white px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-polaris-400 focus:outline-none transition-colors"
              placeholder="At least 8 characters"
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
            {loading ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-ink-dim">
          Already have an account?{" "}
          <Link href="/signin" className="font-medium text-polaris-500 hover:text-polaris-600 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
