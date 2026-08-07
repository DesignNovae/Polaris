/**
 * Education-level roadmap templates.
 *
 * These serve two purposes:
 *   1. Deterministic fallback when the LLM is unreachable - the roadmap is
 *      never empty.
 *   2. Curriculum guidance embedded into the generation prompt so the LLM's
 *      output respects each level's philosophy (no SAT grind for Class 5).
 *
 * Node `stage` is relative (0..1) and is mapped onto the user's actual
 * phase count at generation time.
 */

import type { BranchCategory, RoadmapConfig } from "./types";

export type TplNode = {
  title: string;
  description: string;
  why: string;
  how: string;
  type: "study" | "practice" | "project" | "test" | "activity" | "application";
  priority: "high" | "medium" | "low";
  difficulty: 1 | 2 | 3 | 4 | 5;
  stage: number; // 0..1 relative position in the plan
  hours: number; // est. hours/week
  tasks: string[];
  topics: string[];
  completionCriteria: string;
  impact: string;
  scoreKeys?: string[]; // which score inputs to attach (see SCORE_DEFS)
};

export type TplBranch = {
  title: string;
  category: BranchCategory;
  priority: "high" | "medium" | "low";
  tone: "polaris" | "nova" | "aurora" | "rose";
  /** Only include when these exams were selected (empty = always). */
  requiresExams?: Array<"SAT" | "IELTS" | "TOEFL" | "board" | "olympiad">;
  nodes: TplNode[];
};

export const SCORE_DEFS: Record<string, { label: string; min: number; max: number; step: number; unit?: string }> = {
  "sat-total":     { label: "SAT total",          min: 400, max: 1600, step: 10 },
  "sat-math":      { label: "SAT Math",           min: 200, max: 800,  step: 10 },
  "sat-english":   { label: "SAT Reading/Writing", min: 200, max: 800, step: 10 },
  "ielts-overall": { label: "IELTS overall band", min: 1,   max: 9,    step: 0.5 },
  "ielts-listening": { label: "IELTS Listening",  min: 1,   max: 9,    step: 0.5 },
  "ielts-reading": { label: "IELTS Reading",      min: 1,   max: 9,    step: 0.5 },
  "ielts-writing": { label: "IELTS Writing",      min: 1,   max: 9,    step: 0.5 },
  "ielts-speaking": { label: "IELTS Speaking",    min: 1,   max: 9,    step: 0.5 },
  "mock-pct":      { label: "Mock test score",    min: 0,   max: 100,  step: 1, unit: "%" },
  "board-gpa":     { label: "Board GPA",          min: 0,   max: 5,    step: 0.01 },
  "olympiad-score": { label: "Olympiad practice score", min: 0, max: 100, step: 1, unit: "%" },
};

/* ════════════════════════════════════════════════════════════════════════
 * Templates by level
 * ════════════════════════════════════════════════════════════════════════ */

