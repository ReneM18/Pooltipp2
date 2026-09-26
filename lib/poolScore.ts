import { Sport } from "@/lib/types";
import { mockLeaderboardBySport } from "@/lib/mockLeaderboard";

// ============================================================================
// PoolScore – das zentrale Punkte-/Wirtschaftssystem von PoolTipp.
//
// Drei komplett entkoppelte Zähler:
//   1. Rangliste-Punkte (pro Sportart) – Elo-artig, kann steigen UND fallen,
//      treibt die Bronze→Diamant-Ränge. Wird NUR bei der Auswertung eines
//      Tipps verändert (siehe evaluatePoolScore) sowie durch Inaktivitäts-
//      Abklingen (siehe applyInactivityDecay).
//   2. Saison-Pass-XP – steigt NUR durch den täglichen Login-Bonus, niemals
//      durch Tipp-Ergebnisse. Lebt als "passXP" in UserContext.
//   3. Sterne – die Einsatz-/Shop-Währung. Wird bei Tipp-Abgabe eingesetzt
//      und hier bei der Auswertung (teilweise) zurückerstattet.
//
// Wichtig: Es gibt (noch) kein echtes Backend/Multiplayer – "Gegner" für ein
// bestimmtes Spiel werden deterministisch simuliert (simulateOpponents),
// damit sich das System schon jetzt "gegen echte Leute" anfühlt, obwohl nur
// der eigene Tipp tatsächlich gespeichert wird.
// ============================================================================

export type TipResultTier = "exakt" | "tendenz" | "falsch";

/** Reihenfolge der Tipp-Ergebnisse von schlechtestem zu bestem Ergebnis. */
export const TIER_ORDER: Record<TipResultTier, number> = {
  falsch: 0,
  tendenz: 1,
  exakt: 2,
};

/** Bestimmt, ob ein Tipp exakt, in der Tendenz oder falsch war. */
export function classifyTip(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number
): TipResultTier {
  if (predictedHome === actualHome && predictedAway === actualAway) return "exakt";
  const predictedDiff = Math.sign(predictedHome - predictedAway);
  const actualDiff = Math.sign(actualHome - actualAway);
  if (predictedDiff === actualDiff) return "tendenz";
  return "falsch";
}

// Basis-Rangliste-Punkte pro Ergebnis-Typ. "Falsch" kostet bewusst weniger
// als "Exakt" bringt (10 vs. -6), damit das System im Schnitt nicht zu stark
// deflationär wirkt (siehe Wirtschafts-Simulation während der Konzeption).
export const RANG_BASE_POINTS: Record<TipResultTier, number> = {
  exakt: 10,
  tendenz: 6,
  falsch: -6,
};

/**
 * Sterne-Gutschrift bei der Auswertung (wird auf das Guthaben aufgeschlagen,
 * nachdem der Einsatz bei Tipp-Abgabe bereits abgezogen wurde):
 *   - Exakt: Einsatz zurück + 50% Bonus obendrauf.
 *   - Tendenz: Einsatz zurück (Null-Ergebnis für die Sterne).
 *   - Falsch: nur 50% des Einsatzes gehen verloren, die Hälfte kommt zurück.
 */
export function starsDeltaForTier(tier: TipResultTier, stake: number): number {
  if (tier === "exakt") return Math.round(stake * 1.5);
  if (tier === "tendenz") return Math.round(stake);
  return Math.round(stake * 0.5);
}

export interface SimulatedOpponent {
  name: string;
  rangPunkte: number;
  tier: TipResultTier;
}

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

// Deterministischer Pseudo-Zufallsgenerator (mulberry32), damit dieselbe
// Spiel-/Ergebnis-Kombination bei jedem Aufruf exakt dieselben "Gegner"
// liefert – wichtig, damit eine Auswertung nicht bei jedem Re-Render
// unterschiedliche Ergebnisse zeigt.
function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickTier(random: number): TipResultTier {
  if (random < 0.12) return "exakt";
  if (random < 0.52) return "tendenz";
  return "falsch";
}

/**
 * Simuliert die "Gegner" für ein bestimmtes Spiel: eine Mischung aus den
 * namentlich bekannten Mock-Rangliste-Einträgen (für Narration, z. B. "Du
 * hast Marco T. ausgestochen!") und einer größeren anonymen Population, damit
 * die Prozent-Anzeige ("gegen X% durchgesetzt") auch bei wenigen echten
 * Namen realistisch wirkt. Rein deterministisch aus (matchId, sport,
 * Endstand) berechnet – kein echter Zufall, kein Re-Rendering-Flackern.
 */
export function simulateOpponents(
  matchId: string,
  sport: Sport,
  actualHome: number,
  actualAway: number
): SimulatedOpponent[] {
  const seed = hashString(`${matchId}:${sport}:${actualHome}:${actualAway}`);
  const rng = mulberry32(seed);
  const populationSize = 400 + Math.floor(rng() * 1600); // 400–2000 "Mitspieler"

  const namedOpponents = mockLeaderboardBySport[sport].filter((e) => !e.isCurrentUser);
  const opponents: SimulatedOpponent[] = [];

  for (const entry of namedOpponents) {
    const r = mulberry32(hashString(`${matchId}:${entry.name}`))();
    opponents.push({ name: entry.name, rangPunkte: entry.points, tier: pickTier(r) });
  }

  const avg =
    namedOpponents.length > 0
      ? namedOpponents.reduce((sum, e) => sum + e.points, 0) / namedOpponents.length
      : 500;

  for (let i = 0; i < populationSize; i++) {
    const spread = (rng() - 0.5) * avg * 1.4;
    const rangPunkte = Math.max(0, Math.round(avg + spread));
    const tier = pickTier(rng());
    opponents.push({ name: `Mitspieler #${i + 1}`, rangPunkte, tier });
  }

  return opponents;
}

