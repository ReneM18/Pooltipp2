export type ScoringMode = "ergebnis" | "dreiweg";

export interface League {
  id: string;
  name: string;
  description: string;
  code: string; // Einladungs-Code zum Beitreten
  scoringMode: ScoringMode;
  members: string[];
  // "creator" ist nur der Anzeige-Name (Nutzer können ihn jederzeit ändern).
  // Für Rechte-Prüfungen (Bearbeiten/Löschen) zählt allein creatorId – eine
  // pro Sitzung feste, nicht änderbare ID (siehe UserContext.userId). Sonst
  // könnte sich theoretisch jemand einfach in "Alex" umbenennen und hätte
  // Gründer-Rechte in der Demo-Tipprunde.
  creator: string;
  creatorId: string;
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
