import type { Sport, Team } from "./types";
import { COUNTRIES, countryName, flagEmoji } from "./flags";
import { normalizeTeamName } from "./teamName";

// Untergruppen für die Team-Auswahl (Fußball, Basketball, Eishockey): damit
// man bei vielen Teams nicht lange suchen muss, sind sie in Gruppen wie
// "NHL", "Nationalteams", "Deutschland", "Österreich" sortiert.
//
// Ohne eigene Einstellung ergibt sich die Gruppe automatisch aus dem Team:
// Nationalmannschaft -> "Nationalteams", NBA/NHL-Teams aus USA/Kanada ->
// "NBA"/"NHL", sonst das Land des Vereins. Der Admin kann pro Team eine
// eigene Gruppe eintragen (Team.group). Gespeichert wird nur dieses eine
// Feld im Team – kein SQL, alte Teams funktionieren unverändert.

export const GROUPED_SPORTS: Sport[] = ["Fußball", "NBA", "NHL"];

export const NATIONAL_GROUP = "Nationalteams";

const LEAGUE_OF_SPORT: Partial<Record<Sport, string>> = { NBA: "NBA", NHL: "NHL" };
const LEAGUE_COUNTRIES = ["US", "CA"];

export function hasTeamGroups(sport: Sport | string): boolean {
  return GROUPED_SPORTS.includes(sport as Sport);
}

export interface TeamGroup {
  key: string; // Vergleichswert (Schreibweise egal)
  label: string; // z. B. "Österreich"
  icon: string; // Flagge oder Symbol
}

function groupFromLabel(label: string, icon: string): TeamGroup {
  return { key: normalizeTeamName(label), label, icon };
}

// Automatische Gruppe (ohne eigene Einstellung des Admins).
export function autoTeamGroup(team: Pick<Team, "sport" | "countryCode" | "isNationalTeam">): TeamGroup {
  if (team.isNationalTeam) return groupFromLabel(NATIONAL_GROUP, "🌍");
  const league = LEAGUE_OF_SPORT[team.sport];
  if (league && LEAGUE_COUNTRIES.includes(team.countryCode)) return groupFromLabel(league, "🏆");
  if (!team.countryCode) return groupFromLabel("Sonstige", "•");
  return groupFromLabel(countryName(team.countryCode), flagEmoji(team.countryCode));
}

// Icon für einen frei eingegebenen Gruppennamen: passt er zu einem Land,
// zu "Nationalteams" oder zur Liga, das passende Symbol, sonst ein Pokal.
function iconForLabel(label: string, teams: Team[]): string {
  const key = normalizeTeamName(label);
  const auto = teams.map(autoTeamGroup).find((g) => g.key === key);
  if (auto) return auto.icon;
  const country = COUNTRIES.find((c) => normalizeTeamName(c.name) === key);
  if (country) return flagEmoji(country.code);
  return key === normalizeTeamName(NATIONAL_GROUP) ? "🌍" : "🏆";
}

export function teamGroup(team: Team, allTeams: Team[] = []): TeamGroup {
  const custom = team.group?.trim();
  if (custom) {
    const auto = autoTeamGroup(team);
    if (normalizeTeamName(custom) === auto.key) return auto;
    return groupFromLabel(custom, iconForLabel(custom, allTeams));
  }
  return autoTeamGroup(team);
}

export interface TeamGroupWithTeams extends TeamGroup {
  teams: Team[];
}

// Reihenfolge: Liga (NHL/NBA) zuerst, dann Nationalteams, Österreich,
// Deutschland, danach alle anderen Gruppen A–Z. Teams in der Gruppe A–Z.
const PINNED = ["NHL", "NBA", NATIONAL_GROUP, "Österreich", "Deutschland"].map(normalizeTeamName);

export function groupTeams(teams: Team[]): TeamGroupWithTeams[] {
  const byKey = new Map<string, TeamGroupWithTeams>();
  for (const t of teams) {
    const g = teamGroup(t, teams);
    const entry = byKey.get(g.key);
    if (entry) entry.teams.push(t);
    else byKey.set(g.key, { ...g, teams: [t] });
  }
  const groups = Array.from(byKey.values());
  groups.forEach((g) => g.teams.sort((a, b) => a.name.localeCompare(b.name, "de")));
  return groups.sort((a, b) => {
    const pa = PINNED.indexOf(a.key);
    const pb = PINNED.indexOf(b.key);
    if (pa !== -1 || pb !== -1) return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
    return a.label.localeCompare(b.label, "de");
  });
}
