"use client";

/**
 * /account - Student Profile Settings.
 *
 * Layout matches the spec:
 *   1. Academic Profile (on top)
 *      a. Basic Information (Name / Email / Phone / Avatar URL)
 *      b. Curriculum (5-way segment)
 *      c. Academic Results (SSC + HSC - conditional A* vs GPA based on
 *         the chosen curriculum)
 *      d. Scholarships & Achievements (add/remove rows)
 *      e. Academic Summary (display card)
 *   2. Account security (password change)
 *   3. Plan & billing summary
 *
 * A welcome modal pops on first visit after signup (?welcome=1) prompting
 * the student to complete the academic profile - clicking the CTA scrolls
 * the page to the Academic Profile section.
 */

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CompassLogo } from "@/components/Nav";
import { AvatarUploader } from "@/components/app/AvatarUploader";
import { PremiumSelect } from "@/components/ui/PremiumSelect";
import { PLAN_LABELS } from "@/lib/features";
import { cn } from "@/lib/cn";
import {
  CURRICULUM_LABELS,
  curriculumUsesAStars,
  SCHOLARSHIP_LABELS,
  deriveEngineGpa,
  getMissingFields,
  MISSING_FIELD_LABELS,
  type StudentProfile,
  type GradeLevel,
  type Country,
  type Degree,
  type ECCategory,
  type Tier,
  type Curriculum,
  type Scholarship,
  type ScholarshipType,
  type Achievement,
  type MissingField,
} from "@/lib/profile";

/* ─── option lists ─── */
const GRADES: { v: GradeLevel; label: string }[] = [
  { v: "middle", label: "Middle school" },
  { v: "early-hs", label: "Early high school" },
  { v: "late-hs", label: "Late high school" },
  { v: "undergrad", label: "Undergraduate" },
  { v: "recent-grad", label: "Recent graduate" },
];
const COUNTRIES: Country[] = ["Bangladesh", "India", "Pakistan", "Nepal", "Other South Asia", "Other"];
const DEGREES: { v: Degree; label: string }[] = [
  { v: "undergrad", label: "Undergraduate" },
  { v: "masters", label: "Master's" },
  { v: "phd", label: "PhD" },
  { v: "undecided", label: "Undecided" },
];
const ECS: ECCategory[] = ["Olympiads", "Research", "Leadership", "Community", "Sports/Arts", "Internships"];
const TIERS: { v: Tier; label: string }[] = [
  { v: "elite", label: "Top global (Ivy/Oxbridge/MIT)" },
  { v: "top50", label: "Top 50 global" },
  { v: "top200", label: "Strong international (top 200)" },
  { v: "regional", label: "Regional strong programs" },
];
const CURRICULA: Curriculum[] = ["bangla-medium", "english-version", "english-medium", "madrasa", "other"];

type Account = {
  name: string;
  email: string;
  role: string;
  plan: "free" | "pro" | "elite";
  phone?: string;
  avatarUrl?: string;
};

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="min-h-screen"><SettingsNav /><div className="p-12 text-center text-ink-dim">Loading…</div></main>}>
      <AccountInner />
    </Suspense>
  );
}

