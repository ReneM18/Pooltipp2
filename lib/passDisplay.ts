import type { PassHonors } from "./seasons";
import type { ActiveFrame } from "./seasonPass";
import { xpForLevel } from "./seasonPass";

// Was ein Spieler von seinen Saison-Pass-Belohnungen herzeigt (Profil ->
// Einstellungen -> Pass-Belohnungen). Gespeichert fürs Konto in
// profile_extras.pass_display und für andere Spieler gespiegelt in
// profiles.pass_display (supabase/pass-deko.sql).
//
// Ablegen nimmt nichts weg: die Belohnung bleibt erreicht, sie wird nur nicht
// gezeigt und kann jederzeit wieder angelegt werden.
//
// Je Platz: "auto" (Standard, wie bisher: bester Rahmen, neuester Titel, alle
// Abzeichen), "none" (nichts zeigen) oder genau eine erreichte Belohnung.
// Ist die gewählte nicht (mehr) erreicht, z. B. nach dem Saisonwechsel, gilt
// wieder "auto".

export type DecoChoice = string; // "auto" | "none" | Rahmen-Art bzw. Text von Titel/Abzeichen

export interface PassDisplay {
  frame?: DecoChoice;
  title?: DecoChoice;
  badge?: DecoChoice;
  /** Premium Level 3: Saison-Icon neben dem eigenen Namen. Standard an. */
  nameIcon?: boolean;
}

/** Was andere Spieler sehen (profiles.pass_display). */
export interface PublicPassDisplay extends PassDisplay {
  /** Der Rahmen, den der Besitzer gerade trägt (null = keiner). */
  shownFrame?: Pick<ActiveFrame, "variant" | "colorFrom" | "colorTo" | "animated" | "label"> | null;
}

export const AUTO = "auto";
export const NONE = "none";

export function parsePassDisplay(raw: unknown): PassDisplay {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const r = raw as Record<string, unknown>;
  const out: PassDisplay = {};
  if (typeof r.frame === "string") out.frame = r.frame;
  if (typeof r.title === "string") out.title = r.title;
  if (typeof r.badge === "string") out.badge = r.badge;
  if (typeof r.nameIcon === "boolean") out.nameIcon = r.nameIcon;
  return out;
}

/** Gleiche Auswahl, egal in welcher Reihenfolge die Felder stehen. */
export function normalizePassDisplay(d: PassDisplay): PassDisplay {
  const out: PassDisplay = {};
  if (d.frame && d.frame !== AUTO) out.frame = d.frame;
  if (d.title && d.title !== AUTO) out.title = d.title;
  if (d.badge && d.badge !== AUTO) out.badge = d.badge;
  if (d.nameIcon === false) out.nameIcon = false;
  return out;
}

/** Titel und Abzeichen so, wie der Besitzer sie zeigen will. */
export function applyPassDisplay(honors: PassHonors, display: PassDisplay): PassHonors {
  const titleChoice = display.title ?? AUTO;
  const badgeChoice = display.badge ?? AUTO;
  let title = honors.title;
  if (titleChoice === NONE) title = null;
  // Gewählter Titel: nur wenn er erreicht ist. Titel aus allen Saisons zählen.
  else if (titleChoice !== AUTO && honors.allTitles?.some((t) => t.label === titleChoice)) {
    title = honors.allTitles.find((t) => t.label === titleChoice) ?? title;
  }
  let badges = honors.badges;
  if (badgeChoice === NONE) badges = [];
  else if (badgeChoice !== AUTO && badges.some((b) => b.label === badgeChoice)) {
    badges = badges.filter((b) => b.label === badgeChoice);
  }
  return { ...honors, title, badges };
}

// Gratis-Rahmen und das Level, ab dem sie erreicht sind (lib/seasonPass.ts).
const FREE_FRAME_LEVEL: Record<string, number> = { bronze: 3, silber: 5, gold: 7, diamant: 9, meister: 10 };

/**
 * Rahmen eines ANDEREN Spielers prüfen: Gratis-Rahmen nur, wenn seine
 * Saison-XP dafür reichen. (Premium-Rahmen sind bisher nur ein kostenloser
 * Test, die kann man von außen nicht prüfen.)
 */
export function verifiedOtherFrame(
  shown: PublicPassDisplay["shownFrame"],
  passXP: number | null
): PublicPassDisplay["shownFrame"] {
  if (!shown || typeof shown !== "object") return null;
  if (typeof shown.colorFrom !== "string" || typeof shown.colorTo !== "string") return null;
  if (!/^#[0-9a-fA-F]{3,8}$/.test(shown.colorFrom) || !/^#[0-9a-fA-F]{3,8}$/.test(shown.colorTo)) return null;
  const level = FREE_FRAME_LEVEL[shown.variant];
  if (level !== undefined && (passXP === null || passXP < xpForLevel(level))) return null;
  return {
    variant: shown.variant,
    colorFrom: shown.colorFrom,
    colorTo: shown.colorTo,
    animated: !!shown.animated,
    label: typeof shown.label === "string" ? shown.label.slice(0, 60) : "Rahmen",
  };
}
