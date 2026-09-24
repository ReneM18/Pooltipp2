import { Sport } from "@/lib/types";
import { mockLeaderboardBySport } from "@/lib/mockLeaderboard";

export type RankName = "Bronze" | "Silber" | "Gold" | "Platin" | "Diamant";
export type SubTier = "III" | "II" | "I";

export interface RankTierDef {
  rank: RankName;
  sub: SubTier;
  minPoints: number;
}

// Fixe Punktegrenzen – gelten pro Sportart, unabhängig davon wie viele andere
// User gerade mitspielen. 5 Ränge x 3 Unterstufen (III = niedrigste, I = höchste).
export const RANK_LADDER: RankTierDef[] = [
  { rank: "Bronze", sub: "III", minPoints: 0 },
  { rank: "Bronze", sub: "II", minPoints: 100 },
  { rank: "Bronze", sub: "I", minPoints: 250 },
  { rank: "Silber", sub: "III", minPoints: 450 },
  { rank: "Silber", sub: "II", minPoints: 650 },
  { rank: "Silber", sub: "I", minPoints: 900 },
  { rank: "Gold", sub: "III", minPoints: 1150 },
  { rank: "Gold", sub: "II", minPoints: 1400 },
  { rank: "Gold", sub: "I", minPoints: 1700 },
  { rank: "Platin", sub: "III", minPoints: 2050 },
  { rank: "Platin", sub: "II", minPoints: 2450 },
  { rank: "Platin", sub: "I", minPoints: 2900 },
  { rank: "Diamant", sub: "III", minPoints: 3400 },
  { rank: "Diamant", sub: "II", minPoints: 4000 },
  { rank: "Diamant", sub: "I", minPoints: 4700 },
];

export const RANK_COLORS: Record<RankName, { from: string; to: string; text: string }> = {
  Bronze: { from: "#8a5a34", to: "#c98a4e", text: "#2a1a0a" },
  Silber: { from: "#9aa5ad", to: "#dfe6ea", text: "#1a1f22" },
  Gold: { from: "#e0a834", to: "#ffd873", text: "#2a1c00" },
  Platin: { from: "#5ad1c9", to: "#b8fff2", text: "#012b26" },
  Diamant: { from: "#7a8cff", to: "#c9d2ff", text: "#0a0f2b" },
};

export const SPORT_EMOJI: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export function getTierForPoints(points: number): RankTierDef {
  let current = RANK_LADDER[0];
  for (const tier of RANK_LADDER) {
    if (points >= tier.minPoints) current = tier;
    else break;
  }
  return current;
}

export function tierLabel(tier: RankTierDef): string {
  return `${tier.rank} ${tier.sub}`;
}

/** Die nächste Stufe nach den aktuellen Punkten, oder null wenn schon Diamant I erreicht ist. */
export function getNextTier(points: number): RankTierDef | null {
  const currentIndex = RANK_LADDER.findIndex((t) => t === getTierForPoints(points));
  return RANK_LADDER[currentIndex + 1] ?? null;
}

// Ein auswählbares Rang-Icon: entweder sportgebunden (Fußball Gold III, ...)
// oder das sportartübergreifende Elite-Icon "Sport-Allrounder".
export interface RankIconOption {
  id: string;
  kind: "sport" | "elite";
  sport?: Sport;
  label: string;
  icon: string;
  points?: number;
  colorFrom: string;
  colorTo: string;
  colorText: string;
}

const ELITE_COLORS = { from: "#ffd700", to: "#ff5fa2", text: "#1a0a12" };

/**
 * Ermittelt anhand der (aktuell noch statischen) Sport-Ranglisten, welche
 * Rang-Icons für den aktuell eingeloggten User verfügbar sind. Ein User
 * bekommt für jede Sportart, in der er einen Ranglisten-Eintrag hat, ein
 * eigenes Icon – und zusätzlich das Elite-Icon, sobald er in allen drei
 * Sportarten vertreten ist.
 */
