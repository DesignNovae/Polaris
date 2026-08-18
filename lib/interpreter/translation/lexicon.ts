/**
 * Sign lexicon: concept -> phonological parameters.
 *
 * Entries describe signs the way sign linguistics does - handshape, location,
 * movement, handedness, palm orientation - never as animation data. That is the
 * seam that lets an SVG skeleton, a WebGL avatar and a motion-capture clip
 * library all consume the same lexicon.
 *
 * Scope is deliberate and bounded: this covers the study-skills register the
 * Action Lab lessons actually use. Anything outside it fingerspells rather than
 * guessing, because a wrong sign is worse than an honest spelling.
 *
 * Where a sign genuinely differs between ASL, BSL and ISL, the difference lives
 * in `variants`. Signs are not international, and pretending otherwise is the
 * most common error in machine signing.
 */

import type {
  HandShapeId,
  Handedness,
  MovementType,
  NonManualMarker,
  PalmOrientation,
  SignLanguageCode,
  SignLocation,
} from "../types/gestures";

export type SignArticulation = {
  handShape: HandShapeId;
  location: SignLocation;
  movement: MovementType;
  handedness: Handedness;
  palm: PalmOrientation;
  endLocation?: SignLocation;
  endHandShape?: HandShapeId;
  nonManual?: NonManualMarker;
  repeat?: number;
  /**
   * Relative articulation cost. Duration is distributed across a phrase by
   * weight, so a held sign gets more of the clock than a quick contact.
   */
  weight?: number;
};

export type LexiconEntry = SignArticulation & {
  gloss: string;
  variants?: Partial<Record<SignLanguageCode, Partial<SignArticulation>>>;
};

/** Shorthand so the table below stays readable. */
const sign = (
  gloss: string,
  handShape: HandShapeId,
  location: SignLocation,
  movement: MovementType,
  palm: PalmOrientation,
  handedness: Handedness = "dominant",
  extra: Partial<LexiconEntry> = {},
): LexiconEntry => ({ gloss, handShape, location, movement, palm, handedness, weight: 1, ...extra });

/**
 * The table. Keys are lemmas after morphological normalisation, so "questions",
 * "questioned" and "question" all land here.
 */
