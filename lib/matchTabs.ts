// Einordnung der Spiele auf der Tipps-Seite in "Offene" und "Geschlossene".
// Regel von Rene: Ein Spiel ist erst geschlossen, wenn der Admin den Endstand
// eingetragen (beendet) oder es abgesagt hat. Tippschluss, Anpfiff oder ein
// laufendes Spiel schieben es NICHT zu den geschlossenen. Tippen sperrt nach
// dem Tippschluss trotzdem die Datenbank. Getestet: npm run test:reiter
import type { MatchStatus } from "./types";

type TabMatch = { status: MatchStatus; kickoff: string; tipDeadline: string };

export function isMatchClosed(m: { status: MatchStatus }): boolean {
  return m.status === "finished" || m.status === "cancelled";
}

/**
 * Offene Spiele: streng nach Anpfiff, das früheste oben (Rene-Wunsch). Auch
 * Spiele nach Tippschluss, bei denen der Endstand noch fehlt, bleiben an ihrem
 * Platz, statt ans Ende zu rutschen (sonst standen abends die Spiele von morgen
 * oben). Geschlossene: zuletzt geschlossener Tipp zuerst.
 * `now` wird für die Reihenfolge nicht mehr gebraucht, bleibt aber für Aufrufer.
 */
export function splitMatchesByTab<T extends TabMatch>(matches: T[], _now: number | null) {
  const kickoffAsc = (a: T, b: T) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  const offen = matches.filter((m) => !isMatchClosed(m)).sort(kickoffAsc);
  const geschlossen = matches
    .filter(isMatchClosed)
    .sort((a, b) => new Date(b.tipDeadline).getTime() - new Date(a.tipDeadline).getTime());
  return { offen, geschlossen };
}

// Reiter der Startseite (Rene, 18.10.2026: Tippen/Live/Beendet). Jedes Spiel
// steht in genau einer Gruppe:
// - Tippen: Tippschluss in der Zukunft, noch nicht angepfiffen. "offen" ohne
//   eigenen Tipp, "getippt" mit (bis Tippschluss änderbar). Nach Tippschluss sortiert.
// - Live: "laeuft" (Live-Daten LIVE/Pause, oder ohne Live-Daten: Anpfiff
//   vorbei und kein Endstand), "gleich" (Tippschluss vorbei, noch nicht
//   angepfiffen), "geradeBeendet" (laut Live-Daten abgepfiffen, Endstand fehlt).
// - Beendet: Endstand eingetragen oder abgesagt (wie bisher "geschlossen").
export type HomeTab = "tippen" | "live" | "beendet";

export function splitHomeTabs<T extends TabMatch & { id: string }>(
  matches: T[],
  now: number | null,
  hasTip: (m: T) => boolean,
  liveFinished: (m: T) => boolean
) {
  const deadlineAsc = (a: T, b: T) => Date.parse(a.tipDeadline) - Date.parse(b.tipDeadline);
  const { offen: notClosed, geschlossen: beendet } = splitMatchesByTab(matches, now);
  const split = { offen: [] as T[], getippt: [] as T[], laeuft: [] as T[], gleich: [] as T[], geradeBeendet: [] as T[], beendet };
  for (const m of notClosed) {
    if (m.status === "live" || (now !== null && Date.parse(m.kickoff) <= now)) {
      (liveFinished(m) ? split.geradeBeendet : split.laeuft).push(m);
    } else if (now !== null && Date.parse(m.tipDeadline) <= now) {
      split.gleich.push(m);
    } else {
      (hasTip(m) ? split.getippt : split.offen).push(m);
    }
  }
  split.offen.sort(deadlineAsc);
  split.getippt.sort(deadlineAsc);
  return split;
}

/**
 * Reiter beim Öffnen (Renes Regel, 20.10.2026): läuft etwas → Live, sonst
 * offene Tipps → Tippen, sonst neue Ergebnisse seit dem letzten Besuch →
 * Beendet, sonst Tippen (die eigenen Tipps mit "Alles getippt"). Vorher ging
 * es nach dem letzten Tipp immer zu Beendet, auch ohne neue Ergebnisse.
 * Gibt es gar keine tippbaren Spiele (auch keine schon getippten), gleich
 * Beendet statt eines leeren Reiters Tipps (Rene, 21.10.2026).
 */
export function autoHomeTab(
  split: { offen: unknown[]; getippt?: unknown[]; laeuft: unknown[]; geradeBeendet: unknown[]; beendet?: unknown[] },
  hasNewResults = false
): HomeTab {
  if (split.laeuft.length + split.geradeBeendet.length > 0) return "live";
  if (split.offen.length > 0) return "tippen";
  if (hasNewResults) return "beendet";
  if ((split.getippt?.length ?? 0) === 0 && (split.beendet?.length ?? 0) > 0) return "beendet";
  return "tippen";
}

// Neue Ergebnisse = beendete Spiele, die man im Reiter Beendet noch nicht
// gesehen hat. Gemerkt wird pro Gerät (localStorage), welche Spiele man dort
// schon gesehen hat. Nur Spiele der letzten 3 Tage zählen als "neu".
const SEEN_KEY = "pooltipp.seenResults";
const NEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function readSeen(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/** Gibt es beendete Spiele (letzte 3 Tage), die noch nicht gesehen wurden? */
export function hasUnseenResults(beendet: { id: string; kickoff: string }[], now: number): boolean {
  const seen = readSeen();
  // Erster Besuch mit dieser Regel: nichts als "neu" zählen, nur merken.
  if (!seen) {
    markResultsSeen(beendet);
    return false;
  }
  return beendet.some((m) => now - Date.parse(m.kickoff) < NEW_WINDOW_MS && !seen.has(m.id));
}

/** Beendete Spiele als gesehen merken (die neuesten 300 reichen). */
export function markResultsSeen(beendet: { id: string }[]) {
  try {
    const seen = readSeen() ?? new Set<string>();
    for (const m of beendet) seen.add(m.id);
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(seen).slice(-300)));
  } catch {
    // Speicher nicht verfügbar (privates Fenster): dann gibt es eben kein "neu".
  }
}

/** Reiter, in dem ein Spiel steht (für /?spiel=… vom Start-Erlebnis). */
export function homeTabOf(split: { beendet: { id: string }[]; laeuft: { id: string }[]; gleich: { id: string }[]; geradeBeendet: { id: string }[] }, id: string): HomeTab {
  if (split.beendet.some((m) => m.id === id)) return "beendet";
  if ([...split.laeuft, ...split.gleich, ...split.geradeBeendet].some((m) => m.id === id)) return "live";
  return "tippen";
}
