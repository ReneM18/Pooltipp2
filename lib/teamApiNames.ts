import type { Sport, Team } from "./types";
import { normalizeTeamName } from "./teamName";
import { teamMatchScore } from "./liveScores";
import { setManualAliases } from "./live/aliases";
import { leagueNicknameMatch } from "./teamGroups";
import { apiNationCode } from "./nationalKits";
import { COUNTRIES, countryName, teamCountryName } from "./flags";

// Eigene Vereinsnamen statt der Namen von der API (Rene, 27.10.2026: "Rapid
// Vienna" soll "Rapid Wien" heißen, wie im Admin händisch angelegt).
//
// Der Admin verknüpft unter "Vereinsnamen" einen API-Namen mit einem seiner
// Teams. Ohne Verknüpfung sucht die App selbst ein Team mit gleichem Namen
// (Schreibweise egal) bzw. aus der Alias-Liste (lib/live/aliases.ts) – nur
// eindeutige Treffer, sonst bleibt der API-Name stehen.
//
// Gespeichert als EINE Zeile in der Tabelle "teams" wie die Wettbewerbe und
// Untergruppen (kein SQL nötig).
export const API_NAMES_ROW_ID = "__api_namen__";

export interface ApiNameLink {
  sport: Sport;
  apiName: string;
  // null = bewusst den API-Namen lassen (keine automatische Zuordnung).
  teamId: string | null;
}

export interface ApiNamesRow {
  kind: "apiNames";
  list: ApiNameLink[];
}

function sameApiName(a: string, b: string): boolean {
  return normalizeTeamName(a) === normalizeTeamName(b);
}

export function findApiNameLink(links: ApiNameLink[], sport: Sport, apiName: string): ApiNameLink | undefined {
  return links.find((l) => l.sport === sport && sameApiName(l.apiName, apiName));
}

// Automatischer Treffer: genau ein Team dieser Sportart mit gleichem Namen
// oder Alias (Score ≥ 3, siehe teamMatchScore). Lockere Treffer ("Capitals"
// ↔ "Washington Capitals") zählen bewusst nicht – außer bei NBA, NHL und
// NFL, wo der Spitzname eindeutig ist (leagueNicknameMatch).
export function autoTeamForApiName(teams: Team[], sport: Sport, apiName: string): Team | undefined {
  let best: Team | undefined;
  let bestScore = 0;
  let tie = false;
  for (const t of teams) {
    if (t.sport !== sport) continue;
    // US-Ligen: "Grizzlies" = "Memphis Grizzlies" zählt wie gleicher Name.
    const score = Math.max(teamMatchScore(t.name, apiName), leagueNicknameMatch(sport, t, apiName) ? 3 : 0);
    if (score < 3) continue;
    if (score > bestScore) {
      best = t;
      bestScore = score;
      tie = false;
    } else if (score === bestScore) {
      tie = true;
    }
  }
  return tie ? undefined : best;
}

// Eigenes Team zu einem API-Namen: zuerst die Verknüpfung aus dem Admin,
// sonst der automatische Treffer.
export function appTeamForApiName(
  teams: Team[],
  links: ApiNameLink[],
  sport: Sport,
  apiName: string,
): Team | undefined {
  const link = findApiNameLink(links, sport, apiName);
  if (link && !link.teamId) return undefined;
  // Verknüpftes Team gelöscht: wie ohne Verknüpfung.
  const found = link ? teams.find((t) => t.id === link.teamId) : undefined;
  // Länderspiel mit Verknüpfung auf ein Team aus einem anderen Land (Rene,
  // 12.11.2026: "Belgium" zeigte "Albanien"): Verknüpfung nicht verwenden.
  const linked = found && !sameNation(found, sport, apiName) ? undefined : found;
  const auto = autoTeamForApiName(teams, sport, apiName);
  return linked ?? (auto && sameNation(auto, sport, apiName) ? auto : undefined) ?? nationalTeamForApiName(teams, sport, apiName);
}

