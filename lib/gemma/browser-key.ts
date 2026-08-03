"use client";

const KEY = "polaris.gemma.userKey";

export function getBrowserGemmaKey(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(KEY) || "";
}

export function setBrowserGemmaKey(value: string): void {
  if (typeof window === "undefined") return;
  const clean = value.trim();
  if (clean) window.sessionStorage.setItem(KEY, clean);
  else window.sessionStorage.removeItem(KEY);
}

export function gemmaHeaders(): Record<string, string> {
  const key = getBrowserGemmaKey();
  return key ? { "x-polaris-gemma-key": key } : {};
}

export function getBrowserKnowledgeNotes(): string {
  if (typeof window === "undefined") return "";
  try {
    const notes = JSON.parse(window.localStorage.getItem("polaris.knowledge.notes.v1") || "[]") as Array<{ title?: string; content?: string; gemmaSummary?: string }>;
    return notes.slice(0, 10).map((note) => `${note.title || "Note"}: ${note.gemmaSummary || note.content || ""}`.slice(0, 1200)).join("\n");
  } catch {
    return "";
  }
}