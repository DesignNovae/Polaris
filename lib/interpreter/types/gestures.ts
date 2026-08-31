/**
 * Gesture stage of the interpreter pipeline.
 *
 * A Gesture is a *description of a sign*, never a description of pixels. It names
 * handshape, location, movement and non-manual marker the way sign linguistics
 * does, so the same sequence can be rendered by an SVG skeleton, a WebGL avatar,
 * a motion-capture clip library, or a recorded human interpreter, with no change
 * to translation or synchronisation.
 */

/** Sign languages the pipeline can address. Extend here, not in the UI. */
export type SignLanguageCode = "ase" | "bfi" | "ins";

/** Human-facing metadata for a sign language. */
export type SignLanguageDescriptor = {
  code: SignLanguageCode;
  /** English name, e.g. "American Sign Language". */
  name: string;
  /** Short label for compact controls, e.g. "ASL". */
  abbreviation: string;
  /** Region the language is primarily used in, shown as a control hint. */
  region: string;
  /** One-handed vs two-handed manual alphabet. Changes how fingerspelling renders. */
  fingerspelling: "one-handed" | "two-handed";
};

/**
 * Phonological parameters of a sign. These four (plus non-manual markers) are the
 * standard decomposition used across sign linguistics.
 */
export type HandShapeId =
  // Core contrastive shapes.
  | "flat-b" | "five" | "one" | "s-fist" | "c" | "o" | "claw"
  | "bent-v" | "y" | "ily" | "open-8" | "horns"
  // Manual-alphabet shapes, used by initialised signs and by fingerspelling.
  | "a" | "d" | "f" | "four" | "g" | "i" | "l" | "n" | "r" | "u" | "v" | "w";

/** Where in signing space the sign is articulated. */
export type SignLocation =
  | "neutral" | "chest" | "chin" | "mouth" | "nose" | "forehead" | "temple"
  | "cheek" | "shoulder" | "ear" | "weak-hand" | "side-high" | "side-low" | "waist";

/** Path the hand travels while articulating. */
export type MovementType =
  | "hold" | "straight" | "arc" | "circular" | "tap" | "wiggle"
  | "alternating" | "twist" | "open" | "close" | "contact";

/** Which hands articulate the sign. */
export type Handedness = "dominant" | "non-dominant" | "both-same" | "both-mirror" | "both-alternating";

/** Palm facing. Contrastive in every sign language, so it is a first-class field. */
export type PalmOrientation = "in" | "out" | "up" | "down" | "left" | "right";

/**
 * Non-manual markers: grammar carried on the face and body, not the hands.
 * Dropping these is the single most common way machine signing becomes unreadable,
 * so they travel with every gesture rather than being a rendering afterthought.
 */
export type NonManualMarker = {
  /** Raised for yes/no questions, furrowed for wh-questions, neutral otherwise. */
  brows?: "raised" | "furrowed" | "neutral";
  /** Head movement carrying negation, affirmation, or topic marking. */
  head?: "neutral" | "shake" | "nod" | "tilt-left" | "tilt-right" | "forward";
  /** Mouth morphemes ("cs", "mm", "th") and mouthing of the source word. */
  mouth?: "neutral" | "open" | "pursed" | "cs" | "mm" | "th" | "puffed";
  /** Eye behaviour: gaze shift marks role shift and referent indexing. */
  eyes?: "neutral" | "wide" | "squint" | "gaze-left" | "gaze-right";
  /** Torso lean marks contrast and comparison. */
  torso?: "neutral" | "lean-forward" | "lean-back" | "shift-left" | "shift-right";
};

/**
 * One articulated sign, timed relative to the media clock.
 *
 * startTime/endTime are absolute media seconds, not offsets inside the sequence.
 * That is deliberate: the renderer only ever needs the media clock, so it never
 * has to know which segment a gesture belongs to.
 */
