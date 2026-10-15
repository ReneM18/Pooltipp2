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
import { isLiveLeagueEnabled } from "./liveConfig";

// Live-Spielstände für die Tippkarten (Rene, 15.10.2026). Eine gemeinsame
// Abfrage pro Sportart und Tag für alle Karten (über /api/live, dort für
// alle Nutzer zwischengespeichert). Abgefragt wird NUR, solange mindestens
// eine angezeigte Karte dieser Sportart ein laufendes Spiel hat: Anpfiff
// vorbei, weniger als 4 Stunden her, in der App noch kein Endstand und laut
// Live-Daten noch nicht abgepfiffen. Sonst gibt es keine Abfrage.
//
// (Rene, 15.10.2026: Tippkarte und Matchcenter synchron) Dieser Speicher ist
// die EINE Datenquelle für Tippkarten UND Matchcenter: gleiche URL
// (/api/live?sport=…&date=…, ohne league – gefiltert wird im Browser),
// gleicher Stand, gleiche Minute. Takt 180 s (Fußball), solange jemand
// abfragen will; im Hintergrund (Tab nicht sichtbar) Pause, beim
// Zurückkommen sofort neu holen.

const MAX_LIVE_MS = 4 * 60 * 60 * 1000;
// Liefert der Server-Cache beim Takt noch alte Daten (er holt dann im
// Hintergrund neu), kurz darauf einmal nachfragen – kostet keine API-Abfrage.
const STALE_RETRY_MS = 20 * 1000;

