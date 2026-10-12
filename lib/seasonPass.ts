import { RANK_COLORS } from "./rankTiers";
import { SEASON_THEME } from "./seasonTheme";
import { PASS_LEVELS } from "./passLevels";
import { HALLOWEEN_2026, eventPhase, passClaimKey } from "./seasons";

// Rahmen-Logik für den Saison-Pass, getrennt von passLevels.ts gehalten,
// damit die Belohnungs-DATEN (Text/Icon je Level) unabhängig davon bleiben,
// WIE der aktive Rahmen berechnet wird.

export type FrameVariant =
  | "bronze"
  | "silber"
  | "gold"
  | "diamant"
  | "meister"
  | "neon-pulse"
  | "custom"
  | "kuerbis"
  | "spuk-glow";

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
 * 3) Höchste erreichte Gratis-Stufe (Bronze/Silber/Gold/Diamant/Saison-Meister,
 *    Level 3/5/7/9/10; Saison-Meister in den Farben der Saison)
 * Ohne freigeschaltete Stufe: kein Rahmen (null).
 */
export function getActiveFrame(
  passXP: number,
  hasPremiumPass: boolean,
  customColors: CustomFrameColors | null,
  /** Wahl im Profil (lib/passDisplay.ts): "auto", "none" oder eine Rahmen-Art. */
  choice?: string,
  /** Erreichte Stufen (claimed_milestones), für die Event-Rahmen. */
  claims: string[] = []
): ActiveFrame | null {
  if (choice === "none") return null;
  if (choice && choice !== "auto") {
    const chosen = getOwnedFrames(passXP, hasPremiumPass, customColors, claims).find((f) => f.variant === choice);
    if (chosen) return chosen;
  }
  // Während Halloween trägt man "automatisch" den besten Halloween-Rahmen.
  if (eventPhase(HALLOWEEN_2026, new Date()) === "laeuft") {
    const event = eventFrames(claims);
    if (event.length > 0) return event[event.length - 1];
  }
  return getBestFrame(passXP, hasPremiumPass, customColors);
}

// Halloween-Rahmen (lib/seasons/halloween2026.ts, Stufe 3 und 5). Bleiben
// nach dem Event erhalten.
function eventFrames(claims: string[]): ActiveFrame[] {
  const has = (level: number) => claims.includes(passClaimKey(HALLOWEEN_2026.theme.id, level));
  const frames: ActiveFrame[] = [];
  if (has(3)) frames.push({ variant: "kuerbis", colorFrom: "#FFB347", colorTo: "#E2561A", animated: false, label: "Kürbis" });
  if (has(5)) frames.push({ variant: "spuk-glow", colorFrom: "#9B5DE5", colorTo: "#FF8A2B", animated: true, label: "Spuk-Glow" });
  return frames;
}

/** Alle Rahmen, die man gerade tragen darf (schlechtester zuerst). */
export function getOwnedFrames(
  passXP: number,
  hasPremiumPass: boolean,
  customColors: CustomFrameColors | null,
  claims: string[] = []
): ActiveFrame[] {
  const owned: ActiveFrame[] = [];
  const free: [number, FrameVariant][] = [[3, "bronze"], [5, "silber"], [7, "gold"], [9, "diamant"], [10, "meister"]];
  for (const [level, variant] of free) {
    if (passXP >= xpForLevel(level)) owned.push(freeFrame(variant));
  }
  if (hasPremiumPass && passXP >= xpForLevel(2)) owned.push(neonFrame());
  if (hasPremiumPass && passXP >= xpForLevel(5) && customColors) owned.push(customFrame(customColors));
  owned.push(...eventFrames(claims));
  return owned;
}

function neonFrame(): ActiveFrame {
  return {
    variant: "neon-pulse",
    colorFrom: SEASON_THEME.colorFrom,
    colorTo: SEASON_THEME.colorTo,
    animated: true,
    label: `Neon-Pulse (${SEASON_THEME.name})`,
  };
}

function customFrame(customColors: CustomFrameColors): ActiveFrame {
  return {
    variant: "custom",
    colorFrom: customColors.from,
    colorTo: customColors.to,
    animated: false,
    label: "Eigene Farbmischung",
  };
}

function freeFrame(variant: FrameVariant): ActiveFrame {
  switch (variant) {
    case "meister":
      return { variant, colorFrom: SEASON_THEME.colorFrom, colorTo: SEASON_THEME.colorTo, animated: false, label: "Saison-Meister" };
    case "diamant":
      return { variant, colorFrom: RANK_COLORS.Diamant.from, colorTo: RANK_COLORS.Diamant.to, animated: false, label: "Saison-Diamant" };
    case "gold":
      return { variant, colorFrom: RANK_COLORS.Gold.from, colorTo: RANK_COLORS.Gold.to, animated: false, label: "Saison-Gold" };
    case "silber":
      return { variant, colorFrom: RANK_COLORS.Silber.from, colorTo: RANK_COLORS.Silber.to, animated: false, label: "Saison-Silber" };
    default:
      return { variant: "bronze", colorFrom: RANK_COLORS.Bronze.from, colorTo: RANK_COLORS.Bronze.to, animated: false, label: "Saison-Bronze" };
  }
}

function getBestFrame(
  passXP: number,
  hasPremiumPass: boolean,
  customColors: CustomFrameColors | null
): ActiveFrame | null {
  if (hasPremiumPass) {
    if (passXP >= xpForLevel(5) && customColors) return customFrame(customColors);
    if (passXP >= xpForLevel(2)) return neonFrame();
  }
  if (passXP >= xpForLevel(10)) return freeFrame("meister");
  if (passXP >= xpForLevel(9)) return freeFrame("diamant");
  if (passXP >= xpForLevel(7)) return freeFrame("gold");
  if (passXP >= xpForLevel(5)) return freeFrame("silber");
  if (passXP >= xpForLevel(3)) return freeFrame("bronze");
  return null;
}
