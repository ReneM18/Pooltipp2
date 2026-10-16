import { NextResponse } from "next/server";
import { ALL_SPORTS } from "@/lib/types";
import { isLiveSportEnabled } from "@/lib/liveConfig";
import { liveIntervalSeconds, viennaDate } from "@/lib/liveScores";
import { getLiveProvider } from "@/lib/live";
import type { LiveDiagnostics, LiveResponse } from "@/lib/live/types";

// Live-Spielstände (Rene, 15.10.2026; seit 16.10.2026 anbieterneutral).
// GET /api/live?sport=<App-Sportart>&date=YYYY-MM-DD[&league=<Wettbewerb>]
// Der Anbieter (Standard API-Sports) steckt in lib/live/providers/…,
// gewählt über LIVE_PROVIDER (lib/live/index.ts). Diese Route kennt nur die
// Typen aus lib/live/types.ts.
// "league" grenzt zusätzlich auf einen Wettbewerb ein (fürs Matchcenter),
// die Abfrage beim Anbieter bleibt dieselbe.
//
// Caching (Rene, 16.10.2026: ohne stilles Festhängen): Der Anbieter hält
// seine Abrufe in einem eigenen Cache mit festen Ablaufzeiten (live 180 s,
// Tagesliste 900 s, vergangene Tage 3600 s) und meldet, wann sie ablaufen.
// Diese Antwort darf das CDN genau so lange für alle Nutzer teilen
// (s-maxage = restliche Lebenszeit, heute höchstens ein Live-Takt, damit der
// Wechsel auf "live" zum Anpfiff nicht hängt), danach nur 15 s
// stale-while-revalidate.
//
// Diagnose in jeder Antwort: source ("live" | "day" | "stale"), fetchedAt,
// liveError, quota {used, limit}. Ohne Schlüssel oder bei einem Fehler kommt
// eine leere Liste mit Fehlertext – die App läuft normal weiter.
//
// GET /api/live?status=1 → Diagnose dieser Server-Instanz für den Admin
// (letzter Abruf, Quelle, letzter Fehler, Quote) – fragt NICHT beim Anbieter.

const SWR = 15;

function json(body: LiveResponse | LiveDiagnostics, maxAge: number, status = 200) {
  const sMaxAge = Math.max(1, Math.floor(maxAge));
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": `public, max-age=0, s-maxage=${sMaxAge}, stale-while-revalidate=${SWR}`,
    },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = getLiveProvider();
  const who = { provider: provider.id, providerName: provider.name, providerUrl: provider.url };

  if (searchParams.get("status") === "1") {
    return NextResponse.json(provider.diagnostics(), { headers: { "Cache-Control": "no-store" } });
  }

  const sportParam = searchParams.get("sport") ?? "";
  const date = searchParams.get("date") ?? "";
  const league = searchParams.get("league");
  const sport = ALL_SPORTS.find((s) => s === sportParam);
  if (!sport || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ sport: sportParam, date, games: [], error: "Ungültige Anfrage" }, { status: 400 });
  }
  // Abgeschaltete Sportarten: leere Liste, keine Abfrage (lib/liveConfig.ts).
  // (Rene, 15.10.2026: zum Testen nur Europa League)
  if (!isLiveSportEnabled(sport)) {
    return json({ sport, date, games: [], error: "Live-Stände für diese Sportart abgeschaltet", ...who }, 3600);
  }
  const configError = provider.configError();
  if (configError) return json({ sport, date, games: [], error: configError, ...who }, 300);

  const result = await provider.getDay({ sport, date, league });
  const now = Date.now();
  let maxAge = (result.expiresAt - now) / 1000;
  // Heute höchstens ein Live-Takt im CDN (Anpfiff soll nicht hängen bleiben).
  if (date >= viennaDate(now)) maxAge = Math.min(maxAge, liveIntervalSeconds(sport));
  if (!result.ok) {
    const quota = provider.diagnostics().quota;
    return json({ sport, date, games: [], error: result.error, ...who, ...(quota ? { quota } : {}) }, maxAge);
  }
  return json({ sport, date, ...who, ...result.snapshot }, maxAge);
}
