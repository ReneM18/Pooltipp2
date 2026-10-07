import { Sport, SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";

export type RankName = "Bronze" | "Silber" | "Gold" | "Platin" | "Diamant" | "Meister" | "GOAT";
export type SubTier = "I" | "II" | "III";

export interface RankTierDef {
  rank: RankName;
  /** Unterstufe I/II/III – fehlt beim GOAT, der nur eine einzige Stufe hat. */
  sub?: SubTier;
  minPoints: number;
}

// Fixe Punktegrenzen – gelten pro Sportart, unabhängig davon wie viele andere
// User gerade mitspielen. Passend zum Rankingsystem (feste Punkte + Bonus):
// ein guter Tipper (rund 15 Tipps pro Woche) erreicht GOAT nach etwa 15
// Monaten. 6 Ränge x 3 Unterstufen, aufsteigend gezählt (I = niedrigste,
// III = höchste – wie die 1–3 Winkel im Abzeichen),
// darüber als einzelne Stufe der GOAT.
export const RANK_LADDER: RankTierDef[] = [
  { rank: "Bronze", sub: "I", minPoints: 0 },
  { rank: "Bronze", sub: "II", minPoints: 20 },
  { rank: "Bronze", sub: "III", minPoints: 55 },
  { rank: "Silber", sub: "I", minPoints: 95 },
  { rank: "Silber", sub: "II", minPoints: 135 },
  { rank: "Silber", sub: "III", minPoints: 190 },
  { rank: "Gold", sub: "I", minPoints: 240 },
  { rank: "Gold", sub: "II", minPoints: 300 },
  { rank: "Gold", sub: "III", minPoints: 360 },
  { rank: "Platin", sub: "I", minPoints: 430 },
  { rank: "Platin", sub: "II", minPoints: 520 },
  { rank: "Platin", sub: "III", minPoints: 610 },
  { rank: "Diamant", sub: "I", minPoints: 720 },
  { rank: "Diamant", sub: "II", minPoints: 840 },
  { rank: "Diamant", sub: "III", minPoints: 990 },
  { rank: "Meister", sub: "I", minPoints: 1150 },
  { rank: "Meister", sub: "II", minPoints: 1350 },
  { rank: "Meister", sub: "III", minPoints: 1550 },
  // Ganz oben: eine einzige Stufe, ohne I/II/III.
  { rank: "GOAT", minPoints: 1900 },
];

// Football hat nur rund 285 Spiele im Jahr (272 + Playoffs), Fußball,
// Eishockey und Basketball viel mehr, als jemand tippt. Darum eigene, im
// Verhältnis 0,35 kleinere Grenzen: GOAT ab 650 statt 1.900. Grenzen werden
// nur gesenkt, niemand fällt dadurch einen Rang zurück.
// Die GOAT-Grenze steht auch in supabase/prestige.sql (goat_min_points).
const FOOTBALL_LADDER: RankTierDef[] = [
  { rank: "Bronze", sub: "I", minPoints: 0 },
  { rank: "Bronze", sub: "II", minPoints: 5 },
  { rank: "Bronze", sub: "III", minPoints: 20 },
  { rank: "Silber", sub: "I", minPoints: 35 },
  { rank: "Silber", sub: "II", minPoints: 45 },
  { rank: "Silber", sub: "III", minPoints: 65 },
  { rank: "Gold", sub: "I", minPoints: 85 },
  { rank: "Gold", sub: "II", minPoints: 105 },
  { rank: "Gold", sub: "III", minPoints: 125 },
  { rank: "Platin", sub: "I", minPoints: 150 },
  { rank: "Platin", sub: "II", minPoints: 180 },
  { rank: "Platin", sub: "III", minPoints: 215 },
  { rank: "Diamant", sub: "I", minPoints: 250 },
  { rank: "Diamant", sub: "II", minPoints: 295 },
  { rank: "Diamant", sub: "III", minPoints: 345 },
  { rank: "Meister", sub: "I", minPoints: 400 },
  { rank: "Meister", sub: "II", minPoints: 470 },
  { rank: "Meister", sub: "III", minPoints: 540 },
  { rank: "GOAT", minPoints: 650 },
];

/** Rang-Grenzen einer Sportart (ohne Sportart: die normalen Grenzen). */
export function rankLadder(sport?: Sport | null): RankTierDef[] {
  return sport === "NFL" ? FOOTBALL_LADDER : RANK_LADDER;
}

/** Ab so vielen Punkten ist man in dieser Sportart GOAT. */
export function goatMinPoints(sport?: Sport | null): number {
  const ladder = rankLadder(sport);
  return ladder[ladder.length - 1].minPoints;
}

/** Ab so vielen Punkten ist man in dieser Sportart Gold. */
function goldMinPoints(sport: Sport): number {
  return rankLadder(sport).find((t) => t.rank === "Gold")!.minPoints;
}

// Prestige: Wer in einer Sportart GOAT ist, kann freiwillig wieder bei 0
// anfangen und bekommt dafür einen Prestige-Stern (bis 5, danach Krone).
// Zählt pro Sportart, gespeichert in profiles.prestige (supabase/prestige.sql).
export type PrestigeBySport = Partial<Record<Sport, number>>;

export const PRESTIGE_MAX_STARS = 5;

export function prestigeLevel(prestige: PrestigeBySport | null | undefined, sport: Sport): number {
  const value = Number(prestige?.[sport] ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

/** Summe aller Prestige-Stufen über die aktiven Sportarten. */
export function totalPrestige(prestige: PrestigeBySport | null | undefined): number {
  return SPORTS.reduce((sum, sport) => sum + prestigeLevel(prestige, sport), 0);
}

/** Prestige als Zeichen: 1-5 Sterne, ab 6 Krone mit Zahl. */
export function prestigeMark(level: number): string {
  if (level <= 0) return "";
  return level <= PRESTIGE_MAX_STARS ? "★".repeat(level) : `👑${level}`;
}

export const RANK_COLORS: Record<RankName, { from: string; to: string; text: string }> = {
  Bronze: { from: "#8a5a34", to: "#c98a4e", text: "#2a1a0a" },
  Silber: { from: "#9aa5ad", to: "#dfe6ea", text: "#1a1f22" },
  Gold: { from: "#e0a834", to: "#ffd873", text: "#2a1c00" },
  Platin: { from: "#5ad1c9", to: "#b8fff2", text: "#012b26" },
  Diamant: { from: "#7a8cff", to: "#c9d2ff", text: "#0a0f2b" },
  // Feurig statt kühl – hebt sich bewusst von Diamants Blau/Lila ab, damit auf
  // einen Blick klar ist: das ist nochmal eine eigene, höhere Stufe.
  Meister: { from: "#F97316", to: "#DC2626", text: "#2a0800" },
  GOAT: { from: "#B07A12", to: "#FFE680", text: "#1a1204" },
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
  GOAT: "Größter aller Zeiten",
};

export const SPORT_EMOJI: Record<Sport, string> = SPORT_ICONS;

export function getTierForPoints(points: number, sport?: Sport | null): RankTierDef {
  const ladder = rankLadder(sport);
  let current = ladder[0];
  for (const tier of ladder) {
    if (points >= tier.minPoints) current = tier;
    else break;
  }
  return current;
}

export function tierLabel(tier: RankTierDef): string {
  return tier.sub ? `${tier.rank} ${tier.sub}` : tier.rank;
}

/** Die nächste Stufe nach den aktuellen Punkten, oder null wenn schon die höchste Stufe (GOAT) erreicht ist. */
export function getNextTier(points: number, sport?: Sport | null): RankTierDef | null {
  const ladder = rankLadder(sport);
  const currentIndex = ladder.findIndex((t) => t === getTierForPoints(points, sport));
  return ladder[currentIndex + 1] ?? null;
}

// Ein auswählbares Rang-Icon: entweder sportgebunden (Fußball Gold I, ...)
// oder sportartübergreifend: "Legende" (elite) bzw. "Unsterblich" (ganz oben).
export interface RankIconOption {
  id: string;
  kind: "sport" | "elite" | "unsterblich" | "prestige";
  sport?: Sport;
  label: string;
  icon: string;
  points?: number;
  colorFrom: string;
  colorTo: string;
  colorText: string;
  /** Rang-Titel (z.B. "Champion"), automatisch aus dem erreichten Rang. */
  title?: string;
  /** Rang + Unterstufe – bestimmen Form und Winkel des Abzeichens. */
  rank?: RankName;
  sub?: SubTier;
  /** Prestige-Stufe in dieser Sportart (Sterne am Abzeichen), 0 = keine. */
  prestige?: number;
}

// Gold -> gedecktes Lila statt des vorherigen Gold/Pink-Verlaufs: Pink war
// der einzige Fremdkörper im sonst grün-goldenen PoolTipp-Look. Gold->Lila
// ist ein gängiges "Legendary"-Farbschema (eine Stufe über den kühleren
// Diamant-Blautönen) und bleibt trotzdem hell genug für den dunklen Text.
const ELITE_COLORS = { from: "#FFD700", to: "#B694F6", text: "#241040" };
// Pokal statt Krone (die steht schon für "Premium", Level 8 im Saison-Pass)
// und statt Ziege (die gehört jetzt allein dem GOAT-Rang ganz oben).
const ELITE_ICON = "🏆";

// Das Elite-Icon (Legende) gibt es erst, wenn man in ALLEN
// Sportarten mindestens Gold erreicht hat – vorher reichte schon 1 Punkt pro
// Sportart, und über Demo-Daten bekam es sogar jeder Spieler. Gold gilt je
// Sportart mit deren eigener Grenze; wer dort schon Prestige gegangen ist,
// war schon GOAT und zählt darum immer als erreicht.
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

function isElite(pointsBySport: Partial<Record<Sport, number>>, prestige?: PrestigeBySport | null): boolean {
  return SPORTS.every((s) => prestigeLevel(prestige, s) > 0 || (pointsBySport[s] ?? 0) >= goldMinPoints(s));
}

// Das allerhöchste Abzeichen "Unsterblich": in ALLEN Sportarten GOAT.
export const GOAT_MIN_POINTS = RANK_LADDER.find((t) => t.rank === "GOAT")!.minPoints;
const UNSTERBLICH_COLORS = { from: "#B07A12", to: "#FFFFFF", text: "#1a1204" };

function unsterblichIcon(idSuffix = ""): RankIconOption {
  return {
    id: `unsterblich${idSuffix}`,
    kind: "unsterblich",
    label: "Unsterblich",
    icon: "🐐",
    colorFrom: UNSTERBLICH_COLORS.from,
    colorTo: UNSTERBLICH_COLORS.to,
    colorText: UNSTERBLICH_COLORS.text,
    title: "GOAT in allen Sportarten",
  };
}

// Wer in einer Sportart Prestige gegangen ist, war dort GOAT – Unsterblich
// bleibt darum auch nach dem Neustart erhalten.
export function isUnsterblich(pointsBySport: Partial<Record<Sport, number>>, prestige?: PrestigeBySport | null): boolean {
  return SPORTS.every((s) => prestigeLevel(prestige, s) > 0 || (pointsBySport[s] ?? 0) >= goatMinPoints(s));
}

/** Prestige-Abzeichen einer Sportart: GOAT-Abzeichen mit Prestige-Sternen, bleibt für immer wählbar. */
export function getPrestigeIcon(sport: Sport, level: number, idSuffix = ""): RankIconOption {
  const colors = RANK_COLORS.GOAT;
  return {
    id: `prestige-${sport}${idSuffix}`,
    kind: "prestige",
    sport,
    label: `${sportLabel(sport)} Prestige ${level}`,
    icon: SPORT_EMOJI[sport],
    colorFrom: colors.from,
    colorTo: colors.to,
    colorText: colors.text,
    title: `${level}x Prestige in ${sportLabel(sport)}`,
    rank: "GOAT",
    prestige: level,
  };
}

function prestigeIcons(prestige: PrestigeBySport | null | undefined, idSuffix = ""): RankIconOption[] {
  return SPORTS.filter((s) => prestigeLevel(prestige, s) > 0).map((s) => getPrestigeIcon(s, prestigeLevel(prestige, s), idSuffix));
}

/**
 * Rang-Icons, die der eingeloggte Spieler im Profil auswählen kann – aus
 * seinen echten Rangpunkten: ein Icon pro Sportart, in der er schon Punkte
 * hat, plus das Elite-Icon, wenn er überall mindestens Gold ist.
 */
export function getAvailableRankIcons(
  pointsBySport: Partial<Record<Sport, number>>,
  prestige?: PrestigeBySport | null
): RankIconOption[] {
  const options: RankIconOption[] = [];
  for (const sport of SPORTS) {
    const points = pointsBySport[sport] ?? 0;
    const level = prestigeLevel(prestige, sport);
    if (points > 0 || level > 0) options.push(getSportRankIcon(sport, points, "", level));
  }
  options.push(...prestigeIcons(prestige));
  if (isElite(pointsBySport, prestige)) options.push(eliteIcon());
  if (isUnsterblich(pointsBySport, prestige)) options.push(unsterblichIcon());
  return options;
}

/**
 * ALLE Rang-Icons fürs Profil, auch die noch nicht erreichten: eins pro
 * Sportart (ab dem ersten Punkt freigeschaltet) plus das Legende-Icon (ab
 * Gold in allen Sportarten). Gesperrte werden ausgegraut mit Hinweis gezeigt.
 */
export function getAllRankIcons(
  pointsBySport: Partial<Record<Sport, number>>,
  prestige?: PrestigeBySport | null
): { option: RankIconOption; unlocked: boolean; hint: string }[] {
  const list = SPORTS.map((sport) => {
    const points = pointsBySport[sport] ?? 0;
    const level = prestigeLevel(prestige, sport);
    return {
      option: getSportRankIcon(sport, points, "", level),
      unlocked: points > 0 || level > 0,
      hint: `Gib deinen ersten ${sportLabel(sport)}-Tipp ab`,
    };
  });
  // Prestige-Abzeichen erscheinen erst, wenn man sie hat (dann für immer).
  for (const option of prestigeIcons(prestige)) list.push({ option, unlocked: true, hint: "" });
  list.push({
    option: eliteIcon(),
    unlocked: isElite(pointsBySport, prestige),
    hint: `Gold in allen ${SPORTS.length} Sportarten`,
  });
  list.push({
    option: unsterblichIcon(),
    unlocked: isUnsterblich(pointsBySport, prestige),
    hint: `GOAT in allen ${SPORTS.length} Sportarten`,
  });
  return list;
}

/**
 * Bestes verfügbares Icon – dient als Standardauswahl. Reihenfolge:
 * Unsterblich > GOAT oder Prestige (meiste Sterne zuerst) > Legende >
 * höchster Rang. Der GOAT steht über der Legende, weil GOAT in einer
 * Sportart viel schwerer ist als Gold in allen Sportarten.
 */
export function getBestRankIcon(options: RankIconOption[]): RankIconOption | null {
  if (options.length === 0) return null;
  const unsterblich = options.find((o) => o.kind === "unsterblich");
  if (unsterblich) return unsterblich;
  const goatLike = options
    .filter((o) => o.kind === "prestige" || (o.kind === "sport" && o.rank === "GOAT"))
    .sort((a, b) => (b.prestige ?? 0) - (a.prestige ?? 0) || Number(a.kind === "prestige") - Number(b.kind === "prestige"))[0];
  if (goatLike) return goatLike;
  const best = [...options].filter((o) => o.kind === "sport").sort((a, b) => rankOrder(b) - rankOrder(a))[0];
  return options.find((o) => o.kind === "elite") ?? best ?? null;
}

// Höhe eines Sport-Abzeichens über alle Sportarten vergleichbar (Football
// hat kleinere Punkte-Grenzen, darum nach Stufe statt nach Punkten).
function rankOrder(option: RankIconOption): number {
  if (!option.sport) return -1;
  const ladder = rankLadder(option.sport);
  const tier = getTierForPoints(option.points ?? 0, option.sport);
  return ladder.indexOf(tier) * 1_000_000 + (option.points ?? 0);
}

/** Rang-Icon für eine Sportart und einen echten Punktestand. */
export function getSportRankIcon(sport: Sport, points: number, idSuffix = "", prestige = 0): RankIconOption {
  const tier = getTierForPoints(points, sport);
  const colors = RANK_COLORS[tier.rank];
  return {
    id: `sport-${sport}${idSuffix}`,
    kind: "sport",
    sport,
    label: `${sportLabel(sport)} ${tierLabel(tier)}`,
    icon: SPORT_EMOJI[sport],
    points,
    colorFrom: colors.from,
    colorTo: colors.to,
    colorText: colors.text,
    title: RANK_TITLES[tier.rank],
    rank: tier.rank,
    sub: tier.sub,
    prestige,
  };
}

/**
 * Für die GESAMT-Rangliste, Spielerseite und Chat: immer das stärkste
 * Abzeichen (Unsterblich > GOAT > Legende > höchster Rang), ganz ohne
 * Punkte -> kein Icon. Bei Gleichstand zählt die Reihenfolge der Sportarten.
 */
export function getIconForPoints(
  pointsBySport: Partial<Record<Sport, number>>,
  idSuffix = "",
  prestige?: PrestigeBySport | null
): RankIconOption | null {
  const best = getBestRankIcon(getAvailableRankIcons(pointsBySport, prestige));
  return best ? { ...best, id: `${best.id}${idSuffix}` } : null;
}

/**
 * Rang-Icon eines Spielers mit SEINER Auswahl aus dem Profil ("Dein
 * Rang-Icon"). Ist die gewählte Auswahl (noch) nicht freigeschaltet oder
 * fehlt sie, gilt wie bisher automatisch das stärkste Icon.
 */
export function getChosenIconForPoints(
  pointsBySport: Partial<Record<Sport, number>>,
  chosenId: string | null | undefined,
  idSuffix = "",
  prestige?: PrestigeBySport | null
): RankIconOption | null {
  if (chosenId) {
    const chosen = getAvailableRankIcons(pointsBySport, prestige).find((o) => o.id === chosenId);
    if (chosen) return { ...chosen, id: `${chosen.id}${idSuffix}` };
  }
  return getIconForPoints(pointsBySport, idSuffix, prestige);
}
