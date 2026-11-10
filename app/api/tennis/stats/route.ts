import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { parseTennisStats, type TennisStatsResponse } from "@/lib/tennisLive";

// Statistik eines laufenden Tennis-Spiels fürs Matchcenter-Detail (Rene,
// 10.11.2026). GET /api/tennis/stats?id=<eventId aus /api/tennis>.
// Für alle gemeinsam zwischengespeichert. Gratis-Plan: 50 Abfragen am Tag,
// darum standardmäßig 10 Minuten (TENNIS_STATS_SECONDS, mit Pro z. B. 60).

export const dynamic = "force-dynamic";

const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const TTL = Math.max(15, Number(process.env.TENNIS_STATS_SECONDS) || 600);

class StatsError extends Error {
  constructor(public data: TennisStatsResponse) {
    super(data.error ?? "Fehler");
  }
}

async function load(id: string): Promise<TennisStatsResponse> {
  const key = process.env.TENNIS_API_KEY;
  const fetchedAt = Date.now();
  const fail = (error: string) => new StatsError({ ok: false, error, fetchedAt, rows: [] });
  if (!key) throw fail("Tennis-Daten sind noch nicht eingerichtet.");
  let res: Response;
  try {
    res = await fetch(`https://${HOST}/tennis/v2/extend/api/event/get/statistics/${id}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw fail("Statistik gerade nicht erreichbar.");
  }
  if (res.status === 403) throw fail("Statistik ist im aktuellen Tennis-Plan nicht dabei.");
  if (!res.ok) throw fail(res.status === 429 ? "Tageslimit der Tennis-Daten erreicht." : `Statistik gerade nicht erreichbar (${res.status}).`);
  const body = await res.json().catch(() => null);
  if (!body || typeof body !== "object") throw fail("Statistik gerade nicht lesbar.");
  // Leer ist erlaubt (Spiel gerade erst begonnen): dann "noch keine Statistik".
  return { ok: true, error: null, fetchedAt, rows: parseTennisStats(body) };
}

// Nach einem Fehler 2 Minuten nicht neu fragen (pro Server-Instanz).
const lastError = new Map<string, { at: number; data: TennisStatsResponse }>();

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  // Nur Zahlen (eventId), damit niemand mit erfundenen Werten das Limit aufbraucht.
  if (!/^\d{1,12}$/.test(id)) {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage", fetchedAt: null, rows: [] }, { status: 400 });
  }
  const err = lastError.get(id);
  if (err && Date.now() - err.at < 2 * 60 * 1000) return NextResponse.json(err.data, { headers: { "Cache-Control": "no-store" } });
  try {
    const data = await unstable_cache(() => load(id), ["tennis-stats-v1", id], { revalidate: TTL })();
    lastError.delete(id);
    return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${Math.min(TTL, 60)}` } });
  } catch (e) {
    const data = e instanceof StatsError ? e.data : { ok: false, error: "Statistik gerade nicht erreichbar.", fetchedAt: Date.now(), rows: [] };
    lastError.set(id, { at: Date.now(), data });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  }
}
