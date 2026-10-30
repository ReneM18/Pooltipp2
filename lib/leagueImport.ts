import type { Sport } from "./types";
import type { LeagueTeam } from "./live/providers/apiSports";
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
  // Vereine aus der App, wenn die API sie nicht liefert (Gratis-Plan).
  fallbackTeams?: readonly LeagueTeam[];
}

// ICE Hockey League ohne API (Rene, 30.10.2026: der Gratis-Plan für
// Eishockey sperrt die Vereinslisten). Namen wie bei API-Sports, damit die
// Verknüpfung später auch für Live-Stände passt. Neue Vereine einfach hier
// ergänzen oder im Admin von Hand anlegen.
const club = (apiName: string, country: string, arena: string): LeagueTeam => ({
  apiName,
  apiId: null,
  country,
  stadium: { name: arena, capacity: null, venueId: null },
});
const ICEHL_CLUBS: readonly LeagueTeam[] = [
  club("EC KAC", "AT", "Heidi Horten Arena"),
  club("EC VSV", "AT", "Stadthalle Villach"),
  club("EC Red Bull Salzburg", "AT", "Eisarena Salzburg"),
  club("Vienna Capitals", "AT", "Steffl Arena"),
  club("Black Wings Linz", "AT", "Linz AG Eisarena"),
  club("Graz 99ers", "AT", "Merkur Eisstadion"),
  club("HC Innsbruck", "AT", "TIWAG Arena"),
  club("Pioneers Vorarlberg", "AT", "Vorarlberghalle"),
  club("HC Bolzano", "IT", "Sparkasse Arena"),
  club("HC Pustertal", "IT", "Intercable Arena"),
  club("Fehérvár AV19", "HU", "Ifjabb Ocskay Gábor Jégcsarnok"),
  club("Olimpija Ljubljana", "SI", "Hala Tivoli"),
];

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
    fallbackTeams: ICEHL_CLUBS,
  },
];

export function findImportLeague(key: string): ImportLeague | undefined {
  return IMPORT_LEAGUES.find((l) => l.key === key);
}
