import type { JerseyVariant, Sport } from "./types";

// TV-Sender für Matchcenter-Spiele, die keine Tippspiele sind (Rene,
// 28.10.2026: "ich kann kein TV Sender einfügen bei den Spielen, die nicht
// Tippspiele sind"). Tippspiele behalten ihren Sender am Spiel
// (Match.tvChannel); hier stehen nur die API-Spiele, je Sportart und
// Spiel-Nummer der API. Der Admin trägt den Sender im Matchcenter-Detail ein.
//
// Dazu je Verein Heim- oder Auswärtstrikot (Rene, 30.10.2026: "ich muss
// zusätzlich ändern können ob heim oder auswärtstrikot"). Tippspiele haben
// ihre Wahl am Spiel (Match.homeJersey/awayJersey).
//
// Gespeichert als EINE Zeile in der Tabelle "teams" wie die Vereinsnamen
// (kein SQL nötig).
export const FIXTURE_TV_ROW_ID = "__tv_sender__";

export interface FixtureTv {
  sport: Sport;
  fixtureId: string;
  // Anstoß (ISO), damit alte Einträge beim nächsten Speichern wegfallen.
  kickoff: string;
  // "" = kein Sender (nur Trikotwahl).
  channel: string;
  // Trikot je Seite der API; ohne Angabe das Heimtrikot.
  homeJersey?: JerseyVariant;
  awayJersey?: JerseyVariant;
}

export interface FixtureTvRow {
  kind: "fixtureTv";
  list: FixtureTv[];
}

export type FixtureRef = Pick<FixtureTv, "sport" | "fixtureId" | "kickoff">;

// Einträge, deren Anstoß länger als das her ist, fliegen beim Speichern raus.
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function findEntry(list: FixtureTv[], sport: Sport, fixtureId: string): FixtureTv | undefined {
  return list.find((e) => e.sport === sport && e.fixtureId === fixtureId);
}

export function fixtureTvFor(list: FixtureTv[], sport: Sport, fixtureId: string): string | null {
  return findEntry(list, sport, fixtureId)?.channel || null;
}

export function fixtureJerseyFor(list: FixtureTv[], sport: Sport, fixtureId: string, side: "home" | "away"): JerseyVariant {
  const e = findEntry(list, sport, fixtureId);
  return (side === "home" ? e?.homeJersey : e?.awayJersey) ?? "heim";
}

// Eintrag eines Spiels ändern; alte und leere Einträge fliegen raus.
function withEntry(list: FixtureTv[], ref: FixtureRef, change: (e: FixtureTv) => FixtureTv, now: number): FixtureTv[] {
  const current = findEntry(list, ref.sport, ref.fixtureId) ?? { ...ref, channel: "" };
  const next = change({ ...current, kickoff: ref.kickoff });
  if (next.homeJersey === "heim") delete next.homeJersey;
  if (next.awayJersey === "heim") delete next.awayJersey;
  const rest = list.filter(
    (e) => !(e.sport === ref.sport && e.fixtureId === ref.fixtureId) && !(Date.parse(e.kickoff) < now - KEEP_MS)
  );
  return next.channel || next.homeJersey || next.awayJersey ? [...rest, next] : rest;
}

// Neue Liste mit gesetztem (oder bei leerem Text gelöschtem) Sender.
export function withFixtureTv(list: FixtureTv[], entry: FixtureTv, now = Date.now()): FixtureTv[] {
  const channel = entry.channel.trim();
  return withEntry(list, entry, (e) => ({ ...e, channel }), now);
}

// Neue Liste mit Heim-/Auswärtstrikot für eine Seite (API-Heim/-Gast).
export function withFixtureJersey(
  list: FixtureTv[],
  ref: FixtureRef,
  side: "home" | "away",
  variant: JerseyVariant,
  now = Date.now()
): FixtureTv[] {
  return withEntry(list, ref, (e) => ({ ...e, [side === "home" ? "homeJersey" : "awayJersey"]: variant }), now);
}
