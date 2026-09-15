export type Sport = "Fußball" | "NFL" | "NBA";

export const SPORTS: Sport[] = ["Fußball", "NFL", "NBA"];

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

export interface Match {
  id: string;
  sport: Sport;
  competition: string; // z. B. "Bundesliga", "NFL", "NBA"
  matchday?: number;
  kickoff: string; // ISO 8601 timestamp
  homeTeamId: string;
  awayTeamId: string;
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
