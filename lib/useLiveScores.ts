"use client";

import { useEffect, useState } from "react";
import type { Match, Sport } from "./types";
import {
  findLiveGame,
  isLiveFinished,
  isLiveRunning,
  liveIntervalSeconds,
  viennaDate,
  type LiveGame,
  type LiveResponse,
  type LiveStatus,
} from "./liveScores";

// Live-Spielstände für die Tippkarten (Rene, 15.10.2026). Eine gemeinsame
// Abfrage pro Sportart und Tag für alle Karten (über /api/live, dort für
// alle Nutzer zwischengespeichert). Abgefragt wird NUR, solange mindestens
// eine angezeigte Karte dieser Sportart ein laufendes Spiel hat: Anpfiff
// vorbei, weniger als 4 Stunden her, in der App noch kein Endstand und laut
// Live-Daten noch nicht abgepfiffen. Sonst gibt es keine Abfrage.

const MAX_LIVE_MS = 4 * 60 * 60 * 1000;

interface Entry {
  sport: Sport;
  date: string;
  games: LiveGame[] | null;
  fetchedAt: number;
  loading: boolean;
  listeners: Set<() => void>;
  pollers: Set<symbol>;
  timer: ReturnType<typeof setInterval> | null;
}

const entries = new Map<string, Entry>();

function entryFor(sport: Sport, date: string): Entry {
  const key = `${sport}|${date}`;
  let entry = entries.get(key);
  if (!entry) {
    entry = { sport, date, games: null, fetchedAt: 0, loading: false, listeners: new Set(), pollers: new Set(), timer: null };
    entries.set(key, entry);
  }
  return entry;
}

async function load(entry: Entry) {
  if (entry.loading) return;
  entry.loading = true;
  try {
    const res = await fetch(`/api/live?sport=${encodeURIComponent(entry.sport)}&date=${entry.date}`);
    const data = (await res.json()) as LiveResponse;
    // Bei einem Fehler (z. B. Tageslimit) bleiben die letzten Daten stehen.
    if (Array.isArray(data.games) && (data.games.length > 0 || !data.error)) entry.games = data.games;
  } catch {
    // Netzwerkfehler: einfach beim nächsten Takt wieder versuchen.
  } finally {
    entry.fetchedAt = Date.now();
    entry.loading = false;
    entry.listeners.forEach((l) => l());
  }
}

function startPolling(entry: Entry, id: symbol) {
  entry.pollers.add(id);
  if (entry.timer) return;
  const interval = liveIntervalSeconds(entry.sport) * 1000;
  if (Date.now() - entry.fetchedAt >= interval) void load(entry);
  entry.timer = setInterval(() => void load(entry), interval);
}

function stopPolling(entry: Entry, id: symbol) {
  entry.pollers.delete(id);
  if (entry.pollers.size === 0 && entry.timer) {
    clearInterval(entry.timer);
    entry.timer = null;
  }
}

export interface LiveScore {
  homeScore: number;
  awayScore: number;
  status: LiveStatus;
  statusText: string;
  // true = laut Live-Daten abgepfiffen (offizieller Endstand fehlt noch).
  finished: boolean;
}

// Live-Stand eines App-Spiels oder null (nicht gestartet, schon mit Endstand
// in der App, keine Zuordnung gefunden, keine Daten).
export function useLiveScore(match: Match, homeName: string, awayName: string): LiveScore | null {
  // Uhr erst im Browser (sonst Hydration-Fehler), danach alle 30 s.
  const [now, setNow] = useState<number | null>(null);
  const [, setVersion] = useState(0);
  const hasFinal = match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null;
  const relevant = !hasFinal && match.status !== "cancelled";
  const kickoff = new Date(match.kickoff).getTime();
  const date = viennaDate(match.kickoff);

  useEffect(() => {
    if (!relevant) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 30 * 1000);
    return () => clearInterval(t);
  }, [relevant]);

  const kickedOff = relevant && now !== null && now >= kickoff;
  const entry = kickedOff ? entryFor(match.sport, date) : null;
  const found = entry?.games ? findLiveGame(entry.games, match.kickoff, homeName, awayName) : null;
  const apiFinished = !!found && isLiveFinished(found.game.status);
  const shouldPoll = kickedOff && now !== null && now - kickoff < MAX_LIVE_MS && !apiFinished;

  // Auf neue Daten hören (auch wenn eine andere Karte abfragt).
  useEffect(() => {
    if (!entry) return;
    const listener = () => setVersion((v) => v + 1);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [entry]);

  useEffect(() => {
    if (!entry || !shouldPoll) return;
    const id = Symbol("live");
    startPolling(entry, id);
    return () => stopPolling(entry, id);
  }, [entry, shouldPoll]);

  if (!found || found.homeScore === null || found.awayScore === null) return null;
  const { status } = found.game;
  if (!isLiveRunning(status) && !isLiveFinished(status)) return null;
  return {
    homeScore: found.homeScore,
    awayScore: found.awayScore,
    status,
    statusText: found.game.statusText,
    finished: isLiveFinished(status),
  };
}
