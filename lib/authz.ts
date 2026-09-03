import { cache } from "react";
import { auth, currentUser } from "@clerk/nextjs/server";
import { HttpError } from "@/lib/api/respond";
import { planMeets } from "@/lib/features";
import { isAdminEmail } from "@/lib/env";
import {
  upsertClerkUser,
  setUserPlan,
  type DbUser,
  type Plan,
  type UserRole,
} from "@/lib/db/collections";

/**
 * Server-side session resolution.
 *
 * Clerk owns identity - credentials, email verification, sessions, MFA. Mongo
 * owns the application record: plan, role, profile, roadmap. This module is the
 * single seam between them, which is why the migration off the NextAuth
 * credentials provider touched ~15 files rather than the 87 that call these
 * helpers: the exported API below is unchanged.
 */

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  plan: Plan;
};

/**
 * A paid term that has run out is free, whatever the stored column says.
 *
 * SSLCommerz is not a recurring processor: a payment buys a fixed term and
 * `subscription.expiresAt` is what ends it. Evaluating that here means access
 * cannot outlive the term just because no webhook happened to arrive - the old
 * failure mode was the opposite one, where an unrelated gateway event wrote
 * "free" over a paying customer.
 */
export function effectivePlan(user: Pick<DbUser, "plan" | "subscription">): Plan {
  if (user.plan === "free") return "free";
  const expiresAt = user.subscription?.expiresAt;
  if (!expiresAt) return user.plan; // manually granted, no term
  return Date.parse(expiresAt) > Date.now() ? user.plan : "free";
}

/**
 * Resolve the Clerk session to an application user.
 *
 * `cache()` scopes memoisation to the request, so the many handlers that call
 * `requireSession()` during one render share a single lookup.
 */
const resolve = cache(async (): Promise<SessionUser | null> => {
  const { userId: clerkId } = await auth();
  if (!clerkId) return null;

  const clerk = await currentUser();
  const email =
    clerk?.primaryEmailAddress?.emailAddress ??
    clerk?.emailAddresses?.[0]?.emailAddress ??
    "";
  if (!email) return null;

  const name =
    [clerk?.firstName, clerk?.lastName].filter(Boolean).join(" ").trim() ||
    (typeof clerk?.unsafeMetadata?.fullName === "string"
      ? clerk.unsafeMetadata.fullName.trim()
      : "") ||
    clerk?.username ||
    email.split("@")[0];

  const user = await upsertClerkUser({
    clerkId,
    email,
    name,
    avatarUrl: clerk?.imageUrl,
  });

  const plan = effectivePlan(user);
  // Persist a lapsed term once, so admin views and exports agree with what the
  // session sees rather than showing a plan the user no longer has.
  if (plan !== user.plan && user._id) {
    await setUserPlan(user._id.toString(), plan, {
      ...user.subscription,
      status: "expired",
    }).catch(() => {});
  }

  return {
    id: user._id!.toString(),
    name: user.name,
    email: user.email,
    // The ADMIN_EMAILS allowlist is authoritative, so a fresh deployment can
    // always reach the admin console without a manual database edit.
    role: isAdminEmail(user.email) ? "admin" : user.role,
    plan,
  };
});

/** The session user, or null when signed out. Never throws. */
export async function getOptionalSession(): Promise<SessionUser | null> {
  try {
    return await resolve();
  } catch (err) {
    console.error("[authz] session resolution failed:", err);
    return null;
  }
}

/**
 * Why a page has no session user - which is not the same question as whether
 * it has one.
 *
 * "signed-out" means send them to sign in. "unprovisioned" means Clerk has a
 * valid session but the application record could not be resolved (the database
 * is unreachable, say). Redirecting that second case to /signin creates an
 * infinite bounce: the sign-in page sees the Clerk session and sends them
 * straight back. Callers must render an error for it instead.
 */
export type SessionOutcome =
  | { state: "ok"; user: SessionUser }
  | { state: "signed-out" }
  | { state: "unprovisioned"; reason: string };

export async function resolveSessionOutcome(): Promise<SessionOutcome> {
  const { userId } = await auth();
  if (!userId) return { state: "signed-out" };

  try {
    const user = await resolve();
    if (user) return { state: "ok", user };
    return {
      state: "unprovisioned",
      reason: "Your Clerk account has no email address on it yet.",
    };
  } catch (err) {
    console.error("[authz] provisioning failed for", userId, err);
    return {
      state: "unprovisioned",
      reason: "We could not load your Polaris account. This is usually the database being briefly unreachable.",
    };
  }
}

/** Returns the session user or throws 401. */
export async function requireSession(): Promise<SessionUser> {
  const { userId } = await auth();
  if (!userId) throw new HttpError(401, "You must be signed in");

  const user = await resolve();
  if (!user) throw new HttpError(401, "You must be signed in");
  return user;
}

/** Returns the session user if they have one of the allowed roles, else 403. */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireSession();
  if (!roles.includes(user.role)) {
    throw new HttpError(403, "You don't have access to this resource");
  }
  return user;
}

/** Returns the session user if their plan meets the minimum, else 403. */
export async function requirePlan(minPlan: Plan): Promise<SessionUser> {
  const user = await requireSession();
  if (!planMeets(user.plan, minPlan)) {
    throw new HttpError(
      403,
      `This feature requires the ${minPlan} plan. Upgrade to continue.`,
    );
  }
  return user;
}
