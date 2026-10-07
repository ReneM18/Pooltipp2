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
  };
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
