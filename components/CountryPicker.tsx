"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRIES, countryName, flagEmoji, normalizeForSearch } from "@/lib/flags";

interface CountryPickerProps {
  value: string;
  onChange: (code: string) => void;
}

// Länderauswahl mit Suchfeld: Bei über 250 Ländern ist ein normales
// Dropdown zu lang, darum tippt man einfach die ersten Buchstaben.
export default function CountryPicker({ value, onChange }: CountryPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = normalizeForSearch(query.trim());
    if (!q) return COUNTRIES;
    // Treffer am Wortanfang zuerst ("serb" -> Serbien vor Aserbaidschan),
    // damit Enter das gemeinte Land übernimmt.
    const starts: typeof COUNTRIES = [];
    const contains: typeof COUNTRIES = [];
    for (const c of COUNTRIES) {
      const name = normalizeForSearch(c.name);
      if (name.startsWith(q) || c.code.toLowerCase() === q) starts.push(c);
      else if (name.includes(q)) contains.push(c);
    }
    return [...starts, ...contains];
  }, [query]);

  // Klick außerhalb schließt die Liste.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  function choose(code: string) {
    onChange(code);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg border border-edge bg-pitch px-4 py-3 text-left text-base text-ink outline-none focus:border-gold"
      >
        <span className="shrink-0">{flagEmoji(value)}</span>
        <span className="min-w-0 flex-1 truncate">{countryName(value)}</span>
        <span className="shrink-0 text-xs text-muted">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-edge bg-surface shadow-xl">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (matches.length > 0) choose(matches[0].code);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Land suchen, z. B. Serbien"
            className="w-full rounded-t-lg border-b border-edge bg-pitch px-4 py-3 text-base text-ink outline-none"
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto py-1">
            {matches.length === 0 && (
              <li className="px-4 py-2 text-sm text-muted">Kein Land gefunden.</li>
            )}
            {matches.map((c) => (
              <li key={c.code} role="option" aria-selected={c.code === value}>
                <button
                  type="button"
                  onClick={() => choose(c.code)}
                  className={`flex w-full items-center gap-2 px-4 py-2 text-left text-base hover:bg-surface-hover ${
                    c.code === value ? "text-gold" : "text-ink"
                  }`}
                >
                  <span className="shrink-0">{flagEmoji(c.code)}</span>
                  <span className="min-w-0 flex-1">{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
