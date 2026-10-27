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
}