export type Gesture = {
  id: string;
  /**
   * Gloss label in the conventional small-caps notation, e.g. "BOOK", "fs-IELTS".
   * This is the readable text alternative shown in the gloss track.
   */
  name: string;
  /** Absolute media time in seconds when articulation begins. */
  startTime: number;
  /** Absolute media time in seconds when articulation ends. */
  endTime: number;
  metadata: GestureMetadata;
};

export type GestureMetadata = {
  handShape: HandShapeId;
  /** Handshape the sign transitions *into*, for signs with a shape change (e.g. "understand"). */
  endHandShape?: HandShapeId;
  location: SignLocation;
  /** Destination location for directional/path signs. */
  endLocation?: SignLocation;
  movement: MovementType;
  handedness: Handedness;
  palm: PalmOrientation;
  nonManual?: NonManualMarker;
  /** True when this gesture is one letter of a fingerspelled word. */
  fingerspelled?: boolean;
  /** Source word(s) this gesture realises, for the gloss track and for debugging. */
  sourceText?: string;
  /** Repetitions of the movement. Plurals and intensifiers reduplicate. */
  repeat?: number;
  /** 0-1. Below 1 marks a sign the lexicon had to approximate. Surfaced, never hidden. */
  confidence?: number;
};

/**
 * The translated output for one transcript segment: a whole phrase rendered as a
 * sign sequence. Segment-level, never word-level - see translation/grammar.ts.
 */
export type SignSequence = {
  /** Id of the TranscriptSegment this realises. */
  segmentId: string;
  language: SignLanguageCode;
  gestures: Gesture[];
  /** Total articulation time in seconds. */
  duration: number;
  /** Absolute media time the sequence starts at. */
  startTime: number;
  /** Space-separated gloss of the whole sequence, e.g. "TOMORROW ME GO SCHOOL". */
  gloss: string;
  /** Id of the translation provider that produced this. */
  providerId: string;
  certification: CertificationRecord;
};

/**
 * Provenance and review status of a sign track.
 *
 * Interpreter certification is a human credential (RID/NAD, NRCPD, and national
 * equivalents); software cannot confer it. What software *can* do is carry the
 * record honestly and refuse to overstate it, so the panel always tells a Deaf
 * user which tier they are actually watching.
 */
export type CertificationTier =
  /** Recorded or authored by a credentialed interpreter. Meets WCAG 1.2.6. */
  | "certified-human"
  /** Machine-produced, then reviewed and signed off by a credentialed interpreter. */
  | "interpreter-reviewed"
  /** Machine-produced from a curated lexicon. Not certified. */
  | "machine-synthetic";

export type CertificationRecord = {
  tier: CertificationTier;
  /** Credential body, e.g. "RID", "NRCPD", "ISLIA". Present for the two reviewed tiers. */
  credentialBody?: string;
  /** Credential holder or studio credited for the track. */
  attributedTo?: string;
  /** ISO date the review was signed off. */
  reviewedAt?: string;
  /** True only for "certified-human". Drives the WCAG 1.2.6 conformance claim. */
  meetsWcag126: boolean;
};

/** Non-certified default, used by every synthetic provider. */
export const MACHINE_SYNTHETIC: CertificationRecord = {
  tier: "machine-synthetic",
  meetsWcag126: false,
};

export const SIGN_LANGUAGES: readonly SignLanguageDescriptor[] = [
  { code: "ase", name: "American Sign Language", abbreviation: "ASL", region: "United States, Canada", fingerspelling: "one-handed" },
  { code: "bfi", name: "British Sign Language", abbreviation: "BSL", region: "United Kingdom", fingerspelling: "two-handed" },
  { code: "ins", name: "Indian Sign Language", abbreviation: "ISL", region: "India", fingerspelling: "two-handed" },
] as const;

export function describeSignLanguage(code: SignLanguageCode): SignLanguageDescriptor {
  const found = SIGN_LANGUAGES.find((language) => language.code === code);
  if (!found) throw new Error(`Unknown sign language: ${code}`);
  return found;
}
