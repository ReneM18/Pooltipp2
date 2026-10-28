import type { Sport } from "./types";

// TV-Sender für Matchcenter-Spiele, die keine Tippspiele sind (Rene,
// 28.10.2026: "ich kann kein TV Sender einfügen bei den Spielen, die nicht
// Tippspiele sind"). Tippspiele behalten ihren Sender am Spiel
// (Match.tvChannel); hier stehen nur die API-Spiele, je Sportart und
// Spiel-Nummer der API. Der Admin trägt den Sender im Matchcenter-Detail ein.
//
// Gespeichert als EINE Zeile in der Tabelle "teams" wie die Vereinsnamen
// (kein SQL nötig).
export const FIXTURE_TV_ROW_ID = "__tv_sender__";

export interface FixtureTv {
  sport: Sport;
  fixtureId: string;
  // Anstoß (ISO), damit alte Einträge beim nächsten Speichern wegfallen.
  kickoff: string;
  channel: string;
}

export interface FixtureTvRow {
  kind: "fixtureTv";
  list: FixtureTv[];
}

// Einträge, deren Anstoß länger als das her ist, fliegen beim Speichern raus.
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

export function fixtureTvFor(list: FixtureTv[], sport: Sport, fixtureId: string): string | null {
  return list.find((e) => e.sport === sport && e.fixtureId === fixtureId)?.channel ?? null;
}

// Neue Liste mit gesetztem (oder bei leerem Text gelöschtem) Sender.
export function withFixtureTv(list: FixtureTv[], entry: FixtureTv, now = Date.now()): FixtureTv[] {
  const channel = entry.channel.trim();
  const rest = list.filter(
    (e) =>
      !(e.sport === entry.sport && e.fixtureId === entry.fixtureId) &&
      !(Date.parse(e.kickoff) < now - KEEP_MS)
  );
  return channel ? [...rest, { ...entry, channel }] : rest;
}
