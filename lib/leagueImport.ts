import type { Sport } from "./types";
import { TABLE_LEAGUES } from "./standings";
import { LIVE_LEAGUES } from "./liveConfig";

// Ligen für Admin -> Teams -> "Vereine einer Liga von der API holen"
// (Rene, 30.10.2026). Fußball: alle nationalen Tabellen-Ligen aus
// lib/standings.ts. Eishockey: die ICE Hockey League ("es spielen auch Teams
// wie Bolzano aus Italien") – dort zählt die Liga als Untergruppe, nicht das
// Land; jedes Team behält sein eigenes Land.
//  - key: Wert für /api/league-teams?league=…
//  - country: Land der Liga (Flagge der Untergruppe, Land neuer Vereine,
//    wenn die API keins schickt)
//  - group: Untergruppe, wenn es noch keine passende gibt (sonst das Land)
//  - anyCountry: vorhandene Teams aus allen Ländern vorschlagen (nicht nur
//    aus dem Land der Liga)
export interface ImportLeague {
  key: string;
  sport: Sport;
  label: string;
  country: string;
  group?: string;
  groupNames?: readonly string[];
  anyCountry?: boolean;
  footballId?: number;
  hockey?: { names: readonly string[]; apiCountry: string };
}

const SECOND_LEAGUE_GROUPS: Record<number, string> = {
  219: "2. Liga Österreich",
  79: "2. Bundesliga Deutschland",
};

const ICEHL_NAMES = LIVE_LEAGUES.NHL?.find((l) => l.label === "ICE Hockey League")?.names ?? ["ice hockey league"];

export const IMPORT_LEAGUES: readonly ImportLeague[] = [
  ...TABLE_LEAGUES.filter((l): l is typeof l & { country: string } => l.country !== null).map(
    (l): ImportLeague => ({
      key: String(l.id),
      sport: "Fußball",
      label: l.label,
      country: l.country,
      footballId: l.id,
      ...(SECOND_LEAGUE_GROUPS[l.id] ? { group: SECOND_LEAGUE_GROUPS[l.id] } : {}),
    }),
  ),
  {
    key: "icehl",
    sport: "NHL",
    label: "ICE Hockey League",
    country: "AT",
    group: "ICE Hockey League",
    groupNames: ["ice hockey league", "icehl", "ebel", ...ICEHL_NAMES],
    anyCountry: true,
    hockey: { names: ICEHL_NAMES, apiCountry: "Austria" },
  },
];

export function findImportLeague(key: string): ImportLeague | undefined {
  return IMPORT_LEAGUES.find((l) => l.key === key);
}