// Deutsche Ländernamen → Code ("albanien" → "AL"), für Teams ohne richtiges Land.
const NATION_BY_GERMAN_NAME = new Map<string, string>(
  COUNTRIES.flatMap((c) => [
    [normalizeTeamName(c.name), c.code],
    [normalizeTeamName(teamCountryName(c.code)), c.code],
  ]),
);

// false nur, wenn der API-Name ein Land ist und das Team ein Nationalteam
// (oder Team mit Ländernamen) eines ANDEREN Landes.
export function sameNation(team: Team, sport: Sport, apiName: string): boolean {
  if (sport !== "Fußball") return true;
  const code = apiNationCode(apiName);
  if (!code) return true;
  // Heißt das Team wie ein Land ("Albanien"), zählt der Name, auch wenn beim
  // Team ein falsches Land eingetragen ist.
  const plain = normalizeTeamName(team.name.replace(/\s+w$/i, ""));
  const nameCode = apiNationCode(team.name) ?? NATION_BY_GERMAN_NAME.get(plain);
  if (nameCode) return nameCode === code;
  const teamCode = (team.countryCode ?? "").toUpperCase();
  return !team.isNationalTeam || teamCode === code;
}

// Länderspiele (Rene, 12.11.2026): Die API schreibt englisch ("Belgium"),
// in der App heißt das Team meist deutsch ("Belgien"). Treffer über das Land:
// ein Nationalteam dieser Sportart mit dem Ländercode, sonst ein Team, das
// genau wie das Land heißt. Vereine aus Belgien zählen nicht.
function nationalTeamForApiName(teams: Team[], sport: Sport, apiName: string): Team | undefined {
  if (sport !== "Fußball") return undefined;
  const code = apiNationCode(apiName);
  if (!code) return undefined;
  const women = /\s+w$/i.test(apiName.trim());
  const nameCodeOf = (t: Team) => {
    const plain = normalizeTeamName(t.name.replace(/\s+w$/i, ""));
    return apiNationCode(t.name) ?? NATION_BY_GERMAN_NAME.get(plain);
  };
  // Kandidaten: heißt wie das Land ("Belgien") oder Nationalteam mit diesem
  // Land. Ein Team, das wie ein anderes Land heißt, zählt nie.
  const candidates = teams.filter(
    (t) =>
      t.sport === sport &&
      /\s+w$/i.test(t.name.trim()) === women &&
      sameNation(t, sport, apiName) &&
      (nameCodeOf(t) === code || (t.isNationalTeam && (t.countryCode ?? "").toUpperCase() === code)),
  );
  const pick = (list: Team[]) => (list.length === 1 ? list[0] : undefined);
  return (
    pick(candidates.filter((t) => t.isNationalTeam && nameCodeOf(t) === code)) ??
    pick(candidates.filter((t) => t.isNationalTeam)) ??
    pick(candidates)
  );
}

// Anzeigename: Name des eigenen Teams, sonst der API-Name.
export function appTeamName(teams: Team[], links: ApiNameLink[], sport: Sport, apiName: string): string {
  return appTeamForApiName(teams, links, sport, apiName)?.name ?? apiName;
}

// Verknüpfungen auch für die Live-Zuordnung der Tippspiele (findLiveGame):
// "Rapid Vienna" gilt dann wie ein Alias von "Rapid Wien".
export function applyApiNameAliases(teams: Team[], links: ApiNameLink[]) {
  const pairs: [string, string][] = [];
  for (const l of links) {
    const team = l.teamId ? teams.find((t) => t.id === l.teamId) : undefined;
    // Falsche Länder-Verknüpfung ("Belgium" → "Albanien") auch nicht als Alias,
    // sonst findet die automatische Suche das falsche Team trotzdem.
    if (team && sameNation(team, l.sport, l.apiName)) pairs.push([l.apiName, team.name]);
  }
  setManualAliases(pairs);
}
