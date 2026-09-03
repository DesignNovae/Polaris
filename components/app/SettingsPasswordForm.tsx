"use client";

/**
 * Settings → Security.
 *
 * Credentials moved to Clerk, so there is no password in this application's
 * database to change. Rather than proxy Clerk's password, email and MFA flows
 * through our own form - which would mean re-implementing verification,
 * breach checks and re-authentication - this opens Clerk's account UI, which
 * already handles all of it.
 */

import { useClerk, useUser } from "@clerk/nextjs";
import { Btn } from "./ui";

export function SettingsPasswordForm() {
  const { openUserProfile } = useClerk();
  const { user, isLoaded } = useUser();

  const strategies = user?.passwordEnabled
    ? "Password"
    : user?.externalAccounts?.length
      ? "Connected account"
      : "Email code";
  const mfaOn = Boolean(user?.twoFactorEnabled);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-paper-soft dark:bg-white/[0.04] px-4 py-3.5 ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.08]">
        <dl className="space-y-2.5 text-[13px]">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-dim">Sign-in method</dt>
            <dd className="font-medium text-ink">
              {isLoaded ? strategies : "…"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-dim">Two-factor authentication</dt>
            <dd
              className={
                mfaOn
                  ? "font-medium text-aurora-700 dark:text-aurora-200"
                  : "font-medium text-ink-dim"
              }
            >
              {!isLoaded ? "…" : mfaOn ? "On" : "Off"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-dim">Email</dt>
            <dd className="font-medium text-ink truncate max-w-[55%]">
              {user?.primaryEmailAddress?.emailAddress ?? "—"}
            </dd>
          </div>
        </dl>
      </div>

      <p className="text-[12.5px] leading-relaxed text-ink-dim">
        Your password, email addresses and two-factor settings are managed in
        your Polaris account security panel.
      </p>

      <Btn onClick={() => openUserProfile()} disabled={!isLoaded}>
        Manage sign-in &amp; security
      </Btn>
    </div>
  );
}
