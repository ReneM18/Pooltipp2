import type { EventData } from "./types";

// ============================================================================
// Halloween-Event 2026 (Rene, 12.10.2026) – läuft zusätzlich zum Saison-Pass.
// ============================================================================
// Man sammelt Kürbisse (supabase/halloween-event.sql): +1 pro Tag fürs
// Reinschauen, +1 pro Tag mit mindestens einem Tipp. "xpRequired" heißt hier
// "so viele Kürbisse". Die Stufen stehen gleich wie beim Saison-Pass als
// "halloween-2026:1" … in claimed_milestones, darum funktionieren Sticker,
// Titel, Abzeichen und Rahmen überall und bleiben nach dem Event erhalten.
// Die id NIE ändern. Wie immer: nur Optik und Ehre, nie Coins oder Joker.

export const HALLOWEEN_2026: EventData = {
  theme: {
    id: "halloween-2026",
    name: "Halloween 2026",
    year: "2026",
    icon: "🎃",
    colorFrom: "#FF8A2B",
    colorTo: "#9B5DE5",
  },
  pointsName: "Kürbisse",
  pointIcon: "🎃",
  startsOn: "2026-10-15",
  endsOn: "2026-11-01",
  // Danach steht der Reiter noch ein paar Tage mit "Event beendet" da.
  visibleUntil: "2026-11-08",
  design: {
    unlockLevel: 2,
    // Wie beim Herbst: Hintergrund, Karten und Text bleiben im normalen
    // Design; halloween sind Knöpfe, Nachrichtenstreifen, lila Schimmer und
    // Fledermäuse statt Laub.
    colors: {
      pitch: "#0D1512",
      surface: "#172420",
      surfaceHover: "#1E2F29",
      edge: "#24332C",
      gold: "#E8B34C",
      goldDim: "#4A3D22",
      action: "#F07A1A",
      actionHover: "#FF9433",
      ink: "#F3F1EA",
      muted: "#8B9890",
      ticker: "#F07A1A",
    },
    glow: ["rgba(155, 93, 229, 0.09)", "rgba(240, 122, 26, 0.06)"],
    decoColors: ["#9B5DE5", "#F07A1A", "#6B3FA0"],
    decoShape: "bat",
    heroFrom: "#5B2A86",
    heroTo: "#2A1240",
  },
  levels: [
    {
      level: 1,
      xpRequired: 2,
      kind: "emotes",
      reward: "Halloween-Sticker (6 Stück)",
      icon: "👻",
      rewardWhere: "Im Chat und bei Kommentaren unter „Sticker“.",
      premiumReward: "",
      premiumIcon: "",
    },
    {
      level: 2,
      xpRequired: 5,
      kind: "banner",
      reward: "Halloween-Design für die App",
      icon: "🦇",
      rewardWhere: "Orange Knöpfe und Fledermäuse, bis zum 1.11. Abschaltbar im Profil.",
      premiumReward: "",
      premiumIcon: "",
    },
    {
      level: 3,
      xpRequired: 10,
      kind: "frame",
      reward: "Profil-Rahmen „Kürbis“",
      icon: "🎃",
      rewardWhere: "Ums Profilbild. Auswählen im Profil unter Pass-Belohnungen.",
      premiumReward: "",
      premiumIcon: "",
    },
    {
      level: 4,
      xpRequired: 16,
      kind: "title",
      label: "Geistertipper",
      reward: "Titel „Geistertipper“",
      icon: "🕯️",
      rewardWhere: "Neben deinem Namen im Profil und im Chat.",
      premiumReward: "",
      premiumIcon: "",
    },
    {
      level: 5,
      xpRequired: 23,
      kind: "frame",
      reward: "Profil-Rahmen „Spuk-Glow“ (leuchtend)",
      icon: "✨",
      rewardWhere: "Ums Profilbild. Auswählen im Profil unter Pass-Belohnungen.",
      premiumReward: "",
      premiumIcon: "",
    },
    {
      level: 6,
      xpRequired: 30,
      kind: "badge",
      label: "Halloween 2026",
      reward: "Abzeichen „Halloween 2026“",
      icon: "🎃",
      rewardWhere: "Für immer in deinem Profil und im Chat.",
      premiumReward: "",
      premiumIcon: "",
    },
  ],
  emotes: [
    { id: "hw26-kuerbis", label: "Kürbis", emoji: "🎃" },
    { id: "hw26-geist", label: "Geist", emoji: "👻" },
    { id: "hw26-fledermaus", label: "Fledermaus", emoji: "🦇" },
    { id: "hw26-spinne", label: "Spinne", emoji: "🕷️" },
    { id: "hw26-totenkopf", label: "Totenkopf", emoji: "💀" },
    { id: "hw26-suessigkeit", label: "Süßes", emoji: "🍬" },
  ],
};
