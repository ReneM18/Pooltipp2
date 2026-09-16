// Anbindung an TheSportsDB (kostenlose öffentliche Test-Schnittstelle,
// Schlüssel "3"). Gut geeignet zum Prototypen; für den echten Live-Betrieb
// später einen eigenen, verlässlicheren Zugang (eigener Key/Anbieter) nutzen.

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/3";

// Liga-IDs bei TheSportsDB
export const LEAGUE_IDS: Record<string, string> = {
  Bundesliga: "4331",
  "Premier League": "4328",
  "NBA": "4387",
  "NFL": "4391",
};

export interface StandingRow {
  rank: string;
  teamName: string;
  played: string;
  win: string;
  draw: string;
  loss: string;
  points: string;
  badge?: string;
}

export interface ResultRow {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: string;
  awayScore: string;
  date: string;
}

export async function fetchStandings(leagueId: string, season: string): Promise<StandingRow[]> {
  const res = await fetch(`${BASE_URL}/lookuptable.php?l=${leagueId}&s=${season}`);
  if (!res.ok) throw new Error("Tabelle konnte nicht geladen werden");
  const data = await res.json();
  const table = data?.table ?? [];
  return table.map((row: any) => ({
    rank: row.intRank,
    teamName: row.strTeam,
    played: row.intPlayed,
    win: row.intWin,
    draw: row.intDraw,
    loss: row.intLoss,
    points: row.intPoints,
    badge: row.strBadge,
  }));
}

export async function fetchRecentResults(leagueId: string): Promise<ResultRow[]> {
  const res = await fetch(`${BASE_URL}/eventspastleague.php?id=${leagueId}`);
  if (!res.ok) throw new Error("Ergebnisse konnten nicht geladen werden");
  const data = await res.json();
  const events = data?.events ?? [];
  return events.slice(0, 15).map((ev: any) => ({
    id: ev.idEvent,
    homeTeam: ev.strHomeTeam,
    awayTeam: ev.strAwayTeam,
    homeScore: ev.intHomeScore,
    awayScore: ev.intAwayScore,
    date: ev.dateEvent,
  }));
}
