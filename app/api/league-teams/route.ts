import { NextResponse } from "next/server";
import { footballSeason, isTableLeague } from "@/lib/standings";
import { footballLeagueTeams, type LeagueTeam } from "@/lib/live/providers/apiSports";

// Vereine einer Fußball-Liga (Rene, 30.10.2026), fürs Anlegen im Admin unter
// Teams. GET /api/league-teams?league=<API-Sports-Liga-ID> – nur Ligen aus
// lib/standings.ts. Der Anbieter merkt sich die Liste eine Woche.

export interface LeagueTeamsResponse {
  league: number;
  season: number;
  teams: LeagueTeam[];
  error?: string;
}

function json(body: LeagueTeamsResponse, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=3600" },
  });
}

export async function GET(request: Request) {
  const league = Number(new URL(request.url).searchParams.get("league"));
  const season = footballSeason();
  if (!Number.isInteger(league) || !isTableLeague(league)) {
    return json({ league, season, teams: [], error: "Ungültige Anfrage" }, 400);
  }
  const result = await footballLeagueTeams(league, season);
  if (!result.ok) return NextResponse.json({ league, season, teams: [], error: result.error }, { headers: { "Cache-Control": "no-store" } });
  return json({ league, season, teams: result.teams });
}
