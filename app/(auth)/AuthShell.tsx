"use client";

import Link from "next/link";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { CompassLogo } from "@/components/Nav";

type AuthShellProps = {
  mode: "signin" | "signup" | "signout" | "task";
  children: React.ReactNode;
};

const PROOF = [
  "Your roadmap stays private",
  "Progress returns on every device",
  "Evidence-backed guidance, not guesswork",
];

/**
 * THESIS: Authentication feels like entering a living navigation instrument,
 * not filling out a vendor card.
 * OWN-WORLD: Polaris cocoa, warm paper, rose, terracotta and sage; solid
 * instrument panels, fine orbital lines and real depth from the landing page.
 * STORY: The student sees the journey, completes one clear step, and enters
 * their workspace without leaving Polaris visually or linguistically.
 * FIRST VIEWPORT: A dimensional astrolabe occupies the left field while the
 * focused authentication flow sits in a crisp, high-contrast right panel.
 * FORM: A responsive split-stage extension of the established Polaris world.
 */
export function AuthShell({ mode, children }: AuthShellProps) {
  const reduceMotion = useReducedMotion();
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const tiltX = useSpring(useTransform(pointerY, [-0.5, 0.5], [7, -7]), {
    stiffness: 120,
    damping: 20,
  });
  const tiltY = useSpring(useTransform(pointerX, [-0.5, 0.5], [-8, 8]), {
    stiffness: 120,
    damping: 20,
  });

  function trackPointer(event: React.PointerEvent<HTMLElement>) {
    if (reduceMotion) return;
    const rect = event.currentTarget.getBoundingClientRect();
    pointerX.set((event.clientX - rect.left) / rect.width - 0.5);
    pointerY.set((event.clientY - rect.top) / rect.height - 0.5);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <main
      className="auth-surface relative min-h-[100svh] overflow-hidden bg-[#2C1810] text-[#FAF6F0] selection:bg-[#B8546A]/35 selection:text-[#FAF6F0]"
      onPointerMove={trackPointer}
      onPointerLeave={resetPointer}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-[18rem] -top-[22rem] h-[50rem] w-[50rem] rounded-full bg-[#C47D4E]/14 blur-[120px]" />
        <div className="absolute -bottom-[24rem] right-[-12rem] h-[48rem] w-[48rem] rounded-full bg-[#5B8C6D]/14 blur-[130px]" />
        <div className="absolute left-[48%] top-[18%] h-32 w-32 rounded-full bg-[#B8546A]/14 blur-[60px]" />
      </div>

      <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="group inline-flex items-center gap-3 rounded-lg text-[#FAF6F0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C47D4E]"
          aria-label="Polaris home"
        >
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/[0.055] shadow-[0_12px_34px_-16px_rgba(0,0,0,0.8)] ring-1 ring-inset ring-[#FAF6F0]/15 transition-transform duration-300 group-hover:-translate-y-0.5">
            <CompassLogo onDark className="scale-90" />
          </span>
          <span className="font-serif text-[20px] font-bold tracking-[-0.02em]">Polaris</span>
        </Link>

        {mode !== "signout" && (
          <Link
            href="/demo"
            className="hidden items-center gap-2 text-[12px] font-medium text-[#D1BFB0] transition-colors hover:text-[#FAF6F0] sm:inline-flex"
          >
            Explore the demo
            <ArrowIcon />
          </Link>
        )}
      </header>

      <div className="relative z-10 mx-auto grid min-h-[100svh] w-full max-w-[1480px] items-center gap-10 px-5 pb-10 pt-28 sm:px-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(390px,0.72fr)] lg:gap-16 lg:px-12 lg:pb-14 lg:pt-24 xl:gap-24">
        <section className="relative hidden min-h-[650px] lg:flex lg:flex-col lg:justify-center" aria-label="Polaris journey preview">
          <motion.div
            className="relative z-10 max-w-[620px]"
            initial={reduceMotion ? false : { opacity: 0, x: -22 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="max-w-[620px] text-balance font-sans text-[clamp(2.8rem,5vw,5.4rem)] font-bold leading-[0.98] tracking-[-0.035em] text-[#FAF6F0]">
              Find your bearing. <span className="font-serif font-normal italic text-[#D58FA4]">Build what comes next.</span>
            </p>
            <p className="mt-7 max-w-[520px] text-[16px] leading-7 text-[#D1BFB0]">
              Polaris turns a distant university goal into the next clear move—then keeps the plan honest as your scores, evidence, and deadlines change.
            </p>
          </motion.div>

          <motion.div
            className="relative mt-12 h-[270px] w-full max-w-[660px] [perspective:1100px]"
            style={reduceMotion ? undefined : { rotateX: tiltX, rotateY: tiltY }}
          >
            <NavigationInstrument reduceMotion={Boolean(reduceMotion)} />
          </motion.div>

          <ul className="relative z-10 mt-6 grid max-w-[660px] grid-cols-3 gap-5 border-t border-[#FAF6F0]/[0.12] pt-5">
            {PROOF.map((item) => (
              <li key={item} className="flex gap-2.5 text-[11.5px] leading-[1.55] text-[#C7B3A2]">
                <span className="mt-[5px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#D58FA4] shadow-[0_0_12px_rgba(184,84,106,0.5)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>

        <motion.section
          className="relative mx-auto w-full max-w-[510px] lg:mx-0 lg:justify-self-end"
          initial={reduceMotion ? false : { opacity: 0, y: 24, rotateY: -3 }}
          animate={{ opacity: 1, y: 0, rotateY: 0 }}
          transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="absolute -inset-10 -z-10 bg-[radial-gradient(circle,rgba(196,125,78,0.18),transparent_64%)] blur-2xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl bg-[#FAF6F0] shadow-[0_40px_100px_-38px_rgba(20,8,4,0.95),0_18px_44px_-30px_rgba(196,125,78,0.55)] ring-1 ring-inset ring-[#8B5E3C]/15">
            <div className="h-[3px] w-full bg-[linear-gradient(90deg,#B8546A_0%,#B8546A_48%,#5B8C6D_48%,#5B8C6D_61%,transparent_61%)]" aria-hidden />
            <div className="p-6 sm:p-9">{children}</div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-5 text-[#C7B3A2]">
            Protected by encrypted session security. Polaris never stores your password.
          </p>
        </motion.section>
      </div>

      <div aria-hidden className="absolute bottom-5 left-6 hidden items-center gap-3 text-[10px] uppercase tracking-[0.19em] text-[#9F8875] lg:flex">
        <span className="h-px w-10 bg-[#9F8875]/50" />
        Academic strategy, always in motion
      </div>
    </main>
  );
}

function NavigationInstrument({ reduceMotion }: { reduceMotion: boolean }) {
  return (
    <div className="absolute inset-0 [transform-style:preserve-3d]">
      <motion.div
        className="absolute left-[15%] top-[9%] h-56 w-56 rounded-full border border-[#D58FA4]/35 [transform-style:preserve-3d]"
        animate={reduceMotion ? undefined : { rotateZ: 360 }}
        transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
        style={{ transform: "rotateX(67deg) rotateZ(12deg)" }}
      >
        <span className="absolute left-1/2 top-[-5px] h-2.5 w-2.5 rounded-full bg-[#D58FA4] shadow-[0_0_22px_rgba(184,84,106,0.85)]" />
      </motion.div>
      <motion.div
        className="absolute left-[6%] top-[22%] h-44 w-[330px] rounded-[50%] border border-[#C47D4E]/30"
        animate={reduceMotion ? undefined : { rotateZ: -360 }}
        transition={{ duration: 34, repeat: Infinity, ease: "linear" }}
        style={{ transform: "rotateX(69deg) rotateZ(-8deg) translateZ(32px)" }}
      />
      <div className="absolute left-[30%] top-[34%] grid h-24 w-24 place-items-center rounded-full bg-[#3A2718] shadow-[0_24px_70px_-16px_rgba(184,84,106,0.55)] ring-1 ring-inset ring-[#D58FA4]/35 [transform:translateZ(70px)]">
        <NorthStarIcon />
      </div>

      <motion.div
        className="absolute right-[8%] top-[8%] w-[240px] rounded-xl bg-[#3A2718] p-4 shadow-[0_24px_50px_-24px_rgba(0,0,0,0.9)] ring-1 ring-inset ring-[#FAF6F0]/[0.12] [transform:translateZ(45px)_rotateY(-7deg)]"
        animate={reduceMotion ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#E5B0BF]">Illustrative progress</span>
          <span className="h-2 w-2 rounded-full bg-[#8FB89A] shadow-[0_0_12px_rgba(91,140,109,0.7)]" />
        </div>
        <p className="mt-3 font-serif text-[17px] font-bold text-[#FAF6F0]">Build application evidence</p>
        <div className="mt-4 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
            <motion.div
              className="h-full rounded-full bg-[#D58FA4]"
              initial={{ width: "0%" }}
              animate={{ width: "68%" }}
              transition={{ duration: reduceMotion ? 0 : 1.1, delay: 0.35 }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-[#D1BFB0]">68%</span>
        </div>
      </motion.div>

      <motion.div
        className="absolute bottom-[2%] left-[3%] w-[250px] rounded-xl bg-[#FAF6F0] p-4 text-[#2C1810] shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)] [transform:translateZ(54px)_rotateY(5deg)]"
        animate={reduceMotion ? undefined : { y: [0, 6, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-[0.17em] text-[#8B5E3C]">Sample next move</span>
            <p className="mt-2 text-[13px] font-semibold leading-5">Complete SAT diagnostic</p>
          </div>
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#E3EEE6] text-[#365A41]">
            <CheckIcon />
          </span>
        </div>
      </motion.div>

      <div className="absolute bottom-[16%] right-[17%] h-2 w-2 rounded-full bg-[#C47D4E] shadow-[0_0_20px_rgba(196,125,78,0.9)]" />
      <div className="absolute left-[49%] top-[10%] h-1.5 w-1.5 rounded-full bg-[#FAF6F0]/80" />
      <div className="absolute right-[4%] top-[54%] h-1 w-1 rounded-full bg-[#8FB89A]/80" />
    </div>
  );
}

function NorthStarIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" aria-hidden>
      <circle cx="23" cy="23" r="21" stroke="#D58FA4" strokeOpacity=".32" />
      <path d="M23 5.5 27 19l13.5 4L27 27l-4 13.5L19 27 5.5 23 19 19 23 5.5Z" fill="#D58FA4" />
      <circle cx="23" cy="23" r="4" fill="#C47D4E" />
      <circle cx="23" cy="23" r="1.5" fill="#2C1810" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden>
      <path d="M2.5 7.5h9m-3.5-3.5 3.5 3.5L8 11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="m3.2 8.4 3 3 6.6-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