export function getAvailableRankIcons(): RankIconOption[] {
  const options: RankIconOption[] = [];
  const sports = Object.keys(mockLeaderboardBySport) as Sport[];
  let sportsWithRank = 0;

  for (const sport of sports) {
    const entry = mockLeaderboardBySport[sport].find((e) => e.isCurrentUser);
    if (!entry) continue;
    sportsWithRank += 1;
    const tier = getTierForPoints(entry.points);
    const colors = RANK_COLORS[tier.rank];
    options.push({
      id: `sport-${sport}`,
      kind: "sport",
      sport,
      label: `${sport} ${tierLabel(tier)}`,
      icon: SPORT_EMOJI[sport],
      points: entry.points,
      colorFrom: colors.from,
      colorTo: colors.to,
      colorText: colors.text,
    });
  }

  if (sportsWithRank === sports.length) {
    options.push({
      id: "elite",
      kind: "elite",
      label: "Sport-Allrounder (Elite)",
      icon: "👑",
      colorFrom: ELITE_COLORS.from,
      colorTo: ELITE_COLORS.to,
      colorText: ELITE_COLORS.text,
    });
  }

  return options;
}

/** Bestes verfügbares Icon (Elite > höchster Rang) – dient als Standardauswahl. */
export function getBestRankIcon(options: RankIconOption[]): RankIconOption | null {
  if (options.length === 0) return null;
  const elite = options.find((o) => o.kind === "elite");
  if (elite) return elite;
  return [...options].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
}

/**
 * Für die GESAMT-Rangliste: schaut nach, in wie vielen der drei Sport-Ranglisten
 * dieser Name auftaucht. In allen dreien -> Elite-Icon (Allrounder). In ein oder
 * zwei Sportarten -> das Icon der Sportart, in der die Punktzahl am höchsten ist.
 * In keiner -> null (kein Icon).
 */
export function getIconForName(name: string): RankIconOption | null {
  const sports = Object.keys(mockLeaderboardBySport) as Sport[];
  const matches: { sport: Sport; points: number }[] = [];

  for (const sport of sports) {
    const entry = mockLeaderboardBySport[sport].find((e) => e.name === name);
    if (entry) matches.push({ sport, points: entry.points });
  }

  if (matches.length === 0) return null;

  if (matches.length === sports.length) {
    return {
      id: `elite-${name}`,
      kind: "elite",
      label: "Sport-Allrounder (Elite)",
      icon: "👑",
      colorFrom: ELITE_COLORS.from,
      colorTo: ELITE_COLORS.to,
      colorText: ELITE_COLORS.text,
    };
  }

  const best = matches.reduce((a, b) => (b.points > a.points ? b : a));
  const tier = getTierForPoints(best.points);
  const colors = RANK_COLORS[tier.rank];
  return {
    id: `sport-${best.sport}-${name}`,
    kind: "sport",
    sport: best.sport,
    label: `${best.sport} ${tierLabel(tier)}`,
    icon: SPORT_EMOJI[best.sport],
    points: best.points,
    colorFrom: colors.from,
    colorTo: colors.to,
    colorText: colors.text,
  };
}

// Für Freunde/Chat-Teilnehmer, für die wir (noch) keine echten Punktestände
// tracken: liefert ein deterministisches, aber stabiles Demo-Icon pro Name,
// damit die Namensliste nicht "nackt" wirkt, bis es echte Accounts gibt.
export function getMockRankIconForName(name: string): RankIconOption {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const sports: Sport[] = ["Fußball", "NFL", "NBA", "NHL"];
  const sport = sports[hash % sports.length];
  const points = 50 + (hash % 3200);
  const tier = getTierForPoints(points);
  const colors = RANK_COLORS[tier.rank];
  return {
    id: `mock-${name}`,
    kind: "sport",
    sport,
    label: `${sport} ${tierLabel(tier)}`,
    icon: SPORT_EMOJI[sport],
    points,
    colorFrom: colors.from,
    colorTo: colors.to,
    colorText: colors.text,
  };
}
