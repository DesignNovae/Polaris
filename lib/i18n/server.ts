import type { Lang } from "./strings";
import { stabilizeGeneratedText } from "@/lib/gemma/output-quality";

export function requestLanguage(request: Request): Lang {
  const explicit = request.headers.get("x-polaris-language");
  if (explicit === "bn" || explicit === "en") return explicit;
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)polaris\.lang=(en|bn)(?:;|$)/);
  return match?.[1] === "bn" ? "bn" : "en";
}

export function generationLanguageInstruction(lang: Lang): string {
  if (lang !== "bn") {
    return "Respond in clear English.";
  }

  return [
    "Respond entirely in natural, fluent Bengali (বাংলা).",
    "Keep official names, university names, URLs, citation tags, exam abbreviations such as SAT/IELTS/GPA, code, and mathematical notation unchanged.",
    "Translate every ordinary heading, explanation, label, table heading, and action step into Bengali. Use Bengali numerals in prose, but keep JSON numeric values as numbers.",
    "Do not write bilingual headings, parenthetical English glosses, or mixed Bengali-English sentences when a natural Bengali expression is available.",
    "Translate ordinary terms such as Steps, Impact, Leadership, Action Plan, Focus Area, and Next Steps; preserve only genuine proper names, established acronyms, code, URLs, and mathematical notation.",
    "Before sending the answer, silently review every sentence and replace any unnecessary English word with natural Bengali.",
  ].join(" ");
}

const BENGALI_GENERATION_TERMS: Array<[RegExp, string]> = [
  [/\bComputer Science\b/gi, "কম্পিউটার বিজ্ঞান"],
  [/\bHigher Secondary\b/gi, "উচ্চমাধ্যমিক"],
  [/\bAction Plan\b/gi, "কর্মপরিকল্পনা"],
  [/\bNext Steps?\b/gi, "পরবর্তী পদক্ষেপ"],
  [/\bFocus Areas?\b/gi, "অগ্রাধিকারের ক্ষেত্র"],
  [/\bLeadership\b/gi, "নেতৃত্ব"],
  [/\bImpact\b/gi, "প্রভাব"],
  [/\bPriorities\b/gi, "অগ্রাধিকারগুলো"],
  [/\bPriority\b/gi, "অগ্রাধিকার"],
];

function isProtectedEnglishParenthetical(value: string): boolean {
  return /^(?:[A-Z0-9][A-Z0-9.+/-]*)(?:\s*(?:&|\/|,)\s*[A-Z0-9][A-Z0-9.+/-]*)*$/.test(
    value.trim(),
  );
}

function polishBengaliProse(value: string): string {
  let polished = value.replace(
    /\s*\(([A-Za-z][A-Za-z .,&/+'’-]{2,60})\)/g,
    (match, english: string) =>
      isProtectedEnglishParenthetical(english) ? match : "",
  );
  for (const [pattern, replacement] of BENGALI_GENERATION_TERMS) {
    polished = polished.replace(pattern, replacement);
  }
  return polished;
}

/**
 * Final deterministic guard for generated Bengali copy.
 *
 * The model is instructed to write natural Bengali, while this pass removes
 * occasional bilingual glosses without touching code fences, inline code,
 * URLs, citations, or mathematical notation.
 */
export function finalizeGeneratedLanguage(value: string, lang: Lang): string {
  if (!value) return value;
  const stable = stabilizeGeneratedText(value);
  if (lang !== "bn") return stable;
  return stable
    .split(/(```[\s\S]*?```|`[^`\n]+`|\\\[[\s\S]*?\\\]|\\\([^)\n]*\\\))/g)
    .map((part, index) => (index % 2 === 0 ? polishBengaliProse(part) : part))
    .join("");
}

export const BN_ERRORS = {
  rateLimit: "অনুরোধের সীমা পূর্ণ হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।",
  completeIntake: "প্রথমে ইনটেক সম্পন্ন করুন।",
  invalidRequest: "অনুরোধের তথ্য সঠিক নয়।",
  generic: "কিছু সমস্যা হয়েছে। একটু পর আবার চেষ্টা করুন।",
  capacity: "স্ট্র্যাটেজিস্ট এখন অতিরিক্ত ব্যস্ত। কিছুক্ষণ পর আবার চেষ্টা করুন।",
  stream: "স্ট্র্যাটেজিস্ট উত্তর দিতে পারেনি। অনুগ্রহ করে আবার চেষ্টা করুন।",
  demoLimit: "পাবলিক ডেমোর সীমা পূর্ণ হয়েছে। কয়েক মিনিট পর আবার চেষ্টা করুন।",
} as const;
