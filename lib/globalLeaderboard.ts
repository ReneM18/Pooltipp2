"use client";

// Echte globale Rangliste: liest die Rangliste-Punkte ALLER Spieler aus der
// "profiles"-Tabelle (jeder darf alle Profile lesen, siehe
// supabase/social-features.sql) und für die Wochen-Ansicht die in dieser
// Woche ausgewerteten Tipps aller Spieler. Ersetzt die früheren Mock-Daten.

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useResumeTick } from "@/lib/appRefresh";
import { Sport, SPORTS, ALL_SPORTS } from "@/lib/types";
import { WeekWindow, weeklyTipPoints } from "@/lib/weeklyLeaderboard";
import { PrestigeBySport } from "@/lib/rankTiers";

export interface GlobalPlayer {
  id: string;
  name: string;
  pointsBySport: Record<Sport, number>;
  total: number;
  /** Im Profil gewähltes Rang-Icon (null = automatisch das stärkste). */
  rankIconId: string | null;
  /** Prestige-Stufe je Sportart (leer = keine). */
  prestige: PrestigeBySport;
}

export interface ProfileRow {
  id: string;
  display_name: string | null;
  rang_punkte: Partial<Record<Sport, number>> | null;
  /** Fehlt, solange supabase/rang-icon-auswahl.sql noch nicht ausgeführt ist. */
  rank_icon_id?: string | null;
  /** Fehlt, solange supabase/prestige.sql noch nicht ausgeführt ist. */
  prestige?: PrestigeBySport | null;
}

export function toPointsBySport(raw: Partial<Record<Sport, number>> | null | undefined): Record<Sport, number> {
  const result = {} as Record<Sport, number>;
  for (const sport of ALL_SPORTS) {
    const value = Number(raw?.[sport] ?? 0);
    result[sport] = Number.isFinite(value) ? value : 0;
  }
  return result;
}

// Gesamtpunkte nur aus aktiven Sportarten (ausgeblendete zählen nicht mit,
// bleiben aber gespeichert und zählen wieder, sobald sie eingeschaltet sind).
export function sumPoints(points: Record<Sport, number>): number {
  return SPORTS.reduce((sum, sport) => sum + points[sport], 0);
}

interface WeeklyTipRow {
  user_id: string;
  rang_delta: number | null;
  base_points?: number | null;
  joker?: string | null;
  ranking_legacy?: boolean | null;
}

// Tipp-Punkte der Woche je Spieler. Rechnet die Datenbank (weekly_points in
// supabase/wochensieger.sql, nach Anpfiff wie die Auszahlung "Erster der
// Woche"); fehlt die Funktion noch, ersatzweise aus den Tipps nach
// Abgabezeit.
async function loadWeeklyPoints(weekStart: string, weekEnd: string): Promise<Map<string, number> | { error: string }> {
  const rpc = await supabase.rpc("weekly_points", { p_from: weekStart, p_to: weekEnd });
  if (!rpc.error) {
    const weekly = new Map<string, number>();
    for (const row of (rpc.data ?? []) as { user_id: string; points: number }[]) weekly.set(row.user_id, row.points ?? 0);
    return weekly;
  }
  const res = await supabase
    .from("tips")
    .select("user_id, rang_delta, base_points, joker, ranking_legacy")
    .eq("evaluated", true)
    .gte("submitted_at", weekStart)
    .lt("submitted_at", weekEnd);
  if (res.error) return { error: res.error.message };
  const weekly = new Map<string, number>();
  for (const row of (res.data ?? []) as unknown as WeeklyTipRow[]) {
    // Tipps von vor dem Neustart der Rangpunkte zählen nicht mehr.
    if (row.ranking_legacy) continue;
    // Nur Tipp-Punkte, ohne Platz-Bonus (lib/weeklyLeaderboard.ts).
    const points = weeklyTipPoints({
      basePoints: row.base_points ?? undefined,
      rangDelta: row.rang_delta ?? undefined,
      joker: row.joker,
    });
    weekly.set(row.user_id, (weekly.get(row.user_id) ?? 0) + points);
  }
  return weekly;
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
        loadWeeklyPoints(weekStart, weekEnd),
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
            prestige: row.prestige ?? {},
          };
        })
      );

      let weekly = new Map<string, number>();
      if ("error" in tipsRes) {
        console.warn("Wochen-Rangliste konnte nicht geladen werden:", tipsRes.error);
      } else {
        weekly = tipsRes;
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
 * - fehlende Spalte (z. B. rang_punkte, rank_icon_id oder prestige noch nicht angelegt) -> zweiter
 *   Versuch mit "*", dann zählen fehlende Punkte einfach als 0.
 */
export async function loadProfiles(isCancelled: () => boolean): Promise<{ rows: ProfileRow[] } | { error: string }> {
  let lastError = "Unbekannter Fehler";
  for (let tryNo = 0; tryNo < 3; tryNo++) {
    if (tryNo > 0) await wait(600 * tryNo);
    if (isCancelled()) return { error: "abgebrochen" };

    const res = await supabase.from("profiles").select("id, display_name, rang_punkte, rank_icon_id, prestige");
    if (!res.error && res.data) return { rows: res.data as ProfileRow[] };
    lastError = res.error?.message ?? "Keine Daten";

    const fallback = await supabase.from("profiles").select("*");
    if (!fallback.error && fallback.data) return { rows: fallback.data as ProfileRow[] };
    lastError = `${lastError} / ${fallback.error?.message ?? "Keine Daten"}`;
  }
  return { error: lastError };
}
