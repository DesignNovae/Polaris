"use client";

/**
 * Interpreter controls.
 *
 * Every control is one setting, and every setting is one line in SettingsState,
 * so adding a control is adding a field and an entry to a list here.
 *
 * Keyboard behaviour is the real work. A segmented control is a radio group, not
 * a row of buttons: arrow keys move between options, Tab enters and leaves the
 * group as a unit, and only the selected option is a tab stop. Tabbing through
 * eleven separate buttons to reach the language you need is the difference
 * between an accessibility feature and a feature that merely mentions access.
 */

import { useCallback, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/app/ui";
import { SIGN_LANGUAGES, type SignLanguageCode } from "@/lib/interpreter/types/gestures";
import type {
  InterpreterLayout,
  InterpreterSide,
  InterpreterSize,
  SettingsState,
} from "@/lib/interpreter/types/interpreter";
import type { InterpreterCopy } from "./copy";

/* ── Segmented control ──────────────────────────────────────────────────── */

type Option<T extends string> = { value: T; label: string; hint?: string; badge?: string };

function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "md",
}: {
  label: string;
  value: T;
  options: ReadonlyArray<Option<T>>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();

      const index = options.findIndex((option) => option.value === value);
      const last = options.length - 1;
      const next =
        event.key === "Home" ? 0
        : event.key === "End" ? last
        : event.key === "ArrowRight" || event.key === "ArrowDown" ? (index + 1) % options.length
        : (index - 1 + options.length) % options.length;

      onChange(options[next].value);
      // Selection follows focus in a radio group, so move focus with it.
      const buttons = containerRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']");
      buttons?.[next]?.focus();
    },
    [options, value, onChange],
  );

  return (
    <div
      ref={containerRef}
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex gap-1 rounded-xl bg-paper-deep/70 p-1 dark:bg-white/[0.06]"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            // Roving tabindex: the group is a single tab stop.
            tabIndex={active ? 0 : -1}
            title={option.hint}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-lg font-semibold transition-colors duration-100",
              size === "sm" ? "px-2 py-1 text-[10.5px]" : "px-2.5 py-1.5 text-[11.5px]",
              active ? "bg-ink text-paper shadow-sm" : "text-ink-dim hover:bg-paper-card/70 hover:text-ink",
            )}
          >
            <span className="inline-flex items-center justify-center gap-1">
              {option.label}
              {option.badge && (
                <span className="rounded-full bg-aurora-500 px-1 text-[8px] font-bold uppercase leading-[1.4] text-white">
                  {option.badge}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── Switch ─────────────────────────────────────────────────────────────── */

function Switch({
  label,
  checked,
  onChange,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  description?: string;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <label htmlFor={id} className="min-w-0 cursor-pointer text-[11.5px] font-medium text-ink-dim">
        {label}
        {description && <span className="mt-0.5 block text-[10px] font-normal text-ink-muted">{description}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150",
          checked ? "bg-polaris-500" : "bg-ink-faint/45 dark:bg-white/20",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-[left] duration-150",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </button>
    </div>
  );
}

/* ── Panel controls ─────────────────────────────────────────────────────── */

export function InterpreterControls({
  settings,
  update,
  copy,
  recordedLanguages,
}: {
  settings: SettingsState;
  update: (patch: Partial<SettingsState>) => void;
  copy: InterpreterCopy;
  /** Languages with a filmed interpreter track for this lesson. */
  recordedLanguages: SignLanguageCode[];
}) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();

  const languageOptions = SIGN_LANGUAGES.map((language) => ({
    value: language.code,
    label: language.abbreviation,
    hint: `${language.name} · ${language.region}`,
    badge: recordedLanguages.includes(language.code) ? "film" : undefined,
  }));

  const sizeOptions: Array<Option<InterpreterSize>> = [
    { value: "small", label: copy.sizes.small },
    { value: "medium", label: copy.sizes.medium },
    { value: "large", label: copy.sizes.large },
  ];

  const sideOptions: Array<Option<InterpreterSide>> = [
    { value: "left", label: copy.sides.left },
    { value: "right", label: copy.sides.right },
  ];

  const layoutOptions: Array<Option<InterpreterLayout>> = [
    { value: "beside", label: copy.layouts.beside, hint: copy.layoutHints.beside },
    { value: "focus", label: copy.layouts.focus, hint: copy.layoutHints.focus },
    { value: "overlay", label: copy.layouts.overlay, hint: copy.layoutHints.overlay },
  ];

  return (
    <div className="space-y-3" aria-label={copy.controlsLabel} role="group">
      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.language}</div>
        <Segmented
          label={copy.language}
          value={settings.language}
          options={languageOptions}
          onChange={(language) => update({ language })}
        />
      </div>

      <div>
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.layout}</div>
        <Segmented label={copy.layout} value={settings.layout} options={layoutOptions} onChange={(layout) => update({ layout })} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.size}</div>
          <Segmented label={copy.size} value={settings.size} options={sizeOptions} onChange={(size) => update({ size })} size="sm" />
        </div>
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-muted">{copy.side}</div>
          <Segmented label={copy.side} value={settings.side} options={sideOptions} onChange={(side) => update({ side })} size="sm" />
        </div>
      </div>

      <div>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          aria-controls={detailsId}
          className="flex w-full items-center justify-between rounded-lg py-1.5 text-[11px] font-semibold text-ink-dim transition-colors hover:text-ink"
        >
          {copy.display}
          <span className={cn("transition-transform duration-150", expanded && "rotate-180")}>
            <Icon.chevDown size={12} />
          </span>
        </button>
        {expanded && (
          <div id={detailsId} className="mt-1 border-t border-ink-faint/15 pt-1.5">
            <Switch label={copy.highContrast} checked={settings.highContrast} onChange={(highContrast) => update({ highContrast })} />
            <Switch label={copy.reducedMotion} checked={settings.reducedMotion} onChange={(reducedMotion) => update({ reducedMotion })} />
            <Switch label={copy.showGloss} checked={settings.showGloss} onChange={(showGloss) => update({ showGloss })} />
            <Switch label={copy.showDiagnostics} checked={settings.showDiagnostics} onChange={(showDiagnostics) => update({ showDiagnostics })} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The on/off control.
 *
 * Lives beside the lesson rather than inside the panel, because a control that
 * only appears once the panel is open cannot be used to open it.
 */
export function InterpreterToggle({
  enabled,
  onChange,
  copy,
  className,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  copy: InterpreterCopy;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={enabled ? copy.enableOff : copy.enableOn}
      onClick={() => onChange(!enabled)}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-colors duration-100",
        enabled
          ? "border-polaris-500/45 bg-polaris-500/[0.10] text-polaris-700 dark:text-polaris-100"
          : "border-ink-faint/25 text-ink-dim hover:border-polaris-500/35 hover:text-ink",
        className,
      )}
    >
      <SigningGlyph active={enabled} />
      <span>{copy.enable}</span>
      <span
        className={cn(
          "rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide",
          enabled ? "bg-polaris-500 text-white" : "bg-ink-faint/20 text-ink-muted",
        )}
      >
        {enabled ? copy.on : copy.off}
      </span>
    </button>
  );
}

/**
 * Interpreter mark, drawn to match the app's icon set: 24px box, 1.6 stroke,
 * round caps. A hand with the index and little finger extended.
 */
function SigningGlyph({ active }: { active: boolean }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0 transition-opacity", active ? "opacity-100" : "opacity-70")}
    >
      <path d="M8 11V4.5a1.5 1.5 0 0 1 3 0V10" />
      <path d="M11 10V6.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M14 11V8.5a1.5 1.5 0 0 1 3 0V14" />
      <path d="M8 11V9.5a1.5 1.5 0 0 0-3 0V15a6 6 0 0 0 6 6h2a6 6 0 0 0 6-6v-1" />
    </svg>
  );
}
