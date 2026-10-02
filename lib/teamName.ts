import type { Sport, Team } from "./types";

// Macht Teamnamen vergleichbar: Groß-/Kleinschreibung, Umlaute/Akzente,
// Leerzeichen und Satzzeichen spielen keine Rolle. So gelten z. B.
// "Bayern München", "bayern muenchen" und "Bayern-München" als gleich.
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Sucht ein bereits angelegtes Team mit gleichem Namen in derselben Sportart.
// Gleicher Name in einer anderen Sportart ist erlaubt (z. B. Bayern München
// im Fußball und im Basketball). ignoreId = das gerade bearbeitete Team.
export function findDuplicateTeam(
  teams: Team[],
  name: string,
  sport: Sport,
  ignoreId?: string | null,
): Team | undefined {
  const key = normalizeTeamName(name);
  if (!key) return undefined;
  return teams.find(
    (t) =>
      t.sport === sport &&
      t.id !== ignoreId &&
      normalizeTeamName(t.name) === key,
  );
}
