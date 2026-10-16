import { classifyRankingTip, RANKING_POINTS } from "./poolScore";

// Texte zur "Dein Tipp"-Zeile während des Spiels (Tippkarte, Topspiel,
// Matchcenter, Tor-Toast) an einer Stelle (Rene, 16.10.2026): nur noch der
// Tipp kurz ("Sieg Frankfurt", "Unentschieden", "3:1") und die Punkte beim
// jetzigen Stand – keine Status-Wörter ("Stand jetzt", "Tendenz",
// "Gleichstand" …) mehr, die haben verwirrt.

// Kürzel und Zusätze, die nicht als Kurzname taugen ("FC", "1.", "e.V.").
const FILLER = /^(\d+\.?|e\.?\s?v\.?|[A-Z]{1,4}|[A-Z]\.?[A-Z]?\.?|de|di|la|le|del|von|am|an|der)$/;

/** Kurzname eines Vereins: letztes markantes Wort ("Eintracht Frankfurt" → "Frankfurt", "1. FC Köln" → "Köln", "Vienna Capitals" → "Capitals"). */
export function shortTeamName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  for (let i = words.length - 1; i >= 0; i--) {
    if (!FILLER.test(words[i])) return words[i];
  }
  return name.trim();
}

/** Tipp kurz für die Live-Zeile: "Sieg Frankfurt", "Unentschieden" bzw. "3:1". */
export function liveTipLabel(
  predictedHome: number,
  predictedAway: number,
  isOneXTwo: boolean,
  homeName: string,
  awayName: string,
  scoreText: string
): string {
  if (!isOneXTwo) return scoreText;
  const pick = Math.sign(predictedHome - predictedAway);
  if (pick === 0) return "Unentschieden";
  return `Sieg ${shortTeamName(pick > 0 ? homeName : awayName)}`;
}

/** Vorläufige feste Punkte beim jetzigen Stand (mit Anfänger-Schutz ein Minus als 0). */
export function livePoints(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isOneXTwo: boolean,
  shield: boolean
): number {
  const p = RANKING_POINTS[classifyRankingTip(predictedHome, predictedAway, actualHome, actualAway, isOneXTwo)];
  return shield ? Math.max(0, p) : p;
}

/** "+5", "−3" bzw. "0". */
export function livePointsText(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : "0";
}

/** Zusatz im Tor-Toast: "Dein Tipp: +5 vorläufig". */
export function liveTipToastText(points: number): string {
  return `Dein Tipp: ${livePointsText(points)} vorläufig`;
}
