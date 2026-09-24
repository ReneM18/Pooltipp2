export type Sport = "Fußball" | "NFL" | "NBA" | "NHL";

export const SPORTS: Sport[] = ["Fußball", "NFL", "NBA", "NHL"];

export type JerseyStyle = "solid" | "streifen" | "aermel";

export const JERSEY_STYLES: { value: JerseyStyle; label: string }[] = [
  { value: "solid", label: "Einfarbig" },
  { value: "streifen", label: "Gestreift" },
  { value: "aermel", label: "Ärmel andersfarbig" },
];

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  countryCode: string; // ISO 3166-1 alpha-2, z. B. "DE", "US"
  primaryColor: string; // Hex, z. B. "#DC052D"
  secondaryColor: string; // Hex, z. B. "#FFFFFF"
  jerseyStyle?: JerseyStyle; // nur relevant für Fußball/NBA, wird bei NFL ignoriert
}

export type MatchStatus = "upcoming" | "live" | "finished";

// "score" = User tippt das genaue Ergebnis (z. B. 2:1).
// "1x2" = User tippt nur Heimsieg / Unentschieden / Auswärtssieg.
export type TipMode = "score" | "1x2";

export interface Match {
  id: string;
  sport: Sport;
  competition: string; // z. B. "Bundesliga", "NFL", "NBA"
  matchday?: number;
  kickoff: string; // ISO 8601 timestamp – Anpfiff
  tipDeadline: string; // ISO 8601 timestamp – ab hier ist Tippen nicht mehr möglich
  homeTeamId: string;
  awayTeamId: string;
  fixedStake: number; // vom Admin festgelegter Einsatz in Sternen, für alle User gleich
  status: MatchStatus;
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  summaryVideoUrl: string | null; // z. B. YouTube-Link zur Spiel-Zusammenfassung
  tvChannel: string | null; // z. B. "Sky", "DAZN", "ORF1" – wo das Spiel live läuft
  tipMode: TipMode; // vom Admin pro Spiel frei wählbar, unabhängig von der Sportart
}

export interface Tip {
  matchId: string;
  userId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  stake: number; // eingesetzte Gratis-Sterne
  submittedAt: string; // ISO 8601 timestamp
}

export interface UserProfile {
  id: string;
  displayName: string;
  freeStars: number;
  points: number;
}