const earlySchool: TplBranch[] = [
  {
    title: "Strong foundations", category: "Foundations", priority: "high", tone: "polaris",
    nodes: [
      { title: "Daily reading habit", description: "Read 20 minutes a day from books you actually enjoy.", why: "Reading speed and vocabulary compound for years - it's the single highest-leverage habit at this age.", how: "Pick 3 books this week (any genre). Read 20 minutes after school. Keep a one-line log of what happened in the story.", type: "activity", priority: "high", difficulty: 1, stage: 0.05, hours: 2.5, tasks: ["Pick 3 books you like", "Read 20 min/day for a week", "Write one line per day about what you read", "Tell someone the best part of a story"], topics: ["reading-habit"], completionCriteria: "14 reading days logged", impact: "+ Communication & comprehension", },
      { title: "Math foundation drills", description: "Master your grade's number skills with short, fun practice.", why: "Math confidence now decides which doors open later - Olympiads, science, coding.", how: "Do one Khan Academy unit per week at your grade level. Aim for mastery (blue), not just completion.", type: "practice", priority: "high", difficulty: 2, stage: 0.25, hours: 2, tasks: ["Set up Khan Academy at your grade", "Finish 1 unit to mastery", "Re-try every wrong question", "Show a parent your progress chart"], topics: ["math-foundation"], completionCriteria: "2 units mastered", impact: "+ Academic base", },
      { title: "English word bank", description: "Learn 5 new words a week and actually use them.", why: "Vocabulary is the quiet engine behind every future exam and interview.", how: "Keep a small notebook. 5 words/week from your reading. Use each one out loud in a sentence at dinner.", type: "practice", priority: "medium", difficulty: 1, stage: 0.4, hours: 1, tasks: ["Start a word notebook", "Collect 5 words from your books", "Use each in a spoken sentence", "Quiz yourself Friday"], topics: ["english-vocab"], completionCriteria: "20 words learned and used", impact: "+ Language strength", },
    ],
  },
  {
    title: "Explore & create", category: "Projects", priority: "medium", tone: "aurora",
    nodes: [
      { title: "Try a science-fair mini project", description: "Pick one question about the world and test it at home.", why: "Curiosity projects teach you how to think - and they're fun.", how: "Browse Science Buddies for your grade, pick a 1-week project, run it, photograph the steps.", type: "project", priority: "medium", difficulty: 2, stage: 0.55, hours: 2, tasks: ["Pick a project on Science Buddies", "List materials and get them", "Run the experiment", "Make a 1-page poster of what you found"], topics: ["science-fair"], completionCriteria: "Poster made and shown to class/family", impact: "+ Curiosity & science identity", },
      { title: "First coding adventure", description: "Build something tiny that moves on a screen.", why: "Early exposure beats late cramming - and block coding feels like play.", how: "Use Scratch or a freeCodeCamp intro. Make an animation or mini-game with 2 sprites.", type: "project", priority: "medium", difficulty: 2, stage: 0.7, hours: 1.5, tasks: ["Create a Scratch account", "Follow one starter tutorial", "Make your own 2-sprite game", "Show it to a friend"], topics: ["coding"], completionCriteria: "One playable mini-game", impact: "+ Creative/technical exploration", },
      { title: "Olympiad taste test", description: "Try fun competition-style math puzzles - no pressure.", why: "Finding out you LIKE puzzles early is worth more than any medal later.", how: "Do 3 past primary-level Olympiad problems a week as games, not tests.", type: "practice", priority: "low", difficulty: 3, stage: 0.85, hours: 1, tasks: ["Find primary Olympiad samples", "Solve 3 puzzles weekly", "Keep a 'favorite puzzle' page"], topics: ["olympiad-math"], completionCriteria: "12 puzzles attempted", impact: "+ Problem-solving spark", scoreKeys: ["olympiad-score"], },
    ],
  },
  {
    title: "Confidence & voice", category: "ECAs", priority: "medium", tone: "nova",
    nodes: [
      { title: "Speak up weekly", description: "Practice telling stories and answering questions out loud.", why: "Communication confidence built now pays off in every interview ever.", how: "Once a week: retell a story you read to family, 2 minutes, standing up.", type: "activity", priority: "medium", difficulty: 1, stage: 0.5, hours: 0.5, tasks: ["Pick a story each week", "Tell it in 2 minutes standing", "Ask for one piece of feedback"], topics: ["reading-habit"], completionCriteria: "4 story retellings done", impact: "+ Confidence & speaking", },
      { title: "Discover one activity you love", description: "Sample clubs/sports/art until something clicks.", why: "Deep multi-year ECAs start with honest exploration, not resume-chasing.", how: "Try one new activity every 2 weeks. Rate it /10. Keep the one you score highest.", type: "activity", priority: "medium", difficulty: 1, stage: 0.9, hours: 2, tasks: ["List 4 activities to sample", "Try each once", "Rate and pick your favorite", "Attend it twice more"], topics: ["leadership"], completionCriteria: "One activity chosen and attended 3+ times", impact: "+ Early ECA identity", },
    ],
  },
];

