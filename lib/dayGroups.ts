// Überschriften nach Tag auf der Tipps-Seite ("Läuft gerade", "Heute",
// "Morgen", "Samstag 10.10." …). Die Reihenfolge der Spiele bleibt genau wie
// in lib/matchTabs.ts, hier wird nur in Abschnitte geteilt.
// Getestet: npm run test:reiter
import type { MatchStatus } from "./types";

type DayMatch = { status: MatchStatus; kickoff: string; tipDeadline: string };

export type DayGroup<T> = { key: string; label: string; sub: string; matches: T[] };

const WEEKDAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function dateText(t: number): string {
  const d = new Date(t);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.`;
}

function dayLabel(t: number, now: number): { label: string; sub: string } {
  const diff = Math.round((startOfDay(t) - startOfDay(now)) / 86_400_000);
  const weekday = WEEKDAYS[new Date(t).getDay()];
  const date = dateText(t);
  if (diff === 0) return { label: "Heute", sub: `${weekday}, ${date}` };
  if (diff === 1) return { label: "Morgen", sub: `${weekday}, ${date}` };
  if (diff === -1) return { label: "Gestern", sub: `${weekday}, ${date}` };
  return { label: weekday, sub: date };
}

/**
 * Offene Spiele: alles, was schon angepfiffen ist (läuft oder wartet auf den
 * Endstand), steht unter "Läuft gerade", der Rest nach Anstoß-Tag.
 * Geschlossene Spiele: nach dem Tag des Tippschlusses (wie ihre Sortierung).
 * Ohne `now` (vor dem Laden im Browser) gibt es nur einen Abschnitt ohne Titel.
 */
export function groupMatchesByDay<T extends DayMatch>(
  matches: T[],
  now: number | null,
  tab: "offen" | "geschlossen"
): DayGroup<T>[] {
  if (now === null) return matches.length ? [{ key: "alle", label: "", sub: "", matches }] : [];
  const groups: DayGroup<T>[] = [];
  for (const m of matches) {
    const kickoff = Date.parse(m.kickoff);
    let key: string;
    let label: string;
    let sub = "";
    if (tab === "offen" && (m.status === "live" || kickoff <= now)) {
      key = "jetzt";
      label = "Läuft gerade";
    } else {
      const t = tab === "offen" ? kickoff : Date.parse(m.tipDeadline);
      key = String(startOfDay(t));
      ({ label, sub } = dayLabel(t, now));
    }
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.matches.push(m);
    else groups.push({ key, label, sub, matches: [m] });
  }
  return groups;
}
