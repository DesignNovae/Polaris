"use client";

import { useEffect, useRef, useCallback } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/* ─── Fade-up on scroll ─── */
export function useFadeUp<T extends HTMLElement>(
  options?: { delay?: number; duration?: number; y?: number }
) {
  const ref = useRef<T>(null);
  const { delay = 0, duration = 0.9, y = 60 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [delay, duration, y]);

  return ref;
}

/* ─── Staggered children reveal ─── */
export function useStaggerReveal<T extends HTMLElement>(
  options?: { stagger?: number; duration?: number; y?: number }
) {
  const ref = useRef<T>(null);
  const { stagger = 0.12, duration = 0.8, y = 50 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const children = el.children;
    if (!children.length) return;

    gsap.fromTo(
      children,
      { opacity: 0, y },
      {
        opacity: 1,
        y: 0,
        duration,
        stagger,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [stagger, duration, y]);

  return ref;
}

/* ─── Parallax (slow float on scroll) ─── */
export function useParallax<T extends HTMLElement>(speed = 0.3) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.to(el, {
      yPercent: -speed * 100,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: 1,
      },
    });

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [speed]);

  return ref;
}

/* ─── Scale reveal (zoom from 0.85 → 1) ─── */
export function useScaleReveal<T extends HTMLElement>(
  options?: { delay?: number; duration?: number }
) {
  const ref = useRef<T>(null);
  const { delay = 0, duration = 1 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { opacity: 0, scale: 0.85 },
      {
        opacity: 1,
        scale: 1,
        duration,
        delay,
        ease: "power2.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [delay, duration]);

  return ref;
}

/* ─── Horizontal slide-in ─── */
export function useSlideIn<T extends HTMLElement>(
  direction: "left" | "right" = "left",
  options?: { duration?: number; delay?: number }
) {
  const ref = useRef<T>(null);
  const { duration = 0.9, delay = 0 } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const x = direction === "left" ? -80 : 80;

    gsap.fromTo(
      el,
      { opacity: 0, x },
      {
        opacity: 1,
        x: 0,
        duration,
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 88%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [direction, duration, delay]);

  return ref;
}

/* ─── Counter animation (numbers count up) ─── */
export function useCountUp<T extends HTMLElement>(
  endValue: number,
  options?: { duration?: number; prefix?: string; suffix?: string }
) {
  const ref = useRef<T>(null);
  const { duration = 2, prefix = "", suffix = "" } = options ?? {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const obj = { val: 0 };

    gsap.to(obj, {
      val: endValue,
      duration,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 90%",
        toggleActions: "play none none none",
      },
      onUpdate: () => {
        el.textContent = `${prefix}${Math.round(obj.val)}${suffix}`;
      },
    });

    return () => {
      ScrollTrigger.getAll()
        .filter((st) => st.trigger === el)
        .forEach((st) => st.kill());
    };
  }, [endValue, duration, prefix, suffix]);

  return ref;
}

/* ─── Magnetic hover effect ─── */
export function useMagnetic<T extends HTMLElement>(strength = 0.3) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      const rect = el!.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      gsap.to(el, { x, y, duration: 0.4, ease: "power2.out" });
    }

    function onLeave() {
      gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
    }

    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);

    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, [strength]);

  return ref;
}

