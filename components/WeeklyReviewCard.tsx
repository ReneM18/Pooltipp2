"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { computeWeeklyReview, getPreviousWeekWindow, weekKey, weekRangeText } from "@/lib/weeklyReview";
import { useMyWeeklyWin } from "@/lib/weeklyWinner";

// Karte "Deine letzte Woche" oben auf der Tipps-Seite: erscheint ab
// Dienstag 8:00 (Wochenwechsel, lib/weeklyLeaderboard.ts), wenn man in der
// Vorwoche getippt hat, und bleibt, bis man sie ansieht oder wegklickt. Das "gesehen" gilt fürs Konto, also auf jedem
// Gerät (profile_extras.review_seen_week, supabase/dranbleiben.sql).
export default function WeeklyReviewCard() {
  const { isRegistered, authUserId, reviewSeenReady, reviewSeenWeek, markReviewSeen } = useUser();
  const { myTips, myTipsLoaded, matches } = useAppData();
  const router = useRouter();

  const weekWin = useMemo(() => getPreviousWeekWindow(), []);
  const key = weekKey(weekWin);
  const review = useMemo(() => computeWeeklyReview(myTips, matches, weekWin), [myTips, matches, weekWin]);
  const weeklyWin = useMyWeeklyWin(isRegistered ? authUserId : null, key);

  if (!isRegistered || !reviewSeenReady || !myTipsLoaded || review.tips === 0) return null;
  // Bis Oktober 2026 begann die Woche am Montag: ein dort gemerktes "gesehen"
  // (Montag vor dem Dienstag) gilt weiter für dieselbe Woche.
  if (reviewSeenWeek && reviewSeenWeek >= dayBefore(key)) return null;

  const points = `${review.points > 0 ? "+" : review.points < 0 ? "−" : ""}${Math.abs(review.points).toLocaleString("de-DE")}`;

  function open() {
    markReviewSeen(key);
    router.push("/rueckblick");
  }

  return (
    <div className="mb-5 flex items-center gap-1 rounded-card border border-gold/40 bg-gold/10 pr-2">
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-card p-3 text-left sm:p-4"
      >
        <span className="text-2xl" aria-hidden>
          {weeklyWin ? "🥇" : "📊"}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-sm font-semibold text-ink">
            Deine Woche <span className="whitespace-nowrap font-body text-xs font-normal text-muted">{weekRangeText(weekWin)}</span>
          </span>
          <span className="block text-xs text-muted">
            <span className="whitespace-nowrap">
              {review.tips} {review.tips === 1 ? "Tipp" : "Tipps"} · {review.exakt} exakt
            </span>{" "}
            ·{" "}
            <span className={`whitespace-nowrap font-semibold ${review.points > 0 ? "text-action" : "text-ink"}`}>
              {points} Punkte
            </span>
          </span>
          {weeklyWin && (
            <span className="block text-xs font-semibold text-gold">Erster der Woche · +{weeklyWin.xp} Pass-XP</span>
          )}
        </span>
        <span className="shrink-0 whitespace-nowrap font-display text-sm font-semibold text-gold">Ansehen ›</span>
      </button>
      <button
        type="button"
        onClick={() => markReviewSeen(key)}
        aria-label="Wochenrückblick ausblenden"
        className="shrink-0 p-2 text-lg leading-none text-muted transition-colors hover:text-ink"
      >
        ✕
      </button>
    </div>
  );
}

/** "2026-10-06" → "2026-10-05" */
function dayBefore(key: string): string {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}
