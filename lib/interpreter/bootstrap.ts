/**
 * Provider registration.
 *
 * Importing a provider module registers it. Collecting those imports here means a
 * surface that wants the interpreter imports one thing, and the resolution order
 * across the whole app is decided in one readable place rather than by whichever
 * component happened to import what.
 *
 * Order does not matter - both chains sort by rank - but it is written in rank
 * order so the intent is visible:
 *
 *   Transcript   verbatim (100) > lesson captions (90) > companion (60) > Gemma outline (20)
 *   Translation  Gemma gloss (50) > rule engine (30)
 */

import "./transcript/RuntimeTranscriptProvider";
import "./transcript/YouTubeCaptionProvider";
import "./transcript/BundledTranscriptProvider";
import "./transcript/GemmaTranscriptProvider";

import "./translation/RuleBasedTranslationProvider";
import "./translation/GemmaTranslationProvider";

export { resolveTranscript, listTranscriptProviders } from "./transcript/TranscriptProvider";
export { describeMedia, getMedia, forgetMedia } from "./transcript/mediaRegistry";
export { registerVerbatimScript, clearVerbatimScript } from "./transcript/RuntimeTranscriptProvider";
export { listTranslationProviders, supportedLanguages } from "./translation/SignTranslationProvider";
export { registerRecordedTrack, findRecordedTrack } from "./tracks/InterpreterTrack";
