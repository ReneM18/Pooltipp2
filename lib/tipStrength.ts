"use client";

// Tippstärke (Elo-Zahl pro Sportart) aus der Tabelle tip_strength, die nur
// die Datenbank bei der Auswertung schreibt (supabase/duelle-punkte.sql).
// Fehlt die Tabelle noch (SQL nicht ausgeführt), kommt einfach nichts.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface TipStrengthEntry {
  sport: string;
  rating: number;
  evaluatedTips: number;
}

export function useTipStrength(userId: string | null | undefined, refreshKey = 0) {
  const [entries, setEntries] = useState<TipStrengthEntry[] | null>(null);

  useEffect(() => {
    if (!userId) {
      setEntries(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("tip_strength")
        .select("sport, rating, evaluated_tips")
        .eq("user_id", userId);
      if (cancelled) return;
      if (error || !data) {
        setEntries(null);
        return;
      }
      setEntries(
        (data as { sport: string; rating: number; evaluated_tips: number }[])
          .map((r) => ({ sport: r.sport, rating: r.rating, evaluatedTips: r.evaluated_tips }))
          .sort((a, b) => b.evaluatedTips - a.evaluatedTips)
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  return entries;
}