function AccountInner() {
  const router = useRouter();
  const params = useSearchParams();
  const isWelcome = params.get("welcome") === "1";

  const [account, setAccount] = useState<Account | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [welcomeOpen, setWelcomeOpen] = useState(isWelcome);

  useEffect(() => {
    Promise.all([
      fetch("/api/account").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([a, p]) => {
        if (a?.account) setAccount(a.account);
        if (p?.profile) setProfile(p.profile);
      })
      .finally(() => setLoading(false));
  }, []);

  function startProfile() {
    setWelcomeOpen(false);
    // Strip ?welcome from URL so refresh doesn't re-pop the modal.
    router.replace("/account#academic", { scroll: false });
    requestAnimationFrame(() => {
      document.getElementById("academic")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <main className="min-h-screen">
      <SettingsNav />
      <section className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-16">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold tracking-tight">Your profile</h1>
        <p className="mt-3 text-ink-dim">
          Manage your academic background, scholarships, and account security.
        </p>

        {loading ? (
          <p className="mt-10 text-ink-dim">Loading…</p>
        ) : (
          <div className="mt-8 space-y-6">
            {/* ─── 1. Academic profile (TOP) ───────────────────────── */}
            {account && (
              <AcademicProfileCard
                account={account}
                initialProfile={profile}
                onAccountSaved={(patch) => setAccount({ ...account, ...patch })}
                onProfileSaved={(p) => setProfile(p)}
              />
            )}

            {/* ─── 2. Security ─────────────────────────────────────── */}
            <PasswordCard />

            {/* ─── 3. Plan & billing summary ───────────────────────── */}
            {account && <PlanCard account={account} />}
          </div>
        )}
      </section>

      {/* Simple footer */}
      <footer className="border-t border-polaris-200/60 py-8 px-4 text-center text-xs text-ink-muted">
        <p>© {new Date().getFullYear()} Polaris by Team Arcane. All rights reserved.</p>
      </footer>

      {/* Post-signup welcome modal */}
      {welcomeOpen && <WelcomeModal onStart={startProfile} onSkip={() => {
        setWelcomeOpen(false);
        router.replace("/roadmap", { scroll: false });
      }} />}
    </main>
  );
}

/* ─── Simple settings nav ─── */
function SettingsNav() {
  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="pt-4 px-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link href="/roadmap" className="flex items-center gap-2 shrink-0">
            <CompassLogo />
            <span className="font-serif text-[17px] font-bold tracking-tight text-ink">
              Polaris
            </span>
          </Link>
          <Link
            href="/roadmap"
            className="text-[13px] font-medium text-ink-dim hover:text-ink transition-colors px-3.5 py-2 rounded-full"
          >
            ← Back to roadmap
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   ACADEMIC PROFILE CARD
   ════════════════════════════════════════════════════════════════════════ */

function AcademicProfileCard({
  account, initialProfile, onAccountSaved, onProfileSaved,
}: {
  account: Account;
  initialProfile: StudentProfile | null;
  onAccountSaved: (patch: Partial<Account>) => void;
  onProfileSaved: (p: StudentProfile) => void;
}) {
  // Basic info (User-level)
  const [name, setName] = useState(account.name);
  const [phone, setPhone] = useState(account.phone ?? "");
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl ?? "");

  // Profile-level
  const [grade, setGrade] = useState<GradeLevel>(initialProfile?.grade ?? "late-hs");
  const [country, setCountry] = useState<Country>(initialProfile?.country ?? "Bangladesh");
  const [degree, setDegree] = useState<Degree>(initialProfile?.degree ?? "undergrad");
  const [ecs, setEcs] = useState<ECCategory[]>(initialProfile?.ecs ?? []);
  const [tier, setTier] = useState<Tier>(initialProfile?.targetTier ?? "elite");

  // Extended (curriculum + results)
  const [curriculum, setCurriculum] = useState<Curriculum>(initialProfile?.curriculum ?? "bangla-medium");
  const [sscGpa, setSscGpa] = useState<string>(initialProfile?.sscGpa?.toString() ?? "");
  const [sscAStars, setSscAStars] = useState<string>(initialProfile?.sscAStars?.toString() ?? "");
  const [sscEquivalentGpa, setSscEquivalentGpa] = useState<string>(initialProfile?.sscEquivalentGpa?.toString() ?? "");
  const [hscGpa, setHscGpa] = useState<string>(initialProfile?.hscGpa?.toString() ?? "");
  const [hscAStars, setHscAStars] = useState<string>(initialProfile?.hscAStars?.toString() ?? "");
  const [hscEquivalentGpa, setHscEquivalentGpa] = useState<string>(initialProfile?.hscEquivalentGpa?.toString() ?? "");

  // Undergraduate (only relevant when grade ∈ {undergrad, recent-grad})
  const [ugCgpaRaw, setUgCgpaRaw] = useState<string>(initialProfile?.undergradCgpaRaw?.toString() ?? "");
  const [ugCgpaScale, setUgCgpaScale] = useState<4 | 5 | 10>(initialProfile?.undergradCgpaScale ?? 4);
  const [ugInstitution, setUgInstitution] = useState<string>(initialProfile?.undergradInstitution ?? "");
  const [ugMajor, setUgMajor] = useState<string>(initialProfile?.undergradMajor ?? "");
  const [satScore, setSatScore] = useState<string>(initialProfile?.testScores?.SAT?.toString() ?? "");
  const [greScore, setGreScore] = useState<string>(initialProfile?.testScores?.GRE?.toString() ?? "");
  const [ieltsScore, setIeltsScore] = useState<string>(initialProfile?.testScores?.IELTS?.toString() ?? "");
  const [toeflScore, setToeflScore] = useState<string>(initialProfile?.testScores?.TOEFL?.toString() ?? "");

  const isUndergrad = grade === "undergrad" || grade === "recent-grad";

  // Scholarships + achievements
  const [scholarships, setScholarships] = useState<Scholarship[]>(initialProfile?.scholarships ?? []);
  const [achievements, setAchievements] = useState<Achievement[]>(initialProfile?.achievements ?? []);

  // Save state
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<"ok" | "err">("ok");

  const usesAStars = curriculumUsesAStars(curriculum);

  function parseOptional(v: string): number | undefined {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : undefined;
  }

  // Live completeness check from the current form state - so the badge
  // updates as the student fills fields without waiting for save.
  const missingFields: MissingField[] = useMemo(() => {
    const draft: StudentProfile = {
      grade,
      country,
      degree,
      gpa: 0,
      ecs,
      targetTier: tier,
      curriculum,
      ...(usesAStars
        ? {
            sscAStars: parseOptional(sscAStars),
            sscEquivalentGpa: parseOptional(sscEquivalentGpa),
            hscAStars: parseOptional(hscAStars),
            hscEquivalentGpa: parseOptional(hscEquivalentGpa),
          }
        : {
            sscGpa: parseOptional(sscGpa),
            hscGpa: parseOptional(hscGpa),
          }),
      undergradCgpaRaw: parseOptional(ugCgpaRaw),
      undergradCgpaScale: ugCgpaScale,
    };
    return getMissingFields(draft, { name, phone });
  }, [
    name, phone, grade, country, degree, ecs, tier, curriculum, usesAStars,
    sscGpa, sscAStars, sscEquivalentGpa, hscGpa, hscAStars, hscEquivalentGpa,
    ugCgpaRaw, ugCgpaScale,
  ]);

  function toggleEc(e: ECCategory) {
    setEcs((p) => (p.includes(e) ? p.filter((x) => x !== e) : [...p, e]));
  }
  function addScholarship() {
    setScholarships((cur) => [
      ...cur,
      { id: cryptoId(), type: "general" as ScholarshipType, title: "", year: undefined },
    ]);
  }
  function removeScholarship(id: string) {
    setScholarships((cur) => cur.filter((s) => s.id !== id));
  }
  function updateScholarship(id: string, patch: Partial<Scholarship>) {
    setScholarships((cur) => cur.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }
  function addAchievement() {
    setAchievements((cur) => [...cur, { id: cryptoId(), title: "", year: undefined }]);
  }
  function removeAchievement(id: string) {
    setAchievements((cur) => cur.filter((a) => a.id !== id));
  }
  function updateAchievement(id: string, patch: Partial<Achievement>) {
    setAchievements((cur) => cur.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function save() {
    setMsg("");
    setBusy(true);
    try {
      // PATCH /api/account for name + phone (avatar saves itself via the uploader)
      const accountPatch: { name?: string; phone?: string } = {};
      if (name !== account.name) accountPatch.name = name;
      if (phone !== (account.phone ?? "")) accountPatch.phone = phone;

      if (Object.keys(accountPatch).length > 0) {
        const res = await fetch("/api/account", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(accountPatch),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Failed to save account");
        }
        onAccountSaved(accountPatch);
      }

      // Assemble profile. We derive the 0–4 engine GPA from the SSC/HSC
      // results below so the student never types the same number twice.
      const profileDraft: StudentProfile = {
        grade,
        country,
        degree,
        gpa: 3.7, // placeholder, replaced after results are merged in
        ecs,
        targetTier: tier,
        curriculum,
        // Conditional results
        ...(usesAStars
          ? {
              sscAStars: parseOptional(sscAStars) as number | undefined,
              sscEquivalentGpa: parseOptional(sscEquivalentGpa),
              hscAStars: parseOptional(hscAStars) as number | undefined,
              hscEquivalentGpa: parseOptional(hscEquivalentGpa),
            }
          : {
              sscGpa: parseOptional(sscGpa),
              hscGpa: parseOptional(hscGpa),
            }),
        scholarships: scholarships.filter((s) => s.type !== "other" || (s.title?.trim().length ?? 0) > 0),
        achievements: achievements.filter((a) => a.title.trim().length > 0),
        // Undergraduate-only fields. Only sent when the user is in/past UG.
        ...(isUndergrad
          ? {
              undergradCgpaRaw: parseOptional(ugCgpaRaw),
              undergradCgpaScale: ugCgpaScale,
              undergradInstitution: ugInstitution.trim() || undefined,
              undergradMajor: ugMajor.trim() || undefined,
              testScores: collectTestScores({
                SAT: satScore,
                GRE: greScore,
                IELTS: ieltsScore,
                TOEFL: toeflScore,
              }),
            }
          : {}),
      };
      const derivedEngineGpa = deriveEngineGpa(profileDraft);
      const profileFinal: StudentProfile = {
        ...profileDraft,
        gpa: derivedEngineGpa,
        ...(isUndergrad ? { undergradCgpa: derivedEngineGpa } : {}),
      };

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ profile: profileFinal }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to save profile");
      }
      onProfileSaved(profileFinal);
      setKind("ok");
      setMsg("Profile saved.");
    } catch (e) {
      setKind("err");
      setMsg(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
      setTimeout(() => setMsg(""), 3000);
    }
  }

  return (
    <Card id="academic" title="Academic profile">
      {/* ── 0) Completeness banner ───────────────────────────────────── */}
      <IncompleteProfileBadge missing={missingFields} />

      {/* ── a) Basic information ─────────────────────────────────────── */}
      <SubSection title="Basic information">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full name">
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} maxLength={120} />
          </Field>
          <Field label="Email" hint="Used to sign in. Contact support to change.">
            <input value={account.email} disabled className={cn(inputCls, "opacity-60 cursor-not-allowed")} />
          </Field>
          <Field label="Phone number" hint="Optional. Used for sign-in fallback + family notifications.">
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              className={inputCls}
              maxLength={30}
            />
          </Field>
        </div>
        <div className="mt-4">
          <AvatarUploader
            current={avatarUrl}
            displayName={name || account.name}
            onSaved={(url) => {
              setAvatarUrl(url);
              onAccountSaved({ avatarUrl: url });
            }}
          />
        </div>
      </SubSection>

      {/* ── 2) Current education level (drives the form) ─────────────── */}
      <SubSection
        title="Current education level"
        desc="This decides which academic background fields you fill in next."
      >
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {GRADES.map((g) => {
            const active = grade === g.v;
            return (
              <button
                key={g.v}
                type="button"
                onClick={() => setGrade(g.v)}
                aria-pressed={active}
                className={cn(
                  "relative rounded-xl border px-3 py-3 text-[12px] font-medium text-left transition-all duration-200 active:scale-[0.97]",
                  active
                    ? cn(optionBtnActive, "shadow-[0_6px_16px_-8px_rgba(139,94,60,0.5)] -translate-y-0.5")
                    : cn(optionBtnIdle, "hover:-translate-y-0.5"),
                )}
              >
                {active && (
                  <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-polaris-500 text-white flex items-center justify-center" aria-hidden>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                  </span>
                )}
                <div className="font-semibold pr-5">{g.label}</div>
                <div className="text-[10.5px] font-mono opacity-70 mt-0.5">
                  {g.v === "middle" ? "≤ Grade 8"
                    : g.v === "early-hs" ? "Grade 9–10"
                    : g.v === "late-hs" ? "Grade 11–12"
                    : g.v === "undergrad" ? "Currently studying"
                    : "Completed degree"}
                </div>
              </button>
            );
          })}
        </div>
        <Field label="Country">
          <Select value={country} onChange={(v) => setCountry(v as Country)} options={COUNTRIES.map((c) => ({ v: c, label: c }))} />
        </Field>
      </SubSection>

      {/* ── b) Curriculum (pre-undergrad only) ───────────────────────── */}
      {!isUndergrad && (
      <SubSection title="Curriculum" desc="Affects which result fields appear below.">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {CURRICULA.map((c) => {
            const active = curriculum === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setCurriculum(c)}
                className={cn(
                  "rounded-xl border px-3 py-2.5 text-[12px] font-medium transition-colors",
                  active ? optionBtnActive : optionBtnIdle,
                )}
              >
                {CURRICULUM_LABELS[c]}
              </button>
            );
          })}
        </div>
      </SubSection>
      )}

      {/* ── b.5) Undergraduate (only when grade ∈ {undergrad, recent-grad}) ─── */}
      {isUndergrad && (
        <SubSection title="Undergraduate" desc="Your current undergraduate standing - the Strategist uses this CGPA over your SSC/HSC for postgrad targets.">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Institution" hint="University or institute name.">
              <input
                value={ugInstitution}
                onChange={(e) => setUgInstitution(e.target.value)}
                placeholder="e.g. BRAC University"
                className={inputCls}
                maxLength={200}
              />
            </Field>
            <Field label="Major / program">
              <input
                value={ugMajor}
                onChange={(e) => setUgMajor(e.target.value)}
                placeholder="e.g. Computer Science"
                className={inputCls}
                maxLength={120}
              />
            </Field>
            <Field label="Current CGPA" hint="Your raw CGPA on your home scale.">
              <input
                type="number"
                value={ugCgpaRaw}
                onChange={(e) => setUgCgpaRaw(e.target.value)}
                placeholder={ugCgpaScale === 10 ? "e.g. 8.5" : ugCgpaScale === 5 ? "e.g. 4.5" : "e.g. 3.8"}
                step="0.01"
                min={0}
                max={ugCgpaScale}
                className={inputCls}
              />
            </Field>
            <Field label="CGPA scale">
              <Select
                value={String(ugCgpaScale)}
                onChange={(v) => setUgCgpaScale(parseInt(v, 10) as 4 | 5 | 10)}
                options={[
                  { v: "4", label: "0 – 4.0 (US convention)" },
                  { v: "5", label: "0 – 5.0 (Bangladesh public uni)" },
                  { v: "10", label: "0 – 10.0 (Indian convention)" },
                ]}
              />
            </Field>
          </div>

          <div className="mt-5">
            <div className="text-[12.5px] font-medium text-ink mb-1.5">Standardized tests (optional)</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Field label="SAT" hint="0 – 1600">
                <input type="number" value={satScore} onChange={(e) => setSatScore(e.target.value)} placeholder="1500" min={0} max={1600} className={inputCls} />
              </Field>
              <Field label="GRE" hint="260 – 340">
                <input type="number" value={greScore} onChange={(e) => setGreScore(e.target.value)} placeholder="325" min={0} max={340} className={inputCls} />
              </Field>
              <Field label="IELTS" hint="0 – 9.0">
                <input type="number" value={ieltsScore} onChange={(e) => setIeltsScore(e.target.value)} placeholder="7.5" step="0.5" min={0} max={9} className={inputCls} />
              </Field>
              <Field label="TOEFL" hint="0 – 120">
                <input type="number" value={toeflScore} onChange={(e) => setToeflScore(e.target.value)} placeholder="105" min={0} max={120} className={inputCls} />
              </Field>
            </div>
          </div>
        </SubSection>
      )}

      {/* ── c) Academic Results (pre-undergrad only) ─────────────────── */}
      {!isUndergrad && (
      <SubSection title="Academic results" desc={usesAStars ? "O Level + A Level grade counts." : "GPA on 0–5 scale."}>
        <ResultRow
          label={usesAStars ? "O Level" : "SSC / O-Level"}
          usesAStars={usesAStars}
          gpa={sscGpa}
          setGpa={setSscGpa}
          aStars={sscAStars}
          setAStars={setSscAStars}
          equivalentGpa={sscEquivalentGpa}
          setEquivalentGpa={setSscEquivalentGpa}
        />
        <div className="my-4 h-px bg-polaris-500/10" />
        <ResultRow
          label={usesAStars ? "A Level" : "HSC / A-Level"}
          usesAStars={usesAStars}
          gpa={hscGpa}
          setGpa={setHscGpa}
          aStars={hscAStars}
          setAStars={setHscAStars}
          equivalentGpa={hscEquivalentGpa}
          setEquivalentGpa={setHscEquivalentGpa}
        />
      </SubSection>
      )}

      {/* ── d) Scholarships & Achievements ───────────────────────────── */}
      <SubSection title="Scholarships" desc="Add any awards you've received.">
        <div className="space-y-2">
          {scholarships.length === 0 && (
            <div className="text-[12.5px] text-ink-muted italic">No scholarships added yet.</div>
          )}
          {scholarships.map((s) => (
            <div key={s.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <select
                value={s.type}
                onChange={(e) => updateScholarship(s.id, { type: e.target.value as ScholarshipType })}
                className={cn(inputCls, "max-w-[200px]")}
              >
                {(Object.keys(SCHOLARSHIP_LABELS) as ScholarshipType[]).map((t) => (
                  <option key={t} value={t}>{SCHOLARSHIP_LABELS[t]}</option>
                ))}
              </select>
              <input
                value={s.title ?? ""}
                onChange={(e) => updateScholarship(s.id, { title: e.target.value })}
                placeholder={s.type === "other" ? "Scholarship name" : "Details (optional)"}
                className={cn(inputCls, "min-w-[180px]")}
                maxLength={200}
              />
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={s.year ?? ""}
                  onChange={(e) => updateScholarship(s.id, { year: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                  placeholder="Year"
                  className={cn(inputCls, "w-20")}
                  min={1990}
                  max={2100}
                />
                <button
                  type="button"
                  onClick={() => removeScholarship(s.id)}
                  className="text-rose-600 hover:text-rose-700 text-[12px] font-medium px-2"
                  aria-label="Remove"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addScholarship}
            className="text-[12.5px] font-medium text-polaris-500 hover:text-polaris-600 mt-2"
          >
            + Add scholarship
          </button>
        </div>
      </SubSection>

      <SubSection title="Achievements & academic awards" desc="Anything notable - competition results, publications, leadership roles.">
        <div className="space-y-2">
          {achievements.length === 0 && (
            <div className="text-[12.5px] text-ink-muted italic">No achievements added yet.</div>
          )}
          {achievements.map((a) => (
            <div key={a.id} className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
              <input
                value={a.title}
                onChange={(e) => updateAchievement(a.id, { title: e.target.value })}
                placeholder="e.g. National Math Olympiad, Gold"
                className={inputCls}
                maxLength={200}
              />
              <input
                type="number"
                value={a.year ?? ""}
                onChange={(e) => updateAchievement(a.id, { year: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                placeholder="Year"
                className={cn(inputCls, "w-20")}
                min={1990}
                max={2100}
              />
              <button
                type="button"
                onClick={() => removeAchievement(a.id)}
                className="text-rose-600 hover:text-rose-700 text-[12px] font-medium px-2"
                aria-label="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addAchievement}
            className="text-[12.5px] font-medium text-polaris-500 hover:text-polaris-600 mt-2"
          >
            + Add achievement
          </button>
        </div>
      </SubSection>

      {/* ── e) Goals (target degree + tier + activity categories) ────── */}
      <SubSection title="Goals" desc="What you're aiming for next - drives the Strategist's recommendations.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Target degree">
            <Select value={degree} onChange={(v) => setDegree(v as Degree)} options={DEGREES.map((d) => ({ v: d.v, label: d.label }))} />
          </Field>
          <Field label="Target tier">
            <Select value={tier} onChange={(v) => setTier(v as Tier)} options={TIERS.map((t) => ({ v: t.v, label: t.label }))} />
          </Field>
        </div>
        <div className="mt-5">
          <div className="text-[12.5px] font-medium text-ink mb-1.5">Activity categories</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {ECS.map((e) => {
              const active = ecs.includes(e);
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => toggleEc(e)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-[12.5px] transition-colors",
                    active ? optionBtnActive : optionBtnIdle,
                  )}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>
      </SubSection>

      {/* ── f) Academic summary ──────────────────────────────────────── */}
      <SubSection title="Academic summary">
        <SummaryCard
          name={name}
          phone={phone}
          curriculum={curriculum}
          sscGpa={parseOptional(sscGpa)}
          sscAStars={parseOptional(sscAStars)}
          hscGpa={parseOptional(hscGpa)}
          hscAStars={parseOptional(hscAStars)}
          scholarships={scholarships}
          achievements={achievements}
        />
      </SubSection>

      {/* ── Actions ──────────────────────────────────────────────────── */}
      <Status msg={msg} kind={kind} />
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={save} disabled={busy} className={btnPrimary}>
          {busy ? "Saving…" : "Save profile"}
        </button>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   PIECES
   ════════════════════════════════════════════════════════════════════════ */

/** Tracked fields the percentage is computed against (missing counts down). */
const COMPLETION_FIELD_COUNT = 8;

function IncompleteProfileBadge({ missing }: { missing: MissingField[] }) {
  const pct = Math.max(0, Math.min(100, Math.round(((COMPLETION_FIELD_COUNT - missing.length) / COMPLETION_FIELD_COUNT) * 100)));
  const complete = missing.length === 0;
  const r = 17, c = 2 * Math.PI * r;

  return (
    <div className={cn(
      "mb-5 rounded-2xl px-4 py-3.5 ring-1 ring-inset",
      complete
        ? "bg-aurora-500/10 ring-aurora-400/40"
        : "bg-paper-soft ring-polaris-500/15 dark:bg-white/[0.04] dark:ring-white/[0.1]",
    )}>
      <div className="flex items-start gap-3.5">
        {/* progress ring */}
        <span className="relative h-11 w-11 shrink-0">
          <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90">
            <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-paper-deep dark:stroke-white/[0.08]" />
            <circle
              cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
              className={cn("transition-[stroke-dashoffset] duration-700", complete ? "stroke-aurora-500" : "stroke-polaris-500")}
            />
          </svg>
          <span className={cn(
            "absolute inset-0 flex items-center justify-center text-[10px] font-bold tabular-nums",
            complete ? "text-aurora-700 dark:text-aurora-200" : "text-ink",
          )}>
            {pct}%
          </span>
        </span>

        <div className="min-w-0 flex-1">
          {complete ? (
            <>
              <div className="text-[13px] font-semibold text-aurora-700 dark:text-aurora-200">Profile complete</div>
              <div className="text-[12px] text-ink-dim mt-0.5">The Strategist has everything it needs to plan for you.</div>
            </>
          ) : (
            <>
              <div className="text-[13px] font-semibold text-ink">Profile {pct}% complete</div>
              <div className="text-[12px] text-ink-dim mt-0.5">
                Complete these so the Strategist can personalize your roadmap:
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                {missing.map((field) => (
                  <span
                    key={field}
                    className="inline-flex items-center gap-1 rounded-full bg-paper-card ring-1 ring-inset ring-nova-500/30 px-2.5 py-1 text-[11px] font-medium text-ink dark:bg-nova-400/15 dark:ring-nova-400/40 dark:text-nova-100"
                  >
                    <span className="h-1 w-1 rounded-full bg-nova-500" aria-hidden />
                    {MISSING_FIELD_LABELS[field]}
                  </span>
                ))}
                <button
                  type="button"
                  onClick={() => document.getElementById("academic")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className="ml-1 text-[11.5px] font-semibold text-polaris-600 dark:text-polaris-300 hover:underline"
                >
                  Complete now →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  label, usesAStars, gpa, setGpa, aStars, setAStars, equivalentGpa, setEquivalentGpa,
}: {
  label: string;
  usesAStars: boolean;
  gpa: string;
  setGpa: (v: string) => void;
  aStars: string;
  setAStars: (v: string) => void;
  equivalentGpa: string;
  setEquivalentGpa: (v: string) => void;
}) {
  return (
    <div>
      <div className="text-[12.5px] font-semibold text-ink mb-2">{label}</div>
      {usesAStars ? (
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Number of A* grades" hint="0–20">
            <input
              type="number"
              value={aStars}
              onChange={(e) => setAStars(e.target.value)}
              placeholder="e.g. 7"
              className={inputCls}
              min={0}
              max={20}
            />
          </Field>
          <Field label="GPA equivalent (optional)" hint="0–5 scale">
            <input
              type="number"
              value={equivalentGpa}
              onChange={(e) => setEquivalentGpa(e.target.value)}
              placeholder="e.g. 4.85"
              step="0.01"
              min={0}
              max={5}
              className={inputCls}
            />
          </Field>
        </div>
      ) : (
        <Field label="GPA" hint="0–5 scale">
          <input
            type="number"
            value={gpa}
            onChange={(e) => setGpa(e.target.value)}
            placeholder="e.g. 5.00"
            step="0.01"
            min={0}
            max={5}
            className={cn(inputCls, "max-w-[200px]")}
          />
        </Field>
      )}
    </div>
  );
}

function SummaryCard({
  name, phone, curriculum, sscGpa, sscAStars, hscGpa, hscAStars, scholarships, achievements,
}: {
  name: string;
  phone: string;
  curriculum: Curriculum;
  sscGpa?: number;
  sscAStars?: number;
  hscGpa?: number;
  hscAStars?: number;
  scholarships: Scholarship[];
  achievements: Achievement[];
}) {
  const usesAStars = curriculumUsesAStars(curriculum);
  const sscDisplay = usesAStars
    ? (sscAStars !== undefined ? `${sscAStars} A* grades` : "-")
    : (sscGpa !== undefined ? `GPA ${sscGpa.toFixed(2)}` : "-");
  const hscDisplay = usesAStars
    ? (hscAStars !== undefined ? `${hscAStars} A* grades` : "-")
    : (hscGpa !== undefined ? `GPA ${hscGpa.toFixed(2)}` : "-");
  return (
    <div className="rounded-xl bg-polaris-50 ring-1 ring-inset ring-polaris-500/15 p-4 space-y-2 text-[13px] dark:bg-polaris-400/10 dark:ring-polaris-400/25">
      <SumRow k="Student" v={name || "-"} />
      {phone && <SumRow k="Phone" v={phone} />}
      <SumRow k="Curriculum" v={CURRICULUM_LABELS[curriculum]} />
      <SumRow k={usesAStars ? "O Level" : "SSC"} v={sscDisplay} />
      <SumRow k={usesAStars ? "A Level" : "HSC"} v={hscDisplay} />
      <SumRow k="Scholarships" v={scholarships.length ? `${scholarships.length} on file` : "None yet"} />
      <SumRow k="Achievements" v={achievements.length ? `${achievements.length} on file` : "None yet"} />
    </div>
  );
}
function SumRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-polaris-500/10 last:border-0 pb-1.5 last:pb-0">
      <span className="text-ink-muted">{k}</span>
      <span className="text-ink font-medium text-right">{v}</span>
    </div>
  );
}

function Card({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="glass-strong rounded-2xl p-6 scroll-mt-20">
      <div className="text-sm font-semibold text-ink mb-4">{title}</div>
      {children}
    </div>
  );
}
function SubSection({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 first:mt-0 pt-4 first:pt-0 border-t first:border-t-0 border-polaris-500/10">
      <div className="mb-2.5">
        <div className="text-[13px] font-semibold text-ink">{title}</div>
        {desc && <div className="text-[11.5px] text-ink-muted mt-0.5">{desc}</div>}
      </div>
      {children}
    </div>
  );
}
function Field({ label, hint, children }: { label: React.ReactNode; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[12.5px] font-medium text-ink mb-1">{label}</div>
      {hint && <div className="text-[11.5px] text-ink-muted mb-1.5">{hint}</div>}
      {children}
    </label>
  );
}
function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { v: string; label: string }[] }) {
  return (
    <PremiumSelect
      value={value}
      onChange={onChange}
      variant="input"
      className="w-full"
      options={options.map((o) => ({ value: o.v, label: o.label }))}
    />
  );
}
function Status({ msg, kind }: { msg: string; kind: "ok" | "err" }) {
  if (!msg) return null;
  return (
    <div
      className={cn(
        "mt-3 rounded-xl px-4 py-2.5 text-sm",
        kind === "ok"
          ? "border border-aurora-400/40 bg-aurora-500/10 text-aurora-600"
          : "border border-rose-500/40 bg-rose-500/10 text-rose-600",
      )}
    >
      {msg}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-polaris-200 bg-paper-card px-3 py-2 text-sm text-ink placeholder:text-ink-muted/60 focus:border-polaris-400 focus:outline-none focus:ring-2 focus:ring-polaris-400/25 transition-all dark:border-white/[0.14] dark:bg-paper-deep dark:focus:border-polaris-400/60 dark:[color-scheme:dark]";
const btnPrimary =
  "rounded-full bg-polaris-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-polaris-600 active:bg-polaris-700 transition-colors duration-150 disabled:opacity-60 disabled:cursor-wait";
const optionBtnIdle =
  "bg-paper-card border-polaris-200 text-ink-dim hover:border-polaris-300 hover:text-ink dark:bg-paper-deep dark:border-white/[0.12] dark:hover:border-polaris-400/40";
const optionBtnActive =
  "bg-polaris-100 border-polaris-400 text-ink dark:bg-polaris-400/20 dark:border-polaris-400/60 dark:text-polaris-100";

/* ─── Password card ─── */
function PasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [kind, setKind] = useState<"ok" | "err">("ok");

  async function save() {
    setMsg("");
    setBusy(true);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    setBusy(false);
    if (res.ok) {
      setKind("ok");
      setMsg("Password updated.");
      setCurrent("");
      setNext("");
    } else {
      const d = await res.json().catch(() => ({}));
      setKind("err");
      setMsg(d.error || "Failed to update password");
    }
  }

  return (
    <Card title="Change password">
      <div className="space-y-4">
        <Field label="Current password">
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
        </Field>
        <Field label="New password" hint="At least 8 characters.">
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
        </Field>
        <Status msg={msg} kind={kind} />
        <div className="flex justify-end">
          <button onClick={save} disabled={busy || !current || next.length < 8} className={btnPrimary}>
            {busy ? "Updating…" : "Update password"}
          </button>
        </div>
      </div>
    </Card>
  );
}

/* ─── Plan card ─── */
function PlanCard({ account }: { account: Account }) {
  return (
    <Card title="Plan & billing">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[10.5px] uppercase tracking-wider text-ink-muted font-medium">Current plan</div>
          <div className="font-serif text-[22px] font-bold text-ink mt-0.5">Polaris {PLAN_LABELS[account.plan]}</div>
        </div>
        <Link
          href="/billing"
          className="rounded-full border border-polaris-300 bg-white px-4 py-2 text-[13px] font-medium text-ink hover:bg-polaris-50 transition-colors"
        >
          Manage billing
        </Link>
      </div>
      {account.role !== "student" && (
        <div className="mt-3 text-[12px] text-ink-dim">
          Account role: <span className="font-semibold text-ink capitalize">{account.role}</span>
        </div>
      )}
    </Card>
  );
}

/* ─── Welcome modal ─── */
function WelcomeModal({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-6" role="dialog" aria-modal="true">
      <div className="bg-paper-card rounded-3xl shadow-pop ring-1 ring-inset ring-polaris-500/10 max-w-[440px] w-full p-7 dark:ring-white/[0.12]">
        <div className="text-[10.5px] uppercase tracking-[0.22em] text-ink-muted font-medium mb-2">Welcome to Polaris</div>
        <h2 className="font-serif text-[24px] font-bold tracking-tight text-ink leading-tight">
          One last step - complete your academic profile.
        </h2>
        <p className="mt-3 text-[13.5px] text-ink-dim leading-relaxed">
          Your curriculum, results, scholarships, and achievements feed every recommendation the Strategist makes -
          your roadmap, your acceptance probability, the offers we surface. It takes a couple of minutes.
        </p>
        <div className="mt-6 flex items-center justify-end gap-2">
          <button onClick={onSkip} className="text-[13px] text-ink-dim hover:text-ink px-3 py-2 transition-colors">
            Later
          </button>
          <button
            onClick={onStart}
            className="inline-flex items-center gap-1.5 rounded-full bg-ink text-paper px-5 py-2.5 text-[13.5px] font-semibold hover:bg-polaris-700 transition-colors"
          >
            Complete profile
            <span>→</span>
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── helpers ─── */
function collectTestScores(map: Record<string, string>): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    const n = parseFloat(v);
    if (Number.isFinite(n) && n > 0) out[k] = n;
  }
  return Object.keys(out).length ? out : undefined;
}

function cryptoId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2);
}
