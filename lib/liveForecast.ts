"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { loadProfiles, toPointsBySport } from "@/lib/globalLeaderboard";
import { BEGINNER_SHIELD_TIPS, RANKING_POINTS, classifyRankingTip } from "@/lib/poolScore";
import { peekLiveScore, useLiveStoreVersion } from "@/lib/useLiveScores";
import type { Match, Sport } from "@/lib/types";

// "Wenn es so bleibt" (Rene, 15.10.2026: Spieltag-Umbau): vorläufiger Platz
// des Spielers in der Rangliste der Sportart (Rangpunkte wie app/rangliste,
// gleiche Punkte = gleicher Platz), wenn alle laufenden Spiele so enden.
//
// Gerechnet wird für ALLE Spieler mit Tipps auf laufende Spiele: feste Punkte
// des Live-Stands (classifyRankingTip + RANKING_POINTS, ohne Bonus gegen die
// Mittipper und ohne Joker), Anfänger-Schutz (erste 10 gewertete Tipps
// insgesamt kein Minus), Rangpunkte nie unter 0 – auf die aktuellen
// Rangpunkte addiert und neu sortiert.
//
// Ohne neues SQL: Fremde Tipps gibt die Datenbank ab Tippschluss heraus
// (Richtlinie "Tipps lesen", supabase/tipps-schutz.sql) – laufende Spiele
// sind immer nach Tippschluss. Rangpunkte aller Spieler stehen in profiles
// (wie die Rangliste). Für den Anfänger-Schutz zählen wir die gewerteten
// Tipps der beteiligten Spieler (auch das sind Tipps beendeter Spiele).
// Geladen wird einmal und dann höchstens alle 10 Minuten neu; neue Live-
// Stände rechnet der Browser ohne Datenbank-Abfrage neu.
//
// "Laufend" = Spiel mit Live-Stand (läuft, Pause oder laut Live-Daten schon
// abgepfiffen), das in der App noch keinen Endstand hat. Spiele ohne
// Live-Daten zählen nicht mit (ihr Stand ist unbekannt).

const REFRESH_MS = 10 * 60 * 1000;

interface TipRow {
  user_id: string;
  match_id: string;
  predicted_home_score: number | null;
  predicted_away_score: number | null;
}

interface Store {
  points: Map<string, Record<Sport, number>> | null;
  pointsAt: number;
  tips: Map<string, TipRow[]>; // je Spiel
  tipsAt: Map<string, number>;
  scored: Map<string, number>; // gewertete Tipps je Spieler
  scoredAt: Map<string, number>;
  loading: boolean;
  attemptAt: number;
  version: number;
  listeners: Set<() => void>;
}

const store: Store = {
  points: null,
  pointsAt: 0,
  tips: new Map(),
  tipsAt: new Map(),
  scored: new Map(),
  scoredAt: new Map(),
  loading: false,
  attemptAt: 0,
  version: 0,
  listeners: new Set(),
};

function changed() {
  store.version++;
  store.listeners.forEach((l) => l());
}

async function loadScoredCounts(userIds: string[]) {
  const counts = new Map<string, number>();
  for (let i = 0; i < userIds.length; i += 80) {
    const chunk = userIds.slice(i, i + 80);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("tips")
        .select("user_id")
        .in("user_id", chunk)
        .eq("evaluated", true)
        .not("result_tier", "is", null)
        .is("refunded_at", null)
        .order("id")
        .range(from, from + 999);
      if (error || !data) return null;
      for (const row of data as { user_id: string }[]) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
      if (data.length < 1000) break;
    }
  }
  return counts;
}