const middleSchool: TplBranch[] = [
  {
    title: "Academic excellence", category: "Academics", priority: "high", tone: "polaris",
    nodes: [
      { title: "Subject mastery system", description: "Set up a weekly study block system for school subjects.", why: "Habits formed now carry you through SSC/HSC with far less pain.", how: "3 fixed study blocks/week (45 min each): toughest subject first, practice problems over re-reading.", type: "study", priority: "high", difficulty: 2, stage: 0.05, hours: 3, tasks: ["Pick your 2 weakest subjects", "Schedule 3 weekly blocks", "Do practice problems each block", "Track marks for a month"], topics: ["study-skills", "board-prep"], completionCriteria: "4 weeks of blocks completed", impact: "+ GPA trajectory", scoreKeys: ["mock-pct"], },
      { title: "Math/science deepening", description: "Go one level beyond the school syllabus in math + one science.", why: "Olympiads and future test prep both grow from this root.", how: "Khan Academy: next grade's math units. Pick the science you like most and watch one concept video/week.", type: "study", priority: "high", difficulty: 3, stage: 0.35, hours: 2.5, tasks: ["Finish 2 above-grade math units", "Maintain a 'cool concepts' notebook", "Solve 5 hard problems weekly"], topics: ["math-foundation"], completionCriteria: "2 above-grade units mastered", impact: "+ STEM depth", },
    ],
  },
  {
    title: "Olympiad track", category: "Olympiads", priority: "medium", tone: "nova",
    nodes: [
      { title: "Olympiad fundamentals", description: "Train on real past problems in your strongest subject.", why: "National-round medals at this age become elite signals later.", how: "AoPS-style: 5 past problems/week, write full solutions, compare with answer keys.", type: "practice", priority: "medium", difficulty: 4, stage: 0.45, hours: 2, tasks: ["Collect 3 years of past papers", "Solve 5 problems weekly with written solutions", "Join one online Olympiad community", "Sit one practice round"], topics: ["olympiad-math"], completionCriteria: "One full practice round taken", impact: "+ Competition record", scoreKeys: ["olympiad-score"], },
    ],
  },
  {
    title: "Build & write", category: "Projects", priority: "medium", tone: "aurora",
    nodes: [
      { title: "First real coding project", description: "Build a small project you can show someone.", why: "A shipped project at 13 beats a certificate every time.", how: "freeCodeCamp basics → build a calculator, quiz game, or simple website about a hobby.", type: "project", priority: "medium", difficulty: 3, stage: 0.6, hours: 2.5, tasks: ["Finish freeCodeCamp basics section", "Plan a tiny project", "Build it", "Demo to your class/club"], topics: ["coding", "portfolio"], completionCriteria: "Working demo shown to others", impact: "+ Technical portfolio seed", },
      { title: "Writing voice", description: "Write something short every week - stories, reviews, a blog.", why: "Every future essay and application stands on writing fluency.", how: "300 words weekly. Read it out loud. Fix what sounds wrong. Share monthly.", type: "practice", priority: "medium", difficulty: 2, stage: 0.75, hours: 1, tasks: ["Write 300 words weekly", "Read aloud + edit each piece", "Share one piece a month"], topics: ["essay", "reading-habit"], completionCriteria: "4 edited pieces", impact: "+ Writing fluency", },
    ],
  },
  {
    title: "Clubs & confidence", category: "ECAs", priority: "medium", tone: "rose",
    nodes: [
      { title: "Commit to one club + one role", description: "Stop sampling - go deep in one activity and take a small responsibility.", why: "Depth + responsibility is the pattern admissions reads as leadership.", how: "Pick your strongest club. Volunteer for one concrete job (event helper, newsletter, treasurer).", type: "activity", priority: "medium", difficulty: 2, stage: 0.85, hours: 2, tasks: ["Choose your one club", "Ask for a small role", "Do the role for a month", "Log what you organized"], topics: ["leadership"], completionCriteria: "One month in a named role", impact: "+ Early leadership arc", },
    ],
  },
];

