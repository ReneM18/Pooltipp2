import { NextResponse } from "next/server";
import { viennaDate } from "@/lib/liveScores";
import { formula1, type Formula1Query, type Formula1Result } from "@/lib/live/providers/apiSports";

// Motorsport / Formel 1 im Matchcenter (Rene, 30.10.2026).
// GET /api/formula1?kind=races-season&season=2026   alle Sessions der Saison
//     /api/formula1?kind=races-day[&date=YYYY-MM-DD] Sessions eines Tages
//     /api/formula1?kind=ranking&race=<id>           Wertung einer Session
//     /api/formula1?kind=drivers&season=2026         WM-Stand Fahrer
// Ablaufzeiten stehen beim Anbieter (lib/live/providers/apiSports.ts, F1_TTL).

export type Formula1Response = Formula1Result;

function parseQuery(params: URLSearchParams): Formula1Query | null {
  const kind = params.get("kind");
  const season = Number(params.get("season") ?? new Date().getFullYear());
  const validSeason = Number.isInteger(season) && season >= 2012 && season <= 2100;
  if (kind === "races-day") {
    const date = params.get("date") ?? viennaDate(Date.now());
    return /^\d{4}-\d{2}-\d{2}$/.test(date) ? { kind, date } : null;
  }
  if (kind === "races-season" && validSeason) return { kind, season };
  if (kind === "drivers" && validSeason) return { kind, season };
  if (kind === "ranking") {
    const race = Number(params.get("race"));
    return Number.isInteger(race) && race > 0 ? { kind, race } : null;
  }
  return null;
}

export async function GET(request: Request) {
  const query = parseQuery(new URL(request.url).searchParams);
  if (!query) {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage", quota: null } satisfies Formula1Response, { status: 400 });
  }
  const result = await formula1(query);
  // Kurz im CDN teilen, damit nicht jeder Nutzer einzeln beim Server fragt.
  const maxAge = result.ok ? (query.kind === "ranking" ? 60 : 300) : 30;
  return NextResponse.json(result satisfies Formula1Response, {
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=60` },
  });
}
