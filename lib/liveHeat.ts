import type { LiveEvent, LiveGame } from "./live/types";

// Spannung laufender TV-Spiele (Rene, 27.10.2026: "wo es laut Statistik
// abgeht und welches Spiel eher fad ist", danach "hol alles raus"). Zahlen
// je Spiel über GET /api/live-heat?ids=<API-Sports-Spiel-IDs> (eine Abfrage
// für alle Spiele, app/api/live-heat/route.ts), die Spannung rechnet der
// Browser.

export interface HeatSide {
  shots: number;
  onTarget: number;
  insideBox: number; // Schüsse aus dem Strafraum
  saves: number; // Paraden des Torhüters
  corners: number;
  cards: number; // gelb + rot
  possession: number | null; // Prozent
  xg: number | null; // erwartete Tore, nicht in jeder Liga
}

export interface HeatStats {
  id: string;
  home: HeatSide;
  away: HeatSide;
  // Videobeweis in den letzten 15 Minuten (aus den Ereignissen derselben Abfrage).
  recentVar: number;
  // Minuten der Tore laut derselben Abfrage (falls die Live-Liste sie noch
  // nicht hat).
  goalMinutes: number[];
}

export interface LiveHeatResponse {
  stats: HeatStats[];
  error?: string;
}

export type HeatLevel = "heiss" | "spannend" | "ruhig" | "fad";
export type HeatTrend = "up" | "down" | null;

export const HEAT_LEVELS: Record<HeatLevel, { label: string; emoji: string }> = {
  heiss: { label: "Heiß", emoji: "🔥" },
  spannend: { label: "Spannend", emoji: "⚡" },
  ruhig: { label: "Ruhig", emoji: "🙂" },
  fad: { label: "Fad", emoji: "😴" },
};

export function heatLevel(heat: number): HeatLevel {
  return heat >= 70 ? "heiss" : heat >= 45 ? "spannend" : heat >= 25 ? "ruhig" : "fad";
}

// Gewichtete Aktionen beider Teams (Schüsse, aufs Tor, aus dem Strafraum,
// Paraden, Ecken, Karten). Normales Spiel nach 90 Min. ≈ 55.
export function heatActions(s: HeatStats): number {
  const sum = (k: "shots" | "onTarget" | "insideBox" | "saves" | "corners" | "cards") => s.home[k] + s.away[k];
  return sum("shots") + 1.5 * sum("onTarget") + 0.5 * sum("insideBox") + 0.5 * sum("saves") + 0.6 * sum("corners") + 0.4 * sum("cards");
}

// Früherer Stand desselben Spiels (im Browser gemerkt) für den Trend.
export interface HeatSnapshot {
  minute: number;
  actions: number;
}

// Ein normales Spiel: so viele gewichtete Aktionen bzw. xG pro Minute.
const NORMAL_ACTIONS_PER_MIN = 55 / 90;
const NORMAL_XG_PER_MIN = 2.6 / 90;
// So viele Minuten "normales Spiel" werden am Anfang dazugerechnet, damit die
// ersten Minuten nicht automatisch fad sind (Rene, 28.10.2026).
const PRIOR_MINUTES = 20;

