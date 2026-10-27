"use client";

import { useEffect, useState } from "react";
import type { Match, Sport } from "./types";
import {
  appSideEvents,
  findLiveGame,
  isLiveDelayed,
  isLiveFinished,
  isLiveRunning,
  liveIntervalSeconds,
  liveMaxIntervalSeconds,
  viennaDate,
} from "./liveScores";
import type { LiveEvent, LiveGame, LiveQuota, LiveResponse, LiveSource, LiveStatus } from "./live/types";
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
// gleicher Stand, gleiche Minute. Takt 60 s (Fußball, siehe liveIntervalSeconds), solange jemand
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
  // Diagnose der Route (Rene, 16.10.2026: ehrliche Aktualität): Quelle der
  // Daten, Fehler beim Live-Abruf, Abfragen heute, Anbieter.
  source: LiveSource | null;
  liveError: string | null;
  quota: LiveQuota | null;
  provider: string | null;
  providerName: string | null;
  providerUrl: string | null;
  loading: boolean;
  staleRetried: boolean;
  listeners: Set<() => void>;
  pollers: Set<symbol>;
  timer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

// Hört auf ALLE Einträge (Rene, 15.10.2026: Spieltag-Umbau) – für "Wenn es
// so bleibt", das die Stände aller laufenden Spiele einer Sportart braucht.
const globalListeners = new Set<() => void>();

function notify(entry: Entry) {
  entry.listeners.forEach((l) => l());
  globalListeners.forEach((l) => l());
}

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
      source: null,
      liveError: null,
      quota: null,
      provider: null,
      providerName: null,
      providerUrl: null,
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

// Laufender Abruf je Eintrag, damit refreshLiveDays darauf warten kann
// (Rene, 16.10.2026).
const pending = new Map<Entry, Promise<void>>();

function load(entry: Entry): Promise<void> {
  let running = pending.get(entry);
  if (!running) {
    running = loadNow(entry).finally(() => pending.delete(entry));
    pending.set(entry, running);
  }
  return running;
}

