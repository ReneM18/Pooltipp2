import type { Sport } from "./types";

// Welche Sportarten/Ligen Live-Stände von API-Sports bekommen.
// (Rene, 15.10.2026: zum Testen nur Europa League)
// (Rene, 16.10.2026: dazu AT/DE-Bundesliga, Serie A und Eishockey – NHL und
// ICE Hockey League.) NFL, NBA und Handball sind fertig im Code, aber
// abgeschaltet. Zum Einschalten die Sportart in LIVE_SPORTS und ihre Ligen
// in LIVE_LEAGUES ergänzen.
// Jede eingeschaltete Sportart verbraucht Abfragen (100 pro Tag je
// Sport-API) – Eishockey hat ein eigenes Kontingent (hockey.api-sports.io).
export const LIVE_SPORTS: readonly Sport[] = ["Fußball", "NHL"];

// Eine Liga mit Live-Ständen (Rene, 16.10.2026). Abgleich über Name UND
// Land, weil API-Sports beide Bundesligen "Bundesliga" nennt (league.country
// "Austria"/"Germany") und es z. B. auch eine brasilianische "Serie A" gibt.
//  - names: Schreibweisen in App (Wettbewerb) und API (league.name), klein,
//    ohne "UEFA " davor (wird beim Vergleich entfernt).
//  - country: ISO-Land der Liga (wie in der App unter Wettbewerbe gewählt
//    bzw. per Flaggen-Automatik), null = international (Europa League).
export interface LiveLeague {
  label: string;
  names: readonly string[];
  country: string | null;
}

// Hinweis: Abfrage per league=…&season=2026 ist im Gratis-Plan gesperrt –
// deshalb wird weiter nach Datum abgefragt und hier nach Name + Land
// gefiltert. Leere Liste = alle Ligen der Sportart.
export const LIVE_LEAGUES: Partial<Record<Sport, readonly LiveLeague[]>> = {
  "Fußball": [
    { label: "Europa League", names: ["europa league"], country: null },
    { label: "Bundesliga", names: ["bundesliga", "österreichische bundesliga", "admiral bundesliga"], country: "AT" },
    { label: "Bundesliga", names: ["bundesliga"], country: "DE" },
    { label: "Serie A", names: ["serie a"], country: "IT" },
  ],
  NHL: [
    { label: "NHL", names: ["nhl", "nhl regular season", "nhl playoffs", "stanley cup finale"], country: "US" },
    { label: "ICE Hockey League", names: ["ice hockey league", "win2day ice hockey league", "ebel"], country: "AT" },
  ],
};

// league.country der API (bzw. country.name bei Eishockey) → ISO-Land.
// "World" = international.
const API_COUNTRY: Record<string, string | null> = {
  austria: "AT",
  germany: "DE",
  italy: "IT",
  usa: "US",
  "united states": "US",
  world: null,
  europe: null,
};

function normalizeLeague(name: string): string {
  return name
    .toLowerCase()
    .replace(/^uefa\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Land vereinheitlichen: ISO-Code ("AT") oder Ländername der API
// ("Austria") → ISO-Code; null = international; undefined = unbekannt.
function normalizeCountry(country: string | null | undefined): string | null | undefined {
  if (country === null || country === undefined || country.trim() === "") return undefined;
  const c = country.trim();
  if (/^[A-Za-z]{2}(-[A-Za-z]{3})?$/.test(c)) return c.toUpperCase();
  const key = c.toLowerCase();
  return key in API_COUNTRY ? API_COUNTRY[key] : c.toUpperCase();
}

// Gleicher Wettbewerb? ("Europa League" = "UEFA Europa League")
export function sameLeague(a: string, b: string): boolean {
  return normalizeLeague(a) === normalizeLeague(b);
}

export function isLiveSportEnabled(sport: string): sport is Sport {
  return (LIVE_SPORTS as readonly string[]).includes(sport);
}

// Passende eingeschaltete Liga zu Name + Land oder null.
//  - strict (API-Seite): Land muss passen, ohne Land kein Treffer
//    (brasilianische "Serie A" fällt raus).
//  - sonst (App-Seite): passt das Land, gewinnt diese Liga; ist es
//    unbekannt oder passt keins, zählt der Name allein (App-Wettbewerbe
//    haben nicht immer ein Land, z. B. ICE Hockey League ohne Auswahl → USA
//    per Automatik).
export function findLiveLeague(
  sport: Sport,
  competition: string | null | undefined,
  country?: string | null,
  strict = false,
): LiveLeague | null {
  if (!isLiveSportEnabled(sport) || !competition) return null;
  const list = LIVE_LEAGUES[sport] ?? [];
  const name = normalizeLeague(competition);
  const byName = list.filter((l) => l.names.some((n) => normalizeLeague(n) === name));
  if (byName.length === 0) return null;
  const c = normalizeCountry(country);
  const byCountry = c === undefined ? [] : byName.filter((l) => l.country === c);
  if (byCountry.length > 0) return byCountry[0];
  return strict ? null : byName[0];
}

// true, wenn für diesen Wettbewerb (App-Name oder league.name der API)
// Live-Stände abgefragt bzw. angezeigt werden sollen. country: Land der App
// (ISO) oder der API ("Austria"); strict siehe findLiveLeague.
export function isLiveLeagueEnabled(
  sport: Sport,
  competition: string | null | undefined,
  country?: string | null,
  strict = false,
): boolean {
  if (!isLiveSportEnabled(sport)) return false;
  if ((LIVE_LEAGUES[sport] ?? []).length === 0) return true;
  return findLiveLeague(sport, competition, country, strict) !== null;
}

// ISO-Land aus dem league-Text eines Live-Spiels ("Bundesliga · Austria").
export function liveGameCountry(league: string): string | null {
  const c = normalizeCountry(league.split(" · ")[1]);
  return c ?? null;
}

// Liga eines Live-Spiels (league "Name · Land").
export function liveGameLeague(sport: Sport, league: string): LiveLeague | null {
  const [name, country] = league.split(" · ");
  return findLiveLeague(sport, name, country ?? null, true);
}
