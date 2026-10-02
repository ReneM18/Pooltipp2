// ============================================================================
// PoolScore – das zentrale Punkte-/Wirtschaftssystem von PoolTipp.
//
// Drei komplett entkoppelte Zähler:
//   1. Rangliste-Punkte (pro Sportart) – Summe der Punkte aus den eigenen
//      Tipps, treibt die Bronze→Diamant-Ränge. Wird NUR bei der Auswertung eines
//      Tipps verändert (siehe evaluatePoolScore) sowie durch Inaktivitäts-
//      Abklingen (siehe applyInactivityDecay).
//   2. Saison-Pass-XP – steigt NUR durch den täglichen Login-Bonus, niemals
//      durch Tipp-Ergebnisse. Lebt als "passXP" in UserContext.
//   3. Sterne – die Einsatz-/Shop-Währung. Wird bei Tipp-Abgabe eingesetzt
//      und hier bei der Auswertung (teilweise) zurückerstattet.
//
// Der Vergleich mit den Mitspielern ("besser als X von Y") rechnet mit den
// echten Tipps aus der Datenbank (siehe compareWithOthers).
// ============================================================================

export type TipResultTier = "exakt" | "tendenz" | "falsch";

/** Reihenfolge der Tipp-Ergebnisse von schlechtestem zu bestem Ergebnis. */
export const TIER_ORDER: Record<TipResultTier, number> = {
  falsch: 0,
  tendenz: 1,
  exakt: 2,
};

/**
 * Bestimmt, ob ein Tipp exakt, in der Tendenz oder falsch war.
 *
 * Bei 1X2-Spielen gibt es kein "exakt": Der Tipp wird intern als 1:0, 0:0
 * oder 0:1 gespeichert. Endet das Spiel zufällig genau so, wäre er sonst
 * "exakt" und brächte mehr als ein anderer richtiger 1X2-Tipp.
 */
export function classifyTip(
  predictedHome: number,
  predictedAway: number,
  actualHome: number,
  actualAway: number,
  isOneXTwo = false
): TipResultTier {
  if (!isOneXTwo && predictedHome === actualHome && predictedAway === actualAway) return "exakt";
  const predictedDiff = Math.sign(predictedHome - predictedAway);
  const actualDiff = Math.sign(actualHome - actualAway);
  if (predictedDiff === actualDiff) return "tendenz";
  return "falsch";
}

// Rangliste-Punkte pro Ergebnis-Typ. Hängen NUR vom eigenen Tipp ab, damit
// gleiche Tipps immer gleich viele Punkte bringen. "Falsch" gibt 0 statt
// Abzug: Bei einem Abzug hinge die Summe von der Reihenfolge der Spiele ab,
// weil niemand unter 0 fallen kann. (Früher kam noch ein Bonus/Malus gegen
// simulierte Gegner dazu – entfernt, weil er nichts mit echten Mitspielern
// zu tun hatte.)
export const RANG_BASE_POINTS: Record<TipResultTier, number> = {
  exakt: 10,
  tendenz: 6,
  falsch: 0,
};

/**
 * Sterne-Gutschrift bei der Auswertung (wird auf das Guthaben aufgeschlagen,
 * nachdem der Einsatz bei Tipp-Abgabe bereits abgezogen wurde):
 *   - Exakt: Einsatz zurück + 50% Bonus obendrauf.
 *   - Tendenz (bei Ergebnis-Tipps): Einsatz zurück (Null-Ergebnis für die Sterne)
 *     – ist hier bewusst neutral, weil "Exakt" bei diesem Tipp-Modus noch
 *     erreichbar gewesen wäre.
 *   - Richtig bei 1X2-Tipps: Bei diesem Tipp-Modus IST "richtig geraten"
 *     bereits das bestmögliche Ergebnis (ein exaktes Ergebnis kann man hier
 *     gar nicht abgeben) – deshalb gibt's wie bei "Exakt" Einsatz zurück
 *     + 50% Bonus. Gewinn und Verlust sind damit gleich groß.
 *   - Falsch: nur 50% des Einsatzes gehen verloren, die Hälfte kommt zurück.
 */
export function starsDeltaForTier(tier: TipResultTier, stake: number, isOneXTwo = false): number {
  if (tier === "exakt") return Math.round(stake * 1.5);
  if (tier === "tendenz") return Math.round(stake * (isOneXTwo ? 1.5 : 1));
  return Math.round(stake * 0.5);
}

export interface PoolScoreResult {
  tier: TipResultTier;
  /** Änderung der Rangliste-Punkte – hängt NUR vom eigenen Tipp-Ergebnis ab. */
  rangDelta: number;
  /** Sterne, die dem Guthaben gutgeschrieben werden (Einsatz war schon abgezogen). */
  starsCredit: number;
  /** Netto-Veränderung der Sterne relativ zum eingesetzten Betrag (für die Anzeige). */
  starsNet: number;
}

export function evaluatePoolScore(params: {
  predictedHome: number;
  predictedAway: number;
  actualHome: number;
  actualAway: number;
  stake: number;
  isOneXTwo?: boolean;
}): PoolScoreResult {
  const isOneXTwo = params.isOneXTwo ?? false;
  const tier = classifyTip(params.predictedHome, params.predictedAway, params.actualHome, params.actualAway, isOneXTwo);
  const rangDelta = RANG_BASE_POINTS[tier];
  const starsCredit = starsDeltaForTier(tier, params.stake, isOneXTwo);
  const starsNet = starsCredit - params.stake;
  return { tier, rangDelta, starsCredit, starsNet };
}

/**
 * "Besser als X von Y Mitspielern": vergleicht das eigene Ergebnis mit den
 * ECHTEN Tipps aller anderen Spieler zu diesem Spiel (aus der Datenbank).
 */