interface Entry {
  sport: Sport;
  date: string;
  games: LiveGame[] | null;
  error: string | null;
  // Letzter Abruf im Browser (auch bei Fehlern).
  loadedAt: number;
  // Server-Zeitpunkt der aktuellen Spieldaten (fetchedAt der Route), für die
  // mitlaufende Minute und "aktualisiert vor …".
  dataAt: number;
  loading: boolean;
  staleRetried: boolean;
  listeners: Set<() => void>;
  pollers: Set<symbol>;
  timer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

function entryFor(sport: Sport, date: string): Entry {
  const key = `${sport}|${date}`;
  let entry = entries.get(key);
  if (!entry) {
    entry = {
      sport,
      date,
      games: null,
      error: null,
      loadedAt: 0,
      dataAt: 0,
      loading: false,
      staleRetried: false,
      listeners: new Set(),
      pollers: new Set(),
      timer: null,
    };
    entries.set(key, entry);
  }
  return entry;
}

function intervalMs(entry: Entry): number {
  return liveIntervalSeconds(entry.sport) * 1000;
}

async function load(entry: Entry) {
  if (entry.loading) return;
  entry.loading = true;
  entry.listeners.forEach((l) => l());
  try {
    const res = await fetch(`/api/live?sport=${encodeURIComponent(entry.sport)}&date=${entry.date}`);
    const data = (await res.json()) as LiveResponse;
    const games = Array.isArray(data.games) ? data.games : [];
    // Bei einem Fehler (z. B. Tageslimit) bleiben die letzten Daten stehen.
    if (games.length > 0 || !data.error) {
      entry.games = games;
      entry.error = null;
      // Server-Zeit, höchstens "jetzt" (falls die Uhren etwas abweichen).
      entry.dataAt = Math.min(typeof data.fetchedAt === "number" ? data.fetchedAt : Date.now(), Date.now());
    } else if (!entry.games || entry.games.length === 0) {
      entry.games = [];
      entry.error = data.error ?? null;
    }
  } catch {
    // Netzwerkfehler: einfach beim nächsten Takt wieder versuchen.
    if (!entry.games) {
      entry.games = [];
      entry.error = "Live-Daten nicht erreichbar";
    }
  } finally {
    entry.loadedAt = Date.now();
    entry.loading = false;
    entry.listeners.forEach((l) => l());
    schedule(entry);
  }
}

function hidden(): boolean {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}

// Nächsten Abruf planen: im Takt nach dem letzten Abruf; waren die Daten
// dabei schon älter als ein Takt (Server-Cache lieferte alt), einmal nach
// 20 s nachfragen. Kein Abfragender oder Tab im Hintergrund = kein Timer.
function schedule(entry: Entry) {
  if (entry.timer) clearTimeout(entry.timer);
  entry.timer = null;
  if (entry.pollers.size === 0 || hidden() || entry.loading) return;
  const interval = intervalMs(entry);
  let wait = entry.loadedAt + interval - Date.now();
  const stale = entry.dataAt > 0 && entry.loadedAt - entry.dataAt > interval;
  if (stale && !entry.staleRetried) {
    entry.staleRetried = true;
    wait = Math.min(wait, entry.loadedAt + STALE_RETRY_MS - Date.now());
  } else if (!stale) {
    entry.staleRetried = false;
  }
  entry.timer = setTimeout(() => void load(entry), Math.max(0, wait));
}

let visibilityHooked = false;
function hookVisibility() {
  if (visibilityHooked || typeof document === "undefined") return;
  visibilityHooked = true;
  document.addEventListener("visibilitychange", () => {
    entries.forEach((entry) => {
      if (entry.pollers.size === 0) return;
      if (hidden()) {
        if (entry.timer) clearTimeout(entry.timer);
        entry.timer = null;
      } else if (Date.now() - entry.loadedAt > 10 * 1000) {
        void load(entry); // zurück im Tab: sofort holen
      } else {
        schedule(entry);
      }
    });
  });
}

function startPolling(entry: Entry, id: symbol) {
  hookVisibility();
  const first = entry.pollers.size === 0;
  entry.pollers.add(id);
  if (!first || entry.loading) return;
  if (Date.now() - entry.loadedAt >= intervalMs(entry) && !hidden()) void load(entry);
  else schedule(entry);
}

function stopPolling(entry: Entry, id: symbol) {
  entry.pollers.delete(id);
  if (entry.pollers.size === 0 && entry.timer) {
    clearTimeout(entry.timer);
    entry.timer = null;
  }
}

// Bei neuen Daten neu rendern (auch wenn eine andere Komponente abfragt).
function useEntry(entry: Entry | null) {
  const [, setVersion] = useState(0);
  useEffect(() => {
    if (!entry) return;
    const listener = () => setVersion((v) => v + 1);
    entry.listeners.add(listener);
    return () => {
      entry.listeners.delete(listener);
    };
  }, [entry]);
}

export interface LiveDay {
  games: LiveGame[] | null; // null = noch nicht geladen
  error: string | null;
  loading: boolean;
  loadedAt: number;
  dataAt: number;
}

// Alle Live-Spiele eines Tages aus dem gemeinsamen Speicher (fürs
// Matchcenter). Lädt einmal, wenn noch nichts (oder nur Veraltetes) da ist;
// regelmäßig neu geladen wird nur mit useLivePolling. date = null: nichts.
export function useLiveDay(sport: Sport, date: string | null): LiveDay {
  const entry = date ? entryFor(sport, date) : null;
  useEntry(entry);
  useEffect(() => {
    if (!entry || entry.loading) return;
    if (Date.now() - entry.loadedAt >= intervalMs(entry)) void load(entry);
  }, [entry]);
  if (!entry) return { games: null, error: null, loading: false, loadedAt: 0, dataAt: 0 };
  return { games: entry.games, error: entry.error, loading: entry.loading, loadedAt: entry.loadedAt, dataAt: entry.dataAt };
}

// Im Takt neu laden, solange active (z. B. ein Spiel läuft).
export function useLivePolling(sport: Sport, date: string | null, active: boolean) {
  const entry = date ? entryFor(sport, date) : null;
  useEffect(() => {
    if (!entry || !active) return;
    const id = Symbol("live");
    startPolling(entry, id);
    return () => stopPolling(entry, id);
  }, [entry, active]);
}

// Sofort neu laden (Knopf "Erneut versuchen").
export function reloadLiveDay(sport: Sport, date: string) {
  void load(entryFor(sport, date));
}

export interface LiveScore {
  homeScore: number;
  awayScore: number;
  status: LiveStatus;
  statusText: string;
  // true = laut Live-Daten abgepfiffen (offizieller Endstand fehlt noch).
  finished: boolean;
  // Für die mitlaufende Minute (Rene, 15.10.2026: Live-Gefühl).
  statusShort: string;
  elapsed: number | null;
  dataAt: number;
}

// Live-Stand eines App-Spiels oder null (nicht gestartet, schon mit Endstand
// in der App, keine Zuordnung gefunden, keine Daten).
export function useLiveScore(match: Match, homeName: string, awayName: string): LiveScore | null {
  // Uhr erst im Browser (sonst Hydration-Fehler), danach alle 30 s.
  const [now, setNow] = useState<number | null>(null);
  const hasFinal = match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null;
  // Nur eingeschaltete Sportarten/Ligen abfragen (lib/liveConfig.ts).
  const relevant = !hasFinal && match.status !== "cancelled" && isLiveLeagueEnabled(match.sport, match.competition);
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

  // Auf neue Daten hören (auch wenn eine andere Karte oder das Matchcenter
  // abfragt) und im Takt abfragen, solange das Spiel läuft.
  useEntry(entry);
  useLivePolling(match.sport, kickedOff ? date : null, shouldPoll);

  if (!found || found.homeScore === null || found.awayScore === null) return null;
  const { status } = found.game;
  if (!isLiveRunning(status) && !isLiveFinished(status)) return null;
  return {
    homeScore: found.homeScore,
    awayScore: found.awayScore,
    status,
    statusText: found.game.statusText,
    finished: isLiveFinished(status),
    statusShort: found.game.statusShort,
    elapsed: found.game.elapsed,
    dataAt: entry?.dataAt ?? 0,
  };
}
