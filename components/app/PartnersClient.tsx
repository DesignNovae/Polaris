"use client";

/**
 * Partners - the honest marketplace.
 *
 *   Hero + transparent commission disclosure
 *   Tabs: Matched for you · Score boosters · Application boosters ·
 *         Free student stuff · Saved & claimed · Coming soon
 *   3D offer cards with type badges + match-reason ribbons
 *   Detail modal: why recommended, eligibility, source + last-verified,
 *                 claim flow (real links only), save, add-to-roadmap,
 *                 Ask Strategist
 *
 * No invented codes, discounts, or affiliate links - the registry contains
 * only real student benefits, no-commission recommendations, and honest
 * coming-soon partnerships. Free options always surface first.
 */

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { roadmapStore } from "@/lib/roadmap/store";
import type { EducationLevel } from "@/lib/roadmap/types";
import {
  PARTNER_DISCLOSURE, OFFER_TYPE_META, resolveOfferLink, type PartnerOffer,
} from "@/lib/partners/registry";
import { matchOffers, sectionize, type MatchedOffer } from "@/lib/partners/matching";
import { BrandLogo, type BrandKey } from "./BrandLogos";
import { GemmaOfferRefresh } from "./GemmaOfferRefresh";
import { Icon } from "./ui";
import { cn } from "@/lib/cn";

const BRAND_KEYS = new Set(["notion", "obsidian", "gcal", "github", "khan", "codeforces", "gdrive", "linkedin"]);
const SAVED_KEY = "polaris.partners.saved";
const CLAIMS_KEY = "polaris.partners.claims";
const WISHLIST_KEY = "polaris.unis.wishlist";

type ClaimRecord = { offerId: string; title: string; at: number; url: string };
type Tab = "matched" | "score" | "app" | "free" | "saved" | "coming";

