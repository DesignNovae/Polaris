import { ok, withErrorHandling } from "@/lib/api/respond";
import { requireRole } from "@/lib/authz";
import { getPlatformStats } from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  await requireRole("admin");
  const stats = await getPlatformStats();
  return ok({ stats });
});

