import { NextResponse } from "next/server";
import { footballSeason, isTableLeague, type StandingsResponse } from "@/lib/standings";
import { footballStandings } from "@/lib/live/providers/apiSports";

// Fußball-Tabelle (Rene, 27.10.2026: Pro-Plan).
// GET /api/standings?league=<API-Sports-Liga-ID> – nur Ligen aus
// lib/standings.ts. Der Anbieter merkt sich jede Tabelle 30 Min.; so lange
// darf auch das CDN die Antwort für alle teilen.

function json(body: StandingsResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=60` },
  });
}

export async function GET(request: Request) {
  const league = Number(new URL(request.url).searchParams.get("league"));
  const season = footballSeason();
  if (!Number.isInteger(league) || !isTableLeague(league)) {
    return json({ league, season, groups: [], error: "Ungültige Anfrage" }, 3600, 400);
  }
  const result = await footballStandings(league, season);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ league, season, groups: [], error: result.error }, maxAge);
  return json({ league, season, groups: result.groups, fetchedAt: result.fetchedAt }, maxAge);
}
