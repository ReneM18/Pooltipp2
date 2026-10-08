// Wochen-Rangliste: eine auf eine Woche begrenzte Mini-Rangliste (Dienstag
// 8:00 bis Dienstag 8:00 der Folgewoche, mitteleuropäische Zeit), als Gegenstück zur nie endenden Gesamt-Rangliste – schafft
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

// Die Woche läuft für alle Spieler gleich nach mitteleuropäischer Zeit
// (technisch Europe/Vienna, MEZ/MESZ), nie nach der Uhr/Zeitzone des Geräts
// – genau wie die Auszahlung "Erster der Woche" in supabase/wochensieger.sql.
// Sie wechselt am Dienstag um 8:00: Dann ist das NFL-Wochenende samt
// Monday Night Football (Anpfiff Dienstag ~2:15) und den späten NBA-/NHL-
// Spielen aus Nordamerika (Anpfiff spätestens ~4:30) sicher angepfiffen,
// und vor 8:00 beginnt kein Spiel. Ein Tipp zählt zur Woche, in der das
// Spiel angepfiffen wird (siehe tipWeekTime).
export const WEEK_TIME_ZONE = "Europe/Vienna";
/** Wochentag (0 = Sonntag) und Uhrzeit des Wochenwechsels. */
export const WEEK_START_WEEKDAY = 2;
export const WEEK_START_HOUR = 8;

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

/** Uhrzeit (volle Stunde, Wiener/MEZ-Zeit) eines Kalendertags; Tag darf überlaufen (z. B. 35.10.). */
export function viennaTime(year: number, month: number, day: number, hour = 0): Date {
  const guess = Date.UTC(year, month - 1, day, hour);
  let result = guess - viennaOffset(new Date(guess));
  // Rund um die Zeitumstellung stimmt der Versatz erst im zweiten Anlauf.
  result = guess - viennaOffset(new Date(result));
  return new Date(result);
}

/** Dienstag 8:00 bis Dienstag 8:00 der Folgewoche (MEZ/MESZ). weeksBack = 1 → Vorwoche. */
export function getCurrentWeekWindow(now: Date = new Date(), weeksBack = 0): WeekWindow {
  const p = viennaParts(now);
  const weekday = new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay(); // 0 = Sonntag
  let daysSince = (weekday - WEEK_START_WEEKDAY + 7) % 7;
  if (daysSince === 0 && p.hour < WEEK_START_HOUR) daysSince = 7;
  const startDay = p.day - daysSince - 7 * weeksBack;
  return {
    start: viennaTime(p.year, p.month, startDay, WEEK_START_HOUR),
    end: viennaTime(p.year, p.month, startDay + 7, WEEK_START_HOUR),
  };
}

/**
 * Zeitpunkt, nach dem ein Tipp einer Woche zugeordnet wird: der Anpfiff des
 * Spiels, so landet jede Wertung in der Woche, in der gespielt wurde. Ist
 * das Spiel unbekannt (gelöscht), zählt ersatzweise die Abgabezeit.
 */
export function tipWeekTime(tip: { matchId?: string; submittedAt: string }, kickoffOf?: (matchId: string) => string | undefined): number {
  const kickoff = tip.matchId && kickoffOf ? kickoffOf(tip.matchId) : undefined;
  const time = new Date(kickoff ?? tip.submittedAt).getTime();
  return Number.isFinite(time) ? time : new Date(tip.submittedAt).getTime();
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

/**
 * Tipp-Punkte eines Tipps für die Wochen-Rangliste: nur der Treffer
 * (exakt +10, Tordifferenz +7, Tendenz +5, falsch −3, 1X2 +5/−3, mit
 * Doppel- und Toleranz-Joker), OHNE Platz-Bonus – sonst lägen in der Woche
 * immer die vorne, die in der Gesamt-Rangliste weiter hinten stehen. Der
 * Schutz-Joker verhindert wie sonst ein Minus. Gleiche Regel wie
 * weekly_points() in supabase/wochensieger.sql.
 */
export function weeklyTipPoints(tip: { basePoints?: number; rangDelta?: number; joker?: string | null }): number {
  const base = tip.basePoints ?? tip.rangDelta ?? 0;
  return tip.joker === "schutz" && base < 0 ? 0 : base;
}

/** Summe der Tipp-Punkte (ohne Platz-Bonus) aller ausgewerteten Tipps auf Spiele, die in der Woche angepfiffen wurden. */
export function sumWeeklyTipPoints(
  tips: {
    evaluated?: boolean;
    basePoints?: number;
    rangDelta?: number;
    joker?: string | null;
    matchId?: string;
    submittedAt: string;
    rankingLegacy?: boolean;
    refunded?: boolean;
  }[],
  window: WeekWindow,
  kickoffOf?: (matchId: string) => string | undefined
): number {
  return tips
    .filter((t) => t.evaluated && !t.refunded && (t.basePoints !== undefined || t.rangDelta !== undefined) && !t.rankingLegacy)
    .filter((t) => {
      const at = tipWeekTime(t, kickoffOf);
      return at >= window.start.getTime() && at < window.end.getTime();
    })
    .reduce((sum, t) => sum + weeklyTipPoints(t), 0);
}

/** Anpfiff je Spiel-ID aus der Spieleliste, für tipWeekTime/sumWeeklyTipPoints. */
export function kickoffLookup(matches: { id: string; kickoff: string }[]): (matchId: string) => string | undefined {
  const map = new Map(matches.map((m) => [m.id, m.kickoff]));
  return (matchId) => map.get(matchId);
}
