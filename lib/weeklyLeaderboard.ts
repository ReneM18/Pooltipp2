// Wochen-Rangliste: eine auf die aktuelle Kalenderwoche begrenzte
// Mini-Rangliste (Montag 00:00 bis Montag 00:00 der Folgewoche, Wiener
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

// Die Woche läuft für alle Spieler gleich nach österreichischer Zeit
// (Europe/Vienna), nie nach der Uhr/Zeitzone des Geräts – genau wie die
// Auszahlung "Erster der Woche" in supabase/wochensieger.sql.
export const WEEK_TIME_ZONE = "Europe/Vienna";

const viennaFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: WEEK_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

/** Datum und Uhrzeit in Wien als Zahlen (Monat 1–12). */
export function viennaParts(date: Date): { year: number; month: number; day: number; hour: number; minute: number; second: number } {
  const parts: Record<string, number> = {};
  for (const p of viennaFormat.formatToParts(date)) if (p.type !== "literal") parts[p.type] = Number(p.value);
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute, second: parts.second };
}

/** Wie viele Millisekunden Wien der UTC-Zeit voraus ist (Sommerzeit +2 h, sonst +1 h). */
function viennaOffset(date: Date): number {
  const p = viennaParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Mitternacht (00:00 Wiener Zeit) eines Kalendertags; Tag darf überlaufen (z. B. 35.10.). */
export function viennaMidnight(year: number, month: number, day: number): Date {
  const guess = Date.UTC(year, month - 1, day);
  let result = guess - viennaOffset(new Date(guess));
  // Rund um die Zeitumstellung stimmt der Versatz erst im zweiten Anlauf.
  result = guess - viennaOffset(new Date(result));
  return new Date(result);
}

/** Montag 00:00 bis Montag 00:00 der Folgewoche, Wiener Zeit. weeksBack = 1 → Vorwoche. */
export function getCurrentWeekWindow(now: Date = new Date(), weeksBack = 0): WeekWindow {
  const p = viennaParts(now);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sonntag
  const mondayDay = p.day - (weekday === 0 ? 6 : weekday - 1) - 7 * weeksBack;
  return {
    start: viennaMidnight(p.year, p.month, mondayDay),
    end: viennaMidnight(p.year, p.month, mondayDay + 7),
  };
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
