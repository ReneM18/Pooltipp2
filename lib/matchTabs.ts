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
