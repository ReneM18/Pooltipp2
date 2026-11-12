import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { firstArray, parseTennisResult, type TennisListResponse, type TennisResultRow } from "@/lib/tennisLive";

// Ergebnisse beendeter Tennis-Spiele für den Admin (Rene, 12.11.2026):
// Endstand (gewonnene Sätze) vorausfüllen, Rene drückt nur "Spiel beenden".
// GET /api/tennis/results?tour=atp|wta&from=YYYY-MM-DD  -> Spiele von "from"
// und dem Tag danach (UTC; späte Spiele enden nach Mitternacht).
// Gratis-Plan hat 50 Abfragen am Tag: zwischengespeichert für alle, laufende
// Tage 20 Minuten, vergangene 12 Stunden. Nur die letzten 8 Tage.

export const dynamic = "force-dynamic";

const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const DAY = 24 * 3600e3;

class ResultError extends Error {
  constructor(public data: TennisListResponse<TennisResultRow>) {
    super(data.error ?? "Fehler");
  }
}

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

async function load(tour: "atp" | "wta", from: string): Promise<TennisListResponse<TennisResultRow>> {
  const key = process.env.TENNIS_API_KEY;
  const fetchedAt = Date.now();
  const fail = (error: string) => new ResultError({ ok: false, error, fetchedAt, rows: [] });
  if (!key) throw fail("Tennis-Daten sind noch nicht eingerichtet.");
  const to = isoDay(Date.parse(`${from}T00:00:00Z`) + DAY);
  let res: Response;
  try {
    res = await fetch(`https://${HOST}/tennis/v2/${tour}/results/${from}/${to}?pageSize=500&pageNo=1`, {
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
  const rows = firstArray(body).map(parseTennisResult).filter((r): r is TennisResultRow => !!r);
  return { ok: true, error: null, fetchedAt, rows };
}

const lastError = new Map<string, { at: number; data: TennisListResponse<TennisResultRow> }>();

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const tour = params.get("tour");
  const from = params.get("from") ?? "";
  const fromMs = /^\d{4}-\d{2}-\d{2}$/.test(from) ? Date.parse(`${from}T00:00:00Z`) : NaN;
  const now = Date.now();
  if ((tour !== "atp" && tour !== "wta") || !Number.isFinite(fromMs) || isoDay(fromMs) !== from || fromMs > now || now - fromMs > 8 * DAY) {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage", fetchedAt: null, rows: [] }, { status: 400 });
  }
  const id = `${tour}-${from}`;
  const err = lastError.get(id);
  if (err && now - err.at < 2 * 60 * 1000) return NextResponse.json(err.data, { headers: { "Cache-Control": "no-store" } });
  // Beide Tage vorbei (UTC): Ergebnisse ändern sich nicht mehr.
  const settled = fromMs + 2 * DAY < now;
  try {
    const data = await unstable_cache(() => load(tour, from), ["tennis-results-v1", id, settled ? "alt" : "neu"], {
      revalidate: settled ? 12 * 3600 : 20 * 60,
    })();
    lastError.delete(id);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const data = e instanceof ResultError ? e.data : { ok: false, error: "Tennis-Daten gerade nicht erreichbar.", fetchedAt: now, rows: [] };
    lastError.set(id, { at: now, data });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }
}
