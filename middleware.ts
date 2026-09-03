import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * Auth gate for the protected areas.
 *
 * Clerk replaced the NextAuth credentials provider, which also retires the
 * `secureCookie` workaround this file used to carry: cookie naming is handled
 * by Clerk rather than derived from NEXTAUTH_URL, so a misconfigured origin can
 * no longer desynchronise the session and bounce signed-in users to /signin.
 *
 * Everything not matched here stays public - the landing page, /demo, and the
 * university and scholarship pages that need to be crawlable (see sitemap.ts).
 */

const PROTECTED_ROUTE_PREFIXES = [
  "/dashboard",
  "/onboard",
  "/billing",
  "/family",
  "/monitor",
  "/portal",
  "/account",
  "/admin",
  "/roadmap",
  "/strategist",
  "/deadlines",
  "/universities",
  "/resources",
  "/connections",
  "/transactions",
  "/action-lab",
  "/passport",
  "/cohort",
  "/affordability",
  "/exams",
  "/partners",
  "/consultants",
  "/community",
  "/bookings",
  "/settings",
] as const;

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default clerkMiddleware(async (auth, req) => {
  // Resource-level checks in layouts and handlers are authoritative. This
  // early redirect preserves a fast signed-out experience and remains a
  // defence-in-depth layer without Clerk's deprecated path matcher.
  if (!isProtectedPath(req.nextUrl.pathname)) return NextResponse.next();

  const { userId } = await auth();
  if (!userId) {
    const signIn = new URL("/signin", req.url);
    signIn.searchParams.set(
      "redirect_url",
      req.nextUrl.pathname + req.nextUrl.search,
    );
    return NextResponse.redirect(signIn);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Everything except Next internals and static files, so Clerk can attach
    // the session to requests it does not gate.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
