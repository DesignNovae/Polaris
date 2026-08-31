"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Lenis from "lenis";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Routes where the document itself never scrolls - the (app) shell is locked
// to the viewport and each column manages its own scroll context. Lenis must
// stay OUT of these pages because it hijacks wheel events globally and would
// break native scrolling inside <main>, the strategist rail, and the left nav.
const APP_PREFIX_RE =
  /^\/(strategist|dashboard|account|billing|connections|deadlines|family|partners|consultants|community|bookings|resources|roadmap|settings|transactions|universities|admin|monitor|demo)(\/|$)/;

/**
 * SmoothScroll - wraps children in a Lenis smooth-scroll context
 * and wires it into GSAP ScrollTrigger so both systems stay in sync.
 *
 * Disabled on app workspace routes (see APP_PREFIX_RE) where the page is
 * locked to the viewport and each column owns its own scroll.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const enabled = !APP_PREFIX_RE.test(pathname);
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    lenisRef.current = lenis;

    // Sync Lenis → GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);

    const tick = (time: number) => {
      lenis.raf(time * 1000);
    };
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(tick);
      lenisRef.current = null;
    };
  }, [enabled]);

  return <>{children}</>;
}

