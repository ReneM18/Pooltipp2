// Tennis als Tipp-Sportart (Rene, 10.11.2026, Variante B "Satzergebnis").
// Getippt wird das Satzergebnis, gespeichert wie ein Ergebnis-Tipp: die
// gewonnenen Sätze stehen als Heim/Gast-Zahl im Spiel (Heim = Spieler links).
// Damit laufen Auswertung, Rangpunkte und Joker wie beim Fußball:
// exakt (z. B. 2:1 getippt, 2:1 gespielt) = +10, richtiger Sieger = +5,
// falsch = −3. Ein Unentschieden gibt es nicht.

/** Gewinnsätze: 3 = zwei Gewinnsätze (Standard), 5 = drei (Grand Slam Herren). */
export type TennisBestOf = 3 | 5;

export function tennisBestOf(value: unknown): TennisBestOf {
  return value === 5 ? 5 : 3;
}

/** Sätze, die der Sieger braucht (2 bzw. 3). */
export function setsToWin(bestOf: TennisBestOf): number {
  return bestOf === 5 ? 3 : 2;
}

/**
 * Alle möglichen Satzergebnisse als [links, rechts], von "links gewinnt
 * glatt" bis "rechts gewinnt glatt": 2:0, 2:1, 1:2, 0:2 bzw.
 * 3:0, 3:1, 3:2, 2:3, 1:3, 0:3.
 */
export function tennisSetScores(bestOf: TennisBestOf): [number, number][] {
  const win = setsToWin(bestOf);
  const list: [number, number][] = [];
  for (let lose = 0; lose < win; lose++) list.push([win, lose]);
  for (let lose = win - 1; lose >= 0; lose--) list.push([lose, win]);
  return list;
}

/** true, wenn das ein gültiger Endstand in Sätzen ist (z. B. 2:1, nicht 2:2 oder 1:0). */
export function isValidTennisScore(home: number, away: number, bestOf: TennisBestOf): boolean {
  return tennisSetScores(bestOf).some(([h, a]) => h === home && a === away);
}