async function loadNow(entry: Entry) {
  if (entry.loading) return;
  entry.loading = true;
  notify(entry);
  try {
    const res = await fetch(`/api/live?sport=${encodeURIComponent(entry.sport)}&date=${entry.date}`);
    const data = (await res.json()) as LiveResponse;
    rememberSport(entry.sport, data);
    const games = Array.isArray(data.games) ? data.games : [];
    if (data.quota) entry.quota = data.quota;
    if (data.provider) entry.provider = data.provider;
    if (data.providerName) entry.providerName = data.providerName;
    if (data.providerUrl) entry.providerUrl = data.providerUrl;
    // Bei einem Fehler (z. B. Tageslimit) bleiben die letzten Daten stehen –
    // aber ehrlich als Fehler markiert (Rene, 16.10.2026), damit die Anzeige
    // "verzögert" zeigt statt so zu tun, als wären sie aktuell.
    if (games.length > 0 || !data.error) {
      entry.games = games;
      entry.error = null;
      // Server-Zeit des Abrufs beim Anbieter, höchstens "jetzt" (falls die
      // Uhren etwas abweichen). Ohne fetchedAt: unbekannt = 0 (nie "jetzt"
      // erfinden).
      entry.dataAt = typeof data.fetchedAt === "number" ? Math.min(data.fetchedAt, Date.now()) : 0;
      entry.source = data.source ?? null;
      entry.liveError = data.liveError ?? null;
    } else if (!entry.games || entry.games.length === 0) {
      entry.games = [];
      entry.error = data.error ?? null;
      entry.liveError = data.error ?? null;
    } else {
      entry.source = "stale";
      entry.liveError = data.error ?? null;
    }
  } catch {
    // Netzwerkfehler: einfach beim nächsten Takt wieder versuchen.
    rememberSport(entry.sport, null);
    if (!entry.games) {
      entry.games = [];
      entry.error = "Live-Daten nicht erreichbar";
    } else {
      entry.source = "stale";
      entry.liveError = "Live-Daten nicht erreichbar";
    }
  } finally {
    entry.loadedAt = Date.now();
    entry.loading = false;
    notify(entry);
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
  // Alt = älter als der längste Server-Takt (Gratis-Plan 180 s), sonst
  // fragt der 60-s-Takt im Gratis-Plan jedes Mal doppelt nach.
  const stale = entry.dataAt > 0 && entry.loadedAt - entry.dataAt > liveMaxIntervalSeconds(entry.sport) * 1000;
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
  source: LiveSource | null;
  liveError: string | null;
  providerName: string | null;
  providerUrl: string | null;
  // Abfragen heute laut Anbieter (Rene, 27.10.2026: Spielplan nur mit Pro-Plan).
  quota: LiveQuota | null;
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
  if (!entry) return { games: null, error: null, loading: false, loadedAt: 0, dataAt: 0, source: null, liveError: null, providerName: null, providerUrl: null, quota: null };
  return {
    games: entry.games,
    error: entry.error,
    loading: entry.loading,
    loadedAt: entry.loadedAt,
    dataAt: entry.dataAt,
    source: entry.source,
    liveError: entry.liveError,
    providerName: entry.providerName,
    providerUrl: entry.providerUrl,
    quota: entry.quota,
  };
}

// Mehrere Tage auf einmal (Rene, 27.10.2026: Spielplan der nächsten Tage im
// Matchcenter). Lädt jeden Tag einmal, wenn noch nichts (oder nur
// Veraltetes) da ist; kein regelmäßiges Neuladen. Leere Liste: nichts.
export function useLiveDays(sport: Sport, dates: readonly string[]): LiveDay[] {
  useLiveStoreVersion(dates.length > 0);
  const key = dates.join(",");
  useEffect(() => {
    for (const date of key ? key.split(",") : []) {
      const entry = entryFor(sport, date);
      if (!entry.loading && Date.now() - entry.loadedAt >= intervalMs(entry)) void load(entry);
    }
  }, [sport, key]);
  return dates.map((date) => {
    const entry = entryFor(sport, date);
    return {
      games: entry.games,
      error: entry.error,
      loading: entry.loading,
      loadedAt: entry.loadedAt,
      dataAt: entry.dataAt,
      source: entry.source,
      liveError: entry.liveError,
      providerName: entry.providerName,
      providerUrl: entry.providerUrl,
      quota: entry.quota,
    };
  });
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
  // Tore/Karten mit Heim/Gast wie in der App (Rene, 15.10.2026: Spieltag-Umbau).
  // null = der Anbieter liefert für diese Sportart keine Ereignisse
  // (Eishockey) → kein Knopf "Spielverlauf" (Rene, 16.10.2026).
  events: LiveEvent[] | null;
  // Fortschritt 0..1 vom Anbieter (Eishockey über 60 Min.), sonst undefined.
  progress?: number;
  // Live-Daten verzögert (Rene, 16.10.2026), siehe isLiveDelayed.
  delayed: boolean;
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
    events: found.game.events ? appSideEvents(found) : null,
    ...(found.game.progress !== undefined ? { progress: found.game.progress } : {}),
    delayed: isLiveDelayed(match.sport, entry?.dataAt ?? 0, entry?.source ?? null, isLiveRunning(status), now ?? Date.now()),
  };
}

// Ereignisse eines Spiels, das in der App schon einen Endstand hat
// (Rene, 15.10.2026: Spieltag-Umbau): Torschützen auf der Tafel und
// "Spielverlauf" nach der Wertung. Nur eingeschaltete Ligen und nur bis
// 36 Stunden nach Anpfiff (die Route kennt Ereignisse ohnehin nur aus dem
// letzten Live-Stand). Lädt höchstens einmal je Takt, kein Dauer-Abfragen.
const EVENTS_AFTER_MS = 36 * 60 * 60 * 1000;

export function useFinishedEvents(match: Match, homeName: string, awayName: string, enabled: boolean): LiveEvent[] | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (enabled) setNow(Date.now());
  }, [enabled]);
  const kickoff = new Date(match.kickoff).getTime();
  const relevant =
    enabled &&
    now !== null &&
    isLiveLeagueEnabled(match.sport, match.competition) &&
    now >= kickoff &&
    now - kickoff < EVENTS_AFTER_MS;
  const day = useLiveDay(match.sport, relevant ? viennaDate(match.kickoff) : null);
  if (!relevant || !day.games) return null;
  const found = findLiveGame(day.games, match.kickoff, homeName, awayName);
  // Ohne Ereignisse vom Anbieter (Eishockey) kein Spielverlauf.
  return found && found.game.events ? appSideEvents(found) : null;
}

// Neu rendern, sobald irgendein Live-Eintrag neue Daten hat. enabled = false:
// nicht zuhören (Rene, 16.10.2026: Freunde-Live – Karten ohne Live-Spiel
// rendern dann nicht bei jedem Abruf mit).
export function useLiveStoreVersion(enabled = true): number {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const listener = () => setVersion((v) => v + 1);
    globalListeners.add(listener);
    return () => {
      globalListeners.delete(listener);
    };
  }, [enabled]);
  return version;
}

