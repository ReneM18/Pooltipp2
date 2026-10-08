"use client";

// Erster der Woche: wer in einer abgeschlossenen Woche die meisten
// Rangpunkte gemacht hat (alle Sportarten zusammen, wie im Ranglisten-Reiter
// "Woche"), bekommt Saison-XP. Ausgezahlt wird nur auf dem Server
// (supabase/wochensieger.sql): beim Öffnen der App ruft jedes eingeloggte
// Gerät settle_weekly_winners() auf, die Datenbank zahlt jede Woche nur
// einmal aus. Die neuen XP kommen über den Sofort-Abgleich des Profils auf
// alle Geräte (lib/UserContext.tsx). Nie Coins, Joker oder Gutscheine.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface WeeklyWinnerRules {
  xp: number;
  minPlayers: number;
}

/** Werte wie in supabase/wochensieger.sql, falls die Tabelle fehlt. */
export const DEFAULT_WEEKLY_WINNER_RULES: WeeklyWinnerRules = { xp: 50, minPlayers: 3 };

let lastSettle = 0;

/** Abgeschlossene Wochen auszahlen lassen. Fehler (z. B. SQL noch nicht ausgeführt) still ignorieren. */
export async function settleWeeklyWinners(): Promise<void> {
  const now = Date.now();
  if (now - lastSettle < 10 * 60_000) return;
  lastSettle = now;
  const { error } = await supabase.rpc("settle_weekly_winners");
  if (error) console.warn("Wochensieger konnten nicht ausgezahlt werden:", error.message);
}

export function useWeeklyWinnerRules(): WeeklyWinnerRules {
  const [rules, setRules] = useState(DEFAULT_WEEKLY_WINNER_RULES);
  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("weekly_winner_settings")
      .select("xp, min_players")
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        setRules({ xp: data.xp ?? DEFAULT_WEEKLY_WINNER_RULES.xp, minPlayers: data.min_players ?? DEFAULT_WEEKLY_WINNER_RULES.minPlayers });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return rules;
}

/**
 * Eigener Sieg in der Woche (Starttag Dienstag als "2026-10-06"), sonst null. Kommt
 * die Auszahlung auf einem anderen Gerät, erscheint der Hinweis sofort.
 */
export function useMyWeeklyWin(userId: string | null, week: string): { xp: number; points: number } | null {
  const [win, setWin] = useState<{ xp: number; points: number } | null>(null);
  useEffect(() => {
    setWin(null);
    if (!userId) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("weekly_winners")
        .select("xp, points")
        .eq("user_id", userId)
        .eq("week_start", week)
        .maybeSingle();
      if (!cancelled) setWin(data ? { xp: data.xp, points: data.points } : null);
    };
    void load();
    const channel = supabase
      .channel(`my_weekly_win_${userId}_${week}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "weekly_winners", filter: `user_id=eq.${userId}` },
        () => void load()
      )
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId, week]);
  return win;
}
