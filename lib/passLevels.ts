export interface PassLevel {
  level: number;
  xpRequired: number; // kumulierte Punkte, ab denen dieses Level erreicht ist
  reward: string;
  icon: string;
}

export const PASS_LEVELS: PassLevel[] = [
  { level: 1, xpRequired: 0, reward: "Willkommens-Banner", icon: "🎉" },
  { level: 2, xpRequired: 200, reward: "Extra-Joker", icon: "🃏" },
  { level: 3, xpRequired: 500, reward: "Profil-Rahmen (Bronze)", icon: "🖼️" },
  { level: 4, xpRequired: 900, reward: "Streak-Retter", icon: "🛡️" },
  { level: 5, xpRequired: 1400, reward: "Profil-Rahmen (Silber)", icon: "🥈" },
  { level: 6, xpRequired: 2000, reward: "Badge „Perfekter Spieltag“", icon: "🎯" },
  { level: 7, xpRequired: 2700, reward: "Doppel-Sterne-Wochenende", icon: "✨" },
  { level: 8, xpRequired: 3500, reward: "Profil-Rahmen (Gold)", icon: "🥇" },
  { level: 9, xpRequired: 4500, reward: "Badge „Saison-Veteran“", icon: "🏅" },
  { level: 10, xpRequired: 6000, reward: "Titel „Tipp-König“", icon: "👑" },
];