export function compareWithOthers(
  myTier: TipResultTier,
  otherTips: { predictedHome: number; predictedAway: number }[],
  actualHome: number,
  actualAway: number,
  isOneXTwo = false
): { beaten: number; tied: number; ahead: number; total: number } {
  const myOrder = TIER_ORDER[myTier];
  let beaten = 0;
  let tied = 0;
  let ahead = 0;
  for (const t of otherTips) {
    const order = TIER_ORDER[classifyTip(t.predictedHome, t.predictedAway, actualHome, actualAway, isOneXTwo)];
    if (order < myOrder) beaten++;
    else if (order === myOrder) tied++;
    else ahead++;
  }
  return { beaten, tied, ahead, total: otherTips.length };
}

// ============================================================================
// Täglicher Bonus & Inaktivitäts-Abklingen
// ============================================================================

/** Sterne, die der tägliche Login-Bonus auszahlt. */
export const DAILY_BONUS_STARS = 8;

/**
 * Der "typische" Einsatz pro Spiel (Standardwert im Admin-Bereich beim
 * Anlegen eines Spiels). ALLE Sicherheits-Werte unten (Tages-Limit,
 * Warnschwelle, Rettungs-Bonus) werden bewusst als VIELFACHES dieser einen
 * Zahl berechnet statt als feste, unabhängige Zahlen. Grund: Wird künftig
 * öfter mit höheren oder niedrigeren Einsätzen gespielt, reicht es, NUR
 * diesen einen Wert anzupassen – die restlichen Sicherheits-Werte skalieren
 * dann automatisch mit, statt an mehreren Stellen im Code angepasst werden
 * zu müssen.
 */
export const REFERENCE_STAKE = 20;

/**
 * Maximaler Sterne-Einsatz, den ein User pro Tag insgesamt riskieren kann –
 * UNABHÄNGIG davon, wie viele Spiele an diesem Tag angeboten werden. Ohne
 * dieses Limit würde ein Tag mit vielen Spielen das Sterne-Guthaben viel
 * schneller aufbrauchen als ein Tag mit wenigen. Ist das Tages-Limit erreicht,
 * tippt man für die restlichen Spiele des Tages einfach ohne Einsatz weiter
 * (Rangliste-Punkte gibt's trotzdem, nur keine Sterne-Bewegung mehr).
 * Entspricht ca. 5 Einsätzen zum Referenz-Einsatz.
 */
export const DAILY_STAKE_BUDGET = REFERENCE_STAKE * 5;

/**
 * Abgesagtes Spiel: Der erstattete Einsatz zählt nicht mehr gegen das
 * Tages-Limit – aber nur, wenn der Tipp heute abgegeben wurde (an einem
 * anderen Tag lief das Limit ohnehin schon neu an). Jeder Tipp wird nur
 * einmal berücksichtigt (refundedTipIds), auch nach Neuladen.
 */
export function stakeBudgetAfterRefund<
  S extends { stakedToday: number; stakeBudgetDay: string | null; refundedTipIds: string[] }
>(state: S, tip: { id: string; stake: number; submittedAt: string }, nowIso: string): S {
  if (state.refundedTipIds.includes(tip.id)) return state;
  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
  const countsToday =
    state.stakeBudgetDay !== null && sameDay(state.stakeBudgetDay, nowIso) && sameDay(tip.submittedAt, nowIso);
  return {
    ...state,
    stakedToday: countsToday ? Math.max(0, state.stakedToday - tip.stake) : state.stakedToday,
    // Nur die letzten 100 merken, damit die Liste nicht endlos wächst.
    refundedTipIds: [...state.refundedTipIds, tip.id].slice(-100),
  };
}
/**
 * Sterne, die ein User einmalig geschenkt bekommt, wenn sein Guthaben auf 0
 * fällt – bewusst genau ein Referenz-Einsatz, damit man danach garantiert
 * mindestens noch einmal mitspielen kann.
 */
export const RESCUE_BONUS_STARS = REFERENCE_STAKE;
/**
 * Ab diesem Guthaben wird die Sterne-Anzeige als "knapp" markiert – bewusst
 * genau ein Referenz-Einsatz, damit die Warnung genau dann kommt, wenn's
 * nicht mal mehr für einen weiteren vollen Einsatz reicht.
 */
export const LOW_STARS_THRESHOLD = REFERENCE_STAKE;
/** Saison-Pass-XP, die der tägliche Login-Bonus auszahlt (einziger Weg, wie der Pass steigt). */
export const DAILY_BONUS_XP = 100;
/** So viele Tage Inaktivität sind erlaubt, bevor Rangliste-Punkte abzuklingen beginnen. */
export const INACTIVITY_GRACE_DAYS = 14;
/** Danach: so viele Punkte Abzug pro weiterer inaktiver Woche (langsam, betrifft alle Ränge). */
export const INACTIVITY_DECAY_PER_WEEK = 5;

// ============================================================================
// Tipp-Streak
// ============================================================================

/**
 * Meilensteine für die Tipp-Streak ("X Tage in Folge getippt"): bei jedem
 * erreichten Meilenstein gibt's einmalig einen Sterne-Bonus obendrauf. Ein
 * Tag zählt, sobald an ihm mindestens ein Tipp abgegeben wurde – bleibt ein
 * Kalendertag komplett ohne Tipp, reißt die Serie und beginnt wieder bei 1.
 */
export const STREAK_MILESTONES: { days: number; bonusStars: number }[] = [
  { days: 3, bonusStars: 10 },
  { days: 5, bonusStars: 15 },
  { days: 10, bonusStars: 30 },
  { days: 20, bonusStars: 60 },
];

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
