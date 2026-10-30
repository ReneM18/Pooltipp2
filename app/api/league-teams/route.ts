import { NextResponse } from "next/server";
import { footballSeason } from "@/lib/standings";
import { findImportLeague } from "@/lib/leagueImport";
import { footballLeagueTeams, hockeyLeagueTeams, type LeagueTeam } from "@/lib/live/providers/apiSports";

// Vereine einer Liga (Rene, 30.10.2026), fürs Anlegen im Admin unter Teams.
// GET /api/league-teams?league=<key> – nur Ligen aus lib/leagueImport.ts
// (Fußball: API-Sports-Liga-ID, Eishockey: "icehl"). Der Anbieter merkt sich
// die Liste eine Woche.

export interface LeagueTeamsResponse {
  league: string;
  season: number;
  teams: LeagueTeam[];
  // "app": Liste aus lib/leagueImport.ts, weil die API sie nicht liefert.
  source?: "api" | "app";
  error?: string;
}

function json(body: LeagueTeamsResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600" },
  });
}

export async function GET(request: Request) {
  const key = new URL(request.url).searchParams.get("league") ?? "";
  const league = findImportLeague(key);
  const season = footballSeason();
  if (!league) return json({ league: key, season, teams: [], error: "Ungültige Anfrage" }, 400);
  const result = league.hockey
    ? await hockeyLeagueTeams(league.hockey.names, league.hockey.apiCountry)
    : await footballLeagueTeams(league.footballId!, season);
  // Gratis-Plan sperrt die Eishockey-Vereine (Rene, 30.10.2026): dann die
  // Liste aus der App.
  if ((!result.ok || result.teams.length === 0) && league.fallbackTeams) {
    return json({ league: key, season, teams: [...league.fallbackTeams], source: "app" });
  }
  if (!result.ok) return NextResponse.json({ league: key, season, teams: [], error: result.error }, { headers: { "Cache-Control": "no-store" } });
  return json({ league: key, season: result.season ?? season, teams: result.teams, source: "api" });
}
