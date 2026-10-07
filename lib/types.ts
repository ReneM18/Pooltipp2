// Interne Schlüssel der Sportarten (stehen so in der Datenbank: Spiele,
// Teams, Rangpunkte). NIE umbenennen – angezeigt wird SPORT_LABELS.
export type Sport = "Fußball" | "NFL" | "NBA" | "NHL" | "Handball";

// Alle Sportarten, die es im Code gibt – auch ausgeblendete. Für Daten
// (Rangpunkte, Vereine, Statistik), damit alte Einträge erhalten bleiben.
export const ALL_SPORTS: Sport[] = ["Fußball", "NFL", "NBA", "NHL", "Handball"];

// Ausgeblendete Sportarten: tauchen in der App nirgends mehr auf (Tippen,
// Spiel anlegen, Rangliste, Statistik, Vereine, Rang-Icons, Legende/
// Unsterblich), bleiben aber in Code und Datenbank erhalten. In den News
// bleiben sie wählbar (NEWS_SPORTS). WIEDER EINSCHALTEN: Sportart hier
// aus der Liste löschen (z. B. HIDDEN_SPORTS = []).
export const HIDDEN_SPORTS: Sport[] = ["Handball"];

/** Sportarten, die in der App aktiv sind (ohne ausgeblendete). */
export const SPORTS: Sport[] = ALL_SPORTS.filter((s) => !HIDDEN_SPORTS.includes(s));

/** true, wenn die Sportart aktiv (nicht ausgeblendet) ist. */
export function isSportActive(sport: Sport | null | undefined): boolean {
  return !!sport && SPORTS.includes(sport);
}

/**
 * Auswahl für Sportart-Felder im Admin: aktive Sportarten, plus die aktuell
 * gesetzte, falls sie ausgeblendet ist (damit ein altes Spiel beim
 * Bearbeiten nicht still die Sportart wechselt).
 */
export function sportOptions(current?: Sport | null): Sport[] {
  return current && !SPORTS.includes(current) ? [...SPORTS, current] : SPORTS;
}

// Anzeige-Namen der Sportarten. Ligen/Wettbewerbe (z. B. "NFL Regular
// Season") bleiben eigene Namen und werden hier nicht berührt.
export const SPORT_LABELS: Record<Sport, string> = {
  "Fußball": "Fußball",
  NFL: "Football",
  NBA: "Basketball",
  NHL: "Eishockey",
  Handball: "Handball",
};

export const SPORT_ICONS: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
  Handball: "🤾",
};

/** Anzeige-Name einer Sportart (auch für News-Sportarten). */
export function sportLabel(sport: string | null | undefined): string {
  if (!sport) return "";
  return (SPORT_LABELS as Record<string, string>)[sport] ?? sport;
}

// Sportarten für den News-Ticker: die Tipp-Sportarten plus weitere, zu denen
// es nur News gibt (keine Spiele, keine Rangpunkte). News liegen als JSON in
// der Datenbank, neue Sportarten brauchen deshalb kein SQL.
export type NewsSport = Sport | "Formel 1" | "MotoGP" | "Tennis" | "Darts";

export const NEWS_SPORTS: NewsSport[] = [...ALL_SPORTS, "Formel 1", "MotoGP", "Tennis", "Darts"];

export const NEWS_SPORT_ICONS: Record<NewsSport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
  "Formel 1": "🏎️",
  MotoGP: "🏍️",
  Tennis: "🎾",
  Handball: "🤾",
  Darts: "🎯",
};

export type JerseyStyle = "solid" | "streifen" | "aermel";

export const JERSEY_STYLES: { value: JerseyStyle; label: string }[] = [
  { value: "solid", label: "Einfarbig" },
  { value: "streifen", label: "Gestreift" },
  { value: "aermel", label: "Ärmel andersfarbig" },
];

/** Heimtrikot = Teamfarben wie angelegt, Auswärtstrikot = eigene Auswärtsfarben des Teams oder sonst die beiden Teamfarben vertauscht. */
export type JerseyVariant = "heim" | "auswaerts";

/** Vom Admin pro Spiel gewähltes Trikot eines Teams (Heim/Auswärts + Stil). */
export interface MatchJersey {
  variant: JerseyVariant;
  style: JerseyStyle;
}

