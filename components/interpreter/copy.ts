/**
 * Interpreter copy, in both languages the workspace ships.
 *
 * Every string that a Deaf or hard-of-hearing student might rely on is written to
 * name the situation and the way out of it, not to apologise. Status text says
 * what the interpreter is doing; error text says what failed and what to do next.
 */

export type Lang = "en" | "bn";

/**
 * English is the shape of record. Deriving the type from it without `as const`
 * widens every field to `string`, which is what makes the Bengali block a
 * checked implementation of the same contract rather than a second literal type.
 */
const EN = {
  title: "Sign language",
  enable: "Sign language interpreter",
  enableOn: "Turn on the sign language interpreter",
  enableOff: "Turn off the sign language interpreter",
  on: "On",
  off: "Off",

  language: "Sign language",
  size: "Panel size",
  side: "Panel side",
  sizes: { small: "Small", medium: "Medium", large: "Large" },
  sides: { left: "Left", right: "Right" },
  layout: "Layout",
  layouts: { beside: "Beside", focus: "Focus", overlay: "Overlay" },
  layoutHints: {
    beside: "Lesson and interpreter share the width.",
    focus: "Interpreter leads; the lesson plays smaller beside it.",
    overlay: "Interpreter floats over a full-width lesson.",
  },

  display: "Display options",
  highContrast: "High contrast",
  reducedMotion: "Reduce motion",
  showGloss: "Show gloss",
  showDiagnostics: "Show sync details",

  syncLocked: "In sync",
  syncCorrecting: "Re-syncing",
  syncLost: "Waiting for the lesson",
  syncDrift: "drift",
  syncResyncs: "corrections",
  syncTolerance: "tolerance",

  glossHeading: "Current phrase",
  glossEmpty: "Signing starts when the lesson plays.",
  signing: "Now signing",

  statusLoading: "Reading the lesson transcript.",
  statusTranslating: "Preparing the sign sequence.",
  statusNoTranscript: "This lesson has no transcript yet, so there is nothing to interpret. Pick another lesson, or turn the interpreter off for now.",
  statusUnsupported: "No provider can sign this language yet. Choose ASL, BSL, or ISL.",
  statusRendererError: "The interpreter could not draw. Reload the lesson to try again.",
  statusError: "The interpreter could not start. Reload the lesson to try again.",
  retry: "Try again",

  sourceVerbatim: "Verbatim script",
  sourceCompanion: "Polaris companion track",
  sourceCaptions: "Published captions",
  sourceGenerated: "Gemma outline",
  sourceNote: {
    verbatim: "The exact words Polaris speaks in this exercise.",
    "authored-companion": "Written by Polaris and timed to the lesson. Not a word-for-word transcript of the speaker.",
    "published-captions": "The lesson's own caption track.",
    "ai-generated": "Written by Gemma from the lesson topic. Gemma has not heard the audio.",
  },

  certifiedLabel: "Certified interpreter",
  reviewedLabel: "Interpreter reviewed",
  syntheticLabel: "Generated preview",
  syntheticNote: "Signed by Polaris from the transcript. Not a certified interpretation.",

  avatarLabel: "Sign language interpreter avatar",
  panelLabel: "Sign language interpreter",
  controlsLabel: "Interpreter controls",
};

export type InterpreterCopy = typeof EN;

const BN: InterpreterCopy = {
  title: "সাংকেতিক ভাষা",
  enable: "সাংকেতিক ভাষার দোভাষী",
  enableOn: "সাংকেতিক ভাষার দোভাষী চালু করুন",
  enableOff: "সাংকেতিক ভাষার দোভাষী বন্ধ করুন",
  on: "চালু",
  off: "বন্ধ",

  language: "সাংকেতিক ভাষা",
  size: "প্যানেলের আকার",
  side: "প্যানেলের অবস্থান",
  sizes: { small: "ছোট", medium: "মাঝারি", large: "বড়" },
  sides: { left: "বাঁয়ে", right: "ডানে" },
  layout: "বিন্যাস",
  layouts: { beside: "পাশাপাশি", focus: "দোভাষী বড়", overlay: "উপরে ভাসমান" },
  layoutHints: {
    beside: "পাঠ ও দোভাষী সমান জায়গা নেয়।",
    focus: "দোভাষী বড় থাকে, পাঠ ছোট হয়ে পাশে চলে।",
    overlay: "পুরো প্রস্থের পাঠের উপরে দোভাষী ভাসে।",
  },

  display: "প্রদর্শন সেটিংস",
  highContrast: "উচ্চ কনট্রাস্ট",
  reducedMotion: "কম নড়াচড়া",
  showGloss: "গ্লস দেখান",
  showDiagnostics: "সিঙ্ক তথ্য দেখান",

  syncLocked: "সিঙ্কে আছে",
  syncCorrecting: "আবার মেলানো হচ্ছে",
  syncLost: "পাঠের অপেক্ষায়",
  syncDrift: "পার্থক্য",
  syncResyncs: "সংশোধন",
  syncTolerance: "সহনসীমা",

  glossHeading: "বর্তমান বাক্য",
  glossEmpty: "পাঠ চালু হলে সংকেত শুরু হবে।",
  signing: "এখন দেখানো হচ্ছে",

  statusLoading: "পাঠের প্রতিলিপি পড়া হচ্ছে।",
  statusTranslating: "সংকেতের ধারা তৈরি হচ্ছে।",
  statusNoTranscript: "এই পাঠের কোনো প্রতিলিপি নেই, তাই অনুবাদ করার কিছু নেই। অন্য পাঠ বেছে নিন, অথবা আপাতত দোভাষী বন্ধ রাখুন।",
  statusUnsupported: "এই ভাষার জন্য এখনো কোনো ব্যবস্থা নেই। ASL, BSL বা ISL বেছে নিন।",
  statusRendererError: "দোভাষী আঁকা যায়নি। পাঠটি আবার লোড করুন।",
  statusError: "দোভাষী চালু করা যায়নি। পাঠটি আবার লোড করুন।",
  retry: "আবার চেষ্টা করুন",

  sourceVerbatim: "হুবহু স্ক্রিপ্ট",
  sourceCompanion: "Polaris সহযোগী ট্র্যাক",
  sourceCaptions: "প্রকাশিত ক্যাপশন",
  sourceGenerated: "Gemma রূপরেখা",
  sourceNote: {
    verbatim: "এই অনুশীলনে Polaris যে কথাগুলো বলে, ঠিক সেগুলো।",
    "authored-companion": "Polaris লিখেছে ও পাঠের সময়ের সঙ্গে মিলিয়েছে। বক্তার হুবহু কথা নয়।",
    "published-captions": "পাঠের নিজস্ব ক্যাপশন ট্র্যাক।",
    "ai-generated": "পাঠের বিষয় থেকে Gemma লিখেছে। Gemma অডিও শোনেনি।",
  },

  certifiedLabel: "সনদপ্রাপ্ত দোভাষী",
  reviewedLabel: "দোভাষী যাচাই করেছেন",
  syntheticLabel: "তৈরি করা প্রিভিউ",
  syntheticNote: "প্রতিলিপি থেকে Polaris তৈরি করেছে। এটি সনদপ্রাপ্ত অনুবাদ নয়।",

  avatarLabel: "সাংকেতিক ভাষার দোভাষী অবতার",
  panelLabel: "সাংকেতিক ভাষার দোভাষী",
  controlsLabel: "দোভাষী নিয়ন্ত্রণ",
};

export const INTERPRETER_COPY: Record<Lang, InterpreterCopy> = { en: EN, bn: BN };
