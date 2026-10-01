export type ScoringMode = "ergebnis" | "dreiweg";

// Private Tipprunde. Liegt in Supabase (Tabelle "leagues", siehe
// supabase/tipprunden.sql) und ist nur für ihre Mitglieder sichtbar.
export interface League {
  id: string;
  name: string;
  description: string;
  code: string; // Einladungs-Code zum Beitreten
  scoringMode: ScoringMode;
  // Echte Supabase-Nutzer-ID des Gründers. Nur er darf die Runde bearbeiten,
  // Spiele anlegen und Endstände eintragen (auch in der Datenbank geprüft).
  creatorId: string;
  memberCount: number;
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
  userId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
}

// Ein Mitglied samt Liga-Punkten – die Datenbank (league_leaderboard)
// rechnet die Punkte, damit sie niemand im Browser fälschen kann.
export interface LeagueMember {
  userId: string;
  displayName: string;
  points: number;
  exactTips: number;
  scoredTips: number;
  isCreator: boolean;
}
