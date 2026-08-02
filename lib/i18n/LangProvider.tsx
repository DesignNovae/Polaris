"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { strings, type Lang, type Dict } from "./strings";
import { AutoLocalizer } from "./AutoLocalizer";
import {
  formatLocaleDate,
  formatLocaleNumber,
  translateUiText,
} from "./bengali";

type LangContext = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
  translate: (value: string) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
};

const Ctx = createContext<LangContext | null>(null);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("polaris.lang");
      if (stored === "en" || stored === "bn") {
        setLangState(stored);
      } else if (window.navigator.language.toLowerCase().startsWith("bn")) {
        setLangState("bn");
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.cookie = `polaris.lang=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  }, [lang]);

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (
        event.key === "polaris.lang"
        && (event.newValue === "en" || event.newValue === "bn")
      ) {
        setLangState(event.newValue);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem("polaris.lang", l);
    } catch {}
    document.cookie = `polaris.lang=${l}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const value: LangContext = {
    lang,
    setLang,
    t: strings[lang],
    translate: lang === "bn" ? translateUiText : (value) => value,
    formatNumber: (value, options) => formatLocaleNumber(value, lang, options),
    formatDate: (value, options) => formatLocaleDate(value, lang, options),
  };

  return (
    <Ctx.Provider value={value}>
      {children}
      <AutoLocalizer lang={lang} setLang={setLang} />
    </Ctx.Provider>
  );
}

export function useLang() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useLang must be used within LangProvider");
  return ctx;
}
