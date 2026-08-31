/**
 * Community - channel registry + guidelines. Channels are config, messages
 * live in Mongo (lib/community/service.ts). Every signed-in user (any plan)
 * can read and post; safety tooling (report, block, auto-hide, link guard)
 * is enforced server-side.
 */

export type ChannelKind = "topic" | "country" | "stage" | "official";

export type Channel = {
  id: string;
  name: string;
  blurb: string;
  kind: ChannelKind;
  tone: "polaris" | "aurora" | "nova" | "sky" | "rose";
};

export const CHANNELS: Channel[] = [
  { id: "general",       name: "General",          blurb: "Introductions and anything-goes questions",      kind: "topic",   tone: "polaris" },
  { id: "roadmaps",      name: "Roadmaps",          blurb: "Share plans, swap weekly-task strategies",       kind: "topic",   tone: "aurora" },
  { id: "scholarships",  name: "Scholarships",      blurb: "Aid letters, external awards, negotiation",      kind: "topic",   tone: "nova" },
  { id: "visa",          name: "Visa & interviews", blurb: "Interview experiences, document checklists",     kind: "topic",   tone: "rose" },
  { id: "usa",           name: "USA",               blurb: "Applications, I-20s, campus life",               kind: "country", tone: "sky" },
  { id: "canada",        name: "Canada",            blurb: "SDS, study permits, co-op programs",             kind: "country", tone: "sky" },
  { id: "germany",       name: "Germany",           blurb: "uni-assist, APS, blocked accounts",              kind: "country", tone: "sky" },
  { id: "uk-ireland",    name: "UK & Ireland",      blurb: "UCAS, CAS letters, accommodation",               kind: "country", tone: "sky" },
  { id: "offer-holders", name: "Offer holders",     blurb: "Got an admit? Next steps together",              kind: "stage",   tone: "aurora" },
  { id: "mentor-ama",    name: "Mentor AMA",        blurb: "Scheduled Q&A rooms with verified consultants",  kind: "official", tone: "polaris" },
];

export function getChannel(id: string): Channel | null {
  return CHANNELS.find((c) => c.id === id) ?? null;
}

export const CHANNEL_KIND_LABELS: Record<ChannelKind, string> = {
  topic: "Topics",
  country: "Countries",
  stage: "Stages",
  official: "Official",
};

export const COMMUNITY_GUIDELINES: string[] = [
  "Be kind - everyone here is figuring the same things out.",
  "No links or payment requests in chat. Verified consultants are badged by Polaris; nobody else may offer paid services.",
  "Advice here is peer experience, not official legal or visa counsel.",
  "No spam, self-promotion, or recruitment.",
  "Report anything suspicious - messages with multiple reports auto-hide pending moderation.",
  "Never share passport numbers, payment details, or one-time codes.",
];

export const COMMUNITY_DISCLAIMER =
  "Community advice is shared student experience - not official legal, visa, or financial counsel. " +
  "Only consultants verified by Polaris may offer paid services here.";

