"use client";

// Echte globale Rangliste: liest die Rangliste-Punkte ALLER Spieler aus der
// "profiles"-Tabelle (jeder darf alle Profile lesen, siehe
// supabase/social-features.sql) und für die Spieltags-Ansicht die in dieser
// Woche ausgewerteten Tipps aller Spieler. Ersetzt die früheren Mock-Daten.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Sport, SPORTS } from "@/lib/types";
import { WeekWindow } from "@/lib/weeklyLeaderboard";

export interface GlobalPlayer {
  id: string;
  name: string;
  pointsBySport: Record<Sport, number>;
  total: number;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  rang_punkte: Partial<Record<Sport, number>> | null;
}

export function toPointsBySport(raw: Partial<Record<Sport, number>> | null | undefined): Record<Sport, number> {
  const result = {} as Record<Sport, number>;
  for (const sport of SPORTS) {
    const value = Number(raw?.[sport] ?? 0);
    result[sport] = Number.isFinite(value) ? value : 0;
  }
  return result;
}

export function sumPoints(points: Record<Sport, number>): number {
  return SPORTS.reduce((sum, sport) => sum + points[sport], 0);
}

export function useGlobalLeaderboard(weekWindow: WeekWindow) {
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  // Rangpunkte-Änderung dieser Woche je Spieler-ID (nur Spieler mit Tipps).
  const [weeklyByUser, setWeeklyByUser] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const weekStart = weekWindow.start.toISOString();
  const weekEnd = weekWindow.end.toISOString();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [profilesRes, tipsRes] = await Promise.all([
        supabase.from("profiles").select("id, display_name, rang_punkte"),
        supabase
          .from("tips")
          .select("user_id, rang_delta")
          .eq("evaluated", true)
          .gte("submitted_at", weekStart)
          .lt("submitted_at", weekEnd),
      ]);
      if (cancelled) return;

      if (profilesRes.error || !profilesRes.data) {
        console.warn("Rangliste konnte nicht geladen werden:", profilesRes.error?.message);
        setFailed(true);
        setLoading(false);
        return;
      }

      setPlayers(
        (profilesRes.data as ProfileRow[]).map((row) => {
          const pointsBySport = toPointsBySport(row.rang_punkte);
          return {
            id: row.id,
            name: row.display_name?.trim() || "Spieler",
            pointsBySport,
            total: sumPoints(pointsBySport),
          };
        })
      );

      const weekly = new Map<string, number>();
      if (tipsRes.error) {
        console.warn("Spieltags-Rangliste konnte nicht geladen werden:", tipsRes.error.message);
      } else {
        for (const row of (tipsRes.data ?? []) as { user_id: string; rang_delta: number | null }[]) {
          weekly.set(row.user_id, (weekly.get(row.user_id) ?? 0) + (row.rang_delta ?? 0));
        }
      }
      setWeeklyByUser(weekly);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd]);

  return { players, weeklyByUser, loading, failed };
}
