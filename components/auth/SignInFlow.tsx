"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth, useClerk, useSignIn } from "@clerk/nextjs";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthSuccess,
  CodeField,
  Divider,
  GoogleButton,
  PasswordVisibilityButton,
  SubmitButton,
  TextButton,
  clerkErrorMessage,
} from "./AuthControls";

type Stage = "credentials" | "email-code" | "reset-code" | "new-password" | "mfa-code" | "mfa-totp" | "mfa-backup";

/**
 * `destination` comes from the server page as a prop. See the note in
 * SignUpFlow: reading it with useSearchParams forces a Suspense boundary whose
 * hidden streaming placeholder duplicates the DOM, which breaks Clerk's captcha
 * container on the sign-up side and is avoided here for consistency.
 */
export function SignInFlow({ destination }: { destination: string }) {
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded: isAuthLoaded, userId } = useAuth();
  const clerk = useClerk();
  const reduceMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [busyLocal, setBusyLocal] = useState(false);
  const [error, setError] = useState("");
  const [resumeFailed, setResumeFailed] = useState(false);
  /** True when the second factor is Device Trust rather than account MFA. */
  const [deviceTrust, setDeviceTrust] = useState(false);

  const busy = busyLocal || fetchStatus === "fetching";

  useEffect(() => {
    if (!isAuthLoaded || !userId) return;

    setBusyLocal(true);
    setResumeFailed(false);
    try {
      window.location.assign(clerk.buildUrlWithAuth(destination));
    } catch {
      setBusyLocal(false);
      setResumeFailed(true);
      setError("Your existing session could not be resumed. Sign out, then try again.");
    }
  }, [clerk, destination, isAuthLoaded, userId]);

  async function handleSignInError(value: unknown) {
    const message = clerkErrorMessage(value);
    if (/already signed in/i.test(message)) {
      try {
        window.location.assign(clerk.buildUrlWithAuth(destination));
      } catch {
        setError("Your existing session could not be resumed. Sign out, then try again.");
      }
      return;
    }
    setError(message);
  }

  async function finalize() {
    if (!signIn) return;
    const { error: finalError } = await signIn.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          window.location.assign(clerk.buildUrlWithAuth(`/tasks/${session.currentTask.key}?redirect_url=${encodeURIComponent(destination)}`));
          return;
        }
        await clerk.redirectWithAuth(destination);
      },
    });
    if (finalError) await handleSignInError(finalError);
  }

  async function advanceAfterFactor() {
    if (!signIn) return;
    if (signIn.status === "complete") {
      await finalize();
      return;
    }

    if (signIn.status === "needs_new_password") {
      setNewPassword("");
      setStage("new-password");
      return;
    }

    // `needs_client_trust` is Device Trust: a sign-in from a new device has to
    // clear a second-factor verification before it is allowed through. Clerk
    // drives it with exactly the same MFA methods as `needs_second_factor`, so
    // both statuses take the branch below. This instance has Device Trust
    // enabled, so every sign-in from an unrecognised browser lands here - and
    // before this it fell through to a dead end telling the student to "try
    // Google or contact support".
    if (signIn.status === "needs_protect_check") {
      setError("An additional security challenge is required and this form cannot show it. Reload the page and try again.");
      return;
    }

    if (signIn.status !== "needs_second_factor" && signIn.status !== "needs_client_trust") {
      setError(`This sign-in stopped at an unexpected step (${signIn.status}). Reload the page and try again.`);
      return;
    }

    const isDeviceTrust = signIn.status === "needs_client_trust";
    setDeviceTrust(isDeviceTrust);

    const strategies = (signIn.supportedSecondFactors ?? []).map((factor) => factor.strategy);
    if (strategies.length === 0) {
      setError("No verification method is available for this account. Contact support.");
      return;
    }
    if (strategies.includes("email_code")) {
      const result = await signIn.mfa.sendEmailCode();
      if (result.error) setError(clerkErrorMessage(result.error));
      else setStage("mfa-code");
    } else if (strategies.includes("phone_code")) {
      const result = await signIn.mfa.sendPhoneCode();
      if (result.error) setError(clerkErrorMessage(result.error));
      else setStage("mfa-code");
    } else if (strategies.includes("totp")) {
      setStage("mfa-totp");
    } else if (strategies.includes("backup_code")) {
      setStage("mfa-backup");
    } else {
      setError("No supported second-factor method is available for this account.");
    }
  }

  async function passwordSignIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    // `signIn` is undefined until Clerk's script has loaded. Returning silently
    // here made the button look dead; say so instead.
    if (!signIn) {
      setError("Still connecting to the sign-in service. Try again in a moment.");
      return;
    }
    setError("");
    setBusyLocal(true);
    try {
      const result = await signIn.password({ emailAddress: email.trim(), password });
      if (result.error) await handleSignInError(result.error);
      else await advanceAfterFactor();
    } catch (caught) {
      await handleSignInError(caught);
    } finally {
      setBusyLocal(false);
    }
  }

  async function startEmailCode() {
    if (!signIn || busy || !email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    setError("");
    setBusyLocal(true);
    try {
      const result = await signIn.emailCode.sendCode({ emailAddress: email.trim() });
      if (result.error) setError(clerkErrorMessage(result.error));
      else {
        setCode("");
        setStage("email-code");
      }
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function verifyEmailCode(event: React.FormEvent) {
    event.preventDefault();
    if (!signIn || busy || code.length < 6) return;
    setError("");
    setBusyLocal(true);
    try {
      const result = await signIn.emailCode.verifyCode({ code });
      if (result.error) setError(clerkErrorMessage(result.error));
      else await advanceAfterFactor();
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function startPasswordReset() {
    if (!signIn || busy || !email.trim()) {
      setError("Enter your email address first, then choose Forgot password.");
      return;
    }
    setError("");
    setBusyLocal(true);
    try {
      const created = await signIn.create({ identifier: email.trim() });
      if (created.error) {
        setError(clerkErrorMessage(created.error));
        return;
      }
      const result = await signIn.resetPasswordEmailCode.sendCode();
      if (result.error) setError(clerkErrorMessage(result.error));
      else {
        setCode("");
        setStage("reset-code");
      }
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function verifyResetCode(event: React.FormEvent) {
    event.preventDefault();
    if (!signIn || busy || code.length < 6) return;
    setError("");
    setBusyLocal(true);
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code });
      if (result.error) setError(clerkErrorMessage(result.error));
      else {
        setNewPassword("");
        setStage("new-password");
      }
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function submitNewPassword(event: React.FormEvent) {
    event.preventDefault();
    if (!signIn || busy) return;
    setError("");
    setBusyLocal(true);
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });
      if (result.error) setError(clerkErrorMessage(result.error));
      else await advanceAfterFactor();
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function verifyMfa(event: React.FormEvent) {
    event.preventDefault();
    if (!signIn || busy || !code.trim()) return;
    setError("");
    setBusyLocal(true);
    try {
      const result =
        stage === "mfa-totp"
          ? await signIn.mfa.verifyTOTP({ code })
          : stage === "mfa-backup"
            ? await signIn.mfa.verifyBackupCode({ code })
            : signIn.supportedSecondFactors.some((factor) => factor.strategy === "email_code")
              ? await signIn.mfa.verifyEmailCode({ code })
              : await signIn.mfa.verifyPhoneCode({ code });
      if (result.error) setError(clerkErrorMessage(result.error));
      else await advanceAfterFactor();
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setBusyLocal(false);
    }
  }

  async function signInWithGoogle() {
    if (!signIn || busy) return;
    setError("");
    const result = await signIn.sso({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectCallbackUrl: destination,
    });
    if (result.error) setError(clerkErrorMessage(result.error));
  }

  function restart() {
    void signIn?.reset();
    setStage("credentials");
    setCode("");
    setNewPassword("");
    setError("");
  }

  const step = stage === "credentials" ? "credentials" : stage;

  if (isAuthLoaded && userId && !resumeFailed) {
    return <AuthHeading title="Opening your roadmap" description="Your session is active. Taking you back to Polaris…" />;
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={step}
        initial={reduceMotion ? false : { opacity: 0, x: 16, filter: "blur(4px)" }}
        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
        exit={reduceMotion ? undefined : { opacity: 0, x: -12, filter: "blur(3px)" }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        {stage === "credentials" && (
          <>
            <AuthHeading title="Welcome back" description="Sign in to continue your roadmap from exactly where you left it." />
            <GoogleButton busy={busy} onClick={signInWithGoogle} label="Continue with Google" />
            <Divider />
            <form onSubmit={passwordSignIn} className="space-y-4">
              <AuthField id="email" label="Email address" type="email" value={email} onChange={setEmail} autoComplete="email" placeholder="you@example.com" />
              <div>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <span className="text-[11px] font-semibold tracking-[0.04em] text-[#4A311F]">Password</span>
                  <TextButton onClick={startPasswordReset}>Forgot password?</TextButton>
                </div>
                <AuthField
                  id="password"
                  label=""
                  type={passwordVisible ? "text" : "password"}
                  value={password}
                  onChange={setPassword}
                  autoComplete="current-password"
                  placeholder="Your password"
                  suffix={<PasswordVisibilityButton visible={passwordVisible} onToggle={() => setPasswordVisible((value) => !value)} />}
                />
              </div>
              <AuthError message={error} />
              <SubmitButton busy={busy}>Enter Polaris</SubmitButton>
            </form>
            <button type="button" onClick={startEmailCode} disabled={busy} className="mt-4 w-full text-center text-[11.5px] font-medium text-[#7A6B5D] underline-offset-4 hover:text-[#2C1810] hover:underline disabled:opacity-50">
              Use a one-time email code instead
            </button>
            <p className="mt-6 text-center text-[12px] text-[#7A6B5D]">
              New to Polaris?{" "}<Link href="/signup" className="font-semibold text-[#A24159] underline-offset-4 hover:text-[#2C1810] hover:underline">Create an account</Link>
            </p>
          </>
        )}

        {stage === "email-code" && (
          <>
            <AuthHeading step="Passwordless sign-in" title="Check your inbox" description={`Enter the six-digit code sent to ${email}.`} />
            <form onSubmit={verifyEmailCode} className="space-y-4">
              <CodeField value={code} onChange={setCode} />
              <AuthError message={error} />
              <SubmitButton busy={busy}>Verify and continue</SubmitButton>
            </form>
            <div className="mt-6"><TextButton onClick={restart}>Back to password sign-in</TextButton></div>
          </>
        )}

        {stage === "reset-code" && (
          <>
            <AuthHeading step="Account recovery" title="Reset securely" description={`We sent a recovery code to ${email}.`} />
            <AuthSuccess message="The code is single-use and expires shortly." />
            <form onSubmit={verifyResetCode} className="mt-5 space-y-4">
              <CodeField value={code} onChange={setCode} label="Recovery code" />
              <AuthError message={error} />
              <SubmitButton busy={busy}>Verify recovery code</SubmitButton>
            </form>
            <div className="mt-6"><TextButton onClick={restart}>Cancel recovery</TextButton></div>
          </>
        )}

        {stage === "new-password" && (
          <>
            <AuthHeading step="Account recovery" title="Choose a new password" description="Use at least eight characters. Your other signed-in sessions will be closed." />
            <form onSubmit={submitNewPassword} className="space-y-4">
              <AuthField
                id="new-password"
                label="New password"
                type={passwordVisible ? "text" : "password"}
                value={newPassword}
                onChange={setNewPassword}
                autoComplete="new-password"
                placeholder="8 characters or more"
                suffix={<PasswordVisibilityButton visible={passwordVisible} onToggle={() => setPasswordVisible((value) => !value)} />}
              />
              <AuthError message={error} />
              <SubmitButton busy={busy}>Save password and sign in</SubmitButton>
            </form>
          </>
        )}

        {(stage === "mfa-code" || stage === "mfa-totp" || stage === "mfa-backup") && (
          <>
            <AuthHeading
              step="Two-step verification"
              title={stage === "mfa-totp" ? "Enter authenticator code" : stage === "mfa-backup" ? "Use a backup code" : "Enter your security code"}
              description={
                stage === "mfa-code"
                  ? deviceTrust
                    ? "This device is new, so we sent a code to your email to confirm it is you."
                    : "We sent a verification code to your trusted contact."
                  : "Complete the second factor linked to your account."
              }
            />
            <form onSubmit={verifyMfa} className="space-y-4">
              {stage === "mfa-backup" ? (
                <AuthField id="backup-code" label="Backup code" value={code} onChange={setCode} autoComplete="one-time-code" placeholder="Your backup code" />
              ) : (
                <CodeField value={code} onChange={setCode} label={stage === "mfa-totp" ? "Authenticator code" : "Security code"} />
              )}
              <AuthError message={error} />
              <SubmitButton busy={busy}>Complete sign-in</SubmitButton>
            </form>
            <div className="mt-6"><TextButton onClick={restart}>Use another account</TextButton></div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
