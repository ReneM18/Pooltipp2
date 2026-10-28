// Aufstellungen und Statistik eines Fußballspiels über API-Sports (Rene,
// 27.10.2026: Pro-Plan, "Aufstellungen oder sonstige Info" im Detail).
// Abgefragt über GET /api/match-info?fixture=<id> (app/api/match-info/route.ts),
// der Schlüssel bleibt auf dem Server.

export interface LineupPlayer {
  name: string;
  number: number | null;
  pos: string | null; // "G", "D", "M", "F"
  // Platz auf dem Feld laut API ("Reihe:Spalte", Reihe 1 = Tor), sonst null.
  row: number | null;
  col: number | null;
}

export interface LineupTeam {
  team: string;
  logo: string | null;
  formation: string | null; // z. B. "4-2-3-1"
  coach: string | null;
  // Trikotfarben ohne "#" (z. B. "e30613"), sonst null.
  color: string | null;
  numberColor: string | null;
  keeperColor: string | null;
  startXI: LineupPlayer[];
  substitutes: LineupPlayer[];
}

export interface StatTeam {
  team: string;
  stats: { type: string; value: number | string | null }[];
}

export interface MatchInfoResponse {
  fixture: number;
  lineups: LineupTeam[];
  stats: StatTeam[];
  error?: string;
  // Fehler nur eines Teils (Rene, 27.10.2026: Fehlersuche), sonst fehlt der Grund.
  lineupsError?: string;
  statsError?: string;
}

// Vor dem Spiel (Rene, 28.10.2026: "mehr Statistik, zB die letzten
// Partien"): Form, direkter Vergleich und Tabellenplatz beider Teams.
// Abgefragt über GET /api/match-preview?fixture=<id>.

export interface PreviewGame {
  date: string; // ISO
  home: string;
  away: string;
  homeGoals: number;
  awayGoals: number;
}

export interface PreviewTeam {
  team: string;
  // Letzte Spiele, neuestes zuerst.
  form: PreviewGame[];
  // Tabellenplatz in der Liga dieses Spiels, sonst null (z. B. Cup).
  rank: number | null;
  points: number | null;
  played: number | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
}

export interface MatchPreviewResponse {
  fixture: number;
  teams: PreviewTeam[];
  h2h: PreviewGame[];
  error?: string;
}

// "S", "U" oder "N" aus Sicht von team.
export function gameResult(g: PreviewGame, team: string): "S" | "U" | "N" {
  const own = g.home === team ? g.homeGoals : g.awayGoals;
  const other = g.home === team ? g.awayGoals : g.homeGoals;
  return own > other ? "S" : own < other ? "N" : "U";
}
