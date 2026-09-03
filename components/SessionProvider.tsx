"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import { ClerkProvider, useAuth, useClerk } from "@clerk/nextjs";
import type { Plan, UserRole } from "@/lib/db/collections";
import { identify } from "@/lib/analytics";

/**
 * Client session layer.
 *
 * Clerk holds identity; plan and role live in Mongo, so neither is present in
 * the Clerk session token. Rather than teach seven components two different
 * hooks - and rather than mirror plan into Clerk metadata, which drifts the
 * moment a payment lands - this provider resolves the application user once per
 * page load from /api/session and exposes it through a `useSession()` with the
 * same shape the NextAuth call sites already used.
 *
 * The single fetch is shared by every consumer via context, so adding
 * `useSession()` to another component costs nothing.
 */

export type PolarisSessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  plan: Plan;
};

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";

type SessionValue = {
  data: { user: PolarisSessionUser } | null;
  status: SessionStatus;
  /** Re-read the application user - call after a plan change. */
  refresh: () => void;
};

const SessionContext = createContext<SessionValue>({
  data: null,
  status: "loading",
  refresh: () => {},
});

function PolarisSession({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [user, setUser] = useState<PolarisSessionUser | null>(null);
  const [resolved, setResolved] = useState(false);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setUser(null);
      setResolved(true);
      return;
    }
    let alive = true;
    setResolved(false);
    fetch("/api/session", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        // Join anonymous pre-signup events to the account.
        if (d?.user?.id) identify(d.user.id);
        setUser(d?.user ?? null);
        setResolved(true);
      })
      .catch(() => {
        if (alive) setResolved(true);
      });
    return () => {
      alive = false;
    };
  }, [isLoaded, isSignedIn, nonce]);

  const value = useMemo<SessionValue>(() => {
    const status: SessionStatus = !isLoaded || (isSignedIn && !resolved)
      ? "loading"
      : user
        ? "authenticated"
        : "unauthenticated";
    return { data: user ? { user } : null, status, refresh };
  }, [isLoaded, isSignedIn, resolved, user, refresh]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

/** Drop-in replacement for next-auth's `useSession()`. */
export function useSession(): SessionValue {
  return useContext(SessionContext);
}

/** Drop-in replacement for next-auth's `signOut({ callbackUrl })`. */
export function useSignOut() {
  const { signOut } = useClerk();
  return useCallback(
    (opts?: { callbackUrl?: string }) =>
      signOut({ redirectUrl: opts?.callbackUrl ?? "/" }),
    [signOut],
  );
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      signInUrl="/signin"
      signUpUrl="/signup"
      // Land in the workspace, not on a dashboard that redirects again.
      signInFallbackRedirectUrl="/roadmap"
      signUpFallbackRedirectUrl="/roadmap"
      taskUrls={{
        "choose-organization": "/tasks/choose-organization",
        "reset-password": "/tasks/reset-password",
        "setup-mfa": "/tasks/setup-mfa",
      }}
      appearance={{
        variables: {
          colorPrimary: "#C47D4E",
          borderRadius: "0.75rem",
          fontFamily: "var(--font-inter), system-ui, sans-serif",
        },
      }}
    >
      <PolarisSession>{children}</PolarisSession>
    </ClerkProvider>
  );
}
