import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { parseLiveGame, type TennisLiveGame, type TennisLiveResponse } from "@/lib/tennisLive";

// Tennis-Live fürs Matchcenter (Rene, 10.11.2026), tennis-api.com über
// RapidAPI. Der Schlüssel steht in Vercel als TENNIS_API_KEY.
// Zwischenspeicher für ALLE Besucher gemeinsam (Vercel-Datencache): pro
// Zeitraum höchstens EINE Abfrage beim Anbieter, egal wie viele die App offen
// haben. Gratis-Plan = 50 Abfragen am Tag, darum Standard 45 Minuten.
// Nach dem Kauf (Pro, ~5.000 am Tag) in Vercel TENNIS_LIVE_SECONDS=15 setzen.

export const dynamic = "force-dynamic";

const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const LIVE_PATH = "/tennis/v2/extend/api/events/live";

function ttlSeconds(): number {
  const n = Number(process.env.TENNIS_LIVE_SECONDS);
  return Number.isFinite(n) && n >= 10 ? Math.round(n) : 45 * 60;
}

async function fetchLive(): Promise<{ ok: boolean; error: string | null; fetchedAt: number; games: TennisLiveGame[] }> {
  const key = process.env.TENNIS_API_KEY;
  const fetchedAt = Date.now();
  if (!key) return { ok: false, error: "Tennis-Daten sind noch nicht eingerichtet.", fetchedAt, games: [] };
  try {
    const res = await fetch(`https://${HOST}${LIVE_PATH}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const error = res.status === 429 ? "Tageslimit der Tennis-Daten erreicht." : `Tennis-Daten gerade nicht erreichbar (${res.status}).`;
      return { ok: false, error, fetchedAt, games: [] };
    }
    const body = await res.json();
    const list: unknown[] = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : Array.isArray(body?.results) ? body.results : [];
    const games = list.map(parseLiveGame).filter((g): g is TennisLiveGame => !!g);
    return { ok: true, error: null, fetchedAt, games };
  } catch {
    return { ok: false, error: "Tennis-Daten gerade nicht erreichbar.", fetchedAt, games: [] };
  }
}

// Fehler werden NICHT im gemeinsamen Speicher abgelegt (sonst bliebe Live
// 45 Minuten leer). Nach einem Fehler fragt diese Server-Instanz 2 Minuten
// lang nicht neu, damit Ausfälle das Tageslimit nicht aufbrauchen.
const RETRY_MS = 2 * 60 * 1000;
let lastError: { at: number; data: TennisLiveResponse } | null = null;

class LiveError extends Error {
  constructor(public data: TennisLiveResponse) {
    super(data.error ?? "Fehler");
  }
}

async function fetchLiveOrThrow(): Promise<TennisLiveResponse> {
  const data = await fetchLive();
  if (!data.ok) throw new LiveError(data);
  return data;
}

export async function GET() {
  const ttl = ttlSeconds();
  let data: TennisLiveResponse;
  if (lastError && Date.now() - lastError.at < RETRY_MS) {
    data = lastError.data;
  } else {
    try {
      data = await unstable_cache(fetchLiveOrThrow, ["tennis-live-v2", String(ttl)], { revalidate: ttl })();
      lastError = null;
    } catch (e) {
      data = e instanceof LiveError ? e.data : { ok: false, error: "Tennis-Daten gerade nicht erreichbar.", fetchedAt: Date.now(), games: [] };
      lastError = { at: Date.now(), data };
      return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
    }
  }
  return NextResponse.json(data, { headers: { "Cache-Control": `public, s-maxage=${Math.min(ttl, 60)}, stale-while-revalidate=${ttl}` } });
}
