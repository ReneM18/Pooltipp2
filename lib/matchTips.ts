"use client";

// Echte Tipps ALLER Spieler zu einem Spiel, mit Anzeigename (und Nutzer-
// nummer, falls vorhanden) – für die Liste "Wer hat getippt?" auf der
// Spielkarte und den Vergleich "besser als X von Y Mitspielern" nach der
// Auswertung. Es werden bewusst nur Name + Nummer geladen, keine Mail.

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export interface MatchTipper {
  userId: string;
  name: string;
  userNumber: number | null;
  // null: fremder Tipp vor Tippschluss (die Datenbank verrät die Zahlen nicht).
  predictedHome: number | null;
  predictedAway: number | null;
}

interface TipRow {
  user_id: string;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
}

interface ProfileRow {
  id: string;
  display_name: string | null;
  user_number?: number | null;
}

async function loadProfiles(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) return [];
  const res = await supabase.from("profiles").select("id, display_name, user_number").in("id", ids);
  if (!res.error && res.data) return res.data as ProfileRow[];
  // Ohne Nutzernummer-Spalte (freunde.sql noch nicht ausgeführt) nur den Namen.
  const fallback = await supabase.from("profiles").select("id, display_name").in("id", ids);
  return (fallback.data ?? []) as ProfileRow[];
}

/**
 * Lädt die Tipps zu einem Spiel, sobald `enabled` true ist. `refreshKey`
 * (z. B. die Anzahl Tipps) lädt neu, wenn jemand dazukommt oder einen
 * Tipp zurücknimmt.
 */
export function useMatchTips(matchId: string, enabled: boolean, refreshKey: number | string) {
  const [tippers, setTippers] = useState<MatchTipper[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      // Die Datenbank liefert alle Namen, die Zahlen fremder Tipps aber erst
      // ab Tippschluss (match_tippers, supabase/tipps-schutz.sql). Ohne die
      // Funktion (SQL noch nicht ausgeführt) wie früher direkt lesen.
      let { data, error } = await supabase.rpc("match_tippers", { p_match_id: matchId });
      if (error) {
        ({ data, error } = await supabase
          .from("tips")
          .select("user_id, predicted_home_score, predicted_away_score")
          .eq("match_id", matchId));
      }
      if (cancelled) return;
      if (error || !data) {
        if (error) console.warn("Tipps zum Spiel konnten nicht geladen werden:", error.message);
        setFailed(true);
        return;
      }
      const rows = data as TipRow[];
      const profiles = await loadProfiles(Array.from(new Set(rows.map((r) => r.user_id))));
      if (cancelled) return;
      const byId = new Map(profiles.map((p) => [p.id, p]));
      // Pro Spieler nur ein Eintrag (falls je doppelt gespeichert wurde).
      const seen = new Set<string>();
      const list: MatchTipper[] = [];
      for (const r of rows) {
        if (seen.has(r.user_id)) continue;
        seen.add(r.user_id);
        const profile = byId.get(r.user_id);
        list.push({
          userId: r.user_id,
          name: profile?.display_name?.trim() || "Spieler",
          userNumber: typeof profile?.user_number === "number" ? profile.user_number : null,
          predictedHome: r.predicted_home_score,
          predictedAway: r.predicted_away_score,
        });
      }
      list.sort((a, b) => a.name.localeCompare(b.name, "de"));
      setFailed(false);
      setTippers(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, enabled, refreshKey]);

  return { tippers, failed };
}
