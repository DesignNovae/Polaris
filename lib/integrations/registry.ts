/**
 * Integration registry - the honest catalog.
 *
 * Statuses are real:
 *   - "available"      → working connect flow exists right now
 *                        (Codeforces public API, GitHub public/PAT import)
 *   - "requires_setup" → full OAuth flow is scaffolded server-side but the
 *                        operator hasn't added client credentials yet
 *                        (Google Calendar/Drive, Facebook). The UI says so.
 *   - "coming_soon"    → no reliable API/import path today; no Connect button
 *   - "connected" / "syncing" / "error" / "revoked" → per-user runtime states
 *
 * No fake Connect buttons anywhere.
 */

export type IntegrationStatus =
  | "connected" | "available" | "coming_soon" | "requires_setup"
  | "error" | "syncing" | "revoked";

export type IntegrationCategory =
  | "calendar" | "storage" | "notes" | "coding" | "learning" | "social";

export type ConnectionMethod =
  | "oauth" | "api_key" | "public_handle" | "local_sync" | "coming_soon";

export type IntegrationScope = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

export type IntegrationDef = {
  id: string;
  name: string;
  category: IntegrationCategory;
  /** BrandLogos key when a real vector mark exists in the repo. */
  brand?: string;
  color: string;
  officialUrl: string;
  description: string;
  connectionMethod: ConnectionMethod;
  syncDirection: "import" | "export" | "two_way";
  scopes: IntegrationScope[];
  features: string[];
  /** What Polaris will NOT do - shown in the connect modal. */
  wontDo: string[];
  /** Base availability before per-user state is applied. */
  baseStatus: "available" | "requires_setup" | "coming_soon";
  comingSoonReason?: string;
  /** Env vars that unlock a requires_setup provider. */
  envVars?: string[];
};

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "github",
    name: "GitHub",
    category: "coding",
    brand: "github",
    color: "#24292F",
    officialUrl: "https://github.com",
    description: "Import your public repositories into your project portfolio. The Strategist reads languages, stars, and documentation health to strengthen your profile.",
    connectionMethod: "public_handle",
    syncDirection: "import",
    scopes: [
      { id: "profile", label: "Public profile", description: "Username, name, bio, follower count", required: true },
      { id: "repos", label: "Public repositories", description: "Names, descriptions, languages, stars", required: true },
      { id: "pat", label: "Personal access token (optional)", description: "Used once for this import to raise rate limits / include private repos - never stored", required: false },
    ],
    features: ["Portfolio project import", "Language strengths", "Documentation health check", "Roadmap project milestones"],
    wontDo: ["Modify or publish anything", "Store your access token", "Access private repos without a token you provide"],
    baseStatus: "available",
  },
  {
    id: "codeforces",
    name: "Codeforces",
    category: "coding",
    brand: "codeforces",
    color: "#1F8ACB",
    officialUrl: "https://codeforces.com",
    description: "Import your public competitive-programming profile by handle - rating, rank, solved problems, and weak topic tags feed your Olympiad branch.",
    connectionMethod: "public_handle",
    syncDirection: "import",
    scopes: [
      { id: "profile", label: "Public profile", description: "Handle, rating, rank, max rating", required: true },
      { id: "submissions", label: "Recent submissions", description: "Last ~200 public submissions for solved counts + weak tags", required: true },
    ],
    features: ["Rating + rank tracking", "Weak-topic detection", "Olympiad roadmap tasks", "Contest history"],
    wontDo: ["Require your password", "Submit or change anything on Codeforces"],
    baseStatus: "available",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    category: "calendar",
    brand: "gcal",
    color: "#4285F4",
    officialUrl: "https://calendar.google.com",
    description: "Two-way sync: export Polaris deadlines and study blocks to your calendar, and read busy periods so the Strategist schedules around your real life.",
    connectionMethod: "oauth",
    syncDirection: "two_way",
    scopes: [
      { id: "read", label: "Calendar read", description: "Upcoming events to detect busy periods", required: true },
      { id: "write", label: "Calendar write", description: "Create deadline + study-block events (with confirmation)", required: false },
    ],
    features: ["Deadline export", "Busy-period detection", "Study-block scheduling", "Conflict warnings"],
    wontDo: ["Change or delete events without confirmation", "Read event attendees or descriptions beyond busy/free"],
    baseStatus: "requires_setup",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    category: "storage",
    brand: "gdrive",
    color: "#1FA463",
    officialUrl: "https://drive.google.com",
    description: "Index selected folders only - essay drafts, transcripts, CVs - so the Strategist can cite your actual documents in its advice.",
    connectionMethod: "oauth",
    syncDirection: "import",
    scopes: [
      { id: "selected", label: "Selected folders", description: "Only folders you explicitly pick", required: true },
    ],
    features: ["Essay draft indexing", "Document citations in chat", "Attach docs to application tasks"],
    wontDo: ["Scan your whole Drive", "Access anything outside selected folders", "Share or modify files"],
    baseStatus: "requires_setup",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "facebook",
    name: "Facebook",
    category: "social",
    color: "#1877F2",
    officialUrl: "https://facebook.com",
    description: "Import selected events and groups (with explicit permission) to surface extracurricular activities and event deadlines.",
    connectionMethod: "oauth",
    syncDirection: "import",
    scopes: [
      { id: "events", label: "Your events", description: "Events you've joined or been invited to", required: true },
    ],
    features: ["Event deadline import", "Extracurricular detection"],
    wontDo: ["Post on your behalf", "Read messages or friend lists"],
    baseStatus: "requires_setup",
    envVars: ["FACEBOOK_CLIENT_ID", "FACEBOOK_CLIENT_SECRET"],
  },
  {
    id: "notion",
    name: "Notion",
    category: "notes",
    brand: "notion",
    color: "#111111",
    officialUrl: "https://notion.so",
    description: "Select pages and databases for the Strategist to search and cite - your study notes become part of its grounding.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Note search + citations", "Link notes to roadmap nodes"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Notion OAuth + page-picker flow is on the roadmap. We won't ship a half-working sync.",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    category: "notes",
    brand: "obsidian",
    color: "#7C3AED",
    officialUrl: "https://obsidian.md",
    description: "Privacy-first local vault indexing: your markdown notes linked to roadmap nodes without leaving your machine.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Local vault watch", "Markdown note linking"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Local file sync needs a desktop connector. Faking it with uploads isn't good enough.",
  },
  {
    id: "khan",
    name: "Khan Academy",
    category: "learning",
    brand: "khan",
    color: "#14BF96",
    officialUrl: "https://khanacademy.org",
    description: "Course mastery import so the Strategist stops assigning what you've already mastered and targets real gaps.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Mastery sync", "Weak-topic detection", "SAT progress"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Khan Academy retired its public API. We'll integrate when a reliable import path exists.",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    category: "social",
    brand: "linkedin",
    color: "#0A66C2",
    officialUrl: "https://linkedin.com",
    description: "Mirror verified achievements and experience into your portfolio and roadmap.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Achievement import", "Profile improvement hints"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "LinkedIn's API is restricted to approved partners. We'll support import when access is reliable.",
  },
  {
    id: "leetcode",
    name: "LeetCode",
    category: "coding",
    color: "#FFA116",
    officialUrl: "https://leetcode.com",
    description: "Public profile import - solved counts and contest rating for your technical-prep track.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Solved-problem tracking", "Contest rating"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "LeetCode has no stable public API; scraping breaks silently. Next in line after Codeforces.",
  },
  {
    id: "outlook",
    name: "Outlook Calendar",
    category: "calendar",
    color: "#0F6CBD",
    officialUrl: "https://outlook.com",
    description: "Deadline + study-block sync for Microsoft-account users.",
    connectionMethod: "coming_soon",
    syncDirection: "two_way",
    scopes: [],
    features: ["Deadline export", "Busy-period detection"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Microsoft Graph OAuth is planned right after Google Calendar ships.",
  },
  {
    id: "dropbox",
    name: "Dropbox",
    category: "storage",
    color: "#0061FF",
    officialUrl: "https://dropbox.com",
    description: "Index selected folders for essays and application documents.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Selected-folder indexing", "Document citations"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Planned after Google Drive - same selected-folders-only privacy model.",
  },
  {
    id: "classroom",
    name: "Google Classroom",
    category: "learning",
    color: "#0F9D58",
    officialUrl: "https://classroom.google.com",
    description: "Import coursework deadlines and grades to balance school pressure against your prep roadmap.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Coursework deadline import", "Workload detection"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Classroom API requires school-admin consent flows we haven't built yet.",
  },
];

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  calendar: "Calendar", storage: "Storage", notes: "Notes",
  coding: "Coding", learning: "Learning", social: "Social",
};

export function integrationDef(id: string): IntegrationDef | null {
  return INTEGRATIONS.find((i) => i.id === id) ?? null;
}

/** requires_setup providers flip to "available" when their env creds exist. */
export function envReady(def: IntegrationDef): boolean {
  if (def.baseStatus !== "requires_setup" || !def.envVars) return false;
  return def.envVars.every((v) => !!process.env[v]);
}