const ssc: TplBranch[] = [
  {
    title: "Board exam engine", category: "Academics", priority: "high", tone: "polaris",
    nodes: [
      { title: "SSC subject battle plan", description: "Map every SSC subject to its weak chapters and build a weekly block plan.", why: "Your GPA/A* line is the first filter on every application after this - it must be protected.", how: "List subjects → mark weak chapters from last 2 exams → assign each to a weekly 90-min block, hardest at your freshest hour.", type: "study", priority: "high", difficulty: 3, stage: 0.05, hours: 8, tasks: ["List weak chapters per subject", "Build the weekly block timetable", "Run it for 2 weeks", "Re-test one weak chapter and log the score"], topics: ["board-prep", "study-skills"], completionCriteria: "2 weeks executed + 1 retest improved", impact: "+ GPA/A* protection", scoreKeys: ["mock-pct", "board-gpa"], },
      { title: "Revision cycles before exams", description: "Spaced revision sprints for upcoming school exams.", why: "Cramming loses to spacing every time - protect marks under time pressure.", how: "3 passes per subject: notes condensation → past paper under timer → error-list review.", type: "study", priority: "high", difficulty: 3, stage: 0.55, hours: 6, tasks: ["Condense notes per subject", "One timed past paper per subject", "Build an error list", "Re-drill only the errors"], topics: ["board-prep"], completionCriteria: "All subjects through 3 passes", impact: "+ Exam-day performance", scoreKeys: ["mock-pct"], },
    ],
  },
  {
    title: "English engine (IELTS-light)", category: "IELTS", priority: "medium", tone: "nova", requiresExams: ["IELTS", "TOEFL"],
    nodes: [
      { title: "English skill base", description: "Build reading speed + vocabulary without an exam-prep grind.", why: "A strong English base makes later IELTS prep a 4-week job instead of a 6-month one.", how: "20 min daily English reading + 10 words/week + one listening podcast episode weekly.", type: "practice", priority: "medium", difficulty: 2, stage: 0.3, hours: 3, tasks: ["Daily 20-min English reading", "10 new words weekly with sentences", "1 podcast episode weekly with notes"], topics: ["english-vocab", "ielts-listening"], completionCriteria: "4 weeks of logs", impact: "+ Future IELTS readiness", },
      { title: "IELTS taste test", description: "One diagnostic sample per skill - only if your timeline allows.", why: "Knowing your baseline ends the guessing; it costs one weekend.", how: "Official ielts.org samples: one Listening + one Reading section, self-marked.", type: "test", priority: "low", difficulty: 2, stage: 0.7, hours: 2, tasks: ["Take one Listening sample", "Take one Reading sample", "Self-mark and log bands"], topics: ["ielts-listening", "ielts-reading"], completionCriteria: "Both samples marked + bands logged", impact: "+ Baseline knowledge", scoreKeys: ["ielts-listening", "ielts-reading"], },
    ],
  },
  {
    title: "SAT foundation (light)", category: "SAT", priority: "low", tone: "aurora", requiresExams: ["SAT"],
    nodes: [
      { title: "SAT exposure - no grind", description: "Understand the test format and try a few sections untimed.", why: "Early familiarity removes fear; the real prep comes after boards.", how: "Khan Academy SAT setup → one untimed Math module + one Reading module per fortnight.", type: "practice", priority: "low", difficulty: 2, stage: 0.8, hours: 1.5, tasks: ["Set up Khan Academy SAT", "One untimed Math module", "One untimed Reading module", "Note which felt harder"], topics: ["sat-math", "sat-reading"], completionCriteria: "Both modules done + reflection note", impact: "+ Test familiarity", scoreKeys: ["sat-math", "sat-english"], },
    ],
  },
  {
    title: "Olympiad + ECA (kept realistic)", category: "Olympiads", priority: "medium", tone: "rose", requiresExams: ["olympiad"],
    nodes: [
      { title: "One Olympiad, one ECA", description: "Pick exactly one competition and one activity to keep alive during exam season.", why: "Total ECA silence looks bad; overload kills your GPA. One + one is the realistic balance.", how: "Choose the Olympiad nearest your strength. 2 hrs/week max. Keep one club attendance steady.", type: "activity", priority: "medium", difficulty: 3, stage: 0.45, hours: 2, tasks: ["Pick your one Olympiad", "Solve 3 past problems weekly", "Keep weekly club attendance", "Register for the next round"], topics: ["olympiad-math", "leadership"], completionCriteria: "Registered + 4 weeks of practice logs", impact: "+ Sustained signals without GPA risk", scoreKeys: ["olympiad-score"], },
    ],
  },
];