async function ensureLoaded(matchIds: string[]) {
  const now = Date.now();
  // Höchstens ein Ladeversuch alle 20 s (auch nach Fehlern, kein Dauerfeuer).
  if (store.loading || now - store.attemptAt < 20 * 1000) return;
  const needPoints = !store.points || now - store.pointsAt > REFRESH_MS;
  const needTips = matchIds.filter((id) => !store.tips.has(id) || now - (store.tipsAt.get(id) ?? 0) > REFRESH_MS);
  if (!needPoints && needTips.length === 0) {
    const users = new Set<string>();
    for (const id of matchIds) for (const t of store.tips.get(id) ?? []) users.add(t.user_id);
    const stale = Array.from(users).filter((u) => now - (store.scoredAt.get(u) ?? 0) > REFRESH_MS);
    if (stale.length === 0) return;
  }
  store.loading = true;
  store.attemptAt = now;
  try {
    if (needPoints) {
      const result = await loadProfiles(() => false);
      if ("rows" in result) {
        store.points = new Map(result.rows.map((r) => [r.id, toPointsBySport(r.rang_punkte)]));
        store.pointsAt = Date.now();
      }
    }
    if (needTips.length > 0) {
      const { data, error } = await supabase
        .from("tips")
        .select("user_id, match_id, predicted_home_score, predicted_away_score")
        .in("match_id", needTips);
      if (!error && data) {
        const byMatch = new Map<string, TipRow[]>(needTips.map((id) => [id, []]));
        for (const row of data as TipRow[]) byMatch.get(row.match_id)?.push(row);
        byMatch.forEach((rows, id) => {
          store.tips.set(id, rows);
          store.tipsAt.set(id, Date.now());
        });
      }
    }
    const users = new Set<string>();
    for (const id of matchIds) for (const t of store.tips.get(id) ?? []) users.add(t.user_id);
    const stale = Array.from(users).filter((u) => Date.now() - (store.scoredAt.get(u) ?? 0) > REFRESH_MS);
    if (stale.length > 0) {
      const counts = await loadScoredCounts(stale);
      if (counts) {
        for (const u of stale) {
          store.scored.set(u, counts.get(u) ?? 0);
          store.scoredAt.set(u, Date.now());
        }
      }
    }
  } finally {
    store.loading = false;
    changed();
  }
}

// Feste vorläufige Punkte eines Tipps mit dem Live-Stand (ohne Bonus und
// Joker), mit Anfänger-Schutz: scoredBefore = gewertete Tipps des Spielers
// vor diesem Tipp; unter BEGINNER_SHIELD_TIPS zählt ein Minus als 0.
// Auch für Freunde-Live (lib/friendsLive.ts) (Rene, 16.10.2026: Freunde-Live).
export function fixedLivePoints(
  tipHome: number,
  tipAway: number,
  home: number,
  away: number,
  isOneXTwo: boolean,
  scoredBefore: number,
): { tier: ReturnType<typeof classifyRankingTip>; points: number } {
  const tier = classifyRankingTip(tipHome, tipAway, home, away, isOneXTwo);
  const raw = RANKING_POINTS[tier];
  return { tier, points: scoredBefore < BEGINNER_SHIELD_TIPS ? Math.max(0, raw) : raw };
}

// Gewertete Tipps je Spieler (Anfänger-Schutz) aus demselben Speicher wie
// "Wenn es so bleibt" – Freunde-Live lädt nur nach, was noch fehlt oder
// älter als 10 Minuten ist (Rene, 16.10.2026: Freunde-Live).
let scoredLoading = false;
export async function ensureScoredCounts(userIds: string[]): Promise<void> {
  if (scoredLoading) return;
  const now = Date.now();
  const stale = userIds.filter((u) => now - (store.scoredAt.get(u) ?? 0) > REFRESH_MS);
  if (stale.length === 0) return;
  scoredLoading = true;
  try {
    const counts = await loadScoredCounts(stale);
    if (counts) {
      for (const u of stale) {
        store.scored.set(u, counts.get(u) ?? 0);
        store.scoredAt.set(u, Date.now());
      }
    }
  } finally {
    scoredLoading = false;
    changed();
  }
}

// Gewertete Tipps eines Spielers oder undefined (noch nicht geladen).
export function peekScoredCount(userId: string): number | undefined {
  return store.scored.get(userId);
}

