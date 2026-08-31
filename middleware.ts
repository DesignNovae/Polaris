import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Auth gate for protected areas. We read the JWT explicitly (rather than the
 * default withAuth) so we can force `secureCookie` on HTTPS - this keeps the
 * cookie name (__Secure-next-auth.session-token) consistent with what the auth
 * callback writes, regardless of how NEXTAUTH_URL is configured. Without this,
 * a misconfigured NEXTAUTH_URL makes the middleware miss the session and bounce
 * logged-in users back to /signin.
 */

const PROTECTED = [
  "/dashboard",
  "/onboard",
  "/billing",
  "/family",
  "/monitor",
  "/account",
  "/admin",
  // New (app) workspace shell.
  "/roadmap",
  "/strategist",
  "/deadlines",
  "/universities",
  "/resources",
  "/connections",
  "/partners",
  "/consultants",
  "/community",
  "/bookings",
  "/settings",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const secureCookie =
    !!process.env.VERCEL || req.nextUrl.protocol === "https:";
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    secureCookie,
  });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/signin";
    url.search = `callbackUrl=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboard/:path*",
    "/billing/:path*",
    "/family/:path*",
    "/monitor/:path*",
    "/account/:path*",
    "/admin/:path*",
    "/roadmap/:path*",
    "/strategist/:path*",
    "/deadlines/:path*",
    "/universities/:path*",
    "/resources/:path*",
    "/connections/:path*",
    "/partners/:path*",
    "/consultants/:path*",
    "/community/:path*",
    "/bookings/:path*",
    "/settings/:path*",
  ],
};
