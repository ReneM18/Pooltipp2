import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { firstArray, parsePlanGame, parseRankRow, type TennisListResponse, type TennisPlanGame, type TennisRankRow } from "@/lib/tennisLive";

// Tennis-Spielplan und Weltrangliste fürs Matchcenter (Rene, 10.11.2026).
// GET /api/tennis/list?kind=plan&tour=atp|wta   kommende Spiele
//     /api/tennis/list?kind=rank&tour=atp|wta   Weltrangliste Einzel (Top 100)
// Wie /api/tennis für alle gemeinsam zwischengespeichert; Gratis-Plan hat
// 50 Abfragen am Tag (Live braucht davon bis zu 32): Spielplan 6 Stunden,
// Rangliste 24 Stunden (wird ohnehin nur montags neu). Nur feste Werte,
// damit niemand mit erfundenen Werten das Limit aufbraucht.

export const dynamic = "force-dynamic";

const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const TTL = { plan: 6 * 3600, rank: 24 * 3600 } as const;

type Kind = keyof typeof TTL;
type Row = TennisPlanGame | TennisRankRow;

class ListError extends Error {
  constructor(public data: TennisListResponse<Row>) {
    super(data.error ?? "Fehler");
  }
}

async function load(kind: Kind, tour: "atp" | "wta"): Promise<TennisListResponse<Row>> {
  const key = process.env.TENNIS_API_KEY;
  const fetchedAt = Date.now();
  const fail = (error: string) => new ListError({ ok: false, error, fetchedAt, rows: [] });
  if (!key) throw fail("Tennis-Daten sind noch nicht eingerichtet.");
  const path =
    kind === "rank"
      ? `/tennis/v2/${tour}/ranking/singles?pageNo=1&pageSize=100`
      : `/tennis/v2/upcoming/matches/${tour}?page=1&limit=100&include=fixtureDetails`;
  let res: Response;
  try {
    res = await fetch(`https://${HOST}${path}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw fail("Tennis-Daten gerade nicht erreichbar.");
  }
  if (!res.ok) throw fail(res.status === 429 ? "Tageslimit der Tennis-Daten erreicht." : `Tennis-Daten gerade nicht erreichbar (${res.status}).`);
  const body = await res.json().catch(() => null);
  if (!body || typeof body !== "object") throw fail("Tennis-Daten gerade nicht lesbar.");
  const list = firstArray(body);
  const rows = (kind === "rank" ? list.map(parseRankRow) : list.map(parsePlanGame)).filter((r): r is Row => !!r);
  // Leere Weltrangliste = Fehler, nicht einen Tag lang speichern.
  if (kind === "rank" && !rows.length) throw fail("Weltrangliste gerade nicht lesbar.");
  if (kind === "rank") (rows as TennisRankRow[]).sort((a, b) => a.rank - b.rank);
  else (rows as TennisPlanGame[]).sort((a, b) => a.start - b.start);
  return { ok: true, error: null, fetchedAt, rows };
}

// Nach einem Fehler 2 Minuten nicht neu fragen (pro Server-Instanz).
const lastError = new Map<string, { at: number; data: TennisListResponse<Row> }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const tour = params.get("tour");
  if ((kind !== "plan" && kind !== "rank") || (tour !== "atp" && tour !== "wta")) {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage", fetchedAt: null, rows: [] }, { status: 400 });
  }
  const id = `${kind}-${tour}`;
  const err = lastError.get(id);
  if (err && Date.now() - err.at < 2 * 60 * 1000) return NextResponse.json(err.data, { headers: { "Cache-Control": "no-store" } });
  try {
    const data = await unstable_cache(() => load(kind, tour), ["tennis-list-v1", id], { revalidate: TTL[kind] })();
    lastError.delete(id);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=3600" } });
  } catch (e) {
    const data = e instanceof ListError ? e.data : { ok: false, error: "Tennis-Daten gerade nicht erreichbar.", fetchedAt: Date.now(), rows: [] };
    lastError.set(id, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }
}
