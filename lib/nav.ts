import type { NavItem } from "@/types/app";

/** Single source of truth for the application left navigation. */
export const NAV: NavItem[] = [
  { id: "roadmap",      label: "Roadmap",      hint: "Tasks & milestones",        shortcut: "G R" },
  { id: "strategist",   label: "Strategist",   hint: "AI agent",                  shortcut: "G A" },
  { id: "deadlines",    label: "Deadlines",    hint: "Calendar",                  shortcut: "G D" },
  { id: "universities", label: "Universities", hint: "Directory & fit",           shortcut: "G U" },
  { id: "resources",    label: "Resources",    hint: "Library & notes",           shortcut: "G L" },
  { id: "action-lab",   label: "Action Lab",   hint: "Decide · prove · practise", shortcut: "G X" },
  { id: "passport",     label: "Passport",     hint: "Shareable proof",           shortcut: "G V" },
  { id: "cohort",       label: "Benchmarks",   hint: "Students like you",         shortcut: "G N" },
  { id: "affordability",label: "Affordability",hint: "Cost, aid & the gap",       shortcut: "G Y" },
  { id: "connections",  label: "Connections",  hint: "Notion · Obsidian",         shortcut: "G C", minPlan: "pro" },
  { id: "partners",     label: "Partners",     hint: "Offers · marketplace",      shortcut: "G P", minPlan: "pro" },
  { id: "consultants",  label: "Consultants",  hint: "Verified mentors",          shortcut: "G K" },
  { id: "community",    label: "Community",    hint: "Student channels",          shortcut: "G M" },
  { id: "family",       label: "Family",       hint: "Parents · partners",        shortcut: "G F" },
];

export const NAV_FOOTER: NavItem[] = [
  { id: "bookings",     label: "Bookings",     hint: "Your sessions",   shortcut: "G O" },
  { id: "billing",      label: "Billing",      hint: "Plan & invoices", shortcut: "G B" },
  { id: "transactions", label: "Transactions", hint: "Payment history", shortcut: "G T" },
  { id: "settings",     label: "Settings",     hint: "Account",         shortcut: "G S" },
];
