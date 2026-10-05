"use client";

// Vereinswertung (Herzensverein pro Sportart). Gerechnet wird komplett in
// der Datenbank (supabase/vereinswertung.sql), hier wird nur gelesen und
// über die Datenbank-Funktionen gespeichert – so kann sich niemand im
// Browser Vereinspunkte geben.

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAppRefresh } from "@/lib/appRefresh";
import { Sport, SPORTS } from "@/lib/types";

/** Ab so vielen aktiven Fans wird ein Verein in der Tabelle gewertet. */
export const CLUB_MIN_ACTIVE_FANS = 10;
/** Ab so vielen gewerteten Tipps in der Saison zählt ein Fan als aktiv. */
export const CLUB_MIN_TIPS = 3;

export interface ClubTableRow {
  teamId: string;
  fans: number;
  activeFans: number;
  score: number;
  ranked: boolean;
}

export interface MyClub {
  sport: Sport;
  teamId: string | null;
  since: string | null;
  nextChangeAt: string | null;
  tips: number;
  avgPoints: number;
}

export function useClubTable(sport: Sport, enabled = true) {
  const [rows, setRows] = useState<ClubTableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase.rpc("club_table", { p_sport: sport });
      if (cancelled) return;
      if (error) {
        console.warn("Vereinstabelle konnte nicht geladen werden:", error.message);
        setError(error.message);
        setRows([]);
      } else {
        setError(null);
        setRows(
          ((data ?? []) as { team_id: string; fans: number; active_fans: number; score: number; ranked: boolean }[]).map(
            (r) => ({ teamId: r.team_id, fans: r.fans, activeFans: r.active_fans, score: r.score, ranked: r.ranked })
          )
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [sport, enabled, attempt]);

  return { rows, loading, error, retry: () => setAttempt((n) => n + 1) };
}

interface MyClubRow {
  sport: Sport;
  team_id: string | null;
  since: string | null;
  next_change_at: string | null;
  tips: number;
  avg_points: number | string;
  play_for_clubs: boolean;
}

export function useMyClubs(authUserId: string | null) {
  const [clubs, setClubs] = useState<Record<Sport, MyClub> | null>(null);
  const [playForClubs, setPlayForClubsState] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!authUserId) {
      setClubs(null);
      setLoading(false);
      return;
    }
    const { data, error } = await supabase.rpc("my_clubs");
    if (error) {
      console.warn("Herzensvereine konnten nicht geladen werden:", error.message);
      setError(error.message);
      setLoading(false);
      return;
    }
    const result = {} as Record<Sport, MyClub>;
    for (const sport of SPORTS) {
      result[sport] = { sport, teamId: null, since: null, nextChangeAt: null, tips: 0, avgPoints: 0 };
    }
    let on = true;
    for (const row of (data ?? []) as MyClubRow[]) {
      if (!SPORTS.includes(row.sport)) continue;
      on = row.play_for_clubs;
      result[row.sport] = {
        sport: row.sport,
        teamId: row.team_id,
        since: row.since,
        nextChangeAt: row.next_change_at,
        tips: row.tips ?? 0,
        avgPoints: Number(row.avg_points ?? 0),
      };
    }
    setError(null);
    setClubs(result);
    setPlayForClubsState(on);
    setLoading(false);
  }, [authUserId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Auf einem anderen Gerät gewählt: sofort übernehmen (supabase/profil-sync.sql),
  // verpasst das Handy im Hintergrund etwas, beim Zurückkehren in die App.
  const loadRef = useRef(load);
  loadRef.current = load;
  useAppRefresh(() => loadRef.current());
  useEffect(() => {
    if (!authUserId) return;
    let timer: number | undefined;
    const reload = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadRef.current(), 300);
    };
    // Eigener Kanal je Hook (die Seite kann ihn mehrfach nutzen).
    const channel = supabase
      .channel(`my_clubs_live_${authUserId}_${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_fans", filter: `user_id=eq.${authUserId}` }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "club_settings", filter: `user_id=eq.${authUserId}` }, reload)
      .subscribe();
    return () => {
      window.clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  /** Gibt bei Erfolg null zurück, sonst die (deutsche) Fehlermeldung. */
  async function chooseClub(sport: Sport, teamId: string | null): Promise<string | null> {
    const { error } = await supabase.rpc("set_favorite_club", { p_sport: sport, p_team_id: teamId });
    await load();
    return error ? error.message : null;
  }

  async function setPlayForClubs(on: boolean): Promise<string | null> {
    setPlayForClubsState(on);
    const { error } = await supabase.rpc("set_play_for_clubs", { p_on: on });
    await load();
    return error ? error.message : null;
  }

  return { clubs, playForClubs, loading, error, chooseClub, setPlayForClubs };
}

export function formatDay(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}
