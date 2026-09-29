// Saisonale Turnier-Modi: zeitlich begrenzte Sonder-Bereiche (z. B. WM, EM,
// ein Playoff-Wochenende), die eine Auswahl bestehender Spiele bündeln und
// eine eigene, auf genau diese Spiele begrenzte Mini-Rangliste zeigen –
// öffentlich für alle sichtbar (anders als die privaten Tipprunden mit
// Beitritts-Code, siehe lib/teamsTypes.ts).
export interface Tournament {
  id: string;
  name: string; // z. B. "Weltmeisterschaft 2026"
  description: string;
  icon: string; // Emoji, z. B. "🏆", "🌍", "⭐"
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  matchIds: string[]; // Teilmenge bestehender Match-IDs aus AppDataContext
  createdAt: string;
}

export type TournamentStatus = "kommend" | "aktiv" | "beendet";
