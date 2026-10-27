import { NextResponse } from "next/server";
import type { MatchInfoResponse } from "@/lib/matchInfo";
import { footballMatchInfo } from "@/lib/live/providers/apiSports";

// Aufstellungen und Statistik eines Fußballspiels (Rene, 27.10.2026: Pro-Plan).
// GET /api/match-info?fixture=<API-Sports-Spiel-ID>. Das CDN teilt die
// Antwort so lange, wie der Anbieter sie sich merkt.

function json(body: MatchInfoResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=60` },
  });
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("fixture") ?? "";
  const fixture = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(fixture) || fixture <= 0) {
    return json({ fixture: 0, lineups: [], stats: [], error: "Ungültige Anfrage" }, 3600, 400);
  }
  const result = await footballMatchInfo(fixture);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ fixture, lineups: [], stats: [], error: result.error }, maxAge);
  return json(
    {
      fixture,
      lineups: result.lineups,
      stats: result.stats,
      ...(result.lineupsError ? { lineupsError: result.lineupsError } : {}),
      ...(result.statsError ? { statsError: result.statsError } : {}),
    },
    maxAge,
  );
}
