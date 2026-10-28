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

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Sporttag (Rene, 28.10.2026): Ein Tag im Matchcenter geht von 06:00 bis
// 06:00 Wiener Zeit, nicht von Mitternacht bis Mitternacht. Sonst stehen
// NBA/NHL/NFL-Spiele aus der Nacht (z. B. 02:00) erst unter "Heute", wenn
// sie schon vorbei sind. Spiele vor 06:00 zählen zum Vortag ("Nacht").
export const SPORT_DAY_START_HOUR = 6;

// Stunde in Wien (0–23).
function viennaHour(t: number | string): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Vienna", hour: "2-digit", hourCycle: "h23" }).format(new Date(t)),
  );
}

// Anstoß in der Nacht (00:00 bis 05:59 Wiener Zeit)?
export function isNightKickoff(kickoff: number | string): boolean {
  return viennaHour(kickoff) < SPORT_DAY_START_HOUR;
}

// Sporttag (YYYY-MM-DD) eines Zeitpunkts: vor 06:00 der Vortag.
export function sportDay(t: number | string): string {
  const day = viennaDay(t);
  return isNightKickoff(t) ? shiftDate(day, -1) : day;
}

// Das Matchcenter zeigt nur Spiele von heute und gestern (Sporttage, Wiener
// Zeit), so kommen die Live-Daten. Nur dann gibt es dort etwas zu sehen.
export function inMatchcenterDays(kickoff: string, now: number): boolean {
  const today = sportDay(now);
  const day = sportDay(kickoff);
  return day === today || day === shiftDate(today, -1);
}
