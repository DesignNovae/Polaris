/**
 * Interpreter track resolution: what the panel is actually going to show.
 *
 * There are two fundamentally different kinds of interpreter track, and conflating
 * them is what makes accessibility features dishonest.
 *
 *   recorded  - a real interpreter, filmed. This is what WCAG 1.2.6 asks for and
 *               the only thing that can carry a credential.
 *   synthetic - generated from the transcript by the translation pipeline. Useful,
 *               improvable, and never a substitute for the above.
 *
 * The resolver always prefers a recorded track when one exists for the requested
 * language, and the panel always states which kind it ended up with. A synthetic
 * track is a fallback that says so, not a stand-in that hopes nobody checks.
 */

import type { CertificationRecord, SignLanguageCode } from "../types/gestures";

export type RecordedInterpreterTrack = {
  kind: "recorded";
  mediaId: string;
  language: SignLanguageCode;
  /** Clip URL. Any source a <video> element accepts. */
  src: string;
  /**
   * Seconds to add to media time to reach the equivalent point in the clip.
   * Non-zero when the interpreter recording includes a slate or lead-in.
   */
  offset: number;
  poster?: string;
  certification: CertificationRecord;
};

export type SyntheticInterpreterTrack = {
  kind: "synthetic";
  mediaId: string;
  language: SignLanguageCode;
  certification: CertificationRecord;
};

export type InterpreterTrack = RecordedInterpreterTrack | SyntheticInterpreterTrack;

const recorded = new Map<string, RecordedInterpreterTrack>();

const key = (mediaId: string, language: SignLanguageCode) => `${mediaId}::${language}`;

/**
 * Registers a filmed interpreter track.
 *
 * Refuses to register a track claiming WCAG 1.2.6 conformance without a
 * credential body and an attribution. The claim is the whole value of the record;
 * an unverifiable one is worse than none, because it launders a machine track
 * into a certified-looking badge.
 */
export function registerRecordedTrack(track: RecordedInterpreterTrack): void {
  if (track.certification.meetsWcag126) {
    if (!track.certification.credentialBody || !track.certification.attributedTo) {
      throw new Error(
        `Recorded track for ${track.mediaId} claims WCAG 1.2.6 conformance without a credentialBody and attributedTo. Refusing to register an unverifiable certification claim.`,
      );
    }
  }
  recorded.set(key(track.mediaId, track.language), track);
}

export function unregisterRecordedTrack(mediaId: string, language: SignLanguageCode): void {
  recorded.delete(key(mediaId, language));
}

export function findRecordedTrack(mediaId: string, language: SignLanguageCode): RecordedInterpreterTrack | null {
  return recorded.get(key(mediaId, language)) ?? null;
}

/** Languages with a filmed track for this media. Drives the badge on the language control. */
export function recordedLanguagesFor(mediaId: string): SignLanguageCode[] {
  const result: SignLanguageCode[] = [];
  for (const track of recorded.values()) {
    if (track.mediaId === mediaId) result.push(track.language);
  }
  return result;
}

/** Picks the highest-fidelity track available for this media and language. */
export function resolveInterpreterTrack(
  mediaId: string,
  language: SignLanguageCode,
  syntheticCertification: CertificationRecord,
): InterpreterTrack {
  const filmed = findRecordedTrack(mediaId, language);
  if (filmed) return filmed;
  return { kind: "synthetic", mediaId, language, certification: syntheticCertification };
}

/** Plain-language description of what the viewer is watching. Never overstates. */
export function describeCertification(certification: CertificationRecord): {
  label: string;
  detail: string;
  tone: "aurora" | "nova" | "ink";
} {
  switch (certification.tier) {
    case "certified-human":
      return {
        label: "Certified interpreter",
        detail: certification.attributedTo && certification.credentialBody
          ? `Filmed by ${certification.attributedTo}, ${certification.credentialBody}. Meets WCAG 1.2.6.`
          : "Filmed by a credentialed interpreter. Meets WCAG 1.2.6.",
        tone: "aurora",
      };
    case "interpreter-reviewed":
      return {
        label: "Interpreter reviewed",
        detail: certification.credentialBody
          ? `Generated, then checked and signed off by a ${certification.credentialBody} interpreter.`
          : "Generated, then checked and signed off by a qualified interpreter.",
        tone: "nova",
      };
    default:
      return {
        label: "Generated preview",
        detail: "Signed by Polaris from the transcript. Not a certified interpretation.",
        tone: "ink",
      };
  }
}
