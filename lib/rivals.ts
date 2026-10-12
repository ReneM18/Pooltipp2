"use client";

// Rivalen-Vergleich (supabase/rivalen.sql): Suche, Vergleich und die eigene
// Einstellung "Wer darf meine Statistik sehen?". Gerechnet und geprüft wird in
// der Datenbank, hier wird nur geladen und angezeigt.

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export type StatsVisibility = "public" | "friends" | "private";

export interface RivalSearchHit {
  id: string;
  name: string;
  number: number | null;
  isFriend: boolean;
  visible: boolean;
}

export interface RivalStats {
  name: string;
  number: number | null;
  visible: boolean;
  rang?: number;
  bestSport?: string | null;
  tips?: number;
  evaluated?: number;
  exakt?: number;
  richtig?: number;
  streak?: number;
}

export interface RivalCompare {
  me: RivalStats;
  other: RivalStats;
  h2h: { games: number; me: number; other: number } | null;
}

export async function searchRivals(query: string): Promise<RivalSearchHit[] | null> {
  const { data, error } = await supabase.rpc("search_rivals", { p_query: query });
  if (error) {
    console.warn("Rivalen-Suche fehlgeschlagen:", error.message);
    return null;
  }
  return ((data ?? []) as { id: string; display_name: string | null; user_number: number | null; is_friend: boolean; visible: boolean }[]).map(
    (r) => ({
      id: r.id,
      name: r.display_name?.trim() || "Spieler",
      number: r.user_number,
      isFriend: !!r.is_friend,
      visible: !!r.visible,
    })
  );
}

export async function compareRival(otherId: string): Promise<RivalCompare | null> {
  const { data, error } = await supabase.rpc("rival_compare", { p_other: otherId });
  if (error || !data) {
    if (error) console.warn("Vergleich fehlgeschlagen:", error.message);
    return null;
  }
  return data as RivalCompare;
}

// Eigene Einstellung: aus der Datenbank (pro Konto), Änderungen auf anderen
// Geräten kommen per Realtime an.
export function useStatsVisibility(userId: string | null) {
  const [value, setValue] = useState<StatsVisibility>("public");
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("my_stats_visibility");
    if (error) {
      setMissing(true);
      return;
    }
    setMissing(false);
    if (data === "public" || data === "friends" || data === "private") setValue(data);
    setReady(true);
  }, [userId]);

  useEffect(() => {
    void load();
    if (!userId) return;
    const channel = supabase
      .channel(`stats_visibility_${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_extras", filter: `id=eq.${userId}` }, () =>
        void load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, load]);

  async function save(next: StatsVisibility): Promise<string | null> {
    const { error } = await supabase.rpc("set_stats_visibility", { p_value: next });
    if (error) return error.message;
    setValue(next);
    return null;
  }

  return { value, ready, missing, save };
}
