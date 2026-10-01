"use client";

// Turnier-Mini-Rangliste: begrenzt auf genau die Spiele, die einem Turnier
// zugeordnet sind. Läuft jetzt mit ECHTEN Werten aller registrierten User
// (vorher waren die "anderen Mitspieler" pro Turnier nur simuliert, weil es
// kein Backend gab) – siehe useTournamentStandings unten.
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import { Tournament, TournamentStatus } from "./tournamentTypes";

export function getTournamentStatus(tournament: Tournament, now: Date = new Date()): TournamentStatus {
  const t = now.getTime();
  const start = new Date(tournament.startDate).getTime();
  const end = new Date(tournament.endDate).getTime();
  if (t < start) return "kommend";
  if (t >= end) return "beendet";
  return "aktiv";
}

export interface TournamentEntry {
  name: string;
  points: number;
}

/** Summe der Rangliste-Punkte-Änderung aus allen eigenen, ausgewerteten Tipps zu Spielen dieses Turniers. */
export function sumTournamentRangDelta(
  tips: { evaluated?: boolean; rangDelta?: number; matchId: string }[],
  matchIds: string[]
): number {
  const idSet = new Set(matchIds);
  return tips
    .filter((t) => t.evaluated && t.rangDelta !== undefined && idSet.has(t.matchId))
    .reduce((sum, t) => sum + (t.rangDelta ?? 0), 0);
}

// Echte Turnier-Rangliste: summiert die rang_delta-Werte ALLER registrierten
// User über die ausgewerteten Tipps zu den Spielen dieses Turniers (nicht
// nur die eigenen) – dafür müssen Tipps über alle User hinweg lesbar sein,
// siehe die "Alle Tipps lesen"-Regel in supabase/social-features.sql.
export function useTournamentStandings(matchIds: string[]): { entries: TournamentEntry[]; loading: boolean } {
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const key = matchIds.join(",");

  useEffect(() => {
    if (!key) {
      setEntries([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data: tips, error: tipsError } = await supabase
        .from("tips")
        .select("user_id, rang_delta")
        .in("match_id", key.split(","))
        .eq("evaluated", true);

      if (cancelled) return;
      if (tipsError || !tips) {
        console.warn("Turnier-Rangliste konnte nicht geladen werden:", tipsError?.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      const totalsByUser = new Map<string, number>();
      for (const row of tips as { user_id: string; rang_delta: number | null }[]) {
        totalsByUser.set(row.user_id, (totalsByUser.get(row.user_id) ?? 0) + (row.rang_delta ?? 0));
      }
      const userIds = [...totalsByUser.keys()];
      if (userIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);
      if (cancelled) return;
      if (profilesError || !profiles) {
        console.warn("Turnier-Rangliste: Profile konnten nicht geladen werden:", profilesError?.message);
        setEntries([]);
        setLoading(false);
        return;
      }

      const nameById = new Map((profiles as { id: string; display_name: string }[]).map((p) => [p.id, p.display_name]));
      setEntries(
        userIds.map((id) => ({ name: nameById.get(id) ?? "Unbekannt", points: totalsByUser.get(id) ?? 0 }))
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  return { entries, loading };
}
