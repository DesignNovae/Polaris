"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import type { Lang } from "./strings";
import { translateUiText } from "./bengali";
import { cn } from "@/lib/cn";

type Props = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

type TextRecord = { original: string; translated: string };
type AttributeRecord = { original: string; translated: string };

const textRecords = new Map<Text, TextRecord>();
const attributeRecords = new Map<Element, Map<string, AttributeRecord>>();
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;
const SKIP_SELECTOR = [
  "script", "style", "noscript", "code", "pre", "svg", "math",
  ".katex", ".katex-mathml", "[data-no-translate]", "[translate='no']",
  "[contenteditable='true']",
].join(",");

const ROUTES_WITH_LANGUAGE_CONTROL = /^\/(?:demo|roadmap|strategist|deadlines|universities|resources|connections|partners|consultants|community|family|bookings|billing|transactions|settings|account|admin|case-studies|dashboard|monitor|university)(?:\/|$)/;

function shouldSkip(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE
    ? node as Element
    : node.parentElement;
  return Boolean(element?.closest(SKIP_SELECTOR));
}

function translateTextNode(node: Text): void {
  if (shouldSkip(node) || !node.data.trim()) return;

  const previous = textRecords.get(node);
  if (previous && node.data === previous.translated) return;

  const original = previous && node.data === previous.original
    ? previous.original
    : node.data;
  const translated = translateUiText(original);
  if (translated === original) {
    textRecords.delete(node);
    return;
  }

  textRecords.set(node, { original, translated });
  node.data = translated;
}

function translateElementAttributes(element: Element): void {
  if (shouldSkip(element)) return;

  const attributes = [...TRANSLATABLE_ATTRIBUTES];
  if (
    element instanceof HTMLInputElement
    && ["button", "submit", "reset"].includes(element.type)
  ) {
    attributes.push("value" as (typeof TRANSLATABLE_ATTRIBUTES)[number]);
  }

  let records = attributeRecords.get(element);
  for (const attribute of attributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;

    const previous = records?.get(attribute);
    if (previous && current === previous.translated) continue;
    const original = previous && current === previous.original
      ? previous.original
      : current;
    const translated = translateUiText(original);
    if (translated === original) {
      records?.delete(attribute);
      continue;
    }

    if (!records) {
      records = new Map();
      attributeRecords.set(element, records);
    }
    records.set(attribute, { original, translated });
    element.setAttribute(attribute, translated);
  }
}

function localizeSubtree(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    translateTextNode(root as Text);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;

  if (root.nodeType === Node.ELEMENT_NODE) {
    translateElementAttributes(root as Element);
  }

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );
  let current = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      translateTextNode(current as Text);
    } else {
      translateElementAttributes(current as Element);
    }
    current = walker.nextNode();
  }
}

function restoreEnglish(): void {
  for (const [node, record] of textRecords) {
    if (node.isConnected && node.data === record.translated) {
      node.data = record.original;
    }
  }
  textRecords.clear();

  for (const [element, records] of attributeRecords) {
    if (!element.isConnected) continue;
    for (const [attribute, record] of records) {
      if (element.getAttribute(attribute) === record.translated) {
        element.setAttribute(attribute, record.original);
      }
    }
  }
  attributeRecords.clear();

  document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
    "input, select, textarea",
  ).forEach((element) => element.setCustomValidity(""));
}

export function AutoLocalizer({ lang, setLang }: Props) {
  const pathname = usePathname();
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;

    const previousObserver = observerRef.current;
    previousObserver?.disconnect();

    if (lang === "en") {
      restoreEnglish();
      return;
    }

    localizeSubtree(document.body);

    let frame = 0;
    const pendingRoots = new Set<Node>();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === "characterData") {
          pendingRoots.add(mutation.target);
        } else {
          pendingRoots.add(mutation.target);
          mutation.addedNodes.forEach((node) => pendingRoots.add(node));
        }
      }
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        observer.disconnect();
        for (const root of pendingRoots) {
          if (root.isConnected) localizeSubtree(root);
        }
        pendingRoots.clear();
        observer.observe(document.body, {
          subtree: true,
          childList: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...TRANSLATABLE_ATTRIBUTES, "value"],
        });
      });
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES, "value"],
    });
    observerRef.current = observer;

    function onInvalid(event: Event) {
      const field = event.target;
      if (
        !(field instanceof HTMLInputElement)
        && !(field instanceof HTMLSelectElement)
        && !(field instanceof HTMLTextAreaElement)
      ) return;

      if (field.validity.valueMissing) {
        field.setCustomValidity("এই ঘরটি পূরণ করুন।");
      } else if (field instanceof HTMLInputElement && field.validity.typeMismatch) {
        field.setCustomValidity(
          field.type === "email"
            ? "সঠিক ইমেইল ঠিকানা লিখুন।"
            : "সঠিক তথ্য লিখুন।",
        );
      } else if (field.validity.tooShort) {
        const minimum =
          field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement
            ? field.minLength
            : 0;
        field.setCustomValidity(`কমপক্ষে ${translateUiText(String(minimum))}টি অক্ষর লিখুন।`);
      } else {
        field.setCustomValidity("সঠিক তথ্য লিখুন।");
      }
    }

    function onInput(event: Event) {
      const field = event.target;
      if (
        field instanceof HTMLInputElement
        || field instanceof HTMLSelectElement
        || field instanceof HTMLTextAreaElement
      ) {
        field.setCustomValidity("");
      }
    }

    document.addEventListener("invalid", onInvalid, true);
    document.addEventListener("input", onInput, true);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("invalid", onInvalid, true);
      document.removeEventListener("input", onInput, true);
      document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
        "input, select, textarea",
      ).forEach((element) => element.setCustomValidity(""));
    };
  }, [lang]);

  const showDock = pathname !== "/" && !ROUTES_WITH_LANGUAGE_CONTROL.test(pathname);
  if (!showDock) return null;

  return (
    <div
      data-no-translate
      className="fixed bottom-4 right-4 z-[70] flex items-center rounded-full bg-ink/90 p-1 text-[11px] text-paper shadow-pop ring-1 ring-inset ring-white/15 backdrop-blur-xl"
      aria-label={lang === "bn" ? "Switch to English" : "Switch to Bengali"}
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        className={cn(
          "rounded-full px-2.5 py-1.5 transition-colors",
          lang === "en" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper",
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("bn")}
        className={cn(
          "rounded-full px-2.5 py-1.5 transition-colors",
          lang === "bn" ? "bg-paper text-ink font-semibold" : "text-paper/70 hover:text-paper",
        )}
      >
        বাংলা
      </button>
    </div>
  );
}
