import type { Match, Sport } from "./types";
import { normalizeTeamName } from "./teamName";

// Wettbewerbe (z. B. "UEFA Champions League") legt der Admin einmal pro
// Sportart an und wählt sie beim Spiel-Anlegen nur noch aus. Ein Spiel
// speichert weiterhin nur den Namen als Text (Match.competition) – darum
// bleiben alte Spiele gültig, auch wenn ihr Wettbewerb gelöscht wird.
export interface Competition {
  id: string;
  name: string;
  sport: Sport;
}

// Die ganze Liste liegt als EINE Zeile in der vorhandenen Tabelle "teams"
// (gleiche Rechte: alle lesen, nur der Admin schreibt) – so braucht es
// keine neue Tabelle und kein SQL. Beim Laden der Teams wird diese Zeile
// herausgefiltert (siehe AppDataContext).
export const COMPETITIONS_ROW_ID = "__wettbewerbe__";

export interface CompetitionsRow {
  kind: "competitions";
  list: Competition[];
}

const DEFAULT_NAMES: Record<Sport, string[]> = {
  Fußball: [
    "UEFA Champions League",
    "UEFA Europa League",
    "UEFA Conference League",
    "UEFA Nations League",
    "FIFA Weltmeisterschaft",
    "UEFA Europameisterschaft",
    "WM-Qualifikation",
    "EM-Qualifikation",
    "Länderspiel",
    "Bundesliga",
    "2. Bundesliga",
    "DFB-Pokal",
    "Österreichische Bundesliga",
    "ÖFB-Cup",
    "Premier League",
    "La Liga",
    "Serie A",
  ],
  NFL: ["NFL Regular Season", "NFL Playoffs", "Super Bowl"],
  NBA: ["NBA Regular Season", "NBA Playoffs", "NBA Finals"],
  NHL: ["NHL Regular Season", "NHL Playoffs", "Stanley Cup Finale"],
  Handball: [],
};

export function newCompetitionId(): string {
  return `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Startliste, solange noch nichts gespeichert ist: gängige Wettbewerbe plus
// alle Wettbewerbe, die in bestehenden Spielen schon als Text stehen (damit
// nichts, was bisher benutzt wurde, in der Auswahl fehlt). Alles löschbar.
export function buildStartCompetitions(matches: Match[]): Competition[] {
  const list: Competition[] = [];
  let counter = 0;
  function add(name: string, sport: Sport) {
    const clean = name.trim();
    if (!clean || findDuplicateCompetition(list, clean, sport)) return;
    list.push({ id: `comp-start-${counter++}`, name: clean, sport });
  }
  (Object.keys(DEFAULT_NAMES) as Sport[]).forEach((sport) =>
    DEFAULT_NAMES[sport].forEach((name) => add(name, sport))
  );
  matches.forEach((m) => add(m.competition ?? "", m.sport));
  return list;
}

// Gibt es den Wettbewerb in dieser Sportart schon? Schreibweise egal
// (Groß/klein, Umlaute, Leer- und Satzzeichen) – wie bei den Teams.
export function findDuplicateCompetition(
  competitions: Competition[],
  name: string,
  sport: Sport,
  ignoreId?: string | null
): Competition | undefined {
  const key = normalizeTeamName(name);
  if (!key) return undefined;
  return competitions.find(
    (c) => c.sport === sport && c.id !== ignoreId && normalizeTeamName(c.name) === key
  );
}

export function competitionsForSport(competitions: Competition[], sport: Sport): Competition[] {
  return competitions
    .filter((c) => c.sport === sport)
    .sort((a, b) => a.name.localeCompare(b.name, "de"));
}
