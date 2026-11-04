import { NextResponse } from "next/server";
import { footballSeason } from "@/lib/standings";
import { isFixtureLeague, type FixturesResponse } from "@/lib/competitionFixtures";
import { footballSeasonFixtures } from "@/lib/live/providers/apiSports";

// Spielplan eines Fußball-Bewerbs (Rene, 04.11.2026).
// GET /api/fixtures?league=<API-Sports-Liga-ID> – nur Bewerbe aus
// lib/competitionFixtures.ts. Der Anbieter merkt sich jeden Spielplan
// 30 Min.; so lange darf auch das CDN die Antwort für alle teilen.

function json(body: FixturesResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=60` },
  });
}

export async function GET(request: Request) {
  const league = Number(new URL(request.url).searchParams.get("league"));
  const season = footballSeason();
  if (!Number.isInteger(league) || !isFixtureLeague(league)) {
    return json({ league, season, games: [], error: "Ungültige Anfrage" }, 3600, 400);
  }
  const result = await footballSeasonFixtures(league, season);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ league, season, games: [], error: result.error }, maxAge);
  return json({ league, season, games: result.games, fetchedAt: result.fetchedAt }, maxAge);
}
