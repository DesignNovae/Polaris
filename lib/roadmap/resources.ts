/**
 * Curated, topic-wise resource library for roadmap nodes.
 *
 * Every roadmap node carries `topics` tags; the generator attaches matching
 * resources from here. Resources are real, stable, free materials:
 *   - kind "youtube": ref is a video ID (embedded player in the node modal)
 *     or a full URL (rendered as a link when not embeddable).
 *   - kind "practice"/"link"/"pdf"/"book": ref is an absolute URL.
 */

import type { NodeResource } from "./types";

const LIB: Record<string, NodeResource[]> = {
  /* ─── SAT ─── */
  "sat-math": [
    { kind: "practice", title: "Khan Academy - Digital SAT Math (official)", ref: "https://www.khanacademy.org/test-prep/v2-sat-math", note: "Topic-wise drills with instant feedback" },
    { kind: "link", title: "College Board - full-length practice tests", ref: "https://satsuite.collegeboard.org/sat/practice-preparation/practice-tests", note: "Official Bluebook practice tests" },
    { kind: "youtube", title: "SAT Math walkthroughs (YouTube)", ref: "https://www.youtube.com/results?search_query=digital+sat+math+practice+walkthrough" },
  ],
  "sat-reading": [
    { kind: "practice", title: "Khan Academy - SAT Reading & Writing (official)", ref: "https://www.khanacademy.org/test-prep/sat-reading-and-writing", note: "Skill-by-skill official prep" },
    { kind: "link", title: "College Board - question bank", ref: "https://satsuite.collegeboard.org/digital/digital-practice-preparation/sat-suite-question-bank", note: "Filter by domain + difficulty" },
    { kind: "youtube", title: "SAT Reading strategy lessons (YouTube)", ref: "https://www.youtube.com/results?search_query=digital+sat+reading+strategy" },
  ],
  "sat-writing": [
    { kind: "practice", title: "Khan Academy - grammar & conventions", ref: "https://www.khanacademy.org/test-prep/sat-reading-and-writing", note: "Standard English conventions units" },
    { kind: "youtube", title: "SAT grammar rules crash courses (YouTube)", ref: "https://www.youtube.com/results?search_query=sat+grammar+rules+crash+course" },
  ],
  /* ─── IELTS ─── */
  "ielts-listening": [
    { kind: "practice", title: "IELTS.org - free listening samples", ref: "https://ielts.org/take-a-test/preparation-resources/sample-test-questions/listening", note: "Official sample tasks with answers" },
    { kind: "link", title: "IELTS Liz - listening lessons", ref: "https://ieltsliz.com/ielts-listening/", note: "Tips + common traps" },
  ],
  "ielts-reading": [
    { kind: "practice", title: "IELTS.org - free reading samples", ref: "https://ielts.org/take-a-test/preparation-resources/sample-test-questions/reading" },
    { kind: "link", title: "IELTS Liz - reading strategies", ref: "https://ieltsliz.com/ielts-reading-lessons-information-and-tips/" },
  ],
  "ielts-writing": [
    { kind: "link", title: "IELTS Liz - Writing Task 2 model essays", ref: "https://ieltsliz.com/ielts-writing-task-2/", note: "Band 9 structures by question type" },
    { kind: "practice", title: "IELTS.org - writing samples + band descriptors", ref: "https://ielts.org/take-a-test/preparation-resources/sample-test-questions/writing" },
    { kind: "youtube", title: "Writing Task 2 masterclasses (YouTube)", ref: "https://www.youtube.com/results?search_query=ielts+writing+task+2+band+9" },
  ],
  "ielts-speaking": [
    { kind: "link", title: "IELTS Liz - speaking part 1/2/3 questions", ref: "https://ieltsliz.com/ielts-speaking-free-lessons-essential-tips/" },
    { kind: "youtube", title: "Band 9 speaking mock interviews (YouTube)", ref: "https://www.youtube.com/results?search_query=ielts+speaking+band+9+mock" },
  ],
  "english-vocab": [
    { kind: "practice", title: "Vocabulary.com adaptive trainer", ref: "https://www.vocabulary.com/", note: "Adaptive spaced repetition" },
    { kind: "book", title: "Read theory - graded reading practice", ref: "https://readtheory.org/", note: "Free adaptive reading comprehension" },
  ],
  /* ─── Math / foundations ─── */
  "math-foundation": [
    { kind: "practice", title: "Khan Academy - math (by grade)", ref: "https://www.khanacademy.org/math", note: "Pick your grade level, mastery-based" },
    { kind: "youtube", title: "3Blue1Brown - Essence of linear algebra", ref: "fNk_zzaMoSs", note: "Visual intuition for vectors" },
  ],
  "olympiad-math": [
    { kind: "link", title: "Art of Problem Solving - community + courses", ref: "https://artofproblemsolving.com/", note: "The standard Olympiad training ground" },
    { kind: "pdf", title: "Past national Olympiad problems", ref: "https://artofproblemsolving.com/community/c13_contest_collections", note: "Contest collections archive" },
  ],
  "coding": [
    { kind: "youtube", title: "freeCodeCamp - Learn Python (full course)", ref: "rfscVS0vtbw", note: "4.5h beginner course" },
    { kind: "youtube", title: "freeCodeCamp - JavaScript (full course)", ref: "PkZNo7MFNFg" },
    { kind: "practice", title: "freeCodeCamp - interactive curriculum", ref: "https://www.freecodecamp.org/learn" },
  ],
  "project-building": [
    { kind: "practice", title: "GitHub Skills - build and ship with guided projects", ref: "https://skills.github.com/", note: "Short, practical repositories with feedback" },
    { kind: "link", title: "GitHub Pages - publish a project portfolio", ref: "https://pages.github.com/", note: "Turn finished work into a public artifact" },
    { kind: "practice", title: "freeCodeCamp - project-based curriculum", ref: "https://www.freecodecamp.org/learn", note: "Buildable exercises with clear deliverables" },
  ],
  "reading-habit": [
    { kind: "link", title: "Project Gutenberg - free classic books", ref: "https://www.gutenberg.org/", note: "Readable in-browser" },
    { kind: "link", title: "CommonLit - leveled reading passages", ref: "https://www.commonlit.org/", note: "Free, with comprehension questions" },
  ],
  "essay": [
    { kind: "link", title: "College Essay Guy - personal statement guide", ref: "https://www.collegeessayguy.com/blog/personal-statement-examples", note: "Annotated real essays" },
    { kind: "youtube", title: "Essays that got into Ivies - breakdowns (YouTube)", ref: "https://www.youtube.com/results?search_query=college+essay+breakdown+accepted" },
  ],
  "research": [
    { kind: "link", title: "Google Scholar", ref: "https://scholar.google.com/", note: "Find papers in your interest area" },
    { kind: "link", title: "Polygence research project ideas", ref: "https://www.polygence.org/blog/research-project-ideas-for-high-school-students" },
  ],
  "leadership": [
    { kind: "link", title: "Build a club from scratch - guide", ref: "https://www.collegeessayguy.com/blog/how-to-start-a-club-in-high-school" },
  ],
  "applications": [
    { kind: "link", title: "Common App - first-year application guide", ref: "https://www.commonapp.org/apply/first-year-students" },
    { kind: "link", title: "MIT Admissions blog - what matters", ref: "https://mitadmissions.org/blogs/" },
  ],
  "scholarships": [
    { kind: "link", title: "Scholarships360 - international database", ref: "https://scholarships360.org/scholarships/international-students/" },
  ],
  "board-prep": [
    { kind: "link", title: "Khan Academy - physics / chemistry / biology", ref: "https://www.khanacademy.org/science", note: "Concept gaps before exam revision" },
  ],
  "study-skills": [
    { kind: "youtube", title: "How to study effectively - evidence-based (YouTube)", ref: "https://www.youtube.com/results?search_query=evidence+based+study+techniques" },
    { kind: "link", title: "Pomofocus - free pomodoro timer", ref: "https://pomofocus.io/" },
  ],
  "wellness": [
    { kind: "link", title: "Smiling Mind - free meditation for students", ref: "https://www.smilingmind.com.au/" },
  ],
  "science-fair": [
    { kind: "link", title: "Science Buddies - project ideas by grade", ref: "https://www.sciencebuddies.org/science-fair-projects/project-ideas" },
  ],
  "portfolio": [
    { kind: "link", title: "Build a personal site with GitHub Pages", ref: "https://pages.github.com/" },
  ],
};

