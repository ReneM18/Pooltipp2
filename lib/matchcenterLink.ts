// Tippspiele ↔ Matchcenter (Rene, 27.10.2026): Im Matchcenter steht bei
// tippbaren Spielen "Tippen" und es geht direkt zur Tippkarte; auf der
// Tippkarte führt "Matchcenter" zum selben Spiel im Matchcenter.
// Getestet: npm run test:matchcenter
import type { MatchStatus } from "./types";

// Tippkarte auf der Tipps-Seite (rollt hin und umrandet sie kurz).
export function tipCardHref(matchId: string): string {
  return `/?spiel=${encodeURIComponent(matchId)}`;
}

// Matchcenter mit diesem Spiel ausgewählt.
export function matchcenterHref(matchId: string): string {
  return `/matchcenter?spiel=${encodeURIComponent(matchId)}`;
}

// Kann man jetzt (noch) tippen? Wie die Datenbank: bis zum Tippschluss,
// nicht bei Entwürfen, beendeten oder abgesagten Spielen.
export function isMatchTippable(
  m: { status: MatchStatus; tipDeadline: string; draft?: boolean },
  now: number,
): boolean {
  return !m.draft && m.status === "upcoming" && Date.parse(m.tipDeadline) > now;
}

function viennaDay(t: number | string): string {
  return new Date(t).toLocaleDateString("en-CA", { timeZone: "Europe/Vienna" });
}

// Das Matchcenter zeigt nur Spiele von heute und gestern (Wiener Zeit), so
// kommen die Live-Daten. Nur dann gibt es dort etwas zu sehen.
export function inMatchcenterDays(kickoff: string, now: number): boolean {
  const today = viennaDay(now);
  const y = new Date(`${today}T12:00:00Z`);
  y.setUTCDate(y.getUTCDate() - 1);
  const day = viennaDay(kickoff);
  return day === today || day === y.toISOString().slice(0, 10);
}
