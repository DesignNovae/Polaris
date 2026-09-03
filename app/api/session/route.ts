import { ok, withErrorHandling } from "@/lib/api/respond";
import { getOptionalSession } from "@/lib/authz";

export const dynamic = "force-dynamic";

/**
 * The application user behind the current Clerk session.
 *
 * Plan and role live in Mongo rather than the Clerk token, so the client
 * session provider reads them here once per page load. Returns `{ user: null }`
 * rather than 401 when signed out - it is a status probe, not a gate.
 */
export const GET = withErrorHandling(async () => {
  const user = await getOptionalSession();
  return ok({ user });
});
