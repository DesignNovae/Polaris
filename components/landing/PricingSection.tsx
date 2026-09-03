"use client";

/**
 * Pricing - rendered straight from the central plan catalog
 * (lib/billing/plans.ts), the same source /billing and the feature gates
 * use, so prices and promises can never drift between surfaces. Bengali
 * feature lists come from the catalog too. Unbuilt promises render with a
 * "Soon" tag, never as active benefits.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "@/lib/i18n/LangProvider";
import { startCheckout } from "@/components/PlanGate";
import { PLAN_CATALOG, formatMinor, type BillingCycle, type PlanDef } from "@/lib/billing/plans";
import { cn } from "@/lib/cn";
import { SectionIntro, Accent, Dot, Reveal, GCheck, GArrow } from "./shared";

export function PricingSection() {
  const { t, lang } = useLang();
  const [cycle, setCycle] = useState<BillingCycle>("monthly");

  return (
    <section id="pricing" data-section-theme="light" className="relative bg-paper">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-28">
        <SectionIntro
          eyebrow={t.pricing.eyebrow}
          title={<>{t.pricing.title.replace(/[.।]\s*$/, "")}<Dot /></>}
          sub={<>Start free - upgrade when the roadmap <Accent>earns it</Accent>.</>}
        />

        {/* Monthly / yearly toggle - mirrors /billing */}
        <Reveal delay={0.1}>
          <div className="mt-10 flex items-center justify-center">
            <div className="relative inline-flex items-center rounded-full bg-paper-soft ring-1 ring-inset ring-ink/[0.07] p-1">
              {(["monthly", "yearly"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCycle(c)}
                  className={cn(
                    "relative rounded-full px-5 py-2 text-[13px] font-semibold capitalize transition-colors",
                    cycle === c ? "text-ink" : "text-ink-muted hover:text-ink-dim",
                  )}
                >
                  {cycle === c && (
                    <motion.span
                      layoutId="landing-cycle-pill"
                      className="absolute inset-0 rounded-full bg-paper-card shadow-sm ring-1 ring-inset ring-ink/[0.06]"
                      transition={{ type: "spring", stiffness: 500, damping: 35 }}
                    />
                  )}
                  <span className="relative">{c}</span>
                  {c === "yearly" && (
                    <span className="relative ml-1.5 rounded-full bg-aurora-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-aurora-700">
                      2 months free
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-5 text-left items-stretch">
          {PLAN_CATALOG.map((def, i) => (
            <PricingCard
              key={def.id}
              def={def}
              cycle={cycle}
              lang={lang}
              cta={def.id === "free" ? t.pricing.ctaFree : def.id === "pro" ? t.pricing.ctaPro : t.pricing.ctaElite}
              delay={i * 0.12}
            />
          ))}
        </div>

        <Reveal delay={0.3}>
          <p className="mt-8 text-center text-[12.5px] text-ink-muted">
            Plans, payment methods, and receipts live in your account -{" "}
            <Link href="/billing" className="font-semibold text-polaris-500 hover:text-polaris-600 transition-colors">
              see billing
            </Link>
            . bKash, Nagad, Rocket, and cards supported.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function PricingCard({
  def, cycle, lang, cta, delay,
}: {
  def: PlanDef;
  cycle: BillingCycle;
  lang: string;
  cta: string;
  delay: number;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  const featured = !!def.popular;
  const usd = def.usd[cycle];
  const bdt = def.bdt[cycle];
  const features = lang === "bn" && def.featuresBn.length ? def.featuresBn : def.features;
  const comingSoon = lang === "bn" && def.comingSoonBn?.length ? def.comingSoonBn : def.comingSoon;

  async function handleClick() {
    if (def.id === "free") {
      router.push(session ? "/roadmap" : "/signup");
      return;
    }
    if (!session) {
      router.push(`/signup?next=upgrade&tier=${def.id}`);
      return;
    }
    setLoading(true);
    try { await startCheckout(def.id as "pro" | "elite"); } catch { setLoading(false); router.push("/billing"); }
  }

  return (
    <motion.div
      className={cn(
        "relative rounded-3xl p-7 sm:p-8 flex flex-col h-full",
        featured
          ? "bg-ink text-paper shadow-[0_30px_80px_-30px_rgba(44,24,16,0.5)]"
          : "bg-paper-card border border-ink/[0.06] shadow-[0_1px_0_rgba(139,94,60,0.04),0_24px_60px_-30px_rgba(139,94,60,0.18)]",
      )}
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ delay, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -7 }}
    >
      {featured && (
        <>
          <div
            aria-hidden
            className="absolute -inset-px rounded-3xl pointer-events-none"
            style={{ boxShadow: "0 0 50px -12px rgba(196,125,78,0.45)" }}
          />
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-signal-rose px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-white shadow-md">
            Most popular
          </div>
        </>
      )}

      <div className={cn("text-sm font-medium", featured ? "text-paper/70" : "text-ink")}>{def.name}</div>
      <div className="mt-3 min-h-[64px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={cycle}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-baseline gap-1">
              <span className={cn("font-sans text-4xl sm:text-5xl font-bold leading-none tabular-nums", featured ? "text-paper" : "text-ink")}>
                {usd === 0 ? "$0" : formatMinor(usd, "USD")}
              </span>
              <span className={cn("text-sm", featured ? "text-paper/55" : "text-ink-muted")}>
                {usd === 0 ? "forever" : cycle === "monthly" ? "/ month" : "/ year"}
              </span>
            </div>
            {bdt > 0 && (
              <div className={cn("mt-1 text-[11.5px] font-mono", featured ? "text-paper/50" : "text-ink-muted")}>
                {formatMinor(bdt, "BDT")} {cycle === "monthly" ? "/ mo" : "/ yr"} with bKash
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className={cn("mt-2 text-sm", featured ? "text-paper/65" : "text-ink-dim")}>{def.tagline}</div>
      <div className={cn("my-6 h-px", featured ? "bg-white/10" : "bg-ink/10")} />

      <ul className={cn("space-y-2.5 text-sm flex-1", featured ? "text-paper/80" : "text-ink-dim")}>
        {features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <span className={cn("mt-0.5 shrink-0", featured ? "text-aurora-400" : "text-aurora-500")}>
              <GCheck s={15} />
            </span>
            <span>{f}</span>
          </li>
        ))}
        {comingSoon?.map((f) => (
          <li key={f} className={cn("flex gap-2.5", featured ? "text-paper/45" : "text-ink-muted")}>
            <span className="mt-0.5 shrink-0 opacity-60" aria-hidden>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" />
              </svg>
            </span>
            <span>
              {f}
              <span className={cn(
                "ml-1.5 align-middle rounded-full px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em] font-bold ring-1 ring-inset",
                featured ? "bg-white/[0.07] text-paper/55 ring-white/15" : "bg-paper-soft text-ink-muted ring-ink/10",
              )}>
                Soon
              </span>
            </span>
          </li>
        ))}
      </ul>

      <button
        onClick={handleClick}
        disabled={loading}
        className={cn(
          "mt-7 inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-3 text-[13.5px] font-semibold transition-colors",
          featured
            ? "bg-paper text-ink hover:bg-paper-soft"
            : "bg-paper-soft text-ink hover:bg-paper-deep ring-1 ring-inset ring-ink/10",
          loading && "opacity-70 cursor-wait",
        )}
      >
        {loading ? "Redirecting…" : cta}
        <GArrow s={12} />
      </button>
    </motion.div>
  );
}

