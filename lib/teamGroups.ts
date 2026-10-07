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

// Spitznamen aller NBA- und NHL-Teams: so landet ein Team auch dann in
// seiner Liga, wenn beim Anlegen das Land nicht auf USA/Kanada gestellt
// wurde (Standard im Formular ist Deutschland).
const LEAGUE_NICKNAMES: Partial<Record<Sport, string[]>> = {
  NBA: [
    "Hawks", "Celtics", "Nets", "Hornets", "Bulls", "Cavaliers", "Mavericks", "Nuggets", "Pistons",
    "Warriors", "Rockets", "Pacers", "Clippers", "Lakers", "Grizzlies", "Heat", "Bucks", "Timberwolves",
    "Pelicans", "Knicks", "Thunder", "Magic", "76ers", "Sixers", "Suns", "Trail Blazers", "Blazers",
    "Kings", "Spurs", "Raptors", "Jazz", "Wizards",
  ],
  NHL: [
    "Ducks", "Coyotes", "Utah Hockey Club", "Mammoth", "Bruins", "Sabres", "Flames", "Hurricanes",
    "Blackhawks", "Avalanche", "Blue Jackets", "Stars", "Red Wings", "Oilers", "Panthers", "Kings",
    "Wild", "Canadiens", "Predators", "Devils", "Islanders", "Rangers", "Senators", "Flyers",
    "Penguins", "Sharks", "Kraken", "Blues", "Lightning", "Maple Leafs", "Canucks", "Golden Knights",
    "Capitals", "Jets",
  ],
};

function isLeagueTeamName(sport: Sport, name: string): boolean {
  const key = normalizeTeamName(name);
  return (LEAGUE_NICKNAMES[sport] ?? []).some((n) => key.endsWith(normalizeTeamName(n)));
}

// Heißt das Team wie ein Land ("Österreich", "USA", "Kanada"), ist es eine
// Nationalmannschaft – auch wenn der Haken beim Anlegen vergessen wurde.
const COUNTRY_ALIASES: Record<string, string> = { usa: "US", vereinigtestaaten: "US", england: "GB-ENG", schottland: "GB-SCT", wales: "GB-WLS", nordirland: "GB-NIR" };
function countryOfName(name: string): string | null {
  const key = normalizeTeamName(name);
  if (!key) return null;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return COUNTRIES.find((c) => normalizeTeamName(c.name) === key)?.code ?? null;
}

// Automatische Gruppe (ohne eigene Einstellung des Admins).
export function autoTeamGroup(team: Pick<Team, "name" | "sport" | "countryCode" | "isNationalTeam">): TeamGroup {
  if (team.isNationalTeam || countryOfName(team.name ?? "")) return groupFromLabel(NATIONAL_GROUP, "🌍");
  const league = LEAGUE_OF_SPORT[team.sport];
  if (league && (LEAGUE_COUNTRIES.includes(team.countryCode) || isLeagueTeamName(team.sport, team.name ?? "")))
    return groupFromLabel(league, "🏆");
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

// Gruppen, die der Admin immer sieht (auch ohne Teams), damit klar ist,
// wo ein neues Team hinkommt.
const STANDARD_GROUPS: Partial<Record<Sport, TeamGroup[]>> = {
  "Fußball": [groupFromLabel(NATIONAL_GROUP, "🌍"), groupFromLabel("Österreich", flagEmoji("AT")), groupFromLabel("Deutschland", flagEmoji("DE"))],
  NBA: [groupFromLabel("NBA", "🏆"), groupFromLabel(NATIONAL_GROUP, "🌍")],
  NHL: [groupFromLabel("NHL", "🏆"), groupFromLabel(NATIONAL_GROUP, "🌍")],
};

// withStandardFor: Sportart, deren Standard-Gruppen auch leer dabei sind.
export function groupTeams(teams: Team[], withStandardFor?: Sport): TeamGroupWithTeams[] {
  const byKey = new Map<string, TeamGroupWithTeams>();
  for (const g of (withStandardFor && STANDARD_GROUPS[withStandardFor]) || []) byKey.set(g.key, { ...g, teams: [] });
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

// Gruppe für jedes Land wählbar ("Weitere Länder…"): ist das gewählte Land
// noch nicht in der Liste, kommt es als leere Gruppe dazu.
export function countryGroupByKey(key: string): TeamGroup | null {
  const c = COUNTRIES.find((x) => normalizeTeamName(x.name) === key);
  return c ? groupFromLabel(c.name, flagEmoji(c.code)) : null;
}

export function withSelectedGroup(groups: TeamGroupWithTeams[], key: string): TeamGroupWithTeams[] {
  if (!key || groups.some((g) => g.key === key)) return groups;
  const extra = countryGroupByKey(key);
  return extra ? [...groups, { ...extra, teams: [] }] : groups;
}
