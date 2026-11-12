// Entwürfe, die noch tippbar wären, wenn sie online gingen (Tippschluss noch
// nicht vorbei, nicht abgesagt/beendet). Alte, vergessene Entwürfe zeigt der
// Hinweis auf Tipps-Seite und Matchcenter nicht an (die stehen weiter im Admin).
// Getestet: npm run test:matchcenter
import type { Match } from "./types";

export function upcomingDrafts<T extends Pick<Match, "draft" | "status" | "tipDeadline" | "kickoff">>(
  matches: T[],
  now: number,
): T[] {
  return matches
    .filter((m) => m.draft && m.status === "upcoming" && Date.parse(m.tipDeadline) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
}
