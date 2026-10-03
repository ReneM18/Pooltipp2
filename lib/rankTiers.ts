import { Sport } from "@/lib/types";

export type RankName = "Bronze" | "Silber" | "Gold" | "Platin" | "Diamant" | "Meister";
export type SubTier = "III" | "II" | "I";

export interface RankTierDef {
  rank: RankName;
  sub: SubTier;
  minPoints: number;
}

// Fixe Punktegrenzen – gelten pro Sportart, unabhängig davon wie viele andere
// User gerade mitspielen. 6 Ränge x 3 Unterstufen (III = niedrigste, I = höchste).
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
  { rank: "Meister", sub: "III", minPoints: 5500 },
  { rank: "Meister", sub: "II", minPoints: 6400 },
  { rank: "Meister", sub: "I", minPoints: 7400 },
];

export const RANK_COLORS: Record<RankName, { from: string; to: string; text: string }> = {
  Bronze: { from: "#8a5a34", to: "#c98a4e", text: "#2a1a0a" },
  Silber: { from: "#9aa5ad", to: "#dfe6ea", text: "#1a1f22" },
  Gold: { from: "#e0a834", to: "#ffd873", text: "#2a1c00" },
  Platin: { from: "#5ad1c9", to: "#b8fff2", text: "#012b26" },
  Diamant: { from: "#7a8cff", to: "#c9d2ff", text: "#0a0f2b" },
  // Feurig statt kühl – hebt sich bewusst von Diamants Blau/Lila ab, damit auf
  // einen Blick klar ist: das ist nochmal eine eigene, höhere Stufe.
  Meister: { from: "#F97316", to: "#DC2626", text: "#2a0800" },
};

// Titel werden NICHT mehr über den Saison-Pass verteilt, sondern verdient
// man sich automatisch über den erreichten Rang (Punkte) – pro Hauptrang
// ein fester Titel, unabhängig von der Sportart. So bleibt ein Titel immer
// an eine echte Leistung gekoppelt statt an ein Pass-Level.
export const RANK_TITLES: Record<RankName, string> = {
  Bronze: "Neuling",
  Silber: "Herausforderer",
  Gold: "Champion",
  Platin: "VIP-Tipper",
  Diamant: "Unaufhaltbar",
  Meister: "Elite-Tipper",
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

/** Die nächste Stufe nach den aktuellen Punkten, oder null wenn schon die höchste Stufe (Meister I) erreicht ist. */
export function getNextTier(points: number): RankTierDef | null {
  const currentIndex = RANK_LADDER.findIndex((t) => t === getTierForPoints(points));
  return RANK_LADDER[currentIndex + 1] ?? null;
}

// Ein auswählbares Rang-Icon: entweder sportgebunden (Fußball Gold III, ...)
// oder das sportartübergreifende Elite-Icon "Legende".
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
  /** Rang-Titel (z.B. "Champion"), automatisch aus dem erreichten Rang. */
  title?: string;
}

// Gold -> gedecktes Lila statt des vorherigen Gold/Pink-Verlaufs: Pink war
// der einzige Fremdkörper im sonst grün-goldenen PoolTipp-Look. Gold->Lila
// ist ein gängiges "Legendary"-Farbschema (eine Stufe über den kühleren
// Diamant-Blautönen) und bleibt trotzdem hell genug für den dunklen Text.
const ELITE_COLORS = { from: "#FFD700", to: "#B694F6", text: "#241040" };
// GOAT-Ziege statt Krone: die Krone steht in der App schon für "Premium"
// (siehe Level 8 im Saison-Pass), ein zweites Krone-Symbol fürs Elite-
// Rang-Icon war verwirrend doppelt belegt. GOAT ("Greatest Of All Time")
// ist im Sport-Slang etabliert und passt inhaltlich zu "bester in allen
// Sportarten zugleich".
const ELITE_ICON = "🐐";

// Das Elite-Icon (Legende) gibt es erst, wenn man in ALLEN
// Sportarten mindestens Gold erreicht hat – vorher reichte schon 1 Punkt pro
// Sportart, und über Demo-Daten bekam es sogar jeder Spieler.
export const ELITE_MIN_POINTS = RANK_LADDER.find((t) => t.rank === "Gold")!.minPoints;

function eliteIcon(idSuffix = ""): RankIconOption {
  return {
    id: `elite${idSuffix}`,
    kind: "elite",
    label: "Legende",
    icon: ELITE_ICON,
    colorFrom: ELITE_COLORS.from,
    colorTo: ELITE_COLORS.to,
    colorText: ELITE_COLORS.text,
    title: "alle Sportarten mindestens Gold",
  };
}

function isElite(pointsBySport: Partial<Record<Sport, number>>): boolean {
  return (Object.keys(SPORT_EMOJI) as Sport[]).every((s) => (pointsBySport[s] ?? 0) >= ELITE_MIN_POINTS);
}

/**
 * Rang-Icons, die der eingeloggte Spieler im Profil auswählen kann – aus
 * seinen echten Rangpunkten: ein Icon pro Sportart, in der er schon Punkte
 * hat, plus das Elite-Icon, wenn er überall mindestens Gold ist.
 */
export function getAvailableRankIcons(pointsBySport: Partial<Record<Sport, number>>): RankIconOption[] {
  const options: RankIconOption[] = [];
  for (const sport of Object.keys(SPORT_EMOJI) as Sport[]) {
    const points = pointsBySport[sport] ?? 0;
    if (points > 0) options.push(getSportRankIcon(sport, points));
  }
  if (isElite(pointsBySport)) options.push(eliteIcon());
  return options;
}

/** Bestes verfügbares Icon (Elite > höchster Rang) – dient als Standardauswahl. */
export function getBestRankIcon(options: RankIconOption[]): RankIconOption | null {
  if (options.length === 0) return null;
  const elite = options.find((o) => o.kind === "elite");
  if (elite) return elite;
  return [...options].sort((a, b) => (b.points ?? 0) - (a.points ?? 0))[0];
}

/** Rang-Icon für eine Sportart und einen echten Punktestand. */
export function getSportRankIcon(sport: Sport, points: number, idSuffix = ""): RankIconOption {
  const tier = getTierForPoints(points);
  const colors = RANK_COLORS[tier.rank];
  return {
    id: `sport-${sport}${idSuffix}`,
    kind: "sport",
    sport,
    label: `${sport} ${tierLabel(tier)}`,
    icon: SPORT_EMOJI[sport],
    points,
    colorFrom: colors.from,
    colorTo: colors.to,
    colorText: colors.text,
    title: RANK_TITLES[tier.rank],
  };
}

/**
 * Für die GESAMT-Rangliste, Spielerseite und Chat: Elite-Icon, wenn der
 * Spieler in allen Sportarten mindestens Gold ist, sonst das Icon seiner
 * stärksten Sportart, ganz ohne Punkte -> kein Icon.
 */
export function getIconForPoints(
  pointsBySport: Partial<Record<Sport, number>>,
  idSuffix = ""
): RankIconOption | null {
  const sports = Object.keys(SPORT_EMOJI) as Sport[];
  const withPoints = sports.filter((s) => (pointsBySport[s] ?? 0) > 0);
  if (withPoints.length === 0) return null;
  if (isElite(pointsBySport)) return eliteIcon(idSuffix);
  const best = withPoints.reduce((a, b) => ((pointsBySport[b] ?? 0) > (pointsBySport[a] ?? 0) ? b : a));
  return getSportRankIcon(best, pointsBySport[best] ?? 0, idSuffix);
}
