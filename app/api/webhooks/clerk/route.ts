import { verifyWebhook } from "@clerk/nextjs/webhooks";
import type { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/respond";
import {
  upsertClerkUser,
  deleteUserByClerkId,
} from "@/lib/db/collections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Clerk -> Mongo user synchronisation.
 *
 * The session path (`lib/authz.ts`) already provisions a row on first sight, so
 * this webhook is not the only way a user appears - it exists to keep the row
 * current when the change happens in Clerk rather than in the app: an email
 * change, a name change, or an account deleted from Clerk's dashboard.
 *
 * `verifyWebhook` performs the Svix signature check and throws on a bad or
 * replayed signature, so an unsigned request can never reach the database.
 */
export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch (err) {
    console.error("[clerk-webhook] signature verification failed:", err);
    return fail(400, "Invalid signature");
  }

  try {
    switch (event.type) {
      case "user.created":
      case "user.updated": {
        const data = event.data;
        const email =
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id)
            ?.email_address ?? data.email_addresses?.[0]?.email_address;
        if (!email) break; // nothing to key on yet

        await upsertClerkUser({
          clerkId: data.id,
          email,
          name:
            [data.first_name, data.last_name].filter(Boolean).join(" ").trim() ||
            (typeof data.unsafe_metadata?.fullName === "string"
              ? data.unsafe_metadata.fullName.trim()
              : "") ||
            data.username ||
            email.split("@")[0],
          avatarUrl: data.image_url,
        });
        break;
      }

      case "user.deleted": {
        // Cascades profiles, roadmaps, chat, retrieval rows and transactions -
        // the same path as an in-app account deletion.
        if (event.data.id) await deleteUserByClerkId(event.data.id);
        break;
      }

      default:
        // Unhandled event types are acknowledged, never acted on. The billing
        // webhook's old bug was doing something by default; the default here
        // is deliberately nothing.
        break;
    }
  } catch (err) {
    console.error(`[clerk-webhook] failed handling ${event.type}:`, err);
    // 500 so Clerk retries; the handlers above are idempotent.
    return fail(500, "Webhook processing failed");
  }

  return ok({ received: true });
}
