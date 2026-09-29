// Zentrale Saison-Konfiguration für den Premium-Pass.
//
// WICHTIG: Das ist die einzige Stelle, die sich von Saison zu Saison ändert
// (z. B. Bundesliga-Saison -> WM -> nächste Bundesliga-Saison). Alle
// Premium-Belohnungen, die "saisonal einmalig" wirken sollen (Start-Glow,
// Neon-Pulse-Rahmen, Saison-Icon, Champion-Titel), lesen ihre Farben/ihren
// Namen NUR von hier. Eine neue Saison starten heißt also: diese paar Werte
// austauschen – es wird nichts neu gezeichnet oder programmiert.
export interface SeasonTheme {
  name: string;
  /** Kurzform, z. B. für den Champion-Titel ("Champion 2026/27"). */
  year: string;
  icon: string;
  colorFrom: string;
  colorTo: string;
}

export const SEASON_THEME: SeasonTheme = {
  name: "Bundesliga-Saison 2026/27",
  year: "2026/27",
  icon: "🏆",
  colorFrom: "#E8B34C",
  colorTo: "#3FA66B",
};
