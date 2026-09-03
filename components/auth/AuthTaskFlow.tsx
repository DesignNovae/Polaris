"use client";

import { TaskChooseOrganization, TaskResetPassword, TaskSetupMFA, useClerk, useSession } from "@clerk/nextjs";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { AuthHeading } from "./AuthControls";
import { AuthShell } from "@/app/(auth)/AuthShell";

type TaskKey = "choose-organization" | "reset-password" | "setup-mfa";

const taskAppearance = {
  variables: {
    colorPrimary: "#C47D4E",
    colorText: "#2C1810",
    colorTextSecondary: "#7A6B5D",
    colorBackground: "#FAF6F0",
    colorInputBackground: "#FFFFFF",
    colorInputText: "#2C1810",
    borderRadius: "0.75rem",
    fontFamily: "var(--font-inter), system-ui, sans-serif",
  },
  elements: {
    card: "!w-full !max-w-none !bg-transparent !p-0 !shadow-none",
    logoBox: "hidden",
    footer: "hidden",
    footerAction: "hidden",
    footerActionLink: "!text-[#A24159] hover:!text-[#2C1810]",
    headerTitle: "!text-[#2C1810]",
    headerSubtitle: "!text-[#7A6B5D]",
    formFieldLabel: "!text-[#4A311F]",
    formFieldInput: "!border-[#8B5E3C]/20 !bg-white !text-[#2C1810]",
    formButtonPrimary: "!bg-[#2C1810] hover:!bg-[#4A311F]",
  },
};

export function AuthTaskFlow({ task, destination }: { task: TaskKey | null; destination: string }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn, session } = useSession();
  const reduceMotion = useReducedMotion();
  const completeUrl = `/auth-complete?redirect_url=${encodeURIComponent(destination)}`;
  const currentTask = session?.currentTask?.key;
  const visibleTask = currentTask ?? task;

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (currentTask && currentTask !== task) {
      window.location.assign(clerk.buildUrlWithAuth(`/tasks/${currentTask}?redirect_url=${encodeURIComponent(destination)}`));
      return;
    }
    if (currentTask) return;
    window.location.assign(clerk.buildUrlWithAuth(destination));
  }, [clerk, currentTask, destination, isLoaded, isSignedIn, task]);

  return (
    <AuthShell mode="task">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 10, filter: "blur(4px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        {visibleTask === "choose-organization" && (
          <TaskChooseOrganization
            redirectUrlComplete={completeUrl}
            appearance={taskAppearance}
          />
        )}
        {visibleTask === "reset-password" && (
          <TaskResetPassword
            redirectUrlComplete={completeUrl}
            appearance={taskAppearance}
          />
        )}
        {visibleTask === "setup-mfa" && (
          <TaskSetupMFA
            redirectUrlComplete={completeUrl}
            appearance={taskAppearance}
          />
        )}
        {!visibleTask && (
          <AuthHeading
            title="Returning to Polaris"
            description="Your secure session is being restored."
          />
        )}
      </motion.div>
    </AuthShell>
  );
}
