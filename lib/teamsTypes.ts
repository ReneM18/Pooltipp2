export type ScoringMode = "ergebnis" | "dreiweg";

export interface League {
  id: string;
  name: string;
  description: string;
  code: string; // Einladungs-Code zum Beitreten
  scoringMode: ScoringMode;
  members: string[];
  creator: string;
}

export interface LeagueMatch {
  id: string;
  leagueId: string;
  title: string; // z. B. "FC Bayern vs Borussia Dortmund"
  kickoff: string; // ISO 8601
  status: "upcoming" | "finished";
  finalHomeScore: number | null;
  finalAwayScore: number | null;
}

export interface LeagueTip {
  id: string;
  leagueId: string;
  matchId: string;
  author: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
}
