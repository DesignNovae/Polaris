import { z } from "zod";

/**
 * Centralized, validated environment access.
 *
 * Required vars fail fast at first import with a clear message.
 * Payment + AI vars are optional so the app still boots for local dev /
 * the heuristic fallback - the relevant feature checks `isConfigured` itself.
 */

const schema = z.object({
  // Required
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),

  // Optional (feature-gated at call sites)
  NEXTAUTH_URL: z.string().optional(),
  GEMMA_API_KEY: z.string().optional(),
  GEMMA_MODEL: z.enum(["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Comma-separated list of emails that should be treated as admins.
  ADMIN_EMAILS: z.string().optional(),

  // LemonSqueezy (optional - checkout/portal degrade gracefully if absent)
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_STORE_ID: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  LEMONSQUEEZY_VARIANT_PRO: z.string().optional(),
  LEMONSQUEEZY_VARIANT_ELITE: z.string().optional(),
});

const parsed = schema.safeParse(process.env);

// During `next build` page-data collection, runtime secrets may be absent.
// Don't hard-fail the build; enforce required vars only at runtime.
const isBuildPhase = process.env.NEXT_PHASE === "phase-production-build";

if (!parsed.success && !isBuildPhase) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\nCheck your .env.local against .env.local.example.`,
  );
}

export const env = (parsed.success ? parsed.data : process.env) as z.infer<
  typeof schema
>;

/** True when LemonSqueezy is fully configured for checkout. */
export function isPaymentsConfigured(): boolean {
  return Boolean(
    env.LEMONSQUEEZY_API_KEY &&
      env.LEMONSQUEEZY_STORE_ID &&
      env.LEMONSQUEEZY_VARIANT_PRO &&
      env.LEMONSQUEEZY_VARIANT_ELITE,
  );
}

/** True if the given email is in the ADMIN_EMAILS allowlist. */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

