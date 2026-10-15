import type { Sport } from "./types";

// Welche Sportarten/Ligen Live-Stände von API-Sports bekommen.
// (Rene, 15.10.2026: zum Testen nur Europa League)
// Eishockey (NHL), NFL, NBA und Handball sind fertig im Code, aber abgeschaltet.
// Zum Einschalten die Sportart in LIVE_SPORTS ergänzen.
// Jede eingeschaltete Sportart verbraucht Abfragen (100 pro Tag je Sport-API).
export const LIVE_SPORTS: readonly Sport[] = ["Fußball"];

// Fußball-Wettbewerbe mit Live-Ständen. Verglichen wird über den Namen des
// Wettbewerbs in der App bzw. league.name der API (Groß/Klein egal, "UEFA"
// davor optional). Leere Liste = alle Fußball-Ligen.
// Hinweis: Abfrage per league=3&season=2026 ist im Gratis-Plan gesperrt –
// deshalb wird weiter nach Datum abgefragt und hier nach dem Namen gefiltert.
export const LIVE_LEAGUES_FUSSBALL: readonly string[] = ["UEFA Europa League"];

function normalizeLeague(name: string): string {
  return name
    .toLowerCase()
    .replace(/^uefa\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Gleicher Wettbewerb? ("Europa League" = "UEFA Europa League")
export function sameLeague(a: string, b: string): boolean {
  return normalizeLeague(a) === normalizeLeague(b);
}

export function isLiveSportEnabled(sport: string): sport is Sport {
  return (LIVE_SPORTS as readonly string[]).includes(sport);
}

// true, wenn für diesen Wettbewerb (App-Name oder league.name der API)
// Live-Stände abgefragt bzw. angezeigt werden sollen.
export function isLiveLeagueEnabled(sport: Sport, competition: string | null | undefined): boolean {
  if (!isLiveSportEnabled(sport)) return false;
  if (sport !== "Fußball" || LIVE_LEAGUES_FUSSBALL.length === 0) return true;
  if (!competition) return false;
  const name = normalizeLeague(competition);
  return LIVE_LEAGUES_FUSSBALL.some((l) => normalizeLeague(l) === name);
}