export const LEXICON: Record<string, LexiconEntry> = {
  /* ── Pronouns and reference ─────────────────────────────────────────── */
  i: sign("ME", "one", "chest", "contact", "in", "dominant", { weight: 0.7 }),
  you: sign("YOU", "one", "neutral", "straight", "out", "dominant", { weight: 0.7 }),
  he: sign("HE", "one", "side-high", "straight", "out", "dominant", { weight: 0.7 }),
  she: sign("SHE", "one", "cheek", "straight", "out", "dominant", { weight: 0.7 }),
  we: sign("WE", "one", "chest", "arc", "in", "dominant", { endLocation: "shoulder" }),
  they: sign("THEY", "one", "side-high", "straight", "out", "dominant", { repeat: 2, weight: 0.8 }),
  it: sign("IT", "one", "neutral", "straight", "out", "dominant", { weight: 0.6 }),
  this: sign("THIS", "one", "neutral", "tap", "down", "dominant", { weight: 0.7 }),
  that: sign("THAT", "y", "weak-hand", "tap", "down", "both-same", { weight: 0.8 }),
  your: sign("YOUR", "flat-b", "neutral", "straight", "out"),
  my: sign("MY", "flat-b", "chest", "contact", "in", "dominant", { weight: 0.7 }),
  their: sign("THEIR", "flat-b", "side-high", "straight", "out"),

  /* ── Study and exam register ────────────────────────────────────────── */
  test: sign("TEST", "one", "neutral", "arc", "out", "both-mirror", { weight: 1.2 }),
  exam: sign("TEST", "one", "neutral", "arc", "out", "both-mirror", { weight: 1.2 }),
  question: sign("QUESTION", "one", "neutral", "arc", "out", "dominant", { weight: 1.1 }),
  answer: sign("ANSWER", "one", "chin", "straight", "out", "both-same", { endLocation: "neutral" }),
  lesson: sign("LESSON", "flat-b", "weak-hand", "arc", "down", "both-same", { weight: 1.1 }),
  study: sign("STUDY", "five", "weak-hand", "wiggle", "down", "dominant", { weight: 1.2 }),
  learn: sign("LEARN", "claw", "weak-hand", "close", "down", "dominant", { endLocation: "forehead", endHandShape: "o", weight: 1.2 }),
  practice: sign("PRACTICE", "s-fist", "weak-hand", "straight", "down", "dominant", { repeat: 2, weight: 1.2 }),
  score: sign("SCORE", "one", "neutral", "straight", "out", "dominant"),
  mark: sign("MARK", "one", "weak-hand", "tap", "down", "dominant", { weight: 0.8 }),
  band: sign("BAND", "flat-b", "neutral", "straight", "down", "dominant"),
  passage: sign("PASSAGE", "flat-b", "weak-hand", "straight", "up", "both-same", { weight: 1.1 }),
  paragraph: sign("PARAGRAPH", "c", "weak-hand", "tap", "left", "dominant", { weight: 1.1 }),
  sentence: sign("SENTENCE", "f", "neutral", "straight", "out", "both-mirror", { weight: 1.1 }),
  word: sign("WORD", "one", "weak-hand", "tap", "left", "dominant", { weight: 0.9 }),
  essay: sign("ESSAY", "flat-b", "weak-hand", "arc", "down", "both-same", { weight: 1.2 }),
  note: sign("NOTE", "one", "weak-hand", "tap", "down", "dominant", { repeat: 2 }),
  book: sign("BOOK", "flat-b", "neutral", "open", "up", "both-mirror", { weight: 1.1 }),
  chart: sign("CHART", "one", "neutral", "straight", "out", "both-mirror", { weight: 1.1 }),
  example: sign("EXAMPLE", "one", "weak-hand", "straight", "out", "dominant", { weight: 1.2 }),
  idea: sign("IDEA", "i", "forehead", "arc", "in", "dominant", { weight: 1.1 }),
  reason: sign("REASON", "r", "forehead", "circular", "in", "dominant", { weight: 1.1 }),
  student: sign("STUDENT", "claw", "weak-hand", "close", "down", "dominant", { endLocation: "forehead", weight: 1.3 }),
  teacher: sign("TEACHER", "o", "temple", "straight", "out", "both-mirror", { weight: 1.3 }),
  examiner: sign("EXAMINER", "o", "temple", "straight", "out", "both-mirror", { weight: 1.3 }),
  speaker: sign("SPEAKER", "flat-b", "chin", "circular", "in", "dominant", { weight: 1.2 }),
  recording: sign("RECORDING", "y", "ear", "circular", "in", "dominant", { weight: 1.2 }),
  accent: sign("ACCENT", "one", "chin", "circular", "in", "dominant", { weight: 1.1 }),
  spelling: sign("SPELL", "five", "neutral", "wiggle", "down", "dominant", { weight: 1.2 }),
  grammar: sign("GRAMMAR", "g", "neutral", "straight", "out", "both-mirror", { weight: 1.2 }),
  vocabulary: sign("VOCABULARY", "v", "weak-hand", "tap", "left", "dominant", { weight: 1.2 }),
  formula: sign("FORMULA", "f", "neutral", "straight", "out", "both-mirror", { weight: 1.1 }),
  equation: sign("EQUATION", "flat-b", "neutral", "straight", "down", "both-same", { weight: 1.2 }),
  volume: sign("VOLUME", "c", "neutral", "arc", "in", "both-mirror", { weight: 1.1 }),
  slope: sign("SLOPE", "flat-b", "side-high", "straight", "down", "dominant", { endLocation: "side-low", weight: 1.1 }),
  line: sign("LINE", "one", "side-high", "straight", "out", "dominant", { endLocation: "side-low" }),
  number: sign("NUMBER", "o", "neutral", "twist", "out", "both-mirror"),
  data: sign("DATA", "d", "neutral", "arc", "out", "dominant"),
  detail: sign("DETAIL", "one", "weak-hand", "tap", "down", "dominant", { repeat: 2 }),
  information: sign("INFORMATION", "o", "forehead", "open", "out", "both-mirror", { endHandShape: "five", weight: 1.2 }),
  knowledge: sign("KNOW", "flat-b", "forehead", "tap", "in", "dominant", { weight: 1.1 }),

  /* ── Verbs ──────────────────────────────────────────────────────────── */
  read: sign("READ", "bent-v", "weak-hand", "straight", "down", "dominant", { weight: 1.2 }),
  write: sign("WRITE", "f", "weak-hand", "straight", "down", "dominant", { weight: 1.2 }),
  listen: sign("LISTEN", "c", "ear", "hold", "left", "dominant", { weight: 1.2 }),
  hear: sign("HEAR", "one", "ear", "tap", "left", "dominant"),
  speak: sign("SPEAK", "flat-b", "chin", "circular", "in", "dominant", { weight: 1.1 }),
  say: sign("SAY", "one", "chin", "circular", "in", "dominant"),
  tell: sign("TELL", "one", "chin", "straight", "out", "dominant"),
  ask: sign("ASK", "one", "neutral", "arc", "in", "dominant"),
  look: sign("LOOK", "bent-v", "nose", "straight", "out", "dominant"),
  watch: sign("WATCH", "bent-v", "nose", "straight", "out", "dominant", { weight: 1.1 }),
  see: sign("SEE", "bent-v", "nose", "straight", "out", "dominant"),
  find: sign("FIND", "f", "neutral", "close", "up", "dominant", { weight: 1.1 }),
  scan: sign("SCAN", "bent-v", "side-high", "straight", "out", "dominant", { endLocation: "side-low", weight: 1.1 }),
  skim: sign("SKIM", "flat-b", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  check: sign("CHECK", "one", "weak-hand", "tap", "down", "dominant", { weight: 1.1 }),
  know: sign("KNOW", "flat-b", "forehead", "tap", "in", "dominant"),
  think: sign("THINK", "one", "forehead", "circular", "in", "dominant", { weight: 1.1 }),
  understand: sign("UNDERSTAND", "s-fist", "forehead", "open", "in", "dominant", { endHandShape: "one", weight: 1.2 }),
  remember: sign("REMEMBER", "a", "forehead", "straight", "in", "dominant", { endLocation: "chest", weight: 1.2 }),
  forget: sign("FORGET", "flat-b", "forehead", "close", "in", "dominant", { endHandShape: "a", weight: 1.1 }),
  need: sign("NEED", "one", "neutral", "straight", "down", "dominant", { repeat: 2 }),
  must: sign("MUST", "one", "neutral", "straight", "down", "dominant", { weight: 1.1 }),
  can: sign("CAN", "s-fist", "neutral", "straight", "down", "both-mirror"),
  use: sign("USE", "u", "neutral", "circular", "out", "dominant"),
  make: sign("MAKE", "s-fist", "neutral", "twist", "in", "both-same", { weight: 1.1 }),
  give: sign("GIVE", "o", "chest", "arc", "up", "dominant", { endLocation: "neutral" }),
  take: sign("TAKE", "five", "neutral", "close", "down", "dominant", { endHandShape: "s-fist" }),
  go: sign("GO", "one", "neutral", "straight", "out", "both-mirror"),
  come: sign("COME", "one", "neutral", "straight", "in", "both-mirror"),
  start: sign("START", "one", "weak-hand", "twist", "out", "dominant", { weight: 1.1 }),
  begin: sign("START", "one", "weak-hand", "twist", "out", "dominant", { weight: 1.1 }),
  finish: sign("FINISH", "five", "neutral", "twist", "up", "both-mirror", { weight: 1.1 }),
  end: sign("FINISH", "five", "neutral", "twist", "up", "both-mirror", { weight: 1.1 }),
  continue: sign("CONTINUE", "a", "neutral", "straight", "down", "both-same", { weight: 1.1 }),
  move: sign("MOVE", "claw", "neutral", "arc", "down", "both-same"),
  change: sign("CHANGE", "s-fist", "neutral", "twist", "in", "both-mirror", { weight: 1.1 }),
  correct: sign("CORRECT", "one", "neutral", "contact", "left", "both-mirror", { weight: 1.1 }),
  explain: sign("EXPLAIN", "f", "neutral", "alternating", "in", "both-mirror", { weight: 1.3 }),
  describe: sign("DESCRIBE", "f", "neutral", "alternating", "in", "both-mirror", { weight: 1.3 }),
  compare: sign("COMPARE", "flat-b", "neutral", "twist", "up", "both-mirror", { weight: 1.3 }),
  choose: sign("CHOOSE", "f", "neutral", "straight", "out", "dominant", { endLocation: "chest", weight: 1.1 }),
  select: sign("CHOOSE", "f", "neutral", "straight", "out", "dominant", { endLocation: "chest", weight: 1.1 }),
  plan: sign("PLAN", "flat-b", "side-high", "straight", "left", "both-mirror", { endLocation: "side-low", weight: 1.2 }),
  support: sign("SUPPORT", "s-fist", "weak-hand", "straight", "up", "dominant", { weight: 1.1 }),
  connect: sign("CONNECT", "f", "neutral", "close", "in", "both-mirror", { weight: 1.1 }),
  link: sign("CONNECT", "f", "neutral", "close", "in", "both-mirror", { weight: 1.1 }),
  follow: sign("FOLLOW", "a", "neutral", "straight", "out", "both-same", { weight: 1.1 }),
  show: sign("SHOW", "one", "weak-hand", "straight", "out", "dominant", { weight: 1.1 }),
  mean: sign("MEAN", "bent-v", "weak-hand", "twist", "down", "dominant", { weight: 1.1 }),
  matter: sign("IMPORTANT", "f", "neutral", "arc", "up", "both-mirror", { weight: 1.2 }),
  save: sign("SAVE", "v", "neutral", "contact", "in", "both-same", { weight: 1.1 }),
  build: sign("BUILD", "flat-b", "neutral", "alternating", "down", "both-alternating", { weight: 1.2 }),
  cover: sign("COVER", "flat-b", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  leave: sign("LEAVE", "five", "side-high", "close", "down", "both-same", { endHandShape: "o", weight: 1.1 }),
  wait: sign("WAIT", "five", "neutral", "wiggle", "up", "both-same", { weight: 1.1 }),
  earn: sign("EARN", "five", "weak-hand", "close", "up", "dominant", { endHandShape: "s-fist", weight: 1.1 }),
  guess: sign("GUESS", "c", "forehead", "close", "left", "dominant", { endHandShape: "s-fist", weight: 1.1 }),
  copy: sign("COPY", "five", "weak-hand", "close", "down", "dominant", { endHandShape: "o", weight: 1.1 }),
  underline: sign("UNDERLINE", "one", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  cross: sign("CROSS-OUT", "one", "neutral", "straight", "out", "both-mirror", { weight: 1.1 }),
  add: sign("ADD", "o", "neutral", "close", "up", "both-mirror", { weight: 1.1 }),
  spend: sign("SPEND", "five", "neutral", "open", "up", "dominant", { endHandShape: "five", weight: 1.1 }),
  extend: sign("EXPAND", "o", "neutral", "open", "out", "both-mirror", { endHandShape: "five", weight: 1.2 }),
  record: sign("RECORD", "y", "neutral", "circular", "down", "dominant", { weight: 1.2 }),
  lose: sign("LOSE", "o", "neutral", "open", "down", "both-same", { endHandShape: "five", weight: 1.1 }),
  graph: sign("GRAPH", "one", "neutral", "straight", "out", "both-mirror", { weight: 1.1 }),
  calculate: sign("CALCULATE", "v", "weak-hand", "alternating", "up", "both-alternating", { weight: 1.3 }),
  convert: sign("CONVERT", "s-fist", "neutral", "twist", "in", "both-mirror", { weight: 1.2 }),
  memorise: sign("MEMORIZE", "a", "forehead", "close", "in", "dominant", { endHandShape: "s-fist", weight: 1.2 }),
  memorize: sign("MEMORIZE", "a", "forehead", "close", "in", "dominant", { endHandShape: "s-fist", weight: 1.2 }),
  name: sign("NAME", "u", "weak-hand", "tap", "down", "both-same", { weight: 1.1 }),
  report: sign("REPORT", "flat-b", "neutral", "straight", "out", "both-mirror", { weight: 1.2 }),
  state: sign("STATE", "one", "chin", "straight", "out", "dominant", { weight: 1.1 }),
  restate: sign("REPEAT", "bent-v", "weak-hand", "arc", "down", "dominant", { repeat: 2, weight: 1.2 }),
  repeat: sign("REPEAT", "bent-v", "weak-hand", "arc", "down", "dominant", { repeat: 2, weight: 1.2 }),
  appear: sign("APPEAR", "one", "weak-hand", "straight", "up", "dominant", { weight: 1.1 }),
  grow: sign("GROW", "o", "weak-hand", "open", "up", "dominant", { endHandShape: "five", weight: 1.2 }),
  double: sign("DOUBLE", "l", "neutral", "arc", "up", "dominant", { weight: 1.1 }),
  substitute: sign("SUBSTITUTE", "f", "neutral", "twist", "in", "both-alternating", { weight: 1.3 }),
  discuss: sign("DISCUSS", "one", "weak-hand", "tap", "down", "dominant", { repeat: 2, weight: 1.2 }),
  contradict: sign("CONTRADICT", "one", "neutral", "contact", "in", "both-mirror", { weight: 1.2 }),
  paraphrase: sign("REPHRASE", "f", "neutral", "twist", "out", "both-mirror", { weight: 1.3 }),

  /* ── Descriptors ────────────────────────────────────────────────────── */
  good: sign("GOOD", "flat-b", "chin", "straight", "up", "dominant", { endLocation: "neutral" }),
  bad: sign("BAD", "flat-b", "chin", "straight", "down", "dominant", { nonManual: { brows: "furrowed" } }),
  right: sign("CORRECT", "one", "neutral", "contact", "left", "both-mirror"),
  wrong: sign("WRONG", "y", "chin", "contact", "in", "dominant", { nonManual: { brows: "furrowed" } }),
  important: sign("IMPORTANT", "f", "neutral", "arc", "up", "both-mirror", { weight: 1.2 }),
  hard: sign("HARD", "bent-v", "neutral", "contact", "down", "both-mirror", { weight: 1.1, nonManual: { mouth: "cs" } }),
  difficult: sign("HARD", "bent-v", "neutral", "contact", "down", "both-mirror", { weight: 1.1, nonManual: { mouth: "cs" } }),
  easy: sign("EASY", "flat-b", "weak-hand", "arc", "up", "both-same", { weight: 1.1 }),
  fast: sign("FAST", "l", "neutral", "twist", "out", "dominant", { nonManual: { mouth: "cs" } }),
  quick: sign("FAST", "l", "neutral", "twist", "out", "dominant", { nonManual: { mouth: "cs" } }),
  slow: sign("SLOW", "flat-b", "weak-hand", "straight", "down", "dominant", { weight: 1.2 }),
  long: sign("LONG", "one", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  short: sign("SHORT", "u", "weak-hand", "straight", "down", "dominant"),
  new: sign("NEW", "flat-b", "weak-hand", "arc", "up", "both-same"),
  same: sign("SAME", "one", "neutral", "straight", "down", "both-mirror"),
  different: sign("DIFFERENT", "one", "neutral", "open", "down", "both-mirror", { weight: 1.1 }),
  main: sign("MAIN", "a", "weak-hand", "contact", "down", "dominant", { weight: 1.1 }),
  specific: sign("SPECIFIC", "one", "neutral", "contact", "out", "both-mirror", { weight: 1.2 }),
  general: sign("GENERAL", "five", "neutral", "open", "out", "both-mirror", { weight: 1.2 }),
  academic: sign("ACADEMIC", "a", "weak-hand", "arc", "down", "dominant", { weight: 1.2 }),
  natural: sign("NATURAL", "n", "weak-hand", "circular", "down", "dominant", { weight: 1.2 }),
  normal: sign("NORMAL", "n", "weak-hand", "circular", "down", "dominant", { weight: 1.2 }),
  clear: sign("CLEAR", "o", "neutral", "open", "up", "both-mirror", { endHandShape: "five", weight: 1.1 }),
  strong: sign("STRONG", "s-fist", "neutral", "straight", "in", "both-mirror", { weight: 1.1 }),
  weak: sign("WEAK", "claw", "weak-hand", "close", "down", "dominant", { weight: 1.1 }),
  empty: sign("EMPTY", "one", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  complex: sign("COMPLEX", "one", "neutral", "alternating", "in", "both-alternating", { weight: 1.3 }),
  simple: sign("SIMPLE", "flat-b", "weak-hand", "arc", "up", "both-same", { weight: 1.1 }),
  concrete: sign("CONCRETE", "s-fist", "weak-hand", "contact", "down", "dominant", { weight: 1.2 }),
  key: sign("KEY", "one", "weak-hand", "twist", "down", "dominant", { weight: 1.1 }),
  positive: sign("POSITIVE", "one", "neutral", "contact", "up", "both-mirror", { weight: 1.1 }),
  negative: sign("NEGATIVE", "one", "neutral", "contact", "down", "both-mirror", { weight: 1.1 }),
  parallel: sign("PARALLEL", "one", "neutral", "straight", "down", "both-same", { weight: 1.2 }),
  true: sign("TRUE", "one", "chin", "straight", "left", "dominant", { weight: 1.1 }),
  false: sign("FALSE", "one", "nose", "straight", "left", "dominant", { weight: 1.1, nonManual: { brows: "furrowed" } }),

  /* ── Time ───────────────────────────────────────────────────────────── */
  time: sign("TIME", "one", "weak-hand", "tap", "down", "dominant"),
  minute: sign("MINUTE", "one", "weak-hand", "circular", "left", "dominant"),
  hour: sign("HOUR", "one", "weak-hand", "circular", "left", "dominant", { weight: 1.1 }),
  second: sign("SECOND", "one", "weak-hand", "tap", "left", "dominant", { weight: 0.8 }),
  day: sign("DAY", "one", "weak-hand", "arc", "out", "dominant", { weight: 1.1 }),
  today: sign("TODAY", "y", "neutral", "straight", "down", "both-mirror", { weight: 1.1 }),
  now: sign("NOW", "y", "neutral", "straight", "up", "both-mirror"),
  before: sign("BEFORE", "flat-b", "neutral", "arc", "in", "dominant", { weight: 1.1 }),
  after: sign("AFTER", "flat-b", "weak-hand", "arc", "out", "dominant", { weight: 1.1 }),
  first: sign("FIRST", "one", "weak-hand", "contact", "up", "dominant"),
  next: sign("NEXT", "flat-b", "weak-hand", "arc", "out", "dominant"),
  then: sign("THEN", "l", "neutral", "arc", "out", "dominant"),
  always: sign("ALWAYS", "one", "neutral", "circular", "up", "dominant", { weight: 1.2 }),
  never: sign("NEVER", "flat-b", "neutral", "arc", "out", "dominant", { weight: 1.2, nonManual: { head: "shake", brows: "furrowed" } }),
  often: sign("OFTEN", "bent-v", "weak-hand", "arc", "down", "dominant", { repeat: 2, weight: 1.2 }),
  sometimes: sign("SOMETIMES", "one", "weak-hand", "arc", "up", "dominant", { repeat: 2, weight: 1.2 }),
  every: sign("EVERY", "a", "weak-hand", "straight", "down", "dominant", { repeat: 2, weight: 1.1 }),
  daily: sign("EVERY-DAY", "a", "cheek", "straight", "out", "dominant", { repeat: 2, weight: 1.2 }),

  /* ── Function words that survive translation ────────────────────────── */
  not: sign("NOT", "a", "chin", "straight", "out", "dominant", { nonManual: { head: "shake", brows: "furrowed" } }),
  cannot: sign("CANNOT", "one", "neutral", "contact", "down", "both-mirror", { weight: 1.1, nonManual: { head: "shake", brows: "furrowed" } }),
  none: sign("NONE", "o", "neutral", "straight", "out", "both-mirror", { nonManual: { head: "shake" } }),
  half: sign("HALF", "one", "weak-hand", "straight", "down", "dominant", { weight: 1.1 }),
  twice: sign("TWICE", "v", "weak-hand", "arc", "up", "dominant", { weight: 1.1 }),
  blank: sign("BLANK", "flat-b", "weak-hand", "straight", "left", "dominant", { weight: 1.1 }),
  part: sign("PART", "flat-b", "weak-hand", "arc", "down", "dominant"),
  section: sign("SECTION", "flat-b", "weak-hand", "straight", "down", "both-same", { weight: 1.1 }),
  order: sign("ORDER", "one", "neutral", "straight", "down", "dominant", { repeat: 2, weight: 1.1 }),
  limit: sign("LIMIT", "bent-v", "neutral", "straight", "down", "both-same", { weight: 1.1 }),
  mistake: sign("MISTAKE", "y", "chin", "contact", "in", "dominant", { weight: 1.1 }),
  goal: sign("GOAL", "one", "forehead", "straight", "out", "dominant", { weight: 1.1 }),
  choice: sign("CHOOSE", "f", "neutral", "straight", "out", "dominant", { endLocation: "chest", weight: 1.1 }),
  trend: sign("TREND", "flat-b", "side-low", "arc", "up", "dominant", { endLocation: "side-high", weight: 1.2 }),
  rate: sign("RATE", "r", "neutral", "circular", "out", "dominant", { weight: 1.1 }),
  value: sign("VALUE", "f", "neutral", "arc", "up", "both-mirror", { weight: 1.1 }),
  unit: sign("UNIT", "u", "neutral", "straight", "out", "dominant"),
  problem: sign("PROBLEM", "bent-v", "neutral", "twist", "in", "both-mirror", { weight: 1.2 }),
  minutes: sign("MINUTE", "one", "weak-hand", "circular", "left", "dominant", { repeat: 2 }),
  no: sign("NO", "o", "neutral", "close", "out", "dominant", { nonManual: { head: "shake" } }),
  yes: sign("YES", "s-fist", "neutral", "tap", "out", "dominant", { nonManual: { head: "nod" } }),
  and: sign("AND", "five", "neutral", "close", "out", "dominant", { endHandShape: "o", weight: 0.8 }),
  but: sign("BUT", "one", "neutral", "open", "out", "both-mirror", { weight: 0.9 }),
  because: sign("BECAUSE", "flat-b", "forehead", "close", "in", "dominant", { endHandShape: "a", weight: 1.1 }),
  if: sign("IF", "f", "neutral", "alternating", "in", "both-alternating", { weight: 1.1, nonManual: { brows: "raised" } }),
  or: sign("OR", "one", "neutral", "alternating", "out", "dominant", { weight: 0.9 }),
  with: sign("WITH", "a", "neutral", "contact", "in", "both-mirror", { weight: 0.8 }),
  more: sign("MORE", "o", "neutral", "contact", "up", "both-mirror"),
  less: sign("LESS", "flat-b", "neutral", "straight", "down", "both-mirror"),
  most: sign("MOST", "a", "neutral", "arc", "up", "both-mirror", { weight: 1.1 }),
  all: sign("ALL", "flat-b", "neutral", "circular", "out", "both-same", { weight: 1.1 }),
  many: sign("MANY", "s-fist", "neutral", "open", "up", "both-mirror", { endHandShape: "five", weight: 1.1 }),
  only: sign("ONLY", "one", "neutral", "twist", "out", "dominant"),
  own: sign("OWN", "flat-b", "chest", "contact", "in", "dominant", { weight: 0.8 }),
  than: sign("THAN", "flat-b", "weak-hand", "arc", "down", "dominant", { weight: 0.9 }),
  worth: sign("WORTH", "f", "neutral", "arc", "up", "both-mirror", { weight: 1.1 }),

  /* ── High-frequency words the corpus kept spelling ──────────────────── */
  have: sign("HAVE", "bent-v", "chest", "contact", "in", "both-mirror", { weight: 0.9 }),
  each: sign("EACH", "a", "weak-hand", "straight", "down", "dominant", { weight: 0.9 }),
  both: sign("BOTH", "v", "neutral", "close", "up", "dominant", { weight: 0.9 }),
  some: sign("SOME", "flat-b", "weak-hand", "straight", "up", "dominant", { weight: 0.9 }),
  other: sign("OTHER", "a", "neutral", "twist", "down", "dominant", { weight: 0.9 }),
  week: sign("WEEK", "one", "weak-hand", "straight", "up", "dominant", { weight: 1 }),
  month: sign("MONTH", "one", "weak-hand", "straight", "down", "dominant", { weight: 1 }),
  year: sign("YEAR", "s-fist", "neutral", "circular", "down", "both-mirror", { weight: 1 }),
  people: sign("PEOPLE", "one", "neutral", "circular", "down", "both-alternating", { weight: 1.1 }),
  thing: sign("THING", "flat-b", "neutral", "arc", "up", "dominant", { weight: 0.9 }),
  way: sign("WAY", "flat-b", "neutral", "straight", "in", "both-same", { weight: 1 }),
  help: sign("HELP", "a", "weak-hand", "straight", "up", "dominant", { weight: 1 }),
  want: sign("WANT", "claw", "chest", "straight", "up", "both-mirror", { weight: 1 }),
  work: sign("WORK", "s-fist", "weak-hand", "tap", "down", "dominant", { repeat: 2, weight: 1.1 }),
  again: sign("AGAIN", "bent-v", "weak-hand", "arc", "up", "dominant", { weight: 1 }),
  enough: sign("ENOUGH", "flat-b", "weak-hand", "straight", "down", "dominant", { weight: 1 }),
  ready: sign("READY", "r", "neutral", "straight", "out", "both-mirror", { weight: 1 }),
  able: sign("CAN", "s-fist", "neutral", "straight", "down", "both-mirror", { weight: 0.9 }),
  side: sign("SIDE", "flat-b", "neutral", "straight", "down", "dominant", { weight: 0.9 }),
  place: sign("PLACE", "f", "neutral", "circular", "in", "both-mirror", { weight: 1 }),

  /* ── Numbers ─────────────────────────────────────────────────────────
     Cardinals have dedicated handshapes in all three languages. Fingerspelling
     them is wrong, not merely slow. */
  one_num: sign("ONE", "one", "neutral", "hold", "out", "dominant", { weight: 0.7 }),
  two: sign("TWO", "v", "neutral", "hold", "out", "dominant", { weight: 0.7 }),
  three: sign("THREE", "w", "neutral", "hold", "out", "dominant", { weight: 0.7 }),
  four: sign("FOUR", "four", "neutral", "hold", "out", "dominant", { weight: 0.7 }),
  five_num: sign("FIVE", "five", "neutral", "hold", "out", "dominant", { weight: 0.7 }),
  six: sign("SIX", "w", "neutral", "contact", "out", "dominant", { weight: 0.8 }),
  seven: sign("SEVEN", "w", "neutral", "contact", "out", "dominant", { weight: 0.8 }),
  eight: sign("EIGHT", "open-8", "neutral", "contact", "out", "dominant", { weight: 0.8 }),
  nine: sign("NINE", "f", "neutral", "contact", "out", "dominant", { weight: 0.8 }),
  ten: sign("TEN", "a", "neutral", "twist", "up", "dominant", { weight: 0.8 }),
  twenty: sign("TWENTY", "g", "neutral", "tap", "out", "dominant", { weight: 0.9 }),
  thirty: sign("THIRTY", "w", "neutral", "close", "out", "dominant", { endHandShape: "o", weight: 0.9 }),
  forty: sign("FORTY", "four", "neutral", "close", "out", "dominant", { endHandShape: "o", weight: 0.9 }),
  fifty: sign("FIFTY", "five", "neutral", "close", "out", "dominant", { endHandShape: "o", weight: 0.9 }),
  sixty: sign("SIXTY", "w", "neutral", "arc", "out", "dominant", { weight: 0.9 }),
  hundred: sign("HUNDRED", "c", "neutral", "straight", "out", "dominant", { weight: 1 }),
  thousand: sign("THOUSAND", "flat-b", "weak-hand", "contact", "down", "dominant", { weight: 1 }),
  first_num: sign("FIRST", "one", "weak-hand", "contact", "up", "dominant", { weight: 0.8 }),

  /* ── Question words. Non-manual markers are grammar, not decoration. ── */
  what: sign("WHAT", "five", "neutral", "straight", "up", "both-mirror", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  where: sign("WHERE", "one", "neutral", "alternating", "out", "dominant", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  when: sign("WHEN", "one", "weak-hand", "circular", "out", "dominant", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  why: sign("WHY", "y", "forehead", "straight", "in", "dominant", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  who: sign("WHO", "l", "chin", "circular", "in", "dominant", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  how: sign("HOW", "bent-v", "neutral", "twist", "down", "both-same", { nonManual: { brows: "furrowed", head: "tilt-left" }, weight: 1.1 }),
  which: sign("WHICH", "a", "neutral", "alternating", "in", "both-alternating", { nonManual: { brows: "furrowed" }, weight: 1.1 }),
};

/**
 * BSL and ISL differences that matter for this register.
 *
 * BSL uses a two-handed manual alphabet and a distinct number system; ISL follows
 * subject-object-verb order and shares much of its lexicon with regional gesture.
 * These are the entries where signing the ASL form would simply be wrong.
 */
const LANGUAGE_VARIANTS: Partial<Record<SignLanguageCode, Record<string, Partial<SignArticulation>>>> = {
  bfi: {
    good: { handShape: "a", location: "neutral", movement: "straight", palm: "up" },
    what: { handShape: "one", location: "neutral", movement: "wiggle", handedness: "dominant" },
    why: { handShape: "one", location: "temple", movement: "tap", palm: "in" },
    name: { handShape: "u", location: "forehead", movement: "arc", palm: "down" },
    student: { handShape: "flat-b", location: "weak-hand", movement: "arc", palm: "up" },
    test: { handShape: "bent-v", location: "neutral", movement: "alternating", handedness: "both-alternating" },
    understand: { handShape: "one", location: "forehead", movement: "tap", palm: "in" },
  },
  ins: {
    i: { handShape: "one", location: "chest", movement: "tap", palm: "in" },
    good: { handShape: "a", location: "neutral", movement: "straight", palm: "up" },
    teacher: { handShape: "flat-b", location: "chest", movement: "arc", handedness: "both-mirror" },
    student: { handShape: "flat-b", location: "weak-hand", movement: "straight", palm: "up" },
    book: { handShape: "flat-b", location: "neutral", movement: "open", palm: "up", handedness: "both-mirror" },
    what: { handShape: "five", location: "neutral", movement: "twist", handedness: "both-mirror" },
  },
};

/** Resolves a lemma to its articulation in the requested language, or null. */
export function lookupSign(lemma: string, language: SignLanguageCode): LexiconEntry | null {
  const base = LEXICON[NUMBER_ALIASES[lemma] ?? lemma];
  if (!base) return null;
  const override = LANGUAGE_VARIANTS[language]?.[lemma] ?? base.variants?.[language];
  return override ? { ...base, ...override } : base;
}

/** Words that carry no independent sign and are dropped during translation. */
export const FUNCTION_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being", "am",
  "of", "to", "in", "on", "at", "for", "from", "by", "as", "into", "onto",
  "do", "does", "did", "will", "would", "shall", "should", "may", "might",
  "there", "here", "s", "t", "just", "very", "really", "quite", "about",
]);

/**
 * Lemmas that end in "s" without being plurals, plus the number words whose keys
 * are disambiguated above. Consulted before any stemming runs.
 */
const NON_PLURAL_S = new Set([
  "this", "his", "its", "thus", "yes", "plus", "gas", "bus", "lens", "news",
  "series", "always", "perhaps", "versus", "analysis", "basis", "focus",
  "campus", "status", "bonus", "minus", "class", "process", "across", "unless",
]);

/** Number words share the LEXICON key space, so they resolve through here too. */
const NUMBER_ALIASES: Record<string, string> = {
  one: "one_num", five: "five_num", first: "first_num",
};

/**
 * True when the word is already a lemma the pipeline understands.
 *
 * Used as the guard before morphological stemming: the stemmer cannot tell a
 * genuine plural from a word that merely ends in s, so anything already known is
 * left exactly as it is.
 */
export function isKnownLexeme(word: string): boolean {
  return (
    NON_PLURAL_S.has(word) ||
    FUNCTION_WORDS.has(word) ||
    Object.prototype.hasOwnProperty.call(LEXICON, word) ||
    Object.prototype.hasOwnProperty.call(NUMBER_ALIASES, word)
  );
}

export const LEXICON_SIZE = Object.keys(LEXICON).length;

/**
 * Every gloss the renderer can actually articulate.
 *
 * Handed to the model so it prefers words that have signs. Without it, a model
 * glosses whatever reads best in English and half the output arrives as terms the
 * lexicon has to fingerspell letter by letter - correct, but slow to read and
 * exhausting over a full lesson.
 */
export const SIGNABLE_GLOSSES: readonly string[] = [
  ...new Set(Object.values(LEXICON).map((entry) => entry.gloss)),
].sort();
