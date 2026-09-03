"use client";

/**
 * Passport builder.
 *
 * Two things this screen has to make obvious, because the passport's value
 * rests on both:
 *
 *   1. A claim is only "verified" when an artifact link is attached. The form
 *      shows that transition live rather than after a save, so the student can
 *      see what adding a link does.
 *   2. Unevidenced claims are shown publicly by default. Turning that off is
 *      allowed, but the page then says the list is filtered - which is stated
 *      here, not buried.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { Card, SectionTitle, Btn, Pill } from "./ui";
import { track } from "@/lib/analytics";

type Claim = {
  id: string;
  claim: string;
  proofType: string;
  proofUrl?: string;
  verifiedSignal?: string;
  gap?: string;
  status: "verified" | "unevidenced";
  addedAt: string;
  verifiedAt?: string;
};

type Passport = {
  slug: string;
  published: boolean;
  displayName: string;
  headline: string;
  summary: string;
  claims: Claim[];
  showUnevidenced: boolean;
  views: number;
};

const PROOF_TYPES = [
  "Certificate", "Score report", "Repository", "Published work",
  "Award letter", "Reference letter", "Portfolio", "Transcript", "Other",
];

const EMPTY = {
  id: undefined as string | undefined,
  claim: "",
  proofType: "Certificate",
  proofUrl: "",
  verifiedSignal: "",
  gap: "",
};

export function PassportClient({
  origin, demoPassport,
}: {
  origin: string;
  /** Seeded passport for the public demo - no database, and read-only. */
  demoPassport?: Passport;
}) {
  const readOnly = Boolean(demoPassport);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (demoPassport) { setPassport(demoPassport); return; }
    try {
      const res = await fetch("/api/passport", { cache: "no-store" });
      if (!res.ok) throw new Error("Could not load your passport");
      const d = await res.json();
      setPassport(d.passport);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  }, [demoPassport]);

  useEffect(() => { void load(); }, [load]);

  const post = useCallback(async (body: unknown) => {
    if (readOnly) {
      setError("This is the demo - sign in to build your own passport.");
      return false;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/passport", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Could not save");
      }
      const d = await res.json();
      setPassport(d.passport);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  }, [readOnly]);

  const stats = useMemo(() => {
    const claims = passport?.claims ?? [];
    const verified = claims.filter((c) => c.status === "verified").length;
    return {
      total: claims.length,
      verified,
      coverage: claims.length ? Math.round((verified / claims.length) * 100) : 0,
    };
  }, [passport]);

  // The live preview of what attaching a link does to this claim.
  const draftWillVerify = draft.proofUrl.trim().startsWith("http");

  const publicUrl = passport ? `${origin}/p/${passport.slug}` : "";

  async function saveClaim() {
    if (draft.claim.trim().length < 3) return;
    const okSaved = await post({
      action: "claim",
      claim: {
        ...(draft.id ? { id: draft.id } : {}),
        claim: draft.claim.trim(),
        proofType: draft.proofType,
        proofUrl: draft.proofUrl.trim() || "",
        verifiedSignal: draft.verifiedSignal.trim() || undefined,
        gap: draft.gap.trim() || undefined,
      },
    });
    if (okSaved) setDraft(EMPTY);
  }

  async function togglePublish() {
    if (!passport) return;
    const next = !passport.published;
    const okSaved = await post({ action: "settings", settings: { published: next } });
    if (okSaved && next) track("action_lab_tool_used", { tool: "passport_published" });
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Could not copy - select the link and copy it manually.");
    }
  }

  if (!passport) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
        <p className="text-[13.5px] text-ink-dim">
          {error || "Loading your passport…"}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-8 sm:px-8">
      <SectionTitle
        eyebrow="Proof"
        title="Verified Student Passport"
        sub="One page you can send to a teacher, a consultant or a committee. Each claim sits next to the artifact that proves it - and the ones with nothing behind them are shown, not hidden."
      />

      {/* ── Share bar ── */}
      <Card className="mt-8 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Pill tone={passport.published ? "aurora" : "ink"}>
                {passport.published ? "Live" : "Unpublished"}
              </Pill>
              <span className="text-[12.5px] text-ink-dim tabular-nums">
                {stats.verified}/{stats.total} evidenced · {stats.coverage}% coverage
                {passport.published && ` · ${passport.views} views`}
              </span>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <code className="max-w-full truncate rounded-lg bg-paper-soft px-2.5 py-1.5 font-mono text-[12px] text-ink-dim dark:bg-white/[0.05]">
                {publicUrl}
              </code>
              <button
                type="button"
                onClick={copyLink}
                className="shrink-0 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-polaris-700 transition-colors hover:bg-paper-soft dark:text-polaris-300"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {!passport.published && (
              <p className="mt-2 text-[11.5px] text-ink-dim">
                The link returns nothing until you publish. Publishing makes it
                readable by anyone who has it - it is unlisted, not indexed.
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {passport.published && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-polaris-500/20 px-4 py-2 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft"
              >
                View
              </a>
            )}
            <Btn
              variant={passport.published ? "outline" : "primary"}
              disabled={busy}
              onClick={togglePublish}
            >
              {passport.published ? "Unpublish" : "Publish"}
            </Btn>
          </div>
        </div>
      </Card>

      {error && (
        <p className="mt-3 text-[12.5px] text-rose-600">{error}</p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
        {/* ── Claims ── */}
        <div className="space-y-3">
          {passport.claims.length === 0 && (
            <Card className="p-6">
              <p className="text-[13.5px] text-ink-dim">
                No claims yet. Start with something you can prove - a score
                report, a repository, a certificate.
              </p>
            </Card>
          )}

          <AnimatePresence initial={false}>
            {passport.claims.map((c) => (
              <motion.div
                key={c.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card
                  className={cn(
                    "p-4",
                    c.status === "verified"
                      ? "border-aurora-500/25 bg-aurora-500/[0.03]"
                      : "border-dashed",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-1 h-2 w-2 shrink-0 rounded-full",
                        c.status === "verified" ? "bg-aurora-500" : "bg-ink/20",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14.5px] font-semibold leading-snug text-ink">
                        {c.claim}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ink-dim">
                        <span className="rounded bg-ink/[0.06] px-1.5 py-0.5 dark:bg-white/[0.07]">
                          {c.proofType}
                        </span>
                        <span>
                          {c.status === "verified" ? "Evidenced" : "No artifact yet"}
                        </span>
                        {c.proofUrl && (
                          <a
                            href={c.proofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-polaris-700 hover:underline dark:text-polaris-300"
                          >
                            Artifact ↗
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            id: c.id,
                            claim: c.claim,
                            proofType: c.proofType,
                            proofUrl: c.proofUrl ?? "",
                            verifiedSignal: c.verifiedSignal ?? "",
                            gap: c.gap ?? "",
                          })
                        }
                        className="rounded-lg px-2 py-1 text-[11.5px] font-medium text-ink-dim transition-colors hover:bg-paper-soft hover:text-ink"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => post({ action: "delete-claim", id: c.id })}
                        className="rounded-lg px-2 py-1 text-[11.5px] font-medium text-rose-600 transition-colors hover:bg-rose-500/[0.07]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* ── Editor ── */}
        <Card className="h-fit p-5">
          <h3 className="font-serif text-[16px] font-bold text-ink">
            {draft.id ? "Edit claim" : "Add a claim"}
          </h3>

          <label className="mt-4 block">
            <span className="text-[12px] font-semibold text-ink">The claim</span>
            <textarea
              value={draft.claim}
              onChange={(e) => setDraft({ ...draft, claim: e.target.value })}
              rows={2}
              maxLength={220}
              placeholder="Led a six-person robotics team to the national final"
              className="mt-1.5 w-full resize-none rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-ink">Kind of proof</span>
            <select
              value={draft.proofType}
              onChange={(e) => setDraft({ ...draft, proofType: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
            >
              {PROOF_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-ink">
              Link to the artifact
            </span>
            <input
              type="url"
              value={draft.proofUrl}
              onChange={(e) => setDraft({ ...draft, proofUrl: e.target.value })}
              placeholder="https://…"
              className="mt-1.5 w-full rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
            />
            {/* Live status - what the link does to this claim. */}
            <span
              className={cn(
                "mt-1.5 inline-block text-[11.5px] font-medium",
                draftWillVerify ? "text-aurora-700 dark:text-aurora-300" : "text-ink-dim",
              )}
            >
              {draftWillVerify
                ? "Saves as verified."
                : "Without a link this saves as not-yet-evidenced, and says so publicly."}
            </span>
          </label>

          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-ink">
              What the artifact proves <span className="font-normal text-ink-dim">(optional)</span>
            </span>
            <input
              value={draft.verifiedSignal}
              onChange={(e) => setDraft({ ...draft, verifiedSignal: e.target.value })}
              placeholder="Placed 2nd of 40 teams, verified on the official result page"
              className="mt-1.5 w-full rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[12px] font-semibold text-ink">
              What it does not prove <span className="font-normal text-ink-dim">(optional)</span>
            </span>
            <input
              value={draft.gap}
              onChange={(e) => setDraft({ ...draft, gap: e.target.value })}
              placeholder="Does not establish my individual contribution"
              className="mt-1.5 w-full rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13.5px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
            />
          </label>

          <div className="mt-4 flex gap-2">
            <Btn disabled={busy || draft.claim.trim().length < 3} onClick={saveClaim}>
              {draft.id ? "Save changes" : "Add claim"}
            </Btn>
            {draft.id && (
              <Btn variant="outline" onClick={() => setDraft(EMPTY)}>Cancel</Btn>
            )}
          </div>

          {/* Settings */}
          <div className="mt-6 border-t border-polaris-500/10 pt-5">
            <label className="flex items-start gap-2.5">
              <input
                type="checkbox"
                checked={passport.showUnevidenced}
                onChange={(e) =>
                  post({ action: "settings", settings: { showUnevidenced: e.target.checked } })
                }
                className="mt-0.5 accent-polaris-500"
              />
              <span className="text-[12.5px] leading-snug text-ink-dim">
                Show unevidenced claims publicly.{" "}
                <span className="text-ink">
                  Turning this off makes the page say the list is filtered.
                </span>
              </span>
            </label>

            <label className="mt-4 block">
              <span className="text-[12px] font-semibold text-ink">Headline</span>
              <input
                value={passport.headline}
                onChange={(e) => setPassport({ ...passport, headline: e.target.value })}
                onBlur={(e) =>
                  post({ action: "settings", settings: { headline: e.target.value } })
                }
                maxLength={120}
                placeholder="HSC 2027 · targeting computer science in the US"
                className="mt-1.5 w-full rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
              />
            </label>

            <label className="mt-3 block">
              <span className="text-[12px] font-semibold text-ink">Summary</span>
              <textarea
                value={passport.summary}
                onChange={(e) => setPassport({ ...passport, summary: e.target.value })}
                onBlur={(e) =>
                  post({ action: "settings", settings: { summary: e.target.value } })
                }
                rows={3}
                maxLength={600}
                className="mt-1.5 w-full resize-none rounded-lg border border-polaris-500/15 bg-paper-soft px-3 py-2 text-[13px] text-ink outline-none focus:border-polaris-400 dark:bg-white/[0.04]"
              />
            </label>
          </div>
        </Card>
      </div>
    </div>
  );
}