export interface Team {
  id: string;
  name: string;
  sport: Sport;
  countryCode: string; // ISO 3166-1 alpha-2, z. B. "DE", "US"
  primaryColor: string; // Hex, z. B. "#DC052D"
  secondaryColor: string; // Hex, z. B. "#FFFFFF"
  jerseyStyle?: JerseyStyle; // Trikot-Stil des Heimtrikots (nicht NFL, dort Helm)
  // Dritte Farbe (optional) für Kragen, Ärmelenden und Zierstreifen. Fehlt
  // sie, sieht das Trikot aus wie bisher mit zwei Farben.
  tertiaryColor?: string;
  // Eigene Auswärtstrikot-Farben (optional). Fehlen sie, ist das
  // Auswärtstrikot die Heimfarben vertauscht (dritte Farbe wie daheim).
  awayPrimaryColor?: string;
  awaySecondaryColor?: string;
  awayTertiaryColor?: string;
  // Eigener Stil fürs Auswärtstrikot; fehlt er, gilt der Heim-Stil.
  awayJerseyStyle?: JerseyStyle;
  // Eigene Oberarm-/Ärmelfarbe (optional, Fußball/Handball/Eishockey). Fehlt
  // sie, sehen die Ärmel aus wie bisher.
  armColor?: string;
  awayArmColor?: string;
  isNationalTeam?: boolean; // Nationalmannschaft -> Icon zeigt die Landesflagge statt Trikot/Helm
  // Eigene Untergruppe in der Team-Auswahl (z. B. "Champions League"). Fehlt
  // sie, ergibt sich die Gruppe automatisch (siehe lib/teamGroups.ts).
  group?: string;
}

// "cancelled" = vom Admin abgesagt: alle Einsätze gingen zurück, das Spiel
// wird nicht gewertet (siehe supabase/spiel-absagen.sql).
export type MatchStatus = "upcoming" | "live" | "finished" | "cancelled";

// "score" = User tippt das genaue Ergebnis (z. B. 2:1).
// "1x2" = User tippt nur Heimsieg / Unentschieden / Auswärtssieg.
export type TipMode = "score" | "1x2";

// Optionale Zusatzfrage neben dem Ergebnis-Tipp (z. B. "Wer schießt das
// erste Tor?"). correctOptionIndex ist null, solange der Admin die richtige
// Antwort noch nicht gesetzt hat – erst dann werden abgegebene Antworten
// ausgewertet (von der Datenbank, siehe supabase/auswertung-server.sql).
export interface BonusQuestion {
  question: string;
  options: string[]; // 2–4 Antwortoptionen
  correctOptionIndex: number | null;
  bonusStars: number; // Sterne-Bonus bei richtiger Antwort
}

export interface Match {
  id: string;
  sport: Sport;
  competition: string; // z. B. "Bundesliga", "NFL", "NBA"
  matchday?: number;
  kickoff: string; // ISO 8601 timestamp – Anpfiff
  tipDeadline: string; // ISO 8601 timestamp – ab hier ist Tippen nicht mehr möglich
  homeTeamId: string;
  awayTeamId: string;
  // Einsatz in Sternen: 20 bei Booster-Spielen, sonst 0 (alte Spiele können
  // noch einen anderen Wert haben, zählt nicht mehr – die Datenbank entscheidet).
  fixedStake: number;
  booster?: boolean; // Booster-Spiel: Tipp nur mit 20 Sternen Einsatz (max. 3 pro Tag)
  status: MatchStatus;
  liveHomeScore: number | null;
  liveAwayScore: number | null;
  summaryVideoUrl: string | null; // z. B. YouTube-Link zur Spiel-Zusammenfassung
  tvChannel: string | null; // z. B. "Sky", "DAZN", "ORF1" – wo das Spiel live läuft
  tipMode: TipMode; // vom Admin pro Spiel frei wählbar, unabhängig von der Sportart
  bonusQuestion?: BonusQuestion | null; // optional, vom Admin pro Spiel angelegt
  // Trikots in diesem Spiel; fehlt es, tragen beide Teams ihr normales
  // Heimtrikot im Stil aus den Team-Einstellungen (wie vor den Trikots).
  homeJersey?: MatchJersey;
  awayJersey?: MatchJersey;
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
  // Saison-Pass-XP – siehe PoolScore-Konzept in lib/poolScore.ts. Steigt nur
  // durch den täglichen Bonus, nicht durch Tipp-Ergebnisse.
  passXP: number;
}
