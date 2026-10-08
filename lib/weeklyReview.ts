"use client";

// Wochenrückblick: was in einer PoolTipp-Woche (Dienstag 8:00 bis Dienstag
// 8:00, mitteleuropäische Zeit) mit den eigenen Tipps passiert ist. Zählt
// genau wie die Wochen-Rangliste (lib/weeklyLeaderboard.ts): ein Tipp gehört
// zur Woche, in der das Spiel angepfiffen wird, Punkte zählen, sobald er
// ausgewertet ist.

import { useMemo } from "react";
import type { SubmittedTip } from "@/lib/AppDataContext";
import type { Match, Sport } from "@/lib/types";
import { getCurrentWeekWindow, kickoffLookup, sumWeeklyTipPoints, tipWeekTime, viennaParts, weeklyTipPoints, WeekWindow } from "@/lib/weeklyLeaderboard";
import { useGlobalLeaderboard } from "@/lib/globalLeaderboard";

/** Starttag (Dienstag) der Woche als "2026-10-06", wie week_start in der Datenbank. */
export function weekKey(window: WeekWindow): string {
  const d = viennaParts(window.start);
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

/** Die Woche vor der aktuellen. */
export function getPreviousWeekWindow(now: Date = new Date()): WeekWindow {
  return getCurrentWeekWindow(now, 1);
}

/** "6.10. – 13.10." (Dienstag bis Dienstag) */
export function weekRangeText(window: WeekWindow): string {
  const first = viennaParts(window.start);
  const last = viennaParts(window.end);
  return `${first.day}.${first.month}. – ${last.day}.${last.month}.`;
}

export interface WeeklyReview {
  /** Abgegebene Tipps der Woche (ohne abgesagte Spiele). */
  tips: number;
  evaluated: number;
  open: number;
  exakt: number;
  differenz: number;
  tendenz: number;
  falsch: number;
  /** Sieg/Unentschieden-Tipps (1X2), die richtig waren. */
  richtig1x2: number;
  /** Tipp-Punkte der Woche (ohne Platz-Bonus), wie in der Wochen-Rangliste. */
  points: number;
  /** Ausgewerteter Tipp mit den meisten Punkten. */
  best: { tip: SubmittedTip; match: Match } | null;
  bySport: Partial<Record<Sport, number>>;
}

export function computeWeeklyReview(tips: SubmittedTip[], matches: Match[], window: WeekWindow): WeeklyReview {
  const start = window.start.getTime();
  const end = window.end.getTime();
  const kickoffOf = kickoffLookup(matches);
  const inWeek = tips.filter((t) => {
    if (t.rankingLegacy || t.refunded) return false;
    const at = tipWeekTime(t, kickoffOf);
    return at >= start && at < end;
  });
  const review: WeeklyReview = {
    tips: inWeek.length,
    evaluated: 0,
    open: 0,
    exakt: 0,
    differenz: 0,
    tendenz: 0,
    falsch: 0,
    richtig1x2: 0,
    points: sumWeeklyTipPoints(tips, window, kickoffOf),
    best: null,
    bySport: {},
  };
  const matchById = new Map(matches.map((m) => [m.id, m]));
  for (const tip of inWeek) {
    const match = matchById.get(tip.matchId);
    if (match) review.bySport[match.sport] = (review.bySport[match.sport] ?? 0) + 1;
    if (!tip.evaluated) {
      review.open++;
      continue;
    }
    review.evaluated++;
    const tier = tip.resultTier ?? "falsch";
    if (match?.tipMode === "1x2" && tier !== "falsch") review.richtig1x2++;
    else review[tier]++;
    if (match && weeklyTipPoints(tip) > 0 && (!review.best || weeklyTipPoints(tip) > weeklyTipPoints(review.best.tip))) {
      review.best = { tip, match };
    }
  }
  return review;
}

/**
 * Platz in der Wochen-Rangliste dieser Woche, gerechnet wie auf der
 * Rangliste (app/rangliste/page.tsx): gleiche Punkte, gleicher Platz.
 * null = noch nicht geladen oder keine Tipps in der Woche.
 */
export function useWeeklyPlace(
  window: WeekWindow,
  authUserId: string | null,
  myPoints: number,
  hasTips: boolean
): { place: number | null; players: number; loading: boolean } {
  const { players, weeklyByUser, loading } = useGlobalLeaderboard(window);
  return useMemo(() => {
    if (loading || !authUserId || !hasTips) return { place: null, players: 0, loading };
    const points = players
      .filter((p) => weeklyByUser.has(p.id) && p.id !== authUserId)
      .map((p) => weeklyByUser.get(p.id) ?? 0);
    const better = points.filter((p) => p > myPoints).length;
    return { place: better + 1, players: points.length + 1, loading: false };
  }, [players, weeklyByUser, loading, authUserId, myPoints, hasTips]);
}
