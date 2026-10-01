import { TipResultTier } from "./poolScore";

// "pending" = Herausforderung verschickt, Gegner hat noch nicht reagiert.
// "offen" = Gegner hat angenommen (beide Einsätze sind weg), wartet auf
//           Spielende.
// "abgelehnt" = Gegner hat abgelehnt, Einsatz ging an den Herausforderer zurück.
// "verfallen" = Gegner hat nie reagiert, das Spiel ist inzwischen beendet -
//               Einsatz ging an den Herausforderer zurück.
// "ausgewertet" = Spiel ist vorbei, Ergebnis steht fest.
export type DuelStatus = "pending" | "offen" | "abgelehnt" | "verfallen" | "ausgewertet";
export type DuelResult = "challenger" | "opponent" | "unentschieden";

// Kopf-an-Kopf-Duell zwischen zwei ECHTEN, registrierten Konten (seit der
// Umstellung auf Supabase – vorher war der Gegner nur simuliert). Wird über
// die "duels"-Tabelle plus die SQL-Funktionen decline_duel/
// resolve_duels_for_match abgewickelt (siehe supabase/social-features.sql),
// weil Sterne auf ZWEI verschiedenen Konten gutgeschrieben werden müssen –
// das kann aus dem Browser einer einzelnen Person heraus nicht sicher
// passieren.
export interface Duel {
  id: string;
  challengerId: string;
  challengerName: string;
  opponentId: string;
  opponentName: string;
  matchId: string;
  stake: number;
  status: DuelStatus;
  createdAt: string;
  myTier?: TipResultTier;
  opponentTier?: TipResultTier;
  result?: DuelResult;
  starsCredited?: number;
  resolvedAt?: string;
}