export function PartnersClient({
  level, roadmapTopics, weakScores, deadlineTypesSoon, eliteUniIds,
}: {
  level: EducationLevel;
  roadmapTopics: string[];
  weakScores: Array<{ key: string; label: string; ratio: number }>;
  deadlineTypesSoon: string[];
  eliteUniIds: string[];
}) {
  const [tab, setTab] = useState<Tab>("matched");
  const [openId, setOpenId] = useState<string | null>(null);
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [claims, setClaims] = useState<ClaimRecord[]>([]);
  const [aimsElite, setAimsElite] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(SAVED_KEY);
      if (s) setSaved(new Set(JSON.parse(s)));
      const c = localStorage.getItem(CLAIMS_KEY);
      if (c) setClaims(JSON.parse(c));
      const w = localStorage.getItem(WISHLIST_KEY);
      if (w) {
        const ids = new Set<string>(JSON.parse(w));
        setAimsElite(eliteUniIds.some((id) => ids.has(id)));
      }
    } catch { /* ignore */ }
  }, [eliteUniIds]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const matches = useMemo(
    () => matchOffers({ level, roadmapTopics, weakScores, aimsElite, deadlineTypesSoon }),
    [level, roadmapTopics, weakScores, aimsElite, deadlineTypesSoon],
  );
  const sections = useMemo(() => sectionize(matches), [matches]);

  function toggleSave(o: PartnerOffer) {
    setSaved((cur) => {
      const next = new Set(cur);
      if (next.has(o.id)) next.delete(o.id);
      else {
        next.add(o.id);
        roadmapStore.emit("PARTNER_OFFER_SAVED", `Saved offer "${o.title}"`);
      }
      try { localStorage.setItem(SAVED_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  function recordClaim(o: PartnerOffer, url: string) {
    const rec: ClaimRecord = { offerId: o.id, title: o.title, at: Date.now(), url };
    setClaims((cur) => {
      const next = [rec, ...cur.filter((c) => c.offerId !== o.id)].slice(0, 30);
      try { localStorage.setItem(CLAIMS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    roadmapStore.emit(
      o.offerType === "free_student_benefit" ? "PARTNER_FREEBIE_OPENED" : "PARTNER_OFFER_CLAIMED",
      `Claimed "${o.title}" (${OFFER_TYPE_META[o.offerType].label})`,
    );
  }

  const open = matches.find((m) => m.offer.id === openId) ?? null;
  const savedMatches = matches.filter((m) => saved.has(m.offer.id));

  const TABS: Array<{ id: Tab; label: string; count: number }> = [
    { id: "matched", label: "Matched for you", count: sections.matched.length },
    { id: "score", label: "Score boosters", count: sections.scoreBoost.length },
    { id: "app", label: "Application boosters", count: sections.appBoost.length },
    { id: "free", label: "Free student stuff", count: sections.free.length },
    { id: "saved", label: "Saved & claimed", count: savedMatches.length + claims.length },
    { id: "coming", label: "Coming soon", count: sections.comingSoon.length },
  ];

  const list: MatchedOffer[] =
    tab === "matched" ? sections.matched :
    tab === "score" ? sections.scoreBoost :
    tab === "app" ? sections.appBoost :
    tab === "free" ? sections.free :
    tab === "coming" ? sections.comingSoon :
    savedMatches;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 lg:py-7 max-w-[1240px] mx-auto">
      {/* ─── Hero ─── */}
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mb-5">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-1.5">Partner marketplace</div>
        <h1 className="font-serif text-[28px] sm:text-[34px] leading-[1.05] font-bold tracking-tight text-ink">
          Tools matched to <span className="grad-text">your actual gaps</span>
        </h1>
        <p className="text-[12.5px] text-ink-dim mt-2 max-w-2xl leading-relaxed">
          Recommendations come from your roadmap, scores, and deadlines - free options always first.
        </p>
      </motion.div>

      {/* ─── Disclosure ─── */}
      <div className="mb-5 app-glass rounded-2xl px-4 py-3 flex items-start gap-3">
        <span className="shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-gradient-to-br from-aurora-500/20 to-aurora-500/5 ring-1 ring-inset ring-aurora-400/30 flex items-center justify-center text-aurora-600 dark:text-aurora-200">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4"/></svg>
        </span>
        <p className="text-[11.5px] text-ink-dim leading-relaxed">{PARTNER_DISCLOSURE}</p>
      </div>

      <GemmaOfferRefresh
        level={level}
        roadmapTopics={roadmapTopics}
        weakScores={weakScores}
        deadlineTypesSoon={deadlineTypesSoon}
      />

      {/* ─── Tabs ─── */}
      <div className="flex flex-wrap items-center gap-1.5 mb-5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "h-9 text-[12px] font-medium px-3.5 rounded-xl ring-1 ring-inset transition-colors inline-flex items-center gap-1.5",
              tab === t.id ? "bg-ink text-paper ring-ink" : "bg-paper-card text-ink-dim ring-polaris-500/15 hover:text-ink dark:ring-white/[0.12]",
            )}
          >
            {t.label}
            <span className={cn("font-mono text-[10px]", tab === t.id ? "text-paper/60" : "text-ink-muted")}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      {tab === "saved" ? (
        <SavedView savedMatches={savedMatches} claims={claims} onOpen={setOpenId} />
      ) : list.length === 0 ? (
        <div className="app-glass rounded-2xl p-12 text-center">
          <div className="font-serif text-[18px] font-bold text-ink">Nothing here yet</div>
          <p className="text-[12.5px] text-ink-dim mt-1.5 max-w-md mx-auto">
            {tab === "matched"
              ? "Generate a roadmap and log scores - matches sharpen as Polaris learns your gaps."
              : "Check the other tabs, or save offers to find them here."}
          </p>
        </div>
      ) : (
        <motion.div
          key={tab}
          initial="hidden" animate="visible"
          variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.04 } } }}
          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5"
        >
          {list.map((m) => (
            <OfferCard
              key={m.offer.id}
              m={m}
              saved={saved.has(m.offer.id)}
              onOpen={() => {
                setOpenId(m.offer.id);
                roadmapStore.emit("PARTNER_OFFER_VIEWED", `Viewed offer "${m.offer.title}"`);
              }}
              onSave={() => toggleSave(m.offer)}
            />
          ))}
        </motion.div>
      )}

      {/* ─── Modal + toast ─── */}
      <AnimatePresence>
        {open && (
          <OfferModal
            key={open.offer.id}
            m={open}
            saved={saved.has(open.offer.id)}
            claimed={claims.some((c) => c.offerId === open.offer.id)}
            onClose={() => setOpenId(null)}
            onSave={() => toggleSave(open.offer)}
            onClaim={(url) => recordClaim(open.offer, url)}
            onToast={setToast}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] rounded-full bg-ink text-paper px-5 py-2.5 text-[12.5px] font-medium shadow-pop max-w-[90vw] truncate"
          >
            ✦ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── brand mark ─── */

function OfferMark({ o, size = 42 }: { o: PartnerOffer; size?: number }) {
  const inner = BRAND_KEYS.has(o.brand ?? "")
    ? <BrandLogo brand={o.brand as BrandKey} width={size * 0.5} height={size * 0.5} />
    : <span className="font-serif font-bold" style={{ fontSize: size * 0.4 }}>{o.partnerName[0]}</span>;
  return (
    <span
      data-no-translate
      className="inline-flex items-center justify-center rounded-xl text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.2),0_5px_14px_-6px_rgba(0,0,0,0.4)]"
      style={{ background: o.color, height: size, width: size }}
      aria-label={o.partnerName}
    >
      {inner}
    </span>
  );
}

/* ─── type badge ─── */

function TypeBadge({ o }: { o: PartnerOffer }) {
  const meta = OFFER_TYPE_META[o.offerType];
  const cls = {
    aurora: "bg-aurora-100 text-aurora-700 ring-aurora-400/40 dark:bg-aurora-400/15 dark:text-aurora-100 dark:ring-aurora-400/30",
    polaris: "bg-polaris-100 text-polaris-700 ring-polaris-300 dark:bg-polaris-400/15 dark:text-polaris-100 dark:ring-polaris-400/30",
    nova: "bg-nova-100 text-nova-600 ring-nova-400/40 dark:bg-nova-400/15 dark:text-nova-100 dark:ring-nova-400/30",
    rose: "bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-400/30",
    ink: "bg-paper-deep text-ink-muted ring-ink-faint/30 dark:bg-white/[0.06] dark:ring-white/[0.1]",
  }[meta.tone];
  return (
    <span className={cn("text-[9px] uppercase tracking-wider font-bold rounded-full px-1.5 py-[2px] ring-1 ring-inset", cls)}>
      {meta.label}
    </span>
  );
}

/* ─── 3D offer card ─── */

function OfferCard({
  m, saved, onOpen, onSave,
}: {
  m: MatchedOffer;
  saved: boolean;
  onOpen: () => void;
  onSave: () => void;
}) {
  const o = m.offer;
  const coming = o.status === "coming_soon";
  return (
    <motion.div
      variants={{ hidden: { opacity: 0, y: 14 }, visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } } }}
      whileHover={{ y: -5, rotateX: 1.5, rotateY: -1.5, transition: { duration: 0.25 } }}
      style={{ transformStyle: "preserve-3d", perspective: 800 }}
      onClick={onOpen}
      className={cn(
        "app-glass rounded-2xl p-4 relative overflow-hidden group cursor-pointer flex flex-col",
        coming && "opacity-75",
      )}
    >
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none bg-gradient-to-br from-polaris-200/15 via-transparent to-aurora-200/10" />
      <div className="relative flex items-start gap-3 mb-2">
        <span className="group-hover:scale-105 group-hover:-rotate-2 transition-transform duration-300">
          <OfferMark o={o} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-bold text-ink leading-snug">{o.title}</div>
          <div className="text-[10.5px] text-ink-muted mt-0.5">{o.partnerName}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          aria-label={saved ? "Unsave" : "Save"}
          className={cn("p-1 rounded-md transition-all shrink-0", saved ? "text-rose-500 scale-110" : "text-ink-muted/50 hover:text-rose-500 hover:scale-110")}
        >
          <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      </div>

      <div className="relative flex flex-wrap items-center gap-1.5 mb-2">
        <TypeBadge o={o} />
        {o.estimatedValue && (
          <span className="text-[10px] font-bold text-aurora-700 dark:text-aurora-100 bg-aurora-100 dark:bg-aurora-400/15 ring-1 ring-inset ring-aurora-400/40 rounded-full px-2 py-0.5">
            {o.estimatedValue}
          </span>
        )}
      </div>

      <p className="relative text-[11.5px] text-ink-dim leading-relaxed line-clamp-2 mb-2.5">{o.description}</p>

      {/* match-reason ribbon */}
      {!coming && m.reasons[0] && (
        <div className="relative mt-auto rounded-lg bg-polaris-100/50 dark:bg-polaris-400/10 ring-1 ring-inset ring-polaris-400/25 px-2.5 py-1.5 text-[10.5px] text-ink leading-snug">
          <span className="font-bold text-polaris-600 dark:text-polaris-300">Why: </span>{m.reasons[0]}
        </div>
      )}
      {coming && (
        <div className="relative mt-auto text-[10.5px] text-ink-muted italic">{o.comingSoonReason}</div>
      )}
    </motion.div>
  );
}

/* ─── saved & claimed view ─── */

function SavedView({
  savedMatches, claims, onOpen,
}: {
  savedMatches: MatchedOffer[];
  claims: ClaimRecord[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-serif text-[17px] font-bold text-ink mb-3">Saved offers <span className="text-[11px] font-mono text-ink-muted font-normal">· {savedMatches.length}</span></h2>
        {savedMatches.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted italic">Nothing saved yet - tap the bookmark on any offer.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {savedMatches.map((m) => (
              <button key={m.offer.id} onClick={() => onOpen(m.offer.id)} className="app-glass rounded-2xl p-3.5 text-left flex items-center gap-3 hover:-translate-y-0.5 transition-transform">
                <OfferMark o={m.offer} size={36} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-semibold text-ink truncate">{m.offer.title}</span>
                  <span className="block text-[10.5px] text-ink-muted truncate">{m.offer.partnerName}</span>
                </span>
                <Icon.chev size={12} />
              </button>
            ))}
          </div>
        )}
      </section>
      <section>
        <h2 className="font-serif text-[17px] font-bold text-ink mb-3">Claim history <span className="text-[11px] font-mono text-ink-muted font-normal">· {claims.length}</span></h2>
        {claims.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted italic">No claims yet. Claimed offers are tracked here.</p>
        ) : (
          <ul className="space-y-1.5">
            {claims.map((c) => (
              <li key={`${c.offerId}-${c.at}`} className="flex items-center gap-3 rounded-xl bg-paper-card hairline px-3.5 py-2.5 text-[12px]">
                <span className="h-1.5 w-1.5 rounded-full bg-aurora-500 shrink-0" />
                <span className="font-medium text-ink flex-1 min-w-0 truncate">{c.title}</span>
                <span className="font-mono text-[10.5px] text-ink-muted shrink-0">{new Date(c.at).toLocaleDateString()}</span>
                <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline shrink-0">Reopen ↗</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/* ─── detail modal + claim flow ─── */

function OfferModal({
  m, saved, claimed, onClose, onSave, onClaim, onToast,
}: {
  m: MatchedOffer;
  saved: boolean;
  claimed: boolean;
  onClose: () => void;
  onSave: () => void;
  onClaim: (url: string) => void;
  onToast: (t: string) => void;
}) {
  const o = m.offer;
  const link = resolveOfferLink(o);
  const [busy, setBusy] = useState(false);
  const hasRoadmap = !!roadmapStore.get().doc;

  function claim() {
    if (!link) return;
    onClaim(link);
    window.open(link, "_blank", "noopener,noreferrer");
  }

  async function addToRoadmap() {
    setBusy(true);
    try {
      const r = await fetch("/api/roadmap/v2/adapt", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reason: `Add a concrete task that uses "${o.title}" (${o.partnerWebsite || o.officialOfferUrl}) on the matching branch. It addresses: ${m.reasons.join("; ")}. The tool offers: ${o.benefits.join(", ")}.`,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.doc) {
        roadmapStore.setDoc(d.doc);
        roadmapStore.emit("PARTNER_OFFER_ADDED_TO_ROADMAP", `Added "${o.title}" to the roadmap`);
        onToast(`"${o.title}" worked into your roadmap`);
        onClose();
      } else {
        onToast(d?.error ?? "Couldn't update the roadmap - try again");
      }
    } finally {
      setBusy(false);
    }
  }

  function askStrategist() {
    window.dispatchEvent(new CustomEvent("polaris:openAgentRail", {
      detail: { draft: `Is "${o.title}" (${OFFER_TYPE_META[o.offerType].label}) worth my time right now? It was recommended because: ${m.reasons.join("; ")}. Tell me if a free alternative covers it first. ` },
    }));
    onClose();
  }

  function requestPartner() {
    roadmapStore.emit("PARTNER_COMING_SOON_REQUESTED", `Requested partner "${o.title}"`);
    onToast(`Noted - we'll prioritize ${o.title}`);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/45 backdrop-blur-sm p-4 sm:p-8"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 14, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.95, y: 14, opacity: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[540px] max-h-[88vh] overflow-y-auto overscroll-contain rounded-3xl bg-paper-card shadow-pop ring-1 ring-inset ring-polaris-500/10 dark:ring-white/[0.12]"
      >
        {/* header */}
        <div className="px-6 pt-5 pb-4 border-b border-polaris-500/10 dark:border-white/[0.08] flex items-start gap-3.5">
          <OfferMark o={o} size={48} />
          <div className="min-w-0 flex-1">
            <h2 className="font-serif text-[19px] font-bold tracking-tight text-ink leading-tight">{o.title}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <TypeBadge o={o} />
              {o.commission ? (
                <span className="text-[9px] uppercase tracking-wider font-bold text-rose-600 dark:text-rose-200">may earn commission</span>
              ) : (
                <span className="text-[9px] uppercase tracking-wider font-bold text-aurora-700 dark:text-aurora-200">no commission</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1.5" aria-label="Close"><Icon.close /></button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <p className="text-[12.5px] text-ink leading-relaxed">{o.description}</p>

          {/* why recommended */}
          {o.status === "active" && (
            <section className="relative rounded-xl p-[1.5px] overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-polaris-400/60 via-nova-400/50 to-aurora-400/60" />
              <div className="relative rounded-[10.5px] bg-paper-card px-4 py-3">
                <div className="text-[10.5px] uppercase tracking-wider font-bold text-polaris-600 dark:text-polaris-300 mb-1">Why Polaris recommends this</div>
                <ul className="space-y-1">
                  {m.reasons.map((r) => (
                    <li key={r} className="text-[12px] text-ink leading-relaxed flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-polaris-500 shrink-0" /> {r}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          {/* benefits + eligibility */}
          <section className="grid sm:grid-cols-2 gap-2.5">
            <div className="rounded-xl bg-paper-soft px-3 py-2.5">
              <div className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted mb-1">You get</div>
              <ul className="space-y-0.5">
                {o.benefits.map((b) => <li key={b} className="text-[11.5px] text-ink leading-snug">· {b}</li>)}
              </ul>
            </div>
            <div className="rounded-xl bg-paper-soft px-3 py-2.5">
              <div className="text-[9.5px] uppercase tracking-wider font-bold text-ink-muted mb-1">Eligibility</div>
              <p className="text-[11.5px] text-ink leading-snug">{o.eligibility}</p>
              <p className="text-[10.5px] text-ink-muted mt-1">{o.countries}</p>
            </div>
          </section>

          {/* code - only if a REAL one exists */}
          {o.couponCode && (
            <div className="rounded-xl bg-nova-100/60 dark:bg-nova-400/10 ring-1 ring-inset ring-nova-400/40 px-4 py-3 flex items-center gap-3">
              <span className="text-[11px] font-bold text-nova-600 dark:text-nova-200">Code</span>
              <code className="font-mono text-[13px] font-bold text-ink">{o.couponCode}</code>
            </div>
          )}

          {/* coming soon reason */}
          {o.status === "coming_soon" && (
            <div className="rounded-xl bg-paper-soft px-4 py-3 text-[12px] text-ink-dim leading-relaxed">
              <span className="font-semibold text-ink">Why it&apos;s not live yet:</span> {o.comingSoonReason}
            </div>
          )}

          {/* source */}
          {o.sourceUrl && (
            <div className="text-[10.5px] text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1 text-aurora-700 dark:text-aurora-200 font-bold uppercase tracking-wider text-[9.5px]">
                <Icon.check size={9} /> verified source
              </span>
              <a href={o.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-polaris-600 dark:text-polaris-300 hover:underline">{o.sourceName} ↗</a>
              <span className="font-mono">last verified {o.lastVerifiedAt}</span>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="sticky bottom-0 bg-paper-card/85 backdrop-blur-md px-6 py-3.5 border-t border-polaris-500/10 dark:border-white/[0.08] flex items-center gap-2 flex-wrap">
          {o.status === "active" && link ? (
            <button
              onClick={claim}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-5 py-2.5 text-[13px] font-semibold hover:bg-polaris-700 transition-colors"
            >
              {claimed ? "Open again" : o.offerType === "free_student_benefit" ? "Get it free" : "Open official page"} ↗
            </button>
          ) : o.status === "coming_soon" ? (
            <button
              onClick={requestPartner}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-4 py-2 text-[12.5px] font-semibold hover:bg-polaris-700 transition-colors"
            >
              Request this partner
            </button>
          ) : (
            <span className="text-[12px] text-ink-muted">Offer not available yet</span>
          )}
          {hasRoadmap && o.status === "active" && (
            <button onClick={() => void addToRoadmap()} disabled={busy} className="text-[12px] font-medium text-ink-dim hover:text-ink disabled:opacity-50">
              {busy ? "Adding…" : "Add to roadmap"}
            </button>
          )}
          <button onClick={askStrategist} className="text-[12.5px] text-polaris-600 dark:text-polaris-300 hover:underline font-medium">
            Ask Strategist
          </button>
          <button onClick={onSave} className={cn("ml-auto text-[12px] font-medium", saved ? "text-rose-500" : "text-ink-dim hover:text-ink")}>
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

