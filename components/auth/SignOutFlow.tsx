"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useAuth, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AuthError } from "./AuthControls";

export function SignOutFlow() {
  const { signOut } = useClerk();
  const { isLoaded, userId } = useAuth();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const started = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoaded) return;

    // React Strict Mode runs effects twice in development. The old page called
    // signOut twice, which could make the auth transition appear to repeat.
    if (started.current) return;
    started.current = true;

    if (!userId) {
      router.replace("/");
      return;
    }

    void signOut(() => router.replace("/")).catch(() => {
      setError("We could not close the session. Please refresh and try again.");
    });
  }, [isLoaded, router, signOut, userId]);

  return (
    <div className="py-8 text-center sm:py-12">
      <div className="relative mx-auto mb-7 h-20 w-20 [perspective:500px]">
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full border border-[#B8546A]/45"
          animate={reduceMotion ? undefined : { rotateX: [64, 72, 64], rotateZ: 360 }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          aria-hidden
          className="absolute inset-[13px] rounded-full border border-[#C47D4E]/55"
          animate={reduceMotion ? undefined : { rotateY: [62, 70, 62], rotateZ: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#B8546A] shadow-[0_0_24px_rgba(184,84,106,0.7)]" />
      </div>
      <h1 className="font-sans text-[30px] font-bold tracking-[-0.025em] text-[#2C1810]">Closing your session</h1>
      <p className="mx-auto mt-3 max-w-[34ch] text-[13px] leading-6 text-[#7A6B5D]">
        Your roadmap is saved. We’re securely signing you out of this device.
      </p>
      <div className="mx-auto mt-7 max-w-sm">
        <AuthError message={error} />
      </div>
    </div>
  );
}
