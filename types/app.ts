/**
 * Shared types for the new app shell. Re-exports DB types where useful so
 * page components don't need to import from `lib/db/*`.
 */

import type {
  DbMilestone,
  MilestoneStatus,
  Plan,
  UserRole,
} from "@/lib/db/collections";
import type { RoadmapMilestone } from "@/lib/llm/gemma";

export type NavItemId =
  | "roadmap"
  | "strategist"
  | "deadlines"
  | "universities"
  | "resources"
  | "action-lab"
  | "passport"
  | "cohort"
  | "affordability"
  | "connections"
  | "partners"
  | "consultants"
  | "community"
  | "family"
  | "billing"
  | "transactions"
  | "bookings"
  | "settings";

export type NavItem = {
  id: NavItemId;
  label: string;
  hint: string;
  shortcut: string;
  minPlan?: Plan;
  minRole?: UserRole;
};

export type PathSummary = {
  id: string;
  name: string;
  target: string;
  degree: string;
  horizon: string;
  /** 0..1, or null when the student has no profile to score yet. */
  probability: number | null;
  color: "polaris" | "nova" | "aurora";
};

export type DeadlineKind = "hard" | "soft" | "repeat";

export type Deadline = {
  id: string;
  date: string; // ISO yyyy-mm-dd
  title: string;
  kind: DeadlineKind;
  milestoneId?: string;
  source: "ai" | "user" | "external";
};

export type StrategistRole = "user" | "agent" | "system";

export type StrategistSource = {
  label: string;
  uri: string;
  kind: "kb" | "case" | "web" | "profile" | "roadmap";
};

export type StrategistMessage = {
  id: string;
  role: StrategistRole;
  text?: string;
  bullets?: string[];
  sources?: StrategistSource[];
  createdAt: string; // ISO
};

export type ResourceKind = "video" | "pdf" | "book" | "doc" | "essay" | "link";

export type ResourceRecord = {
  id: string;
  kind: ResourceKind;
  title: string;
  source: string;
  length: string;
  url: string;
  milestoneId?: string;
  tags: string[];
};

export type Probability = {
  baseline: number;
  yours: number;
  factors: Array<{ id: string; label: string; weight: number; you: number; peers: number }>;
};

export type { DbMilestone, MilestoneStatus, RoadmapMilestone, Plan, UserRole };
