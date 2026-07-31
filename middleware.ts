import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

/**
 * Auth gate for protected areas.
 */

const PROTECTED = [
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
  "/billing",
  "/transactions",
  "/family",
  "/account",
  "/action-lab",
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  if (!isProtected) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
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
    "/billing/:path*",
    "/transactions/:path*",
    "/family/:path*",
    "/account/:path*",
    "/action-lab/:path*",
  ],
};
