/**
 * Integration Registry - Definitive catalog of external platform integrations.
 * 
 * VIVA NOTE: This file acts as the single source of truth for all available external tools.
 * It defines each integration's metadata (category, brand color, capabilities, and privacy contracts).
 */

// Available status values for integrations
export type IntegrationStatus =
  | "connected"      // User has active connection
  | "available"      // Ready to connect right now (Codeforces, GitHub)
  | "coming_soon"    // Roadmap feature, connect button disabled
  | "requires_setup" // Requires OAuth server credentials
  | "error"          // Connection error
  | "syncing"        // Currently syncing data
  | "revoked";       // Disconnected by user

// Category classification for tools
export type IntegrationCategory =
  | "calendar" | "storage" | "notes" | "coding" | "learning" | "social";

// Method used to establish connection
export type ConnectionMethod =
  | "oauth" | "api_key" | "public_handle" | "local_sync" | "coming_soon";

// Individual permission scope requested by integration
export type IntegrationScope = {
  id: string;
  label: string;
  description: string;
  required: boolean;
};

// Full definition interface for an integration provider
export type IntegrationDef = {
  id: string;
  name: string;
  category: IntegrationCategory;
  brand?: string;
  color: string;
  officialUrl: string;
  description: string;
  connectionMethod: ConnectionMethod;
  syncDirection: "import" | "export" | "two_way";
  scopes: IntegrationScope[];
  features: string[];
  wontDo: string[]; // Explicit privacy guarantee shown in UI modal
  baseStatus: "available" | "requires_setup" | "coming_soon";
  comingSoonReason?: string;
  envVars?: string[];
};

/**
 * Catalog list of all external integrations supported in Polaris.
 * VIVA NOTE: Includes GitHub & Codeforces (working imports), plus OAuth & coming-soon scaffolds.
 */
export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: "github",
    name: "GitHub",
    category: "coding",
    brand: "github",
    color: "#24292F",
    officialUrl: "https://github.com",
    description: "Import your public repositories into your project portfolio. Evaluates languages, stars, and documentation health to strengthen your profile.",
    connectionMethod: "public_handle",
    syncDirection: "import",
    scopes: [
      { id: "profile", label: "Public profile", description: "Username, bio, follower count", required: true },
      { id: "repos", label: "Public repositories", description: "Repo names, descriptions, languages, star counts", required: true },
      { id: "pat", label: "Personal access token (optional)", description: "Used once to bypass rate limits — never stored", required: false },
    ],
    features: ["Portfolio project import", "Language strengths analysis", "Documentation health check"],
    wontDo: ["Modify or publish code", "Store your access token", "Access private repos without a token"],
    baseStatus: "available",
  },
  {
    id: "codeforces",
    name: "Codeforces",
    category: "coding",
    brand: "codeforces",
    color: "#1F8ACB",
    officialUrl: "https://codeforces.com",
    description: "Import your competitive programming profile by handle — rating, rank, solved problems, and weak topic tags.",
    connectionMethod: "public_handle",
    syncDirection: "import",
    scopes: [
      { id: "profile", label: "Public profile", description: "Handle, rating, rank, peak rating", required: true },
      { id: "submissions", label: "Recent submissions", description: "Solved problem count & weak topic analysis", required: true },
    ],
    features: ["Rating & rank tracking", "Weak topic detection", "Contest history summary"],
    wontDo: ["Require your password", "Modify anything on Codeforces"],
    baseStatus: "available",
  },
  {
    id: "gcal",
    name: "Google Calendar",
    category: "calendar",
    brand: "gcal",
    color: "#4285F4",
    officialUrl: "https://calendar.google.com",
    description: "Export deadlines and study blocks to Google Calendar, and detect busy periods for optimal scheduling.",
    connectionMethod: "oauth",
    syncDirection: "two_way",
    scopes: [
      { id: "read", label: "Calendar read", description: "Detect busy scheduling periods", required: true },
    ],
    features: ["Deadline export", "Busy-period detection", "Conflict warnings"],
    wontDo: ["Change events without confirmation", "Read private attendee details"],
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
    description: "Index selected essay drafts and transcripts to cite documents in strategic advice.",
    connectionMethod: "oauth",
    syncDirection: "import",
    scopes: [
      { id: "selected", label: "Selected folders", description: "Only explicit folders you grant access to", required: true },
    ],
    features: ["Essay draft indexing", "Document citations"],
    wontDo: ["Scan your full Drive", "Access unselected files"],
    baseStatus: "requires_setup",
    envVars: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  },
  {
    id: "notion",
    name: "Notion",
    category: "notes",
    brand: "notion",
    color: "#111111",
    officialUrl: "https://notion.so",
    description: "Index selected Notion pages and databases to connect study notes to your academic strategy.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Note indexing", "Roadmap citations"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Notion OAuth integration planned on roadmap.",
  },
  {
    id: "obsidian",
    name: "Obsidian",
    category: "notes",
    brand: "obsidian",
    color: "#7C3AED",
    officialUrl: "https://obsidian.md",
    description: "Local markdown vault sync to connect local notes directly to your roadmap nodes.",
    connectionMethod: "coming_soon",
    syncDirection: "import",
    scopes: [],
    features: ["Vault watching", "Markdown note linking"],
    wontDo: [],
    baseStatus: "coming_soon",
    comingSoonReason: "Local desktop vault watcher under development.",
  },
];

// Friendly category labels for UI filters
export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  calendar: "Calendar",
  storage: "Storage",
  notes: "Notes",
  coding: "Coding",
  learning: "Learning",
  social: "Social",
};

/**
 * VIVA NOTE: Utility function to lookup an integration definition by ID.
 */
export function integrationDef(id: string): IntegrationDef | null {
  return INTEGRATIONS.find((i) => i.id === id) ?? null;
}

/**
 * VIVA NOTE: Checks if required OAuth environment variables exist on the server.
 */
export function envReady(def: IntegrationDef): boolean {
  if (def.baseStatus !== "requires_setup" || !def.envVars) return false;
  return def.envVars.every((v) => !!process.env[v]);
}
