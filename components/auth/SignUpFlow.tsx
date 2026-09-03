"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useState } from "react";
import { useAuth, useClerk, useSignUp } from "@clerk/nextjs";
import {
  AuthError,
  AuthField,
  AuthHeading,
  AuthSuccess,
  CodeField,
  Divider,
  GoogleButton,
  PasswordStrength,
  PasswordVisibilityButton,
  SubmitButton,
  TextButton,
  clerkErrorMessage,
} from "./AuthControls";

type Stage = "details" | "verify";

/**
 * `destination` arrives as a prop from the server page rather than being read
 * with useSearchParams. That is deliberate: useSearchParams forces a Suspense
 * boundary, and React's hidden streaming placeholder for that boundary was
 * duplicating `id="clerk-captcha"` into the document. Cloudflare Turnstile
 * refuses to render twice into the same id ("Turnstile has already been
 * rendered in this container"), so no bot-protection token was ever issued and
 * `signUp.password()` hung forever with no error.
 */
export function SignUpFlow({ destination }: { destination: string }) {
  const { signUp, fetchStatus } = useSignUp();
  const { isLoaded: isAuthLoaded, userId } = useAuth();
  const clerk = useClerk();
  const reduceMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [localBusy, setLocalBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [resumeFailed, setResumeFailed] = useState(false);
  const [sessionConflict, setSessionConflict] = useState(false);

  /**
   * When the captcha wait times out, Clerk's own promise never settles, so
   * `fetchStatus` stays "fetching" forever. Without this flag the error would
   * render under a button that is permanently disabled - visible, but not
   * recoverable. A timed-out attempt releases the button so it can be retried.
   */
  const [timedOut, setTimedOut] = useState(false);
  const busy = localBusy || (fetchStatus === "fetching" && !timedOut);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (!isAuthLoaded || !userId) return;

    setLocalBusy(true);
    setResumeFailed(false);
    try {
      window.location.assign(clerk.buildUrlWithAuth(destination));
    } catch {
      setLocalBusy(false);
      setResumeFailed(true);
      setError("Your existing session could not be resumed. Sign out, then try again.");
    }
  }, [clerk, destination, isAuthLoaded, userId]);

  async function continueWithActiveSession() {
    setError("");
    setLocalBusy(true);
    try {
      window.location.assign(clerk.buildUrlWithAuth(destination));
    } catch {
      setLocalBusy(false);
      setResumeFailed(true);
      setError("Your existing session could not be resumed. Try again or sign out first.");
    }
  }

  async function signOutAndCreateAccount() {
    setError("");
    setLocalBusy(true);
    try {
      const signupUrl = `/signup?redirect_url=${encodeURIComponent(destination)}`;
      // Complete the Clerk state transition before returning to this route.
      // Passing redirectUrl directly can preserve the old client snapshot for
      // one navigation and immediately trigger the active-session guard again.
      await clerk.signOut();
      window.location.assign(signupUrl);
    } catch {
      setLocalBusy(false);
      setError("We could not sign out this session. Refresh the page and try again.");
    }
  }

  function handleSignupError(value: unknown) {
    const message = clerkErrorMessage(value);
    if (/already signed in/i.test(message)) {
      setSessionConflict(true);
      setError("");
      return;
    }
    setError(message);
  }

  async function finalize() {
    if (!signUp) return;
    const { error: finalError } = await signUp.finalize({
      navigate: async ({ session }) => {
        if (session?.currentTask) {
          window.location.assign(clerk.buildUrlWithAuth(`/tasks/${session.currentTask.key}?redirect_url=${encodeURIComponent(destination)}`));
          return;
        }
        await clerk.redirectWithAuth(destination);
      },
    });
    if (finalError) handleSignupError(finalError);
  }

  async function sendVerificationCode() {
    if (!signUp) return false;
    const result = await signUp.verifications.sendEmailCode();
    if (result.error) {
      setError(clerkErrorMessage(result.error));
      return false;
    }
    setResendIn(30);
    return true;
  }

  /**
   * Clerk will not resolve `signUp.password()` until Cloudflare Turnstile has
   * produced a bot-protection token, and this instance requires one. If the
   * widget cannot render, that promise never settles and the button spins
   * forever with nothing to act on. Bound the wait and say what happened.
   */
  async function withCaptchaTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: number | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = window.setTimeout(() => {
            const err = new Error(
              "The security check did not finish. Reload the page and try again - "
              + "if it keeps happening, disable any extension blocking challenges.cloudflare.com.",
            );
            err.name = "CaptchaTimeout";
            reject(err);
          }, 25_000);
        }),
      ]);
    } finally {
      if (timer !== undefined) window.clearTimeout(timer);
    }
  }

  async function createAccount(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!signUp) {
      setError("Still connecting to the sign-up service. Try again in a moment.");
      return;
    }
    if (isAuthLoaded && userId) {
      setSessionConflict(true);
      setError("");
      return;
    }
    setError("");
    setTimedOut(false);
    setLocalBusy(true);
    try {
      const result = await withCaptchaTimeout(signUp.password({
        emailAddress: email.trim(),
        password,
        unsafeMetadata: { fullName: name.trim() },
      }));

      if (result.error) {
        handleSignupError(result.error);
        return;
      }

      if (signUp.status === "complete") {
        await finalize();
        return;
      }

      if (signUp.unverifiedFields.includes("email_address")) {
        if (await sendVerificationCode()) {
          setStage("verify");
          setCode("");
        }
        return;
      }

      const missing = signUp.missingFields.filter((field) => field !== "protect_check");
      setError(
        missing.length
          ? `Your Clerk configuration requires additional fields: ${missing.join(", ")}.`
          : "We could not complete your account. Please try again.",
      );
    } catch (caught) {
      if (caught instanceof Error && caught.name === "CaptchaTimeout") setTimedOut(true);
      handleSignupError(caught);
    } finally {
      setLocalBusy(false);
    }
  }

  async function verifyEmail(event: React.FormEvent) {
    event.preventDefault();
    if (!signUp || busy || code.length < 6) return;

    setError("");
    setLocalBusy(true);
    try {
      const result = await signUp.verifications.verifyEmailCode({ code });
      if (result.error) {
        setError(clerkErrorMessage(result.error));
        return;
      }
      if (signUp.status === "complete") {
        await finalize();
      } else {
        setError("Your email was verified, but the account still needs information. Please restart sign-up.");
      }
    } catch (caught) {
      setError(clerkErrorMessage(caught));
    } finally {
      setLocalBusy(false);
    }
  }

  async function resendCode() {
    if (busy || resendIn > 0) return;
    setError("");
    setLocalBusy(true);
    try {
      await sendVerificationCode();
    } finally {
      setLocalBusy(false);
    }
  }

  async function signUpWithGoogle() {
    if (!signUp || busy) return;
    setError("");
    const result = await signUp.sso({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectCallbackUrl: destination,
      unsafeMetadata: { source: "polaris-auth" },
    });
    if (result.error) handleSignupError(result.error);
  }

  function restart() {
    void signUp?.reset();
    setStage("details");
    setCode("");
    setError("");
    setSessionConflict(false);
    setResumeFailed(false);
  }

  if (isAuthLoaded && userId && !resumeFailed) {
    return <AuthHeading title="Opening your roadmap" description="Your session is active. Taking you back to Polaris…" />;
  }

  if (sessionConflict || (isAuthLoaded && userId)) {
    return (
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-2xl border border-[#C47D4E]/25 bg-[#FFFDF9] p-5 shadow-[0_18px_45px_-28px_rgba(44,24,16,0.55)]"
      >
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-[#B8546A]/[0.08] blur-2xl" />
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#A24159]">Session already active</p>
        <h1 className="mt-3 text-[24px] font-bold leading-tight tracking-[-0.025em] text-[#2C1810]">You’re already inside Polaris.</h1>
        <p className="mt-3 text-[13px] leading-6 text-[#7A6B5D]">
          This browser is signed in. Continue to your roadmap, or sign out first if you want to create a different account.
        </p>
        <AuthSuccess message="Your account details are safe. No new account was created." />
        <AuthError message={error} />
        <div className="mt-5 space-y-3">
          <button
            type="button"
            onClick={continueWithActiveSession}
            disabled={localBusy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#2C1810] px-5 text-[13px] font-bold text-[#FAF6F0] shadow-[0_14px_34px_-18px_rgba(44,24,16,0.65)] transition-colors hover:bg-[#4A311F] disabled:cursor-wait disabled:opacity-70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#C47D4E]"
          >
            {localBusy ? "Opening Polaris…" : "Continue to Polaris"}
            {!localBusy && <ArrowIcon />}
          </button>
          <button
            type="button"
            onClick={signOutAndCreateAccount}
            disabled={localBusy}
            className="w-full rounded-md py-1 text-center text-[12px] font-semibold text-[#A24159] underline-offset-4 transition-colors hover:text-[#2C1810] hover:underline disabled:cursor-wait disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-[#C47D4E]"
          >
            Sign out and create a new account
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <AnimatePresence mode="wait" initial={false}>
      {stage === "details" ? (
        <motion.div
          key="details"
          initial={reduceMotion ? false : { opacity: 0, x: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12, filter: "blur(3px)" }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <AuthHeading
            title="Create your Polaris account"
            description="Start free. Turn your goals, scores, and deadlines into a roadmap you can actually follow."
          />

          <GoogleButton busy={busy} onClick={signUpWithGoogle} label="Continue with Google" />
          <Divider />

          <form onSubmit={createAccount} className="space-y-4" noValidate>
            <AuthField
              id="name"
              label="Full name"
              value={name}
              onChange={setName}
              autoComplete="name"
              placeholder="Your name"
            />
            <AuthField
              id="email"
              label="Email address"
              type="email"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              placeholder="you@example.com"
            />
            <AuthField
              id="password"
              label="Password"
              type={passwordVisible ? "text" : "password"}
              value={password}
              onChange={setPassword}
              autoComplete="new-password"
              placeholder="8 characters or more"
              suffix={<PasswordVisibilityButton visible={passwordVisible} onToggle={() => setPasswordVisible((value) => !value)} />}
            />
            <PasswordStrength password={password} />

            <AuthError message={error} />
            <SubmitButton busy={busy}>Create my roadmap</SubmitButton>
          </form>

          <p className="mt-6 text-center text-[12px] text-[#7A6B5D]">
            Already have an account?{" "}
            <Link href="/signin" className="font-semibold text-[#A24159] underline-offset-4 hover:text-[#2C1810] hover:underline">
              Sign in
            </Link>
          </p>
        </motion.div>
      ) : (
        <motion.div
          key="verify"
          initial={reduceMotion ? false : { opacity: 0, x: 16, filter: "blur(4px)" }}
          animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
          exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <AuthHeading
            step="One last check"
            title="Verify your email"
            description={`We sent a six-digit code to ${email}. It expires shortly.`}
          />
          <AuthSuccess message="Your account details are saved. Verify the email to secure the account." />

          <form onSubmit={verifyEmail} className="mt-5 space-y-4">
            <CodeField value={code} onChange={setCode} />
            <AuthError message={error} />
            <SubmitButton busy={busy}>Verify and enter Polaris</SubmitButton>
          </form>

          <div className="mt-6 flex items-center justify-between gap-4">
            <TextButton onClick={restart}>Change details</TextButton>
            <TextButton onClick={resendCode} disabled={busy || resendIn > 0}>
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </TextButton>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/*
        Clerk mounts Cloudflare Turnstile into this container when Protect
        suspects bot traffic, and `signUp.password()` will not resolve until it
        has a token. Three properties are load-bearing, and all three were
        broken before:

          1. It exists exactly ONCE in the document. Turnstile rejects a second
             render into the same id and then never produces a token.
          2. It is never re-keyed or unmounted, so it survives the stage change.
          3. No ancestor carries a transform or filter, which is why the stage
             animations above no longer blur.
      */}
      <div
        id="clerk-captcha"
        data-cl-theme="light"
        data-cl-size="flexible"
        data-cl-language="auto"
        className="mt-4 min-h-0 overflow-hidden rounded-xl empty:mt-0 [&:not(:empty)]:min-h-[66px]"
      />
    </>
  );
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4" fill="none">
      <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
