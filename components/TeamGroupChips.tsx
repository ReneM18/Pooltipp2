"use client";

import { useEffect, useRef } from "react";

import type { TeamGroupWithTeams } from "@/lib/teamGroups";
import { COUNTRIES, flagEmoji } from "@/lib/flags";
import { normalizeTeamName } from "@/lib/teamName";

// Knöpfe für die Untergruppen ("Alle", "NHL", "Nationalteams", "Österreich" …).
// value "" = Alle. Groß (Admin-Liste): Umbruch, damit jede Gruppe sichtbar
// ist. Klein (aufgeklappte Auswahl): eine Zeile zum Wischen, damit die
// Teamliste darunter am Handy genug Platz behält.
export default function TeamGroupChips({
  groups,
  value,
  onChange,
  total,
  size = "md",
  countryPicker = false,
}: {
  groups: TeamGroupWithTeams[];
  value: string;
  onChange: (key: string) => void;
  total: number;
  size?: "sm" | "md";
  // Zusätzlich jedes Land der Welt wählbar (Auswahlliste mit Flaggen).
  countryPicker?: boolean;
}) {
  const small = size === "sm";
  const rowRef = useRef<HTMLDivElement>(null);
  // Gewählte Gruppe in der Wisch-Zeile sichtbar halten (z. B. nach
  // "Weitere Länder…", das hinten angehängt wird).
  useEffect(() => {
    const row = rowRef.current;
    const btn = row?.querySelector<HTMLElement>('button[aria-pressed="true"]');
    if (!row || !btn || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: Math.max(0, btn.offsetLeft - row.offsetLeft - 12), behavior: "smooth" });
  }, [value, groups.length]);
  const chip = small ? "min-h-[36px] shrink-0 px-3 py-1.5 text-sm" : "min-h-[44px] px-4 py-2 text-sm";
  const options = [{ key: "", label: "Alle", icon: "", count: total }, ...groups.map((g) => ({ ...g, count: g.teams.length }))];
  return (
    <div
      ref={rowRef}
      className={`flex min-w-0 max-w-full gap-1.5 ${
        small
          ? "overflow-x-auto overscroll-contain pr-3 touch-pan-x [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden"
          : "flex-wrap"
      }`}
      role="group"
      aria-label="Untergruppe"
    >
      {options.map((o) => {
        const active = o.key === value;
        return (
          <button
            key={o.key || "alle"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.key)}
            className={`flex items-center gap-1.5 rounded-full border font-semibold leading-tight transition-colors ${chip} ${
              active
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-pitch text-muted hover:border-gold/40 hover:text-ink"
            }`}
          >
            {o.icon && <span aria-hidden>{o.icon}</span>}
            <span className="whitespace-nowrap">{o.label}</span>
            <span className="text-xs font-normal opacity-70">{o.count}</span>
          </button>
        );
      })}
      {countryPicker && (
        <select
          value=""
          onChange={(e) => e.target.value && onChange(e.target.value)}
          aria-label="Anderes Land wählen"
          className={`w-52 shrink-0 cursor-pointer rounded-full border border-dashed border-edge bg-pitch font-semibold text-muted outline-none hover:border-gold/40 hover:text-ink focus:border-gold ${chip}`}
        >
          <option value="">🌐 Weitere Länder…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={normalizeTeamName(c.name)}>
              {flagEmoji(c.code)} {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
