import { emptyNotice, type Notice } from "./schema";

// Explicit demo data; never written to the notice collection or sent to users.
export const demoNotices: Notice[] = [
  {
    ...emptyNotice(),
    id: "demo-welcome",
    title: "YOUR NEXT CHAPTER.",
    summary:
      "Academic updates. Upcoming events. One clear place to stay in the loop.",
    body: "Meet your Polaris notices.\n\nOpen the bell from any page to find updates selected for your role and plan. Each notice arrives as a floating paper, without taking you away from your work.\n\nThis is a demo notice. Your administrator’s published updates will appear here in your own account.",
    category: "Announcement",
    status: "published",
    revision: 1,
    createdAt: "2026-09-22T00:00:00.000Z",
    updatedAt: "2026-09-22T00:00:00.000Z",
    publishedAt: "2026-09-22T00:00:00.000Z",
    read: false,
  },
];