// Live-Stand eines App-Spiels direkt aus dem Speicher, ohne zu laden
// (für "Wenn es so bleibt"). null = keine Daten oder nicht begonnen.
export function peekLiveScore(
  match: Match,
  homeName: string,
  awayName: string,
): { homeScore: number; awayScore: number; status: LiveStatus; elapsed: number | null; events: LiveEvent[] | null } | null {
  const entry = entries.get(`${match.sport}|${viennaDate(match.kickoff)}`);
  if (!entry?.games) return null;
  const found = findLiveGame(entry.games, match.kickoff, homeName, awayName);
  if (!found || found.homeScore === null || found.awayScore === null) return null;
  const { status } = found.game;
  if (!isLiveRunning(status) && !isLiveFinished(status)) return null;
  // Minute und Tore (App-Seiten) für den Freunde-Live-Ticker
  // (Rene, 16.10.2026: Freunde-Live).
  return {
    homeScore: found.homeScore,
    awayScore: found.awayScore,
    status,
    elapsed: found.game.elapsed,
    events: found.game.events ? appSideEvents(found) : null,
  };
}

// Alle Spiellisten, die dieser Browser schon geladen hat (Rene, 16.10.2026:
// Zuordnungs-Check im Admin). Keine Abfrage.
export function peekLiveDays(): { sport: Sport; date: string; fetchedAt: number; games: LiveGame[]; error: string | null }[] {
  const list: { sport: Sport; date: string; fetchedAt: number; games: LiveGame[]; error: string | null }[] = [];
  entries.forEach((e) => {
    if (e.games && e.loadedAt > 0) list.push({ sport: e.sport, date: e.date, fetchedAt: e.dataAt || e.loadedAt, games: e.games, error: e.error });
  });
  return list;
}

// Diagnose je Sportart aus den Antworten von /api/live (Rene, 16.10.2026:
// Diagnose aus den Antworten statt aus dem Speicher einer Server-Instanz).
// Jede Antwort bringt fetchedAt, source, liveError und quota mit; gemerkt
// wird je Sportart der neueste Datenstand, der Fehler der letzten Antwort und
// die neueste Quote (nach ihrem Zeitpunkt at). Keine Abfrage.
export interface LiveSportDiagnostics {
  sport: Sport;
  providerName: string | null;
  loadedAt: number; // letzte Antwort im Browser
  dataAt: number; // Abruf beim Anbieter (fetchedAt), 0 = unbekannt
  source: LiveSource | null;
  error: string | null;
  quota: LiveQuota | null;
}

const sportDiags = new Map<Sport, LiveSportDiagnostics>();

function rememberSport(sport: Sport, data: LiveResponse | null) {
  const prev = sportDiags.get(sport);
  const now = Date.now();
  const fetchedAt = data && typeof data.fetchedAt === "number" ? Math.min(data.fetchedAt, now) : 0;
  const newer = !prev || fetchedAt >= prev.dataAt;
  const quota = data?.quota ?? null;
  const newerQuota = quota && (!prev?.quota || (quota.at ?? 0) >= (prev.quota.at ?? 0));
  sportDiags.set(sport, {
    sport,
    providerName: data?.providerName ?? prev?.providerName ?? null,
    loadedAt: now,
    dataAt: newer ? fetchedAt : prev!.dataAt,
    source: newer && data?.source ? data.source : prev?.source ?? null,
    error: data ? data.liveError ?? data.error ?? null : "Live-Daten nicht erreichbar",
    quota: newerQuota ? quota : prev?.quota ?? null,
  });
}

export function peekLiveSportDiagnostics(): LiveSportDiagnostics[] {
  return Array.from(sportDiags.values());
}

// Tageslisten gezielt laden, auch ohne laufendes Spiel (Rene, 16.10.2026:
// Admin-Kachel "Live-Daten" lädt selbst). Gleiche Route und gleicher
// Speicher wie Tippkarten/Matchcenter; die Route hält Tageslisten 900 s im
// Cache, das kostet also keine Extra-Quote. Wartet, bis alle da sind.
export async function refreshLiveDays(days: { sport: Sport; date: string }[]): Promise<void> {
  await Promise.all(days.map((d) => load(entryFor(d.sport, d.date))));
}
