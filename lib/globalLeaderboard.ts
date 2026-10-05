"use client";

// Echte globale Rangliste: liest die Rangliste-Punkte ALLER Spieler aus der
// "profiles"-Tabelle (jeder darf alle Profile lesen, siehe
// supabase/social-features.sql) und für die Spieltags-Ansicht die in dieser
// Woche ausgewerteten Tipps aller Spieler. Ersetzt die früheren Mock-Daten.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useResumeTick } from "@/lib/appRefresh";
import { Sport, SPORTS } from "@/lib/types";
import { WeekWindow } from "@/lib/weeklyLeaderboard";

export interface GlobalPlayer {
  id: string;
  name: string;
  pointsBySport: Record<Sport, number>;
  total: number;
  /** Im Profil gewähltes Rang-Icon (null = automatisch das stärkste). */
  rankIconId: string | null;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  rang_punkte: Partial<Record<Sport, number>> | null;
  /** Fehlt, solange supabase/rang-icon-auswahl.sql noch nicht ausgeführt ist. */
  rank_icon_id?: string | null;
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

interface WeeklyTipRow {
  user_id: string;
  rang_delta: number | null;
  rang_booked?: number | null;
  ranking_legacy?: boolean | null;
}

// Ausgewertete Tipps der Woche. Fehlt die Spalte ranking_legacy noch (SQL
// rankingsystem.sql noch nicht ausgeführt), ohne sie laden.
async function loadWeeklyTips(weekStart: string, weekEnd: string) {
  const query = (columns: string) =>
    supabase.from("tips").select(columns).eq("evaluated", true).gte("submitted_at", weekStart).lt("submitted_at", weekEnd);
  const res = await query("user_id, rang_delta, rang_booked, ranking_legacy");
  if (res.error && /ranking_legacy|rang_booked/.test(res.error.message)) return query("user_id, rang_delta");
  return res;
}

export function useGlobalLeaderboard(weekWindow: WeekWindow) {
  const [players, setPlayers] = useState<GlobalPlayer[]>([]);
  // Rangpunkte-Änderung dieser Woche je Spieler-ID (nur Spieler mit Tipps).
  const [weeklyByUser, setWeeklyByUser] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  // Fehlermeldung der Datenbank (null = alles ok) – wird klein auf der Seite
  // angezeigt, damit man bei Problemen sieht, woran es liegt.
  const [error, setError] = useState<string | null>(null);
  // Hochzählen lädt die Rangliste neu ("Nochmal versuchen"-Knopf).
  const [attempt, setAttempt] = useState(0);
  const weekStart = weekWindow.start.toISOString();
  const weekEnd = weekWindow.end.toISOString();
  // Beim Zurückkehren in die App still im Hintergrund neu laden: ohne
  // Lade-Anzeige, und ein Fehler dabei lässt die angezeigte Liste stehen.
  const resumeTick = useResumeTick();
  const shownKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    const key = `${weekStart}|${weekEnd}|${attempt}`;
    const silent = shownKeyRef.current === key;
    if (!silent) setLoading(true);
    (async () => {
      const [profilesResult, tipsRes] = await Promise.all([
        loadProfiles(() => cancelled),
        loadWeeklyTips(weekStart, weekEnd),
      ]);
      if (cancelled) return;

      if ("error" in profilesResult) {
        console.warn("Rangliste konnte nicht geladen werden:", profilesResult.error);
        if (silent) return;
        setError(profilesResult.error);
        setPlayers([]);
        setLoading(false);
        return;
      }

      setError(null);
      setPlayers(
        profilesResult.rows.map((row) => {
          const pointsBySport = toPointsBySport(row.rang_punkte);
          return {
            id: row.id,
            name: row.display_name?.trim() || "Spieler",
            pointsBySport,
            total: sumPoints(pointsBySport),
            rankIconId: row.rank_icon_id ?? null,
          };
        })
      );

      const weekly = new Map<string, number>();
      if (tipsRes.error) {
        console.warn("Spieltags-Rangliste konnte nicht geladen werden:", tipsRes.error.message);
      } else {
        for (const row of (tipsRes.data ?? []) as unknown as WeeklyTipRow[]) {
          // Tipps von vor dem Neustart der Rangpunkte zählen nicht mehr.
          if (row.ranking_legacy) continue;
          // Wirklich gebuchte Punkte (nie unter 0), sonst die gerechneten.
          weekly.set(row.user_id, (weekly.get(row.user_id) ?? 0) + (row.rang_booked ?? row.rang_delta ?? 0));
        }
      }
      setWeeklyByUser(weekly);
      setLoading(false);
      shownKeyRef.current = key;
    })();
    return () => {
      cancelled = true;
    };
  }, [weekStart, weekEnd, attempt, resumeTick]);

  return {
    players,
    weeklyByUser,
    loading,
    failed: error !== null,
    error,
    retry: () => setAttempt((n) => n + 1),
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Lädt alle Profile. Robust gegen zwei Fehlerarten:
 * - kurzer Verbindungsfehler (z. B. direkt nach dem Seitenaufruf, während
 *   die Login-Sitzung noch aufgefrischt wird) -> bis zu 3 Versuche;
 * - fehlende Spalte (z. B. rang_punkte oder rank_icon_id noch nicht angelegt) -> zweiter
 *   Versuch mit "*", dann zählen fehlende Punkte einfach als 0.
 */
export async function loadProfiles(isCancelled: () => boolean): Promise<{ rows: ProfileRow[] } | { error: string }> {
  let lastError = "Unbekannter Fehler";
  for (let tryNo = 0; tryNo < 3; tryNo++) {
    if (tryNo > 0) await wait(600 * tryNo);
    if (isCancelled()) return { error: "abgebrochen" };

    const res = await supabase.from("profiles").select("id, display_name, rang_punkte, rank_icon_id");
    if (!res.error && res.data) return { rows: res.data as ProfileRow[] };
    lastError = res.error?.message ?? "Keine Daten";

    const fallback = await supabase.from("profiles").select("*");
    if (!fallback.error && fallback.data) return { rows: fallback.data as ProfileRow[] };
    lastError = `${lastError} / ${fallback.error?.message ?? "Keine Daten"}`;
  }
  return { error: lastError };
}
