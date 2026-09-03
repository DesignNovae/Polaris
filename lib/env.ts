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

  // Clerk - identity provider. The publishable key is public by design; the
  // secret key is server-only and must never be exposed to the browser.
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  /** Svix signing secret for POST /api/webhooks/clerk. */
  CLERK_WEBHOOK_SIGNING_SECRET: z.string().optional(),

  // Optional (feature-gated at call sites)
  /** Canonical public origin. Used for gateway callback URLs and metadata. */
  APP_URL: z.string().optional(),
  GEMMA_API_KEY: z.string().optional(),
  GEMMA_MODEL: z.enum(["gemma-4-26b-a4b-it", "gemma-4-31b-it"]).optional(),
  GEMINI_API_KEY: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Comma-separated list of emails that should be treated as admins.
  ADMIN_EMAILS: z.string().optional(),

  // SSLCommerz (optional - checkout degrades to "not configured" if absent)
  SSLCOMMERZ_STORE_ID: z.string().optional(),
  SSLCOMMERZ_STORE_PASSWORD: z.string().optional(),
  /** "false" switches to the live gateway. Anything else stays on sandbox. */
  SSLCOMMERZ_SANDBOX: z.string().optional(),
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

/** True when SSLCommerz is fully configured for checkout. */
export function isPaymentsConfigured(): boolean {
  return Boolean(env.SSLCOMMERZ_STORE_ID && env.SSLCOMMERZ_STORE_PASSWORD);
}

/**
 * Canonical public origin, without a trailing slash.
 *
 * The payment gateway posts the payer back to absolute URLs built from this, so
 * an incorrect value strands a completed payment on a dead callback. Set
 * APP_URL explicitly in production rather than relying on the Vercel fallback.
 */
export function appOrigin(): string {
  const raw =
    env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000");
  return raw.replace(/\/+$/, "");
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