const hsc: TplBranch[] = [
  {
    title: "Academic excellence", category: "Academics", priority: "high", tone: "polaris",
    nodes: [
      { title: "Result target lock-in", description: "Define your exact grade target and reverse-engineer weekly study blocks.", why: "Admissions filters start at your transcript - everything else multiplies on top of it.", how: "Set target per subject → identify the 3 highest-risk chapters → 2 deep-work blocks per risk area weekly.", type: "study", priority: "high", difficulty: 3, stage: 0.05, hours: 10, tasks: ["Write exact grade targets", "List 3 risk chapters per subject", "Schedule deep-work blocks", "Monthly self-mock + log"], topics: ["board-prep", "study-skills"], completionCriteria: "One month of blocks + improved mock", impact: "+ Transcript strength", scoreKeys: ["mock-pct", "board-gpa"], },
    ],
  },
  {
    title: "SAT campaign", category: "SAT", priority: "high", tone: "nova", requiresExams: ["SAT"],
    nodes: [
      { title: "Diagnostic + weak-map", description: "Full timed digital SAT diagnostic, then build your personal weak-topic map.", why: "Every efficient SAT plan starts from real data, not vibes.", how: "Bluebook full test under real timing → log every miss → tag by topic → sort by frequency.", type: "test", priority: "high", difficulty: 3, stage: 0.1, hours: 5, tasks: ["Take full Bluebook diagnostic", "Log every wrong answer with reason", "Build the weak-topic table", "Pick top 3 weaknesses"], topics: ["sat-math", "sat-reading"], completionCriteria: "Diagnostic score + weak map done", impact: "+ Testing baseline", scoreKeys: ["sat-total", "sat-math", "sat-english"], },
      { title: "Weak-topic destruction cycles", description: "Khan Academy drills targeted at your top 3 weak topics.", why: "Score gains come from fixing specific holes, not generic practice.", how: "Per topic: lesson → 30 drills → timed mini-section → re-test. Move on only at 85%+.", type: "practice", priority: "high", difficulty: 3, stage: 0.35, hours: 5, tasks: ["Drill weak topic #1 to 85%", "Drill weak topic #2 to 85%", "Drill weak topic #3 to 85%", "Timed mixed section"], topics: ["sat-math", "sat-writing"], completionCriteria: "All 3 topics at 85%+", impact: "+ Score climbing", scoreKeys: ["sat-math", "sat-english"], },
      { title: "Full mock + review ritual", description: "Alternate full timed mocks with deep review weeks.", why: "Mock → review → fix is the only loop that converts practice into points.", how: "Week A: full mock. Week B: error autopsy + targeted re-drills. Repeat.", type: "test", priority: "high", difficulty: 4, stage: 0.7, hours: 6, tasks: ["Mock 1 + full review", "Mock 2 + full review", "Trend your section scores", "Set final-sit date"], topics: ["sat-math", "sat-reading"], completionCriteria: "2 mocks + visible trend", impact: "+ Real-test readiness", scoreKeys: ["sat-total"], },
    ],
  },
  {
    title: "IELTS sprint", category: "IELTS", priority: "medium", tone: "aurora", requiresExams: ["IELTS", "TOEFL"],
    nodes: [
      { title: "Band diagnostic (all 4 skills)", description: "Official samples for L/R/W/S, self-marked with band descriptors.", why: "Most students only need 4–6 focused weeks - IF they know their per-skill bands.", how: "ielts.org samples for each skill. Mark with official descriptors. Log 4 bands.", type: "test", priority: "medium", difficulty: 2, stage: 0.25, hours: 4, tasks: ["Listening sample + band", "Reading sample + band", "Writing T2 essay + self-band", "Record a Speaking part 2 answer"], topics: ["ielts-listening", "ielts-reading", "ielts-writing", "ielts-speaking"], completionCriteria: "4 bands logged", impact: "+ Language cert baseline", scoreKeys: ["ielts-listening", "ielts-reading", "ielts-writing", "ielts-speaking"], },
      { title: "Weakest-skill focus block", description: "Hammer your lowest band with daily targeted practice.", why: "Overall band rises fastest by lifting the floor, not the ceiling.", how: "IELTS Liz lessons for that skill + daily 30-min practice + weekly re-test.", type: "practice", priority: "medium", difficulty: 3, stage: 0.55, hours: 4, tasks: ["Identify lowest band skill", "Daily 30-min practice for 2 weeks", "Weekly re-test", "Log band movement"], topics: ["ielts-writing", "ielts-speaking"], completionCriteria: "+0.5 band on weakest skill", impact: "+ Band score", scoreKeys: ["ielts-overall"], },
    ],
  },
  {
    title: "Signature projects & leadership", category: "Projects", priority: "high", tone: "rose",
    nodes: [
      { title: "One signature project", description: "Ship something real in your interest area - app, paper, campaign, build.", why: "A single deep, shipped project outweighs five shallow club memberships.", how: "Define a problem you genuinely care about → scope a 6-week build → ship publicly (GitHub/blog/event).", type: "project", priority: "high", difficulty: 4, stage: 0.4, hours: 4, tasks: ["Write a one-page project spec", "Weekly build milestones", "Ship it publicly", "Collect 3 pieces of feedback"], topics: ["coding", "research", "portfolio"], completionCriteria: "Public artifact exists", impact: "+ Spike/differentiation", },
      { title: "Leadership with receipts", description: "Turn club membership into a named role with measurable outcomes.", why: "\"Led X to Y\" needs numbers - admissions can't credit what isn't measured.", how: "Take/expand a role → run one initiative → document attendance, funds, or output changes.", type: "activity", priority: "medium", difficulty: 3, stage: 0.6, hours: 3, tasks: ["Secure a named role", "Plan one initiative", "Execute + measure outcomes", "Write the 2-line resume bullet"], topics: ["leadership"], completionCriteria: "Initiative done + metrics logged", impact: "+ Leadership evidence", },
      { title: "Competition season", description: "Enter 2 competitions that match your spike (Olympiad/hackathon/essay).", why: "External validation ranks among the strongest profile signals.", how: "Pick 2 with deadlines inside your window → 3 weeks prep each → enter.", type: "activity", priority: "medium", difficulty: 4, stage: 0.75, hours: 3, tasks: ["Shortlist competitions + deadlines", "Prep plan per competition", "Submit/compete in both", "Log results + learnings"], topics: ["olympiad-math", "coding"], completionCriteria: "2 entries submitted", impact: "+ Awards line", scoreKeys: ["olympiad-score"], },
    ],
  },
  {
    title: "Application runway", category: "Applications", priority: "medium", tone: "polaris",
    nodes: [
      { title: "University shortlist v1", description: "Build a 12-school balanced list (reach/target/safety) with costs.", why: "A smart list strategy changes outcomes more than 50 extra SAT points.", how: "Use your probability engine on /universities → 4 reach, 5 target, 3 safety → note aid policies.", type: "application", priority: "medium", difficulty: 2, stage: 0.5, hours: 2, tasks: ["Pick 12 universities in the app", "Tag reach/target/safety", "Note aid/scholarship policy each", "Wishlist them in Polaris"], topics: ["applications", "scholarships"], completionCriteria: "12-school list with aid notes", impact: "+ Strategy clarity", },
      { title: "Recommender + essay groundwork", description: "Choose recommenders early and bank essay raw material.", why: "Great recs and essays are grown over months, not begged for in October.", how: "Pick 2 teachers who know your work → engage genuinely all term. Keep a weekly 'moments' journal for essays.", type: "application", priority: "medium", difficulty: 2, stage: 0.85, hours: 1.5, tasks: ["Choose 2 target recommenders", "One meaningful interaction each, weekly", "Start the essay-moments journal", "Draft one 250-word story"], topics: ["essay", "applications"], completionCriteria: "Journal active + 1 draft story", impact: "+ Application ammunition", },
    ],
  },
];

