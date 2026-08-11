/**
 * Shared types for the app shell.
 */

import type { Plan, UserRole } from "@/lib/db/collections";

export type NavItemId =
  | "roadmap"
  | "strategist"
  | "deadlines"
  | "universities"
  | "resources"
  | "action-lab"
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
  probability: number; // 0..1
  color: "polaris" | "nova" | "aurora";
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
  createdAt: string;
};

export type { Plan, UserRole };
