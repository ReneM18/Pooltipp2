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

// Spannung 0–100 aus
//  - Tempo: gewichtete Aktionen je 90 Minuten (bis 40),
//  - Torgefahr: xG je 90 Minuten (bis 15; ohne xG zählt das Tempo mehr),
//  - offenem Spiel: beide Teams schießen, der Ballbesitz ist ausgeglichen (bis 6),
//  - Trend: Aktionen der letzten ~10 Minuten gegenüber dem Schnitt (−8 bis +10),
//  - Toren, Roten, verschossenen Elfmetern und Videobeweis der letzten 15 Minuten (bis 30),
//  - Spielstand: knapp zählt mehr, in der Schlussphase doppelt, ab 3 Toren
//    Abstand ist die Luft raus.
// Nur Spiele mit Statistik kommen auf die Karte (Rene, 27.10.2026).
export function liveHeat(game: LiveGame, stats: HeatStats, earlier: HeatSnapshot | null = null): { heat: number; trend: HeatTrend } {
  const minute = Math.max(1, Math.min(120, game.elapsed ?? 45));
  // Am Anfang nicht hochrechnen (eine Chance in Minute 2 ist kein Feuerwerk).
  const per90 = (x: number) => (x / Math.max(minute, 15)) * 90;
  const actions = heatActions(stats);
  const xg = stats.home.xg !== null && stats.away.xg !== null ? stats.home.xg + stats.away.xg : null;
  const tempo = xg === null ? Math.min(52, per90(actions) * 0.85) : Math.min(40, per90(actions) * 0.65);
  const danger = xg === null ? 0 : Math.min(15, per90(xg) * 5);

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
  let recentPts = 6 * stats.recentVar;
  for (const e of events) {
    if (minute - e.minute > 15) continue;
    if (e.type === "goal" || e.type === "owngoal" || e.type === "penalty") recentPts += 14;
    else if (e.type === "red" || e.type === "missed_penalty") recentPts += 8;
  }
  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  const late = minute >= 70 ? 2 : 1;
  const close = diff === 0 ? 7 * late : diff === 1 ? 9 * late : diff === 2 ? 0 : -15;
  const heat = tempo + danger + open + trendPts + Math.min(30, recentPts) + close;
  return { heat: Math.round(Math.max(0, Math.min(100, heat))), trend };
}
