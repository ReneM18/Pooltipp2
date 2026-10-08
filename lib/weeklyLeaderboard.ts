// Wochen-Rangliste: eine auf die aktuelle Kalenderwoche begrenzte
// Mini-Rangliste (Montag 00:00 bis Montag 00:00 der Folgewoche, lokale
// Zeit), als Gegenstück zur nie endenden Gesamt-Rangliste – schafft
// kurzfristige Dringlichkeit statt eines Ziels, das sich erst nach Monaten
// bewegt. Da es kein echtes Backend gibt, werden die Werte der anderen
// Mitspieler deterministisch pro Woche simuliert (mulberry32-
// Zufallsgenerator) – bei echten Konten
// stünden hier reale Wochenwerte.

import { mockLeaderboard } from "./mockLeaderboard";

function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

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

export interface WeekWindow {
  start: Date;
  end: Date;
}

/** Montag 00:00 (lokale Zeit) bis Montag 00:00 der Folgewoche. */
export function getCurrentWeekWindow(now: Date = new Date()): WeekWindow {
  const start = new Date(now);
  const day = start.getDay(); // 0 = Sonntag
  const diffToMonday = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export interface WeeklyEntry {
  name: string;
  points: number;
}

/** Deterministisch simulierte Wochenpunkte für die bekannten Mock-Mitspieler. */
export function getSimulatedWeeklyEntries(weekStart: Date): WeeklyEntry[] {
  const weekKey = weekStart.toISOString().slice(0, 10);
  return mockLeaderboard
    .filter((e) => !e.isCurrentUser)
    .map((entry) => {
      const rng = mulberry32(hashString(`weekly:${weekKey}:${entry.name}`));
      const points = Math.round(20 + rng() * 90); // 20–110 Punkte diese Woche
      return { name: entry.name, points };
    });
}

/**
 * Summe der Rangliste-Punkte-Änderung aus allen in diesem Zeitfenster
 * ausgewerteten eigenen Tipps. Tipps von vor dem Neustart der Rangpunkte
 * (rankingLegacy) zählen nicht mehr.
 */
export function sumWeeklyRangDelta(
  tips: { evaluated?: boolean; rangDelta?: number; submittedAt: string; rankingLegacy?: boolean }[],
  window: WeekWindow
): number {
  return tips
    .filter((t) => t.evaluated && t.rangDelta !== undefined && !t.rankingLegacy)
    .filter((t) => {
      const submitted = new Date(t.submittedAt).getTime();
      return submitted >= window.start.getTime() && submitted < window.end.getTime();
    })
    .reduce((sum, t) => sum + (t.rangDelta ?? 0), 0);
}