export function subscribeForecastStore(listener: () => void): () => void {
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

export interface LiveForecast {
  rankNow: number;
  rankThen: number;
  // Vorläufige feste Punkte des Spielers aus allen laufenden Spielen der Sportart.
  myPoints: number;
}

// Vorläufiger Platz in der Sportart oder null (nicht eingeloggt, keine
// laufenden Spiele mit Live-Stand, Daten noch nicht geladen, enabled aus).
export function useLiveForecast(sport: Sport, enabled = true): LiveForecast | null {
  const { matches, getTeam, myTips } = useAppData();
  const { authUserId, rangPunkte, profileLoaded } = useUser();
  const liveVersion = useLiveStoreVersion();
  const [dataVersion, setDataVersion] = useState(store.version);

  useEffect(() => {
    const listener = () => setDataVersion(store.version);
    store.listeners.add(listener);
    return () => {
      store.listeners.delete(listener);
    };
  }, []);

  // Laufende Spiele der Sportart mit Live-Stand.
  const running = useMemo(() => {
    const list: { match: Match; home: number; away: number }[] = [];
    if (!enabled) return list;
    for (const m of matches) {
      if (m.sport !== sport || m.status === "cancelled" || m.draft) continue;
      if (m.status === "finished" && m.liveHomeScore !== null && m.liveAwayScore !== null) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const live = peekLiveScore(m, home.name, away.name);
      if (live) list.push({ match: m, home: live.homeScore, away: live.awayScore });
    }
    return list.sort((a, b) => Date.parse(a.match.kickoff) - Date.parse(b.match.kickoff));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, sport, liveVersion, enabled]);

  const idsKey = running.map((r) => r.match.id).join(",");
  useEffect(() => {
    if (!authUserId || !idsKey) return;
    void ensureLoaded(idsKey.split(","));
  }, [authUserId, idsKey, liveVersion, dataVersion]);

  return useMemo(() => {
    if (!authUserId || running.length === 0 || !store.points) return null;
    if (running.some((r) => !store.tips.has(r.match.id))) return null;
    const base = new Map<string, number>();
    store.points.forEach((points, id) => base.set(id, points[sport]));
    // Eigene Punkte wie in der Rangliste aus dem Browser (sofort aktuell).
    if (profileLoaded || !base.has(authUserId)) base.set(authUserId, rangPunkte[sport] ?? 0);

    const myScored = myTips.filter((t) => t.evaluated && t.resultTier && !t.refunded).length;
    const then = new Map(base);
    const slots = new Map<string, number>();
    let myPoints = 0;
    for (const r of running) {
      const isOneXTwo = r.match.tipMode === "1x2";
      for (const tip of store.tips.get(r.match.id) ?? []) {
        if (tip.predicted_home_score === null || tip.predicted_away_score === null) continue;
        if (!then.has(tip.user_id)) continue; // ohne Profil steht niemand in der Rangliste
        const scored = (tip.user_id === authUserId ? myScored : store.scored.get(tip.user_id) ?? BEGINNER_SHIELD_TIPS) + (slots.get(tip.user_id) ?? 0);
        slots.set(tip.user_id, (slots.get(tip.user_id) ?? 0) + 1);
        const { points } = fixedLivePoints(tip.predicted_home_score, tip.predicted_away_score, r.home, r.away, isOneXTwo, scored);
        if (tip.user_id === authUserId) myPoints += points;
        then.set(tip.user_id, Math.max(0, (then.get(tip.user_id) ?? 0) + points));
      }
    }
    const rankIn = (map: Map<string, number>) => {
      const mine = map.get(authUserId) ?? 0;
      let ahead = 0;
      map.forEach((p, id) => {
        if (id !== authUserId && p > mine) ahead++;
      });
      return ahead + 1;
    };
    return { rankNow: rankIn(base), rankThen: rankIn(then), myPoints };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId, running, dataVersion, profileLoaded, rangPunkte, myTips, sport]);
}
