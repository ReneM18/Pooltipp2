// Fußball-Tabellen über API-Sports (Rene, 27.10.2026: Pro-Plan). Ersetzt
// für Fußball die Tabellen von TheSportsDB (lib/sportsApi.ts). Abgefragt über
// GET /api/standings?league=<id> (app/api/standings/route.ts), der Schlüssel
// bleibt auf dem Server.

// Eine Zeile der Tabelle (aus standings[].all).
export interface StandingTeamRow {
  rank: number;
  team: string;
  logo: string | null;
  played: number;
  win: number;
  draw: number;
  loss: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDiff: number;
  points: number;
  // z. B. "Promotion - Champions League (League phase: )"
  description: string | null;
}

export interface StandingGroup {
  name: string;
  rows: StandingTeamRow[];
}

// Ligen mit Tabelle, IDs von API-Sports (v3.football.api-sports.io/leagues).
// country: ISO-Land für die Flagge, null = international.
export interface TableLeague {
  id: number;
  label: string;
  country: string | null;
}

export const TABLE_LEAGUES: readonly TableLeague[] = [
  { id: 218, label: "Bundesliga", country: "AT" },
  { id: 78, label: "Bundesliga", country: "DE" },
  { id: 79, label: "2. Bundesliga", country: "DE" },
  { id: 39, label: "Premier League", country: "GB-ENG" },
  { id: 140, label: "La Liga", country: "ES" },
  { id: 135, label: "Serie A", country: "IT" },
  { id: 2, label: "Champions League", country: null },
  { id: 3, label: "Europa League", country: null },
  { id: 848, label: "Conference League", country: null },
];

export function isTableLeague(id: number): boolean {
  return TABLE_LEAGUES.some((l) => l.id === id);
}

// Saison bei API-Sports = Startjahr (2026/27 → 2026). Ab Juli zählt das
// laufende Jahr (Wiener Zeit).
export function footballSeason(now = Date.now()): number {
  const [y, m] = new Date(now)
    .toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" })
    .split("-")
    .map(Number);
  return m >= 7 ? y : y - 1;
}

// Antwort von GET /api/standings.
export interface StandingsResponse {
  league: number;
  season: number;
  groups: StandingGroup[];
  fetchedAt?: number;
  error?: string;
}
