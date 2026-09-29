export interface PassLevel {
  level: number;
  xpRequired: number; // kumulierte Punkte, ab denen dieses Level erreicht ist
  reward: string;
  icon: string;
  /** Sterne-Auszahlung statt Item – aktuell nur beim letzten Level (kostenlose Spur). */
  starsReward?: number;

  // Premium-Spur (freigeschaltet durch Kauf, siehe PREMIUM_PASS_PRICE): zusätzliche
  // Belohnung auf demselben Level, kommt zur kostenlosen Belohnung oben drauf.
  premiumReward?: string;
  premiumIcon?: string;
  premiumStarsReward?: number;
}

// Alle Belohnungen hier sind Saison-exklusiv: man bekommt sie NUR durchs Spielen
// (Punkte sammeln), sie sind nirgendwo im Shop kaufbar. Einzelne Level zahlen
// stattdessen Sterne aus, die dann wieder im Shop ausgegeben werden können.
//
// WICHTIG: Titel (z.B. "Tipp-Legende") sind bewusst KEINE Pass-Belohnung mehr –
// die verdient man sich automatisch über den erreichten Rang, siehe
// RANK_TITLES in lib/rankTiers.ts. So bleibt ein Titel an eine echte Leistung
// gekoppelt statt an ein beliebiges Pass-Level.
export const PASS_LEVELS: PassLevel[] = [
  { level: 1, xpRequired: 0, reward: "Willkommens-Banner", icon: "🎉" },
  {
    level: 2,
    xpRequired: 200,
    reward: "Emote-Paket „Community“",
    icon: "💬",
    premiumReward: "Profil-Rahmen „Neon-Pulse“ (animiert)",
    premiumIcon: "🌟",
  },
  {
    level: 3,
    xpRequired: 500,
    reward: "Profil-Rahmen „Saison-Bronze“",
    icon: "🖼️",
    premiumReward: "Goldene Schrift im Chat",
    premiumIcon: "💬",
  },
  {
    level: 4,
    xpRequired: 900,
    reward: "Kommentar-Sticker-Paket",
    icon: "🏷️",
    premiumReward: "Premium-Emote-Paket",
    premiumIcon: "🎭",
  },
  {
    level: 5,
    xpRequired: 1400,
    reward: "Profil-Rahmen „Saison-Silber“",
    icon: "🥈",
    premiumReward: "Profil-Banner „Saison-Elite“",
    premiumIcon: "🎌",
  },
  {
    level: 6,
    xpRequired: 2000,
    reward: "Animierter Namens-Effekt",
    icon: "✨",
    premiumReward: "50 Sterne Sofort-Bonus",
    premiumIcon: "⭐",
    premiumStarsReward: 50,
  },
  {
    level: 7,
    xpRequired: 2700,
    reward: "Profil-Rahmen „Saison-Gold“",
    icon: "🥇",
    premiumReward: "75 Sterne Sofort-Bonus",
    premiumIcon: "⭐",
    premiumStarsReward: 75,
  },
  {
    level: 8,
    xpRequired: 3500,
    reward: "30 Sterne Bonus",
    icon: "⭐",
    starsReward: 30,
    premiumReward: "Animiertes Kronen-Icon",
    premiumIcon: "👑",
  },
  {
    level: 9,
    xpRequired: 4500,
    reward: "Profil-Rahmen „Saison-Diamant“",
    icon: "💎",
    premiumReward: "100 Sterne Sofort-Bonus",
    premiumIcon: "⭐",
    premiumStarsReward: 100,
  },
  {
    level: 10,
    xpRequired: 6000,
    reward: "200 Sterne Bonus-Auszahlung",
    icon: "⭐",
    starsReward: 200,
    premiumReward: "+300 Sterne Extra-Bonus",
    premiumIcon: "⭐",
    premiumStarsReward: 300,
  },
];

// Einmaliger Kaufpreis für die Premium-Spur des Saison-Passes (echtes Geld,
// kein Glücksspielbezug: fester Preis für garantierte kosmetische Inhalte,
// keine Zufallskomponente).
export const PREMIUM_PASS_PRICE = "5,99 €";
