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

// Sucht ein bereits angelegtes Team mit gleichem Namen in derselben Sportart
// und demselben Land. Gleicher Name in einer anderen Sportart ist erlaubt
// (z. B. Bayern München im Fußball und im Basketball), ebenso in einem
// anderen Land: Capitals in Österreich und in den USA sind verschiedene
// Klubs (Rene, 15.10.2026). Fehlt bei einem der beiden das Land, gilt es
// wie bisher als gleich. ignoreId = das gerade bearbeitete Team.
export function findDuplicateTeam(
  teams: Team[],
  name: string,
  sport: Sport,
  countryCode: string | null | undefined,
  ignoreId?: string | null,
): Team | undefined {
  const key = normalizeTeamName(name);
  if (!key) return undefined;
  const country = (countryCode ?? "").trim().toUpperCase();
  return teams.find((t) => {
    if (t.sport !== sport || t.id === ignoreId) return false;
    if (normalizeTeamName(t.name) !== key) return false;
    const other = (t.countryCode ?? "").trim().toUpperCase();
    return !country || !other || country === other;
  });
}
