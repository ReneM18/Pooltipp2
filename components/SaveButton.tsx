"use client";

import { useEffect, useRef, useState } from "react";

// Einstellungen im Profil: Auswählen ändert erst einen Entwurf, übernommen
// wird er mit "Speichern". Solange man nichts angefasst hat, folgt die
// Anzeige dem gespeicherten Wert (z. B. wenn ein anderes Gerät ihn ändert).
export function useDraft<T>(value: T) {
  const [draft, setDraft] = useState<{ v: T } | null>(null);
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  // Gespeicherter Wert hat den Entwurf eingeholt: Entwurf auflösen, damit die
  // Anzeige wieder dem gespeicherten Wert folgt (auch Änderungen anderer Geräte).
  useEffect(() => {
    if (draft && draft.v === value) setDraft(null);
  }, [value, draft]);

  const shown = draft ? draft.v : value;
  const dirty = !!draft && draft.v !== value;

  return {
    value: shown,
    dirty,
    saved,
    set(v: T) {
      setDraft({ v });
      setSaved(false);
    },
    // apply übernimmt den Entwurf; gibt es einen Fehler (Text), bleibt der Entwurf stehen.
    async save(apply: (v: T) => void | string | null | Promise<void | string | null>) {
      if (!draft) return;
      const error = await apply(draft.v);
      if (error) return;
      setDraft(null);
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    },
    // Auswählen speichert sofort, ohne "Speichern"-Knopf (Rene, 19.10.2026).
    // Klappt es nicht (Fehlertext), springt die Anzeige auf den gespeicherten
    // Wert zurück.
    async pick(v: T, apply: (v: T) => void | string | null | Promise<void | string | null>) {
      if (v === value && !draft) return;
      setDraft({ v });
      setSaved(false);
      const error = await apply(v);
      // Erfolg: Auswahl stehen lassen, bis der gespeicherte Wert nachzieht
      // (siehe Effekt oben), damit nichts kurz zurückspringt.
      if (error) {
        setDraft(null);
        return;
      }
      setSaved(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setSaved(false), 2500);
    },
  };
}

// Kurzer Hinweis nach dem sofortigen Speichern (statt "Speichern"-Knopf).
export function SavedHint({ saved, className = "" }: { saved: boolean; className?: string }) {
  return (
    <span
      aria-live="polite"
      className={`shrink-0 whitespace-nowrap font-display text-xs font-semibold text-action transition-opacity ${
        saved ? "opacity-100" : "opacity-0"
      } ${className}`}
    >
      ✓ Gespeichert
    </span>
  );
}

export default function SaveButton({
  dirty,
  saved,
  busy = false,
  onClick,
  type = "button",
  className = "",
}: {
  dirty: boolean;
  saved: boolean;
  busy?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  const done = saved && !dirty;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={!dirty || busy}
      aria-live="polite"
      className={`shrink-0 whitespace-nowrap rounded-full border px-4 py-1.5 font-display text-sm font-semibold transition-colors ${
        done
          ? "border-action/60 bg-transparent text-action"
          : dirty
          ? "border-action bg-action text-pitch hover:bg-action-hover"
          : "cursor-default border-edge bg-transparent text-muted opacity-60"
      } ${className}`}
    >
      {busy ? "…" : done ? "Gespeichert ✓" : "Speichern"}
    </button>
  );
}
