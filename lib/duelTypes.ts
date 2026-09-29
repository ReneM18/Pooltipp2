import { TipResultTier } from "./poolScore";

export type DuelStatus = "offen" | "ausgewertet";
export type DuelResult = "gewonnen" | "verloren" | "unentschieden";

// Kopf-an-Kopf-Duell zwischen dem aktuellen User und einem Freund, mit
// Sterne-Einsatz. WICHTIG: Es gibt kein Backend, also spielt der Freund hier
// nicht wirklich mit – sein Tipp wird beim Erstellen des Duells deterministisch
// simuliert (siehe DuelsContext) und direkt angezeigt, damit von Anfang an
// klar ist, dass es sich um eine Simulation handelt, bis es echte Konten gibt.
export interface Duel {
  id: string;
  opponentName: string;
  matchId: string;
  stake: number;
  status: DuelStatus;
  createdAt: string;
  // Simulierter Tipp des Freundes, direkt bei Erstellung festgelegt.
  opponentPredictedHome: number;
  opponentPredictedAway: number;
  opponentPickLabel: string; // Anzeige-Text, z. B. "2:1" oder "Heimsieg (1)"
  // Erst gesetzt, sobald das Spiel beendet und das Duell ausgewertet wurde.
  myTier?: TipResultTier;
  opponentTier?: TipResultTier;
  result?: DuelResult;
  starsCredited?: number; // tatsächlich gutgeschriebene Sterne (0, stake oder stake*2)
}
