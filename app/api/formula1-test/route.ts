import { NextResponse } from "next/server";
import { viennaDate } from "@/lib/liveScores";
import { formula1Test, type Formula1Query, type Formula1TestResult } from "@/lib/live/providers/apiSports";

// Formel-1-Test (Rene, 30.10.2026), nur für die Kachel im Admin.
// GET /api/formula1-test?kind=races-day[&date=YYYY-MM-DD]
//     /api/formula1-test?kind=races-season&season=2026
//     /api/formula1-test?kind=ranking&race=<id>
//     /api/formula1-test?kind=drivers&season=2026
// Der Anbieter merkt sich jede Antwort 60 s (lib/live/providers/apiSports.ts).

export type Formula1TestResponse = Formula1TestResult;

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
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage", quota: null } satisfies Formula1TestResponse, { status: 400 });
  }
  const result = await formula1Test(query);
  return NextResponse.json(result satisfies Formula1TestResponse, { headers: { "Cache-Control": "no-store" } });
}
