import type { SeasonData } from "./types";

// ============================================================================
// Saison-Kalender: welche Saison läuft an welchem Tag?
// ============================================================================
// Reine Datums-Rechnung ohne Datenbank, damit sie getestet werden kann
// (scripts/saison-test.mjs). Gerechnet wird immer mit dem Kalendertag in
// Österreich, egal wo das Gerät steht – genauso wie in der SQL-Funktion
// start_pass_season (supabase/saisonwechsel.sql).
//
// Regeln:
// - Entwürfe (draft: true) werden nie aktiv.
// - Aktiv ist die Saison mit dem spätesten startsOn, der schon erreicht ist.
// - Ist die Saison vorbei, aber die nächste noch nicht fertig (Entwurf),
//   läuft die alte einfach weiter ("Verlängerung") – niemand verliert XP,
//   bevor es eine neue Saison gibt, in der man sie wieder sammeln kann.
// - Vor dem Start der allerersten Saison gilt die erste Saison.

/** Kalendertag in Österreich als "JJJJ-MM-TT". */
export function viennaDateKey(date: Date): string {
  // "sv-SE" schreibt Datumswerte genau im Format JJJJ-MM-TT.
  return date.toLocaleDateString("sv-SE", { timeZone: "Europe/Vienna" });
}

/** Saisons, die aktiv werden dürfen (keine Entwürfe), älteste zuerst. */
export function playableSeasons(seasons: SeasonData[]): SeasonData[] {
  return seasons.filter((s) => !s.draft).sort((a, b) => a.startsOn.localeCompare(b.startsOn));
}

export function seasonForDate(seasons: SeasonData[], date: Date): SeasonData {
  const playable = playableSeasons(seasons);
  if (playable.length === 0) throw new Error("Keine spielbare Saison eingetragen");
  const today = viennaDateKey(date);
  let current = playable[0];
  for (const season of playable) {
    if (season.startsOn <= today) current = season;
  }
  return current;
}

function dayNumber(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

export type SeasonCountdown =
  | { kind: "laeuft"; daysLeft: number } // daysLeft 0 = heute ist der letzte Tag
  | { kind: "verlaengert" }; // Ende überschritten, Nachfolger noch nicht fertig

export function seasonCountdown(season: SeasonData, date: Date): SeasonCountdown {
  const daysLeft = dayNumber(season.endsOn) - dayNumber(viennaDateKey(date));
  return daysLeft < 0 ? { kind: "verlaengert" } : { kind: "laeuft", daysLeft };
}

/** "Endet in 79 Tagen", "Endet morgen", "Endet heute", "Verlängert …". */
export function seasonCountdownText(season: SeasonData, date: Date): string {
  const c = seasonCountdown(season, date);
  if (c.kind === "verlaengert") return "Läuft weiter, bis die nächste Saison startet";
  if (c.daysLeft === 0) return "Endet heute";
  if (c.daysLeft === 1) return "Endet morgen";
  return `Endet in ${c.daysLeft} Tagen`;
}

/** "23.9.–20.12.2026" bzw. "21.12.2026–19.3.2027". */
export function seasonPeriodText(season: SeasonData): string {
  const [y1, m1, d1] = season.startsOn.split("-").map(Number);
  const [y2, m2, d2] = season.endsOn.split("-").map(Number);
  const start = y1 === y2 ? `${d1}.${m1}.` : `${d1}.${m1}.${y1}`;
  return `${start}–${d2}.${m2}.${y2}`;
}
