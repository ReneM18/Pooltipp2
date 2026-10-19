import type { Sport } from "@/lib/types";

// Sportart-Abzeichen an der Ecke der Tippkarten (Rene, 19.10.2026:
// Sportart-Abzeichen, Schalter SPORT_BADGE). Runder Knopf mit dem
// Sport-Emoji oben links über dem Kartenrand, Rand in der Sportfarbe; das
// kleine Emoji im Kartenkopf entfällt dann. Rückbau: auf false setzen, dann
// sehen alle Karten genau wie vorher aus.
export const SPORT_BADGE: boolean = true;

/** Randfarbe des Abzeichens je Sportart. */
export const SPORT_BADGE_COLOR: Record<Sport, string> = {
  "Fußball": "#3fa66b",
  NFL: "#c9874a",
  NHL: "#7cc4f0",
  NBA: "#e0803a",
  Handball: "#c9a3f0",
};
