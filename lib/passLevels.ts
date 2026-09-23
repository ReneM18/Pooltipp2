export interface PassLevel {
  level: number;
  xpRequired: number; // kumulierte Punkte, ab denen dieses Level erreicht ist
  reward: string;
  icon: string;
  /** Sterne-Auszahlung statt Item – aktuell nur beim letzten Level. */
  starsReward?: number;
}

// Alle Belohnungen hier sind Saison-exklusiv: man bekommt sie NUR durchs Spielen
// (Punkte sammeln), sie sind nirgendwo im Shop kaufbar. Das letzte Level zahlt
// stattdessen Sterne aus, die dann wieder im Shop ausgegeben werden können.
export const PASS_LEVELS: PassLevel[] = [
  { level: 1, xpRequired: 0, reward: "Willkommens-Banner", icon: "🎉" },
  { level: 2, xpRequired: 200, reward: "Emote-Paket „Community“", icon: "💬" },
  { level: 3, xpRequired: 500, reward: "Profil-Rahmen „Saison-Bronze“", icon: "🖼️" },
  { level: 4, xpRequired: 900, reward: "Titel „Aufsteiger der Saison“", icon: "📈" },
  { level: 5, xpRequired: 1400, reward: "Profil-Rahmen „Saison-Silber“", icon: "🥈" },
  { level: 6, xpRequired: 2000, reward: "Animierter Namens-Effekt", icon: "✨" },
  { level: 7, xpRequired: 2700, reward: "Profil-Rahmen „Saison-Gold“", icon: "🥇" },
  { level: 8, xpRequired: 3500, reward: "Titel „Tipp-Legende“", icon: "🏅" },
  { level: 9, xpRequired: 4500, reward: "Profil-Rahmen „Saison-Diamant“", icon: "💎" },
  { level: 10, xpRequired: 6000, reward: "200 Sterne Bonus-Auszahlung", icon: "⭐", starsReward: 200 },
];