const gapApplicant: TplBranch[] = [
  {
    title: "Score finalization", category: "SAT", priority: "high", tone: "nova", requiresExams: ["SAT", "IELTS", "TOEFL"],
    nodes: [
      { title: "Final score push", description: "Last focused cycle on whichever test gains you the most.", why: "This is the final window where numbers can still move.", how: "Pick the ONE test with the best ROI → 3-week sprint: drills + 2 mocks → book the real sitting.", type: "test", priority: "high", difficulty: 4, stage: 0.1, hours: 10, tasks: ["Choose the highest-ROI test", "3-week drill plan", "2 full mocks", "Book the official sitting"], topics: ["sat-math", "ielts-writing"], completionCriteria: "Official test booked + mock trend up", impact: "+ Final numbers", scoreKeys: ["sat-total", "ielts-overall"], },
    ],
  },
  {
    title: "Essays & narrative", category: "Applications", priority: "high", tone: "polaris",
    nodes: [
      { title: "Personal statement engine", description: "Draft → feedback → rewrite your main essay until it sings.", why: "At this stage, essays are the highest-variance lever you control.", how: "College Essay Guy structure → full draft → 2 readers' feedback → 2 rewrites minimum.", type: "application", priority: "high", difficulty: 4, stage: 0.25, hours: 6, tasks: ["Outline with a proven structure", "Full first draft", "Collect 2 rounds of feedback", "Rewrite twice"], topics: ["essay"], completionCriteria: "Polished main essay v3", impact: "+ Narrative strength", },
      { title: "Supplemental essay factory", description: "Systematize 'Why us' and activity essays across your list.", why: "Recycled-but-tailored supplements keep quality high across 12 schools.", how: "Build a content matrix: stories × prompts. Write masters, then tailor per school.", type: "application", priority: "high", difficulty: 3, stage: 0.55, hours: 5, tasks: ["Build the story×prompt matrix", "Write 3 master essays", "Tailor for top 5 schools", "Proof pass on everything"], topics: ["essay", "applications"], completionCriteria: "Top-5 supplements done", impact: "+ Application completeness", },
    ],
  },
  {
    title: "Applications & money", category: "Scholarships", priority: "high", tone: "aurora",
    nodes: [
      { title: "Deadline war-room", description: "Every deadline, requirement, and document in one tracker.", why: "Strong profiles die on missed logistics every single year.", how: "Spreadsheet: school × (deadline, essays, recs, tests, fees, portal). Weekly review ritual.", type: "application", priority: "high", difficulty: 2, stage: 0.4, hours: 2, tasks: ["Build the tracker", "Enter all requirements", "Set weekly review slot", "Clear the nearest 3 deadlines"], topics: ["applications"], completionCriteria: "Tracker live + nearest deadlines met", impact: "+ Zero logistics losses", },
      { title: "Scholarship sweep", description: "Apply to every scholarship your profile plausibly fits.", why: "Aid applications are the highest-ROI hours of a gap year.", how: "Scholarships360 + university-specific aid pages → 5 applications minimum → reuse essay material.", type: "application", priority: "high", difficulty: 3, stage: 0.7, hours: 4, tasks: ["List 10 plausible scholarships", "Rank by fit + deadline", "Submit 5 applications", "Track responses"], topics: ["scholarships"], completionCriteria: "5 submitted", impact: "+ Funding odds", },
      { title: "Interview readiness", description: "Mock interviews until your answers are stories, not scripts.", why: "Interviews convert borderline files into admits.", how: "Bank 8 stories → 3 recorded mocks → review tape → refine.", type: "practice", priority: "medium", difficulty: 3, stage: 0.85, hours: 2, tasks: ["Write 8 core stories", "Record 3 mock interviews", "Review + note fixes", "One live mock with a mentor"], topics: ["applications"], completionCriteria: "3 mocks reviewed", impact: "+ Conversion rate", },
    ],
  },
  {
    title: "Portfolio polish", category: "Portfolio", priority: "medium", tone: "rose",
    nodes: [
      { title: "Portfolio cleanup & site", description: "One clean page that proves your spike in 30 seconds.", why: "Reviewers give you minutes; a sharp portfolio buys you more.", how: "GitHub Pages/Notion site: 3 best works, metrics, media. Cut everything weak.", type: "project", priority: "medium", difficulty: 2, stage: 0.6, hours: 3, tasks: ["Select your 3 best artifacts", "Write outcome-first blurbs", "Publish the page", "Add link to applications"], topics: ["portfolio"], completionCriteria: "Live portfolio URL", impact: "+ Evidence accessibility", },
    ],
  },
];