export interface UpsetResult {
  bonus: number;
  malus: number;
  net: number;
}

const UPSET_CAP = 20;
const UPSET_SCALE = 100;

/**
 * Elo-artiger Überraschungs-Bonus/Malus, skalierbar für beliebig viele
 * Mitspieler: Statt jeden einzelnen Gegner zu vergleichen (das würde bei
 * sehr vielen Usern explodieren), wird nur der DURCHSCHNITT jeder
 * Ergebnis-Stufe (exakt/tendenz/falsch) herangezogen – dadurch bleibt die
 * Berechnung unabhängig von der Anzahl der Mitspieler und der Bonus/Malus
 * ist hart gedeckelt (±20 Punkte).
 */
export function computeUpsetAdjustment(
  myRangPunkte: number,
  myTier: TipResultTier,
  opponents: SimulatedOpponent[]
): UpsetResult {
  const myOrder = TIER_ORDER[myTier];
  const tiers: TipResultTier[] = ["falsch", "tendenz", "exakt"];

  let bonusRaw = 0;
  let malusRaw = 0;

  for (const tier of tiers) {
    const group = opponents.filter((o) => o.tier === tier);
    if (group.length === 0) continue;
    const avg = group.reduce((sum, o) => sum + o.rangPunkte, 0) / group.length;
    const order = TIER_ORDER[tier];

    if (order < myOrder) {
      // Diese Gruppe hat schlechter getippt als ich – bin ich gegen im
      // Rang eigentlich Bessere angetreten? Dann gibt's einen Bonus.
      bonusRaw += Math.max(0, avg - myRangPunkte);
    } else if (order > myOrder) {
      // Diese Gruppe hat besser getippt als ich – habe ich gegen im Rang
      // eigentlich Schlechtere verloren? Dann gibt's einen Malus.
      malusRaw += Math.max(0, myRangPunkte - avg);
    }
  }

  const bonus = Math.min(UPSET_CAP, bonusRaw / UPSET_SCALE);
  const malus = Math.min(UPSET_CAP, malusRaw / UPSET_SCALE);
  return { bonus, malus, net: bonus - malus };
}

/** Prozentsatz der simulierten Mitspieler, die schlechter getippt haben als ich. */
export function computeBeatPercent(myTier: TipResultTier, opponents: SimulatedOpponent[]): number {
  if (opponents.length === 0) return 0;
  const myOrder = TIER_ORDER[myTier];
  const worseCount = opponents.filter((o) => TIER_ORDER[o.tier] < myOrder).length;
  return Math.round((worseCount / opponents.length) * 100);
}

export interface PoolScoreResult {
  tier: TipResultTier;
  rangPointsBase: number;
  upset: UpsetResult;
  /** Gesamtänderung der Rangliste-Punkte (Basis + Überraschungs-Bonus/Malus), gerundet. */
  rangDelta: number;
  /** Sterne, die dem Guthaben gutgeschrieben werden (Einsatz war schon abgezogen). */
  starsCredit: number;
  /** Netto-Veränderung der Sterne relativ zum eingesetzten Betrag (für die Anzeige). */
  starsNet: number;
  beatPercent: number;
  opponents: SimulatedOpponent[];
}

export function evaluatePoolScore(params: {
  matchId: string;
  sport: Sport;
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  myRangPunkte: number;
}): PoolScoreResult {
  const tier = classifyTip(params.predictedHome, params.predictedAway, params.actualHome, params.actualAway);
  const rangPointsBase = RANG_BASE_POINTS[tier];
  const opponents = simulateOpponents(params.matchId, params.sport, params.actualHome, params.actualAway);
  const upset = computeUpsetAdjustment(params.myRangPunkte, tier, opponents);
  const rangDelta = Math.round(rangPointsBase + upset.net);
  const starsCredit = starsDeltaForTier(tier, params.stake);
  const starsNet = starsCredit - params.stake;
  const beatPercent = computeBeatPercent(tier, opponents);

  return { tier, rangPointsBase, upset, rangDelta, starsCredit, starsNet, beatPercent, opponents };
}

// ============================================================================
// Täglicher Bonus & Inaktivitäts-Abklingen
// ============================================================================

/** Sterne, die der tägliche Login-Bonus auszahlt. */
export const DAILY_BONUS_STARS = 8;
/** Saison-Pass-XP, die der tägliche Login-Bonus auszahlt (einziger Weg, wie der Pass steigt). */
export const DAILY_BONUS_XP = 100;
/** So viele Tage Inaktivität sind erlaubt, bevor Rangliste-Punkte abzuklingen beginnen. */
export const INACTIVITY_GRACE_DAYS = 14;
/** Danach: so viele Punkte Abzug pro weiterer inaktiver Woche (langsam, betrifft alle Ränge). */
export const INACTIVITY_DECAY_PER_WEEK = 5;

export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.floor(Math.abs(b - a) / (1000 * 60 * 60 * 24));
}

/** Wendet das langsame Abklingen auf einen einzelnen Rangliste-Punktestand an, nie unter 0. */
export function applyInactivityDecay(currentRang: number, daysInactive: number): number {
  if (daysInactive <= INACTIVITY_GRACE_DAYS) return currentRang;
  const inactiveWeeksAfterGrace = Math.floor((daysInactive - INACTIVITY_GRACE_DAYS) / 7);
  const decay = inactiveWeeksAfterGrace * INACTIVITY_DECAY_PER_WEEK;
  return Math.max(0, currentRang - decay);
}
