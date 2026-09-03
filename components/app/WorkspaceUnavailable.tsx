import Link from "next/link";
import { CompassLogo } from "@/components/Nav";

/**
 * Shown when Clerk has a valid session but the Polaris account behind it could
 * not be resolved. The important thing is that this is a dead end with actions
 * on it, not a redirect - bouncing to /signin would loop, because the sign-in
 * page would see the same valid Clerk session and send the user back here.
 */
export function WorkspaceUnavailable({ reason }: { reason: string }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-ink px-6 text-paper">
      <div className="max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-paper/70 transition-colors hover:text-paper">
          <CompassLogo />
          <span className="font-serif text-[15px] font-bold">Polaris</span>
        </Link>

        <h1 className="mt-8 font-serif text-3xl font-bold leading-tight">
          We can&apos;t open your workspace
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-paper/65">{reason}</p>
        <p className="mt-3 text-[14px] leading-relaxed text-paper/50">
          You are signed in - this is not a sign-in problem, so signing in again
          will not help.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/roadmap"
            className="rounded-full bg-paper px-5 py-3 text-[13.5px] font-semibold text-ink transition-colors hover:bg-paper-soft"
          >
            Try again
          </Link>
          <Link
            href="/signout"
            className="rounded-full border border-white/15 bg-white/[0.06] px-5 py-3 text-[13.5px] font-semibold text-paper transition-colors hover:bg-white/[0.12]"
          >
            Sign out
          </Link>
        </div>
      </div>
    </main>
  );
}
