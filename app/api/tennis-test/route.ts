import { NextResponse } from "next/server";

// Test für tennis-api.com (über RapidAPI, Gratisplan 50 Abfragen/Tag), Rene 10.11.2026.
// GET /api/tennis-test  holt einmal die laufenden Tennis-Spiele und zeigt,
// wie schnell der Anbieter antwortet und wie aktuell die Stände sind.
// Zweimal im Abstand von 15 s öffnen und mit einem Live-Ticker vergleichen.
// Kein Teil der App; wird entfernt, sobald das Tennis-Matchcenter steht.

export const dynamic = "force-dynamic";

const HOST = "tennis-api-atp-wta-itf.p.rapidapi.com";
const LIVE_PATH = "/tennis/v2/extend/api/events/live";

function viennaTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour12: false });
}

export async function GET() {
  const key = process.env.TENNIS_API_KEY;
  if (!key) {
    return NextResponse.json({ ok: false, error: "TENNIS_API_KEY fehlt in Vercel (Production) oder es wurde nicht neu deployt." }, { status: 500 });
  }

  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(`https://${HOST}${LIVE_PATH}`, {
      headers: { "X-RapidAPI-Key": key, "X-RapidAPI-Host": HOST },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: `Anbieter nicht erreichbar: ${String(e)}` }, { status: 502 });
  }
  const ms = Date.now() - started;
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {
    // kein JSON: Text unten unverändert zeigen
  }

  // Die Liste kann je nach Antwort direkt oder unter data/events/results liegen.
  const obj = body as Record<string, unknown> | unknown[];
  const list = Array.isArray(obj)
    ? obj
    : ((["data", "events", "results", "response"] as const)
        .map((k) => (obj as Record<string, unknown>)?.[k])
        .find(Array.isArray) as unknown[] | undefined);

  return NextResponse.json(
    {
      ok: res.ok,
      httpStatus: res.status,
      abgefragtUm: viennaTime(started),
      antwortzeitMs: ms,
      abfragenUebrigHeute: res.headers.get("x-ratelimit-requests-remaining"),
      abfragenLimit: res.headers.get("x-ratelimit-requests-limit"),
      laufendeSpiele: list ? list.length : null,
      // Ganze Antwort, gekürzt, damit man sieht, welche Felder es gibt.
      antwort: list ? list.slice(0, 15) : typeof body === "string" ? body.slice(0, 3000) : body,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
