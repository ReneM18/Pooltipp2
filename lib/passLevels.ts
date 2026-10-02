import { CURRENT_SEASON } from "./seasons";

export type { PassLevel } from "./seasons";

// Die Level der laufenden Saison. Die eigentlichen Daten (Belohnung, Wert,
// Hinweis, wo man sie sieht) stehen in lib/seasons/<saison>.ts – eine neue
// Saison ist nur eine neue Datenliste, kein neuer Code.
//
// Feste Rollen der drei Zähler:
//   - Saison-XP (passXP): zeigt Aktivität, füllt NUR diesen Pass.
//   - Rangpunkte: zeigen, wie gut man tippt (Rangliste), nie Belohnung hier.
//   - Sterne: nur zum Tippen. Der Pass gibt bewusst wenig davon (nur Level 10).
//
// Feste Belohnungsarten (RewardKind): banner, emotes, frame, title, badge.
// Wie jede Art funktioniert: frame -> lib/seasonPass.ts + SeasonFrame,
// emotes -> components/EmotePicker.tsx, title/badge -> components/PassHonors.tsx,
// Sterne -> claimPassRewards in lib/UserContext.tsx.
export const PASS_LEVELS = CURRENT_SEASON.levels;

// Einmaliger Kaufpreis für die Premium-Spur des Saison-Passes. Bezahlen ist
// noch NICHT eingebaut – der Knopf schaltet Premium nur zum Testen frei.
export const PREMIUM_PASS_PRICE = "5,99 €";
