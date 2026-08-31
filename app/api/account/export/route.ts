/**
 * GET /api/account/export - download all data Polaris holds for the
 * signed-in user as a JSON file. Auth-guarded; a user can only export
 * their own data. Supports the "Ethical AI compliance" data-portability
 * requirement in the app README.
 */

import { withErrorHandling } from "@/lib/api/respond";
import { requireSession } from "@/lib/authz";
import {
  getUserById,
  getProfile,
  getLatestRoadmap,
  getLinksForStudent,
} from "@/lib/db/collections";

export const dynamic = "force-dynamic";

export const GET = withErrorHandling(async () => {
  const session = await requireSession();
  const [user, profile, roadmap, links] = await Promise.all([
    getUserById(session.id),
    getProfile(session.id),
    getLatestRoadmap(session.id),
    getLinksForStudent(session.id),
  ]);

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user
      ? { name: user.name, email: user.email, role: user.role, plan: user.plan, createdAt: user.createdAt }
      : null,
    profile,
    roadmap,
    links,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="polaris-data.json"',
    },
  });
});

