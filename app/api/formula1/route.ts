import { NextResponse } from "next/server";
import { viennaDate } from "@/lib/liveScores";
import { formula1, isKnownF1Session, type Formula1Query, type Formula1Result } from "@/lib/live/providers/apiSports";

// Motorsport / Formel 1 im Matchcenter (Rene, 30.10.2026).
// GET /api/formula1?kind=races-season   alle Sessions der laufenden Saison
//     /api/formula1?kind=races-day&date=YYYY-MM-DD  Sessions von heute/morgen
//     /api/formula1?kind=ranking&race=<id>          Wertung einer Session
//     /api/formula1?kind=drivers                    WM-Stand Fahrer
// Nur feste Werte (laufende Saison, heute/morgen, bekannte Sessions), damit
// niemand mit erfundenen Werten die 100 Abfragen pro Tag aufbraucht.
// Ablaufzeiten stehen beim Anbieter (lib/live/providers/apiSports.ts, F1_TTL).

export type Formula1Response = Formula1Result;

function plusDay(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function bad() {
  return NextResponse.json({ ok: false, error: "Ungültige Anfrage", quota: null } satisfies Formula1Response, { status: 400 });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const today = viennaDate(Date.now());
  const days = [today, plusDay(today)];
  const season = Number(today.slice(0, 4));
  const kind = params.get("kind");
  let query: Formula1Query;
  if (kind === "races-season") query = { kind, season };
  else if (kind === "drivers") query = { kind, season };
  else if (kind === "races-day") {
    const date = params.get("date") ?? today;
    if (!days.includes(date)) return bad();
    query = { kind, date };
  } else if (kind === "ranking") {
    const race = Number(params.get("race"));
    if (!Number.isInteger(race) || race <= 0 || !(await isKnownF1Session(race, season, days))) return bad();
    query = { kind, race };
  } else return bad();

  const result = await formula1(query);
  // Kurz im CDN teilen, damit nicht jeder Nutzer einzeln beim Server fragt.
  const maxAge = result.ok ? (query.kind === "ranking" ? 60 : 300) : 30;
  return NextResponse.json(result satisfies Formula1Response, {
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=60` },
  });
}
