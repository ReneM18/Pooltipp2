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
 * Offene Spiele: noch tippbare vorne (nächster Anpfiff zuerst), danach die nach
 * Tippschluss, bei denen der Endstand noch fehlt. Geschlossene: zuletzt
 * geschlossener Tipp zuerst. `now` = null (noch nicht im Browser) zählt alles als tippbar.
 */
export function splitMatchesByTab<T extends TabMatch>(matches: T[], now: number | null) {
  const pastDeadline = (m: T) => now !== null && new Date(m.tipDeadline).getTime() <= now;
  const kickoffAsc = (a: T, b: T) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
  const offen = matches
    .filter((m) => !isMatchClosed(m))
    .sort((a, b) => Number(pastDeadline(a)) - Number(pastDeadline(b)) || kickoffAsc(a, b));
  const geschlossen = matches
    .filter(isMatchClosed)
    .sort((a, b) => new Date(b.tipDeadline).getTime() - new Date(a.tipDeadline).getTime());
  return { offen, geschlossen };
}
