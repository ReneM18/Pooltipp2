// Booster-Spiele pro Tag zählen (höchstens BOOSTERS_PER_DAY, siehe
// lib/poolScore.ts). Ein Tag ist der Anpfiff-Tag in Österreich, wie
// pooltipp_day in der Datenbank.
import type { Match } from "./types";
import { viennaDateKey } from "./seasons/schedule";

/** Booster-Spiele am Anpfiff-Tag von `kickoff` (abgesagte zählen nicht). */
export function boostersOnDay(matches: Match[], kickoff: string, excludeMatchId?: string): number {
  const day = viennaDateKey(new Date(kickoff));
  return matches.filter(
    (m) => m.booster && m.status !== "cancelled" && m.id !== excludeMatchId && viennaDateKey(new Date(m.kickoff)) === day
  ).length;
}
