import type { SeasonData, SeasonTheme } from "./types";

// ============================================================================
// Saison "Winter 2026/27" – ENTWURF, noch nicht aktiv.
// ============================================================================
// Vorlage mit denselben 10 Stufen-Typen wie der Herbst. Alles, was mit
// "OFFEN" markiert ist, entscheidet Rene noch (Titel, Abzeichen, Sticker,
// Farben). Solange "draft: true" unten steht, wird diese Saison nie aktiv und
// nirgends angezeigt – der Herbst läuft dann über den 20.12. hinaus weiter.
//
// Aktivieren: Lücken füllen, 12 Sticker eintragen, "draft: true" löschen.
// Die id "winter-2026" danach NIE mehr ändern (steht dann in der Datenbank).

const theme: SeasonTheme = {
  id: "winter-2026",
  name: "Winter 2026/27",
  year: "2026/27",
  icon: "❄️", // OFFEN
  colorFrom: "#7FB3E0", // OFFEN
  colorTo: "#3B5B8C", // OFFEN
};

export const WINTER_2026: SeasonData = {
  theme,
  // Astronomischer Winter.
  startsOn: "2026-12-21",
  endsOn: "2027-03-19",
  draft: true,
  levels: [
    {
      level: 1,
      xpRequired: 0,
      kind: "banner",
      reward: "Willkommens-Banner",
      rewardWhere: "oben in deinem Profil, bis du Level 2 erreichst",
      icon: "🎉",
      premiumReward: `Start-Glow im Saison-Design „${theme.name}"`,
      premiumIcon: theme.icon,
    },
    {
      level: 2,
      xpRequired: 200,
      kind: "emotes",
      reward: "Emote-Paket „Winter“ (OFFEN: 12 Sticker)",
      rewardWhere: "im Community-Chat und bei Spiel-Kommentaren über den 🙂-Knopf",
      icon: "❄️",
      premiumReward: `Animierter Rahmen „Neon-Pulse" ums Profilbild`,
      premiumIcon: "🌟",
    },
    {
      level: 3,
      xpRequired: 500,
      kind: "frame",
      reward: "Profil-Rahmen „Saison-Bronze“",
      rewardWhere: "um dein Profilbild (Profil und oben im Menü)",
      icon: "🖼️",
      premiumReward: "Saison-Icon neben deinem Namen",
      premiumIcon: theme.icon,
    },
    {
      level: 4,
      xpRequired: 900,
      kind: "title",
      label: "OFFEN (Titel 1)",
      reward: "Titel „OFFEN (Titel 1)“",
      rewardWhere: "in deinem Profil und neben deinem Namen im Chat",
      icon: "❔",
      premiumReward: "Sieges-Animation bei gewonnenen Duellen",
      premiumIcon: "🏅",
    },
    {
      level: 5,
      xpRequired: 1400,
      kind: "frame",
      reward: "Profil-Rahmen „Saison-Silber“",
      rewardWhere: "um dein Profilbild (ersetzt Bronze)",
      icon: "🥈",
      premiumReward: "Eigener Farbwähler für deinen Rahmen",
      premiumIcon: "🎨",
    },
    {
      level: 6,
      xpRequired: 2000,
      kind: "title",
      label: "OFFEN (Titel 2)",
      reward: "Titel „OFFEN (Titel 2)“",
      rewardWhere: "in deinem Profil und im Chat (ersetzt Titel 1)",
      icon: "❔",
      premiumReward: "Große goldene Sternenexplosion bei exaktem Tipp",
      premiumIcon: "💥",
    },
    {
      level: 7,
      xpRequired: 2700,
      kind: "frame",
      reward: "Profil-Rahmen „Saison-Gold“",
      rewardWhere: "um dein Profilbild (ersetzt Silber)",
      icon: "🥇",
      premiumReward: "Tiefen-Statistik: deine Trefferquote vs. Community",
      premiumIcon: "📊",
      premiumNote: "Community-Wert ist noch ein Beispielwert",
    },
    {
      level: 8,
      xpRequired: 3500,
      kind: "title",
      label: "OFFEN (Titel 3)",
      reward: "Titel „OFFEN (Titel 3)“",
      rewardWhere: "in deinem Profil und im Chat (ersetzt Titel 2)",
      icon: "❔",
      premiumReward: "Animiertes Kronen-Icon + Profil-Hintergrundbanner",
      premiumIcon: "👑",
    },
    {
      level: 9,
      xpRequired: 4500,
      kind: "frame",
      reward: "Profil-Rahmen „Saison-Diamant“",
      rewardWhere: "um dein Profilbild (ersetzt Gold)",
      icon: "💎",
      premiumReward: "Automatische Saison-Rückblick-Karte zum Teilen",
      premiumIcon: "🗂️",
    },
    {
      level: 10,
      xpRequired: 6000,
      kind: "badge",
      label: "OFFEN (Abzeichen, z. B. Wintermeister 2026/27)",
      reward: "Abzeichen „OFFEN“ + OFFEN Coins",
      rewardWhere: "Abzeichen für immer im Profil und im Chat, Coins sofort aufs Konto",
      icon: "❔",
      // starsReward: OFFEN (Herbst: 50)
      premiumReward: `Titel „Champion ${theme.year}" + Abschluss-Feuerwerk`,
      premiumIcon: "🎆",
    },
  ],
  // OFFEN: 12 Sticker, ids mit "winter26-" beginnen lassen.
  emotes: [],
};
