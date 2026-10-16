import { classifyRankingTip, type TipResultTier } from "./poolScore";

// Texte zur "Dein Tipp"-Zeile während des Spiels (Tippkarte, Topspiel,
// Matchcenter, Tor-Toast) an einer Stelle (Rene, 16.10.2026): "richtig"
// klang mitten im Spiel endgültig, darum "Stand jetzt: …" bzw. nach Abpfiff
// ohne App-Endstand "Endstand: …".

const TIER_TEXT: Record<TipResultTier, string> = {
  exakt: "exakt",
  differenz: "Tordifferenz",
  tendenz: "Tendenz",
  falsch: "daneben",
};

/**
 * Wie der Tipp beim aktuellen Stand liegt, ohne Vorsatz: Ergebnistipp nach
 * Stufe ("Tendenz"), Siegertipp "liegt vorne"/"liegt hinten"/"Gleichstand",
 * Remis-Tipp "Remis passt"/"kein Remis". Nach Abpfiff beim Siegertipp
 * "gewonnen"/"verloren"/"Remis".
 */
export function liveTipStatus(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isOneXTwo: boolean,
  finished = false
): string {
  if (!isOneXTwo) {
    return TIER_TEXT[classifyRankingTip(predictedHome, predictedAway, actualHome, actualAway, false)];
  }
  const pick = Math.sign(predictedHome - predictedAway);
  const now = Math.sign(actualHome - actualAway);
  if (pick === 0) return now === 0 ? "Remis passt" : "kein Remis";
  if (now === 0) return finished ? "Remis" : "Gleichstand";
  if (now === pick) return finished ? "gewonnen" : "liegt vorne";
  return finished ? "verloren" : "liegt hinten";
}

/** "Stand jetzt: Tendenz" bzw. nach Abpfiff "Endstand: Tendenz". */
export function liveTipPhrase(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isOneXTwo: boolean,
  finished: boolean
): string {
  const status = liveTipStatus(predictedHome, predictedAway, actualHome, actualAway, isOneXTwo, finished);
  return `${finished ? "Endstand" : "Stand jetzt"}: ${status}`;
}

/** Zusatz im Tor-Toast: "Dein Tipp: Stand jetzt Tendenz". */
export function liveTipToastText(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isOneXTwo: boolean
): string {
  return `Dein Tipp: Stand jetzt ${liveTipStatus(predictedHome, predictedAway, actualHome, actualAway, isOneXTwo)}`;
}
