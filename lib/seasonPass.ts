import { RANK_COLORS } from "./rankTiers";
import { SEASON_THEME } from "./seasonTheme";
import { PASS_LEVELS } from "./passLevels";

// Rahmen-Logik für den Saison-Pass, getrennt von passLevels.ts gehalten,
// damit die Belohnungs-DATEN (Text/Icon je Level) unabhängig davon bleiben,
// WIE der aktive Rahmen berechnet wird.

export type FrameVariant = "bronze" | "silber" | "gold" | "diamant" | "neon-pulse" | "custom";

export interface ActiveFrame {
  variant: FrameVariant;
  colorFrom: string;
  colorTo: string;
  /** true = animierter Premium-Rahmen (siehe components/SeasonFrame.tsx). */
  animated: boolean;
  label: string;
}

export interface CustomFrameColors {
  from: string;
  to: string;
}

/** XP-Schwelle eines Pass-Levels – zentral hier statt an mehreren Stellen hart codiert. */
export function xpForLevel(level: number): number {
  return PASS_LEVELS.find((l) => l.level === level)?.xpRequired ?? Infinity;
}

/**
 * Ermittelt den aktuell aktiven Profil-Rahmen. Reihenfolge (höchste zuerst):
 * 1) Premium + eigene Farbmischung (Level 5 Premium: „Eigener Farbwähler")
 * 2) Premium + Neon-Pulse (Level 2 Premium), Farbe kommt aus SEASON_THEME
 * 3) Höchste erreichte Gratis-Stufe (Bronze/Silber/Gold/Diamant, Level 3/5/7/9)
 * Ohne freigeschaltete Stufe: kein Rahmen (null).
 */
export function getActiveFrame(
  passXP: number,
  hasPremiumPass: boolean,
  customColors: CustomFrameColors | null
): ActiveFrame | null {
  if (hasPremiumPass) {
    if (passXP >= xpForLevel(5) && customColors) {
      return {
        variant: "custom",
        colorFrom: customColors.from,
        colorTo: customColors.to,
        animated: false,
        label: "Eigene Farbmischung",
      };
    }
    if (passXP >= xpForLevel(2)) {
      return {
        variant: "neon-pulse",
        colorFrom: SEASON_THEME.colorFrom,
        colorTo: SEASON_THEME.colorTo,
        animated: true,
        label: `Neon-Pulse (${SEASON_THEME.name})`,
      };
    }
  }

  if (passXP >= xpForLevel(9)) {
    return { variant: "diamant", colorFrom: RANK_COLORS.Diamant.from, colorTo: RANK_COLORS.Diamant.to, animated: false, label: "Saison-Diamant" };
  }
  if (passXP >= xpForLevel(7)) {
    return { variant: "gold", colorFrom: RANK_COLORS.Gold.from, colorTo: RANK_COLORS.Gold.to, animated: false, label: "Saison-Gold" };
  }
  if (passXP >= xpForLevel(5)) {
    return { variant: "silber", colorFrom: RANK_COLORS.Silber.from, colorTo: RANK_COLORS.Silber.to, animated: false, label: "Saison-Silber" };
  }
  if (passXP >= xpForLevel(3)) {
    return { variant: "bronze", colorFrom: RANK_COLORS.Bronze.from, colorTo: RANK_COLORS.Bronze.to, animated: false, label: "Saison-Bronze" };
  }
  return null;
}
