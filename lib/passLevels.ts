import { SEASON_THEME } from "./seasonTheme";

export interface PassLevel {
  level: number;
  xpRequired: number; // kumulierte Punkte, ab denen dieses Level erreicht ist
  reward: string;
  icon: string;
  /** Sterne-Auszahlung statt Item – aktuell nur auf der kostenlosen Spur. */
  starsReward?: number;

  // Premium-Spur (freigeschaltet durch Kauf, siehe PREMIUM_PASS_PRICE): zusätzliche
  // Belohnung auf demselben Level, kommt zur kostenlosen Belohnung oben drauf.
  premiumReward: string;
  premiumIcon: string;
}

// Alle Belohnungen hier sind Saison-exklusiv: man bekommt sie NUR durchs Spielen
// (Punkte sammeln), sie sind nirgendwo im Shop kaufbar. Einzelne Level zahlen
// stattdessen Sterne aus, die dann wieder im Shop ausgegeben werden können.
//
// Design-Prinzip (siehe Absprache): die Gratis-Spur ist bewusst billig zu
// pflegen (Rahmenfarben, kleine Sterne-Boni – nichts davon braucht neue
// Design-Arbeit). Die ganze "richtig coole" Seite steckt in der
// Premium-Spur, und zwar so, dass eine neue Saison nur SEASON_THEME
// austauscht statt etwas neu zu bauen:
//   - Level 2/5 (Rahmen): Farbe/Animation kommt aus SEASON_THEME bzw. der
//     eigenen Farbmischung, kein neues Bild nötig (siehe lib/seasonPass.ts).
//   - Level 1/3/10 (Saison-Icon, Glow, Titel): Text/Icon/Farbe kommen aus
//     SEASON_THEME, keine neue Grafik.
//   - Level 4/6 (Animationen), 7/9 (Statistik/Rückblick): einmal gebaute
//     Effekte/Seiten, die automatisch mit echten Daten laufen – kein
//     wiederkehrender Aufwand.
//
// WICHTIG: Titel (z.B. "Tipp-Legende") sind bewusst KEINE Pass-Belohnung mehr –
// die verdient man sich automatisch über den erreichten Rang, siehe
// RANK_TITLES in lib/rankTiers.ts. So bleibt ein Titel an eine echte Leistung
// gekoppelt statt an ein beliebiges Pass-Level. Der "Champion"-Titel auf
// Level 10 ist die Ausnahme: der ist explizit an DIESE Saison gebunden
// (siehe SEASON_THEME.year) statt an einen Rang.
export const PASS_LEVELS: PassLevel[] = [
  {
    level: 1,
    xpRequired: 0,
    reward: "Willkommens-Banner",
    icon: "🎉",
    premiumReward: `Start-Glow im Saison-Design „${SEASON_THEME.name}"`,
    premiumIcon: SEASON_THEME.icon,
  },
  {
    level: 2,
    xpRequired: 200,
    reward: "Emote-Paket „Community“",
    icon: "💬",
    premiumReward: `Animierter Rahmen „Neon-Pulse" ums Profilbild`,
    premiumIcon: "🌟",
  },
  {
    level: 3,
    xpRequired: 500,
    reward: "Profil-Rahmen „Saison-Bronze“",
    icon: "🖼️",
    premiumReward: "Saison-Icon neben deinem Namen",
    premiumIcon: SEASON_THEME.icon,
  },
  {
    level: 4,
    xpRequired: 900,
    reward: "20 Sterne Bonus",
    icon: "⭐",
    starsReward: 20,
    premiumReward: "Sieges-Animation bei gewonnenen Duellen",
    premiumIcon: "🏅",
  },
  {
    level: 5,
    xpRequired: 1400,
    reward: "Profil-Rahmen „Saison-Silber“",
    icon: "🥈",
    premiumReward: "Eigener Farbwähler für deinen Rahmen",
    premiumIcon: "🎨",
  },
  {
    level: 6,
    xpRequired: 2000,
    reward: "30 Sterne Bonus",
    icon: "⭐",
    starsReward: 30,
    premiumReward: "Große goldene Sternenexplosion bei exaktem Tipp",
    premiumIcon: "💥",
  },
  {
    level: 7,
    xpRequired: 2700,
    reward: "Profil-Rahmen „Saison-Gold“",
    icon: "🥇",
    premiumReward: "Tiefen-Statistik: deine Trefferquote vs. Community",
    premiumIcon: "📊",
  },
  {
    level: 8,
    xpRequired: 3500,
    reward: "40 Sterne Bonus",
    icon: "⭐",
    starsReward: 40,
    premiumReward: "Animiertes Kronen-Icon + Profil-Hintergrundbanner",
    premiumIcon: "👑",
  },
  {
    level: 9,
    xpRequired: 4500,
    reward: "Profil-Rahmen „Saison-Diamant“",
    icon: "💎",
    premiumReward: "Automatische Saison-Rückblick-Karte zum Teilen",
    premiumIcon: "🗂️",
  },
  {
    level: 10,
    xpRequired: 6000,
    reward: "200 Sterne Bonus-Auszahlung",
    icon: "⭐",
    starsReward: 200,
    premiumReward: `Titel „Champion ${SEASON_THEME.year}" + Abschluss-Feuerwerk`,
    premiumIcon: "🎆",
  },
];

// Einmaliger Kaufpreis für die Premium-Spur des Saison-Passes (echtes Geld,
// kein Glücksspielbezug: fester Preis für garantierte kosmetische/funktionale
// Inhalte, keine Zufallskomponente, keine zusätzlichen Sterne für Einsätze).
export const PREMIUM_PASS_PRICE = "5,99 €";
