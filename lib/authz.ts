import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { HttpError } from "@/lib/api/respond";
import { planMeets } from "@/lib/features";
import type { Plan, UserRole } from "@/lib/db/collections";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
  plan: Plan;
};

/** Returns the session user or throws 401. */
export async function requireSession(): Promise<SessionUser> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    throw new HttpError(401, "You must be signed in");
  }
  return session.user as SessionUser;
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
