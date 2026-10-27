import type { LiveEvent, LiveGame } from "./live/types";

// Spannung laufender TV-Spiele (Rene, 27.10.2026: "wo es laut Statistik
// abgeht und welches Spiel eher fad ist"). Zahlen je Spiel über
// GET /api/live-heat?ids=<API-Sports-Spiel-IDs> (eine Abfrage für alle
// Spiele, app/api/live-heat/route.ts), die Spannung rechnet der Browser.

export interface HeatSide {
  shots: number;
  onTarget: number;
  corners: number;
  cards: number; // gelb + rot
}

export interface HeatStats {
  id: string;
  home: HeatSide;
  away: HeatSide;
}

export interface LiveHeatResponse {
  stats: HeatStats[];
  error?: string;
}

export type HeatLevel = "heiss" | "spannend" | "ruhig" | "fad";

export const HEAT_LEVELS: Record<HeatLevel, { label: string; emoji: string }> = {
  heiss: { label: "Heiß", emoji: "🔥" },
  spannend: { label: "Spannend", emoji: "⚡" },
  ruhig: { label: "Ruhig", emoji: "🙂" },
  fad: { label: "Fad", emoji: "😴" },
};

export function heatLevel(heat: number): HeatLevel {
  return heat >= 70 ? "heiss" : heat >= 45 ? "spannend" : heat >= 25 ? "ruhig" : "fad";
}

// Spannung 0–100 aus
//  - Tempo: Schüsse, Schüsse aufs Tor, Ecken und Karten je 90 Minuten
//    (normales Spiel ≈ 25 Schüsse, 8 aufs Tor, 10 Ecken → ≈ 40 Punkte),
//  - Toren und roten Karten der letzten 15 Minuten,
//  - Spielstand: knapp zählt mehr, ab 3 Toren Abstand ist die Luft raus,
//    in der Schlussphase zählt ein knapper Stand doppelt.
// Nur Spiele mit Statistik kommen auf die Karte (Rene, 27.10.2026).
export function liveHeat(game: LiveGame, stats: HeatStats): number {
  const minute = Math.max(1, Math.min(120, game.elapsed ?? 45));
  const sum = (k: keyof HeatSide) => stats.home[k] + stats.away[k];
  const actions = sum("shots") + 1.5 * sum("onTarget") + 0.6 * sum("corners") + 0.4 * sum("cards");
  // Am Anfang nicht hochrechnen (eine Chance in Minute 2 ist kein Feuerwerk).
  const tempo = Math.min(60, (actions / Math.max(minute, 15)) * 90 * 0.9);
  const events: LiveEvent[] = game.events ?? [];
  const recent = events.filter((e) => minute - e.minute <= 15);
  let recentPts = 0;
  for (const e of recent) {
    if (e.type === "goal" || e.type === "owngoal" || e.type === "penalty") recentPts += 14;
    else if (e.type === "red" || e.type === "missed_penalty") recentPts += 8;
  }
  const diff = Math.abs((game.homeScore ?? 0) - (game.awayScore ?? 0));
  const late = minute >= 70 ? 2 : 1;
  const close = diff === 0 ? 7 * late : diff === 1 ? 9 * late : diff === 2 ? 0 : -15;
  return Math.round(Math.max(0, Math.min(100, tempo + Math.min(30, recentPts) + close)));
}
