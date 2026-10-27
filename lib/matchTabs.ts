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

// Reiter der Startseite. Seit 27.10.2026 nur noch Tipps/Beendet (Rene: den
// Reiter Live braucht es nicht mehr, laufende Spiele zeigt das Matchcenter).
// Jedes Spiel steht in genau einer Gruppe:
// - Tipps, tippbar: Tippschluss in der Zukunft, noch nicht angepfiffen.
//   "offen" ohne eigenen Tipp, "getippt" mit (bis Tippschluss änderbar).
//   Nach Tippschluss sortiert.
// - Tipps, ab Tippschluss: "laeuft" (Live-Daten LIVE/Pause, oder ohne
//   Live-Daten: Anpfiff vorbei und kein Endstand), "gleich" (Tippschluss
//   vorbei, noch nicht angepfiffen), "geradeBeendet" (laut Live-Daten
//   abgepfiffen, Endstand fehlt).
// - Beendet: Endstand eingetragen oder abgesagt (wie bisher "geschlossen").
export type HomeTab = "tippen" | "beendet";

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
 * Reiter beim Öffnen (Rene, 27.10.2026): gibt es noch nicht beendete Spiele
 * (tippbar, getippt oder laufend) → Tipps, sonst beendete Spiele → Beendet.
 * Ganz ohne Spiele bleibt es bei Tipps (Hinweis "Alles getippt" mit Link zum
 * Matchcenter). Vorher (21.10.) sprang es bei laufenden Spielen zu Live.
 */
export function autoHomeTab(split: {
  offen: unknown[];
  getippt: unknown[];
  laeuft: unknown[];
  gleich: unknown[];
  geradeBeendet: unknown[];
  beendet: unknown[];
}): HomeTab {
  const notClosed = split.offen.length + split.getippt.length + split.laeuft.length + split.gleich.length + split.geradeBeendet.length;
  if (notClosed > 0) return "tippen";
  if (split.beendet.length > 0) return "beendet";
  return "tippen";
}

/** Reiter, in dem ein Spiel steht (für /?spiel=… vom Start-Erlebnis). */
export function homeTabOf(split: { beendet: { id: string }[] }, id: string): HomeTab {
  return split.beendet.some((m) => m.id === id) ? "beendet" : "tippen";
}