// Spannung 0–100 aus
//  - Tempo: gewichtete Aktionen je 90 Minuten (bis 40), am Anfang mit einem
//    normalen Spiel aufgefüllt (erste Minuten = "Ruhig", nicht "Fad"),
//  - Torgefahr: xG je 90 Minuten (bis 15; ohne xG zählt das Tempo mehr),
//  - offenem Spiel: beide Teams schießen, der Ballbesitz ist ausgeglichen (bis 6),
//  - Trend: Aktionen der letzten ~10 Minuten gegenüber dem Schnitt (−8 bis +10),
//  - Toren: je Tor +4 (bis 16), ein Tor in den letzten 15 Minuten +14, und
//    bis 10 Minuten nach einem Tor mindestens "Spannend" (Rene, 28.10.2026:
//    "Salzburg macht das Tor in der ersten Minute und es steht fad"),
//  - Roten, verschossenen Elfmetern und Videobeweis der letzten 15 Minuten,
//  - Spielstand: knapp zählt mehr, in der Schlussphase doppelt, ab 3 Toren
//    Abstand ist die Luft raus.
// Nur Spiele mit Statistik kommen auf die Karte (Rene, 27.10.2026).
export function liveHeat(game: LiveGame, stats: HeatStats, earlier: HeatSnapshot | null = null): { heat: number; trend: HeatTrend } {
  const minute = Math.max(1, Math.min(120, game.elapsed ?? 45));
  const per90 = (x: number, normalPerMin: number) => ((x + normalPerMin * PRIOR_MINUTES) / (minute + PRIOR_MINUTES)) * 90;
  const actions = heatActions(stats);
  const xg = stats.home.xg !== null && stats.away.xg !== null ? stats.home.xg + stats.away.xg : null;
  const actions90 = per90(actions, NORMAL_ACTIONS_PER_MIN);
  const tempo = xg === null ? Math.min(52, actions90 * 0.6) : Math.min(40, actions90 * 0.45);
  const danger = xg === null ? 0 : Math.min(15, per90(xg, NORMAL_XG_PER_MIN) * 4);

  const hs = stats.home.shots;
  const as = stats.away.shots;
  const shotBalance = Math.max(hs, as) > 0 ? Math.min(hs, as) / Math.max(hs, as) : 0;
  const pos = stats.home.possession;
  const posBalance = pos === null ? 0.5 : 1 - Math.min(1, Math.abs(pos - 50) / 25);
  const open = 4 * shotBalance + 2 * posBalance;

  let trendPts = 0;
  let trend: HeatTrend = null;
  if (earlier && minute - earlier.minute >= 5 && minute > 20) {
    const recentRate = (actions - earlier.actions) / (minute - earlier.minute);
    const avgRate = actions / minute;
    if (avgRate > 0) {
      const ratio = recentRate / avgRate;
      trendPts = Math.max(-8, Math.min(10, (ratio - 1) * 10));
      trend = ratio >= 1.35 ? "up" : ratio <= 0.6 ? "down" : null;
    }
  }

  const events: LiveEvent[] = game.events ?? [];
  const isGoal = (e: LiveEvent) => e.type === "goal" || e.type === "owngoal" || e.type === "penalty";
  // Tore aus der Live-Liste, sonst aus der Statistik-Abfrage.
  const listGoals = events.filter(isGoal).map((e) => e.minute);
  const goalMinutes = listGoals.length >= stats.goalMinutes.length ? listGoals : stats.goalMinutes;
  const goals = Math.max(goalMinutes.length, (game.homeScore ?? 0) + (game.awayScore ?? 0));
  // Tor ohne bekannte Minute in den ersten 10 Minuten: muss frisch sein.
  const lastGoalAge = goalMinutes.length > 0 ? minute - Math.max(...goalMinutes) : goals > 0 && minute <= 10 ? 0 : Infinity;

  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  const blowout = diff >= 3;
  // Bei einem Kantersieg machen weitere Tore das Spiel nicht spannender.
  let eventPts = (blowout ? 0 : Math.min(16, 4 * goals)) + 6 * stats.recentVar;
  eventPts += (blowout ? 4 : 14) * goalMinutes.filter((m) => minute - m <= 15).length;
  for (const e of events) {
    if (minute - e.minute > 15) continue;
    if (e.type === "red" || e.type === "missed_penalty") eventPts += 8;
  }
  const late = minute >= 70 ? 2 : 1;
  const close = diff === 0 ? 7 * late : diff === 1 ? 9 * late : diff === 2 ? 0 : -20;
  let heat = tempo + danger + open + trendPts + Math.min(40, eventPts) + close;
  // Frisches Tor: mindestens "Spannend", außer bei einem Kantersieg.
  if (lastGoalAge <= 10 && !blowout) heat = Math.max(heat, 55);
  return { heat: Math.round(Math.max(0, Math.min(100, heat))), trend };
}

// ---------------------------------------------------------------------------
// NFL (Rene, 31.10.2026, Variante B): gleiche Karte, eigene Zahlen. API-Sports
// liefert bei American Football je Spiel die Team-Statistik (Yards, Spielzüge,
// Turnover, Red Zone, 3rd/4th Down, Sacks), aber keine mitlaufende Uhr in
// Minuten – gerechnet wird mit dem Viertel.

export interface NflSide {
  yards: number;
  plays: number;
  firstDowns: number;
  turnovers: number;
  sacks: number;
  redZoneMade: number;
  redZoneAtt: number;
  thirdMade: number;
  thirdAtt: number;
  fourthAtt: number;
}

export interface NflTeamStats {
  team: string; // Name laut API-Sports, zum Zuordnen Heim/Gast
  stats: NflSide;
}

export interface NflHeatRaw {
  id: string;
  teams: NflTeamStats[];
}

export interface NflLiveHeatResponse {
  stats: NflHeatRaw[];
  error?: string;
}

export interface NflHeatStats {
  id: string;
  home: NflSide;
  away: NflSide;
}