export const TEMPLATES: Record<string, TplBranch[]> = {
  "early-school": earlySchool,
  "middle-school": middleSchool,
  "ssc": ssc,
  "hsc": hsc,
  "gap-applicant": gapApplicant,
};

/** Level philosophy lines injected into the LLM prompt. */
export const LEVEL_GUIDANCE: Record<string, string> = {
  "early-school": "Gentle, fun, exploratory. NO SAT/IELTS pressure. Reading habit, math foundation, vocabulary, Olympiad taste-testing, science-fair curiosity, basic coding/robotics exposure, communication confidence, activity discovery.",
  "middle-school": "Academic excellence, math/science strengthening one level above grade, Olympiad preparation, reading/writing fluency, early coding projects, clubs and competitions, confidence and habit formation. Still no heavy test-prep.",
  "ssc": "Board exam results are TOP priority - protect GPA/A* first. Weekly study blocks because school+coaching eats time. SAT only as light exposure IF the timeline allows. IELTS as English skill-building, not grind. Exactly one Olympiad + one ECA kept alive. Revision cycles before exams. Realistic, not overloaded.",
  "hsc": "Serious admission-focused: academic target lock-in, full SAT campaign (diagnostic → weak-topic cycles → mocks), IELTS sprint, one signature project, leadership with measurable outcomes, competitions, university shortlist, recommender + essay groundwork. Show how to balance all of it WITHOUT destroying grades.",
  "gap-applicant": "Application season: final test-score push, personal statement + supplemental essays, deadline war-room, scholarship sweep, interview prep, portfolio cleanup. Everything converges on submitted applications.",
};

/** Branch filter: include exam-gated branches only when relevant. */
export function templateFor(config: RoadmapConfig): TplBranch[] {
  const base = TEMPLATES[config.educationLevel] ?? hsc;
  return base.filter((b) => {
    if (!b.requiresExams?.length) return true;
    return b.requiresExams.some((e) => config.exams.includes(e));
  });
}
