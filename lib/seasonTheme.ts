// Saison-Farben/-Name der laufenden Saison. Die Daten selbst stehen in
// lib/seasons/ (eine Datei pro Saison) – hier nur die bequeme Abkürzung, die
// überall in der App benutzt wird.
import { CURRENT_SEASON } from "./seasons";

export type { SeasonTheme } from "./seasons";

export const SEASON_THEME = CURRENT_SEASON.theme;
