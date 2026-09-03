"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  DiscoveryEntityType,
  DiscoveryNote,
} from "@/lib/discovery/notes";
import { cn } from "@/lib/cn";

type SaveState = "idle" | "saving" | "saved" | "error";

export type DiscoveryNotesController = {
  available: boolean;
  loading: boolean;
  notes: Record<string, string>;
  stateFor: (entityId: string) => SaveState;
  errorFor: (entityId: string) => string;
  setDraft: (entityId: string, value: string) => void;
  save: (entityId: string) => Promise<void>;
};

/** One request loads all notes for a page; every visible card shares it. */
export function useDiscoveryNotes(entityType: DiscoveryEntityType): DiscoveryNotesController {
  const [available, setAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetch(`/api/discovery/notes?entityType=${entityType}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as { notes?: DiscoveryNote[]; error?: string };
        if (response.status === 401) {
          setAvailable(false);
          return;
        }
        if (!response.ok) throw new Error(body.error || "Personal notes could not be loaded.");
        setNotes(Object.fromEntries((body.notes ?? []).map((item) => [item.entityId, item.note])));
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setErrors((current) => ({
          ...current,
          _load: error instanceof Error ? error.message : "Personal notes could not be loaded.",
        }));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [entityType]);

  const setDraft = useCallback((entityId: string, value: string) => {
    setNotes((current) => ({ ...current, [entityId]: value }));
    setStates((current) => ({ ...current, [entityId]: "idle" }));
    setErrors((current) => ({ ...current, [entityId]: "" }));
  }, []);

  const save = useCallback(async (entityId: string) => {
    setStates((current) => ({ ...current, [entityId]: "saving" }));
    setErrors((current) => ({ ...current, [entityId]: "" }));
    try {
      const response = await fetch("/api/discovery/notes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entityType, entityId, note: notes[entityId] ?? "" }),
      });
      const body = await response.json() as { note?: DiscoveryNote | null; error?: string };
      if (!response.ok) throw new Error(body.error || "The personal note could not be saved.");
      setNotes((current) => ({ ...current, [entityId]: body.note?.note ?? "" }));
      setStates((current) => ({ ...current, [entityId]: "saved" }));
    } catch (error) {
      setStates((current) => ({ ...current, [entityId]: "error" }));
      setErrors((current) => ({
        ...current,
        [entityId]: error instanceof Error ? error.message : "The personal note could not be saved.",
      }));
    }
  }, [entityType, notes]);

  return {
    available,
    loading,
    notes,
    stateFor: (entityId) => states[entityId] ?? "idle",
    errorFor: (entityId) => errors[entityId] || errors._load || "",
    setDraft,
    save,
  };
}

export function DiscoveryNoteField({
  entityId,
  controller,
}: {
  entityId: string;
  controller: DiscoveryNotesController;
}) {
  if (!controller.available) return null;
  const state = controller.stateFor(entityId);
  const error = controller.errorFor(entityId);

  return (
    <div
      className="relative mt-3 rounded-xl border border-ink-faint/15 bg-bg/45 p-2.5"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={`personal-note-${entityId}`} className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink-muted">
          Personal note
        </label>
        <span className={cn(
          "text-[9px]",
          state === "error" ? "text-signal-rose" : state === "saved" ? "text-aurora-700 dark:text-aurora-200" : "text-ink-muted",
        )}>
          {state === "saving" ? "Saving…" : state === "saved" ? "Saved" : state === "error" ? "Try again" : `${(controller.notes[entityId] ?? "").length}/240`}
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          id={`personal-note-${entityId}`}
          value={controller.notes[entityId] ?? ""}
          onChange={(event) => controller.setDraft(entityId, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void controller.save(entityId);
            }
          }}
          maxLength={240}
          disabled={controller.loading || state === "saving"}
          placeholder="e.g. Ask counsellor about this one"
          className="min-w-0 flex-1 rounded-lg border border-ink-faint/20 bg-paper-card px-2.5 py-1.5 text-[10.5px] text-ink outline-none transition placeholder:text-ink-muted/60 focus:border-polaris-500/55 disabled:opacity-60"
        />
        <button
          type="button"
          disabled={controller.loading || state === "saving"}
          onClick={() => void controller.save(entityId)}
          className="rounded-lg bg-ink px-2.5 py-1.5 text-[10px] font-semibold text-paper transition hover:bg-polaris-700 disabled:opacity-50"
        >
          Save
        </button>
      </div>
      {error ? <p role="alert" className="mt-1 text-[9px] text-signal-rose">{error}</p> : null}
    </div>
  );
}
