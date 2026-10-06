"use client";

// Tipp-Serie ("X Tage in Folge getippt") so, wie sie gerade WIRKLICH steht.
// Die Datenbank zählt die Serie erst beim nächsten Tipp weiter oder setzt sie
// zurück (supabase/dranbleiben.sql). Bis dahin steht im Profil noch die alte
// Zahl, auch wenn die Serie längst gerissen ist. Darum wird hier aus dem
// letzten Tipp-Tag ausgerechnet, was man anzeigen muss. Tage zählen wie in
// der Datenbank nach österreichischer Zeit.

import { useEffect, useState } from "react";
import { useUser } from "@/lib/UserContext";
import { STREAK_MILESTONES } from "@/lib/poolScore";

/**
 * none   = keine Serie
 * today  = heute schon getippt
 * open   = gestern getippt, heute noch nicht
 * shield = gestern ausgelassen, der Serien-Schutz rettet die Serie beim
 *          nächsten Tipp heute
 */
export type StreakStatus = "none" | "today" | "open" | "shield";

export interface StreakState {
  status: StreakStatus;
  /** Serie, wie sie gerade zählt (0, wenn gerissen). */
  count: number;
  /** Zahl nach dem nächsten Tipp heute (gleich count, wenn schon getippt). */
  countAfterTip: number;
  /** Serien-Schutz dieser Woche noch frei? null = gibt es noch nicht (SQL fehlt). */
  shieldFree: boolean | null;
  /** Nächster noch nicht bekommener Meilenstein. */
  nextMilestone: { days: number; bonusStars: number; remaining: number } | null;
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Vienna",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Kalendertag in Österreich als "2026-10-06". */
export function viennaDay(date: Date): string {
  return dayFormat.format(date);
}

function dayNumber(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

function dayFromNumber(n: number): string {
  return new Date(n * 86_400_000).toISOString().slice(0, 10);
}

/** Montag der Woche dieses Tages ("2026-10-05"). */
export function mondayOf(day: string): string {
  const n = dayNumber(day);
  const weekday = (new Date(n * 86_400_000).getUTCDay() + 6) % 7; // 0 = Montag
  return dayFromNumber(n - weekday);
}

export function computeStreak(input: {
  streakCount: number;
  lastTipDate: string | null;
  streakClaims: number[];
  shieldWeeks: string[] | null;
  now: Date;
}): StreakState {
  const { streakCount, lastTipDate, streakClaims, shieldWeeks, now } = input;
  const today = viennaDay(now);
  const todayN = dayNumber(today);
  const shieldFree = shieldWeeks === null ? null : !shieldWeeks.includes(mondayOf(today));

  let status: StreakStatus = "none";
  let count = 0;
  const last = lastTipDate ? new Date(lastTipDate) : null;
  if (last && !Number.isNaN(last.getTime()) && streakCount > 0) {
    const gap = todayN - dayNumber(viennaDay(last));
    if (gap <= 0) status = "today";
    else if (gap === 1) status = "open";
    else if (gap === 2 && shieldWeeks !== null && !shieldWeeks.includes(mondayOf(dayFromNumber(todayN - 1)))) {
      status = "shield";
    }
    if (status !== "none") count = Math.max(streakCount, 1);
  }
  const countAfterTip = status === "today" ? count : count + 1;

  const claimed = new Set(streakClaims);
  const next = STREAK_MILESTONES.find((m) => m.days > count && !claimed.has(m.days));
  return {
    status,
    count,
    countAfterTip,
    shieldFree,
    nextMilestone: next ? { ...next, remaining: next.days - count } : null,
  };
}

/** Aktueller Stand der eigenen Tipp-Serie, jede Minute neu gerechnet. */
export function useStreak(): StreakState {
  const { streakCount, lastTipDate, streakClaims, shieldWeeks } = useUser();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return computeStreak({ streakCount, lastTipDate, streakClaims, shieldWeeks, now });
}

/** "1 Tag" / "6 Tage" */
export function daysLabel(n: number): string {
  return `${n.toLocaleString("de-DE")} ${n === 1 ? "Tag" : "Tage"}`;
}

/** "bei 1 Tag" / "bei 10 Tagen" */
export function daysDative(n: number): string {
  return `${n.toLocaleString("de-DE")} ${n === 1 ? "Tag" : "Tagen"}`;
}
