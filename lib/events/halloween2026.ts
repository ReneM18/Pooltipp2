// ENTWURF Halloween-Event 2026 (nur für die Vorschau-Bilder, noch nicht gebaut).
export interface EventLevel {
  level: number;
  days: number; // so viele Bonus-Tage im Event braucht man
  icon: string;
  reward: string;
  where: string;
  accent?: string;
}

export const HALLOWEEN_2026 = {
  id: "halloween-2026",
  name: "Halloween-Event",
  icon: "🎃",
  startsOn: "2026-10-15",
  endsOn: "2026-11-02",
  colorFrom: "#F97316",
  colorTo: "#7C3AED",
  levels: [
    { level: 1, days: 1, icon: "🎃", accent: "⚽", reward: "Sticker „Kürbis-Ball“", where: "im Chat und bei Kommentaren" },
    { level: 2, days: 4, icon: "👻", reward: "Sticker „Torgeist“", where: "im Chat und bei Kommentaren" },
    { level: 3, days: 7, icon: "🦇", reward: "Sticker „Fledermaus“", where: "im Chat und bei Kommentaren" },
    { level: 4, days: 10, icon: "⭐", reward: "20 Sterne", where: "sofort aufs Konto" },
    { level: 5, days: 13, icon: "🏅", reward: "Abzeichen „Gruselprofi 2026“", where: "für immer im Profil und im Chat" },
  ] as EventLevel[],
};