/** True when a youtube ref looks like a raw video id (embeddable). */
export function isYouTubeId(ref: string): boolean {
  return /^[A-Za-z0-9_-]{8,16}$/.test(ref);
}

/** Resources for a set of topic tags (deduped, max `cap`). */
export function resourcesForTopics(topics: string[], cap = 5): NodeResource[] {
  const out: NodeResource[] = [];
  const seen = new Set<string>();
  for (const t of topics) {
    for (const r of LIB[t] ?? []) {
      if (seen.has(r.ref)) continue;
      seen.add(r.ref);
      out.push(r);
      if (out.length >= cap) return out;
    }
  }
  return out;
}

const TASK_TOPIC_HINTS: Array<[string, RegExp]> = [
  ["sat-math", /digital sat|sat math|bluebook|sat diagnostic|sat score|sat practice/i],
  ["sat-reading", /sat.*reading|sat.*passage|college board|question bank/i],
  ["sat-writing", /sat.*writing|sat grammar/i],
  ["ielts-listening", /ielts.*listen|ielts listening|ielts.*audio/i],
  ["ielts-reading", /ielts.*read|ielts reading|reading.*band|ielts.*passage/i],
  ["ielts-writing", /ielts.*writ|ielts writing|band 9|ielts.*task 2/i],
  ["ielts-speaking", /ielts.*speak|ielts speaking|speaking band|mock interview/i],
  ["research", /research|paper|publication|lab|literature|scholar/i],
  ["coding", /code|coding|program|software|repository|github|debug/i],
  ["project-building", /project|prototype|ship|build|portfolio/i],
  ["essay", /essay|personal statement|supplement|draft/i],
  ["leadership", /leadership|club|volunteer|service|impact|organize/i],
  ["study-skills", /study|focus|pomodoro|review|schedule|practice/i],
  ["math-foundation", /math|calculus|algebra|geometry|problem/i],
  ["english-vocab", /vocabulary|word|reading|language/i],
  ["board-prep", /\bboard\b|\bhsc\b|a[- ]?level|o[- ]?level|board syllabus|board exam/i],
  ["scholarships", /scholarship|eligibility|financial aid/i],
];

/** Select resources for the actual task text, falling back to node topics. */
export function resourcesForTask(taskText: string, fallbackTopics: string[] = [], cap = 4): NodeResource[] {
  const matched = TASK_TOPIC_HINTS.filter(([, pattern]) => pattern.test(taskText)).map(([topic]) => topic);
  return resourcesForTopics([...new Set([...matched, ...fallbackTopics])], cap);
}

/** All known topic tags (for prompt guidance). */
export const KNOWN_TOPICS = Object.keys(LIB);