// Heim/Gast über den Teamnamen der Live-Liste, sonst Reihenfolge der API.
export function nflSides(raw: NflHeatRaw, homeName: string, awayName: string): NflHeatStats | null {
  if (raw.teams.length < 2) return null;
  const norm = (s: string) => s.trim().toLowerCase();
  const home = raw.teams.find((t) => norm(t.team) === norm(homeName)) ?? raw.teams.find((t) => norm(t.team) !== norm(awayName)) ?? raw.teams[0];
  const away = raw.teams.find((t) => t !== home) ?? raw.teams[1];
  return { id: raw.id, home: home.stats, away: away.stats };
}

export function nflSum(s: NflHeatStats, k: keyof NflSide): number {
  return s.home[k] + s.away[k];
}

// Gespielte Minuten (von 60) grob aus dem Viertel: Mitte des Viertels.
export function nflGameMinute(statusShort: string): number {
  const s = statusShort.toUpperCase();
  const q = /^Q([1-4])$/.exec(s);
  if (q) return (Number(q[1]) - 1) * 15 + 7.5;
  if (s === "HT") return 30;
  if (s === "OT") return 62;
  return 30;
}

// Früherer Stand (im Browser gemerkt, Uhrzeit statt Spielminute).
export interface NflSnapshot {
  at: number;
  points: number;
  turnovers: number;
}

const NFL_NORMAL_YPP = 5.3; // Yards pro Spielzug in einem normalen Spiel
const NFL_NORMAL_POINTS = 45; // Punkte beider Teams in 60 Minuten

// Spannung 0–100 aus
//  - Tempo: Yards pro Spielzug (bis 24), am Anfang mit 20 normalen
//    Spielzügen aufgefüllt,
//  - Punkte-Tempo: Punkte je 60 Minuten (bis 16), am Anfang mit 15 Minuten
//    normalem Spiel aufgefüllt,
//  - Turnover (je +4, bis 15), Red-Zone-Besuchen, 4th-Down-Versuchen, Sacks,
//  - frischen Punkten und Turnovern seit dem letzten Stand (~10 Min.),
//  - Spielstand: bis 3 bzw. bis 8 Punkte (ein Touchdown) Abstand zählt,
//    im 4. Viertel doppelt; ab 17 Punkten Abstand ist die Luft raus (fad),
//  - Verlängerung +15; 4. Viertel mit höchstens 8 Punkten Abstand ist
//    mindestens "Spannend".
export function nflLiveHeat(game: LiveGame, stats: NflHeatStats, earlier: NflSnapshot | null = null): { heat: number; trend: HeatTrend } {
  const minute = nflGameMinute(game.statusShort);
  const yards = nflSum(stats, "yards");
  const plays = nflSum(stats, "plays");
  const ypp = (yards + NFL_NORMAL_YPP * 20) / (plays + 20);
  const tempo = Math.max(0, Math.min(24, (ypp - 4) * 12));

  const points = (game.homeScore ?? 0) + (game.awayScore ?? 0);
  const points60 = ((points + (NFL_NORMAL_POINTS / 60) * 15) / (minute + 15)) * 60;
  const scoring = Math.min(16, points60 * 0.3);

  const turnovers = nflSum(stats, "turnovers");
  const extras =
    Math.min(15, 4 * turnovers) + Math.min(6, nflSum(stats, "redZoneAtt")) + Math.min(6, 2 * nflSum(stats, "fourthAtt")) + Math.min(4, 0.5 * nflSum(stats, "sacks"));

  let recent = 0;
  let trend: HeatTrend = null;
  if (earlier) {
    const newPoints = Math.max(0, points - earlier.points);
    const newTurnovers = Math.max(0, turnovers - earlier.turnovers);
    recent = Math.min(20, 10 * Math.min(2, Math.ceil(newPoints / 7)) + 8 * newTurnovers);
    if (recent > 0) trend = "up";
  }

  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  const s = game.statusShort.toUpperCase();
  const late = s === "Q4" || s === "OT";
  const blowout = diff >= 17;
  const close = (diff <= 3 ? 10 : diff <= 8 ? 7 : 0) * (late ? 2 : 1);
  // Bei 17+ Punkten Abstand zählen Yards und Punkte kaum noch.
  let heat = blowout
    ? 0.6 * (tempo + scoring + extras) - 15
    : tempo + scoring + extras + recent + close + (s === "OT" ? 15 : 0);
  if (late && diff <= 8) heat = Math.max(heat, 55);
  if (blowout) trend = null;
  return { heat: Math.round(Math.max(0, Math.min(100, heat))), trend };
}
