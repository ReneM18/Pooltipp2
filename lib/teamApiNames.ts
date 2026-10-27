import type { Sport, Team } from "./types";
import { normalizeTeamName } from "./teamName";
import { teamMatchScore } from "./liveScores";
import { setManualAliases } from "./live/aliases";

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
// ↔ "Washington Capitals") zählen bewusst nicht.
export function autoTeamForApiName(teams: Team[], sport: Sport, apiName: string): Team | undefined {
  let best: Team | undefined;
  let bestScore = 0;
  let tie = false;
  for (const t of teams) {
    if (t.sport !== sport) continue;
    const score = teamMatchScore(t.name, apiName);
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
  if (link) return link.teamId ? teams.find((t) => t.id === link.teamId) : undefined;
  return autoTeamForApiName(teams, sport, apiName);
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
    if (team) pairs.push([l.apiName, team.name]);
  }
  setManualAliases(pairs);
}
