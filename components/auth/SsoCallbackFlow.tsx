"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { AuthHeading } from "./AuthControls";

/**
 * Completes an OAuth handshake.
 *
 * `AuthenticateWithRedirectCallback` reads the provider's response from the
 * URL, activates the session, and navigates on. The two fallback URLs matter:
 * a brand-new social account has no Polaris account yet and must land on
 * sign-up rather than bouncing between the two pages.
 */
export function SsoCallbackFlow({ destination }: { destination: string }) {
  return (
    <>
      <AuthHeading
        title="Finishing your sign-in"
        description="Confirming the details with your provider, then opening your roadmap."
      />
      <AuthenticateWithRedirectCallback
        signInUrl="/signin"
        signUpUrl="/signup"
        signInFallbackRedirectUrl={destination}
        signUpFallbackRedirectUrl={destination}
        continueSignUpUrl="/signup"
      />
    </>
  );
}
