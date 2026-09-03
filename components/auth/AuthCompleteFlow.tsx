"use client";

import { useClerk, useSession } from "@clerk/nextjs";
import { useEffect } from "react";
import { AuthShell } from "@/app/(auth)/AuthShell";
import { AuthHeading } from "./AuthControls";

export function AuthCompleteFlow({ destination }: { destination: string }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, session } = useSession();
  const currentTask = session?.currentTask?.key;

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      void clerk.redirectToSignIn({ redirectUrl: destination });
      return;
    }
    if (currentTask) {
      window.location.assign(clerk.buildUrlWithAuth(`/tasks/${currentTask}?redirect_url=${encodeURIComponent(destination)}`));
      return;
    }
    window.location.assign(clerk.buildUrlWithAuth(destination));
  }, [clerk, currentTask, destination, isLoaded, isSignedIn]);

  return (
    <AuthShell mode="task">
      <AuthHeading
        title="Securing your Polaris session"
        description="One last check, then we’ll open your roadmap."
      />
    </AuthShell>
  );
}
