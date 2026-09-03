/**
 * Fail fast when a hosted build is missing the Clerk keys required by the
 * edge middleware. Next.js intentionally skips runtime env validation during
 * `next build`, but that would otherwise let Vercel publish a deployment that
 * crashes on the first request with MIDDLEWARE_INVOCATION_FAILED.
 *
 * Local builds are not checked here because Next loads .env.local after npm's
 * lifecycle scripts start. Hosted builds receive these values from Vercel
 * before the lifecycle begins.
 */

const isHostedBuild = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

if (!isHostedBuild) {
  process.exit(0);
}

const required = [
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  console.error(
    [
      "Clerk deployment configuration is incomplete.",
      `Missing: ${missing.join(", ")}`,
      "Add the matching Clerk test or live keys to the Vercel environment and redeploy.",
      "Do not use the legacy NEXTAUTH_SECRET or NEXTAUTH_URL variables for Clerk.",
    ].join("\n"),
  );
  process.exit(1);
}

const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY.trim();
const secretKey = process.env.CLERK_SECRET_KEY.trim();
const invalid = [];

if (!/^pk_(test|live)_/.test(publishableKey)) {
  invalid.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
}
if (!/^sk_(test|live)_/.test(secretKey)) {
  invalid.push("CLERK_SECRET_KEY");
}

if (invalid.length > 0) {
  console.error(
    [
      "Clerk deployment configuration is invalid.",
      `Check the format of: ${invalid.join(", ")}`,
      "The publishable and secret keys must come from the same Clerk instance.",
    ].join("\n"),
  );
  process.exit(1);
}
