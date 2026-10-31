import { NextResponse } from "next/server";
import type { LiveHeatResponse, NflLiveHeatResponse } from "@/lib/liveHeat";
import { footballLiveHeat, HEAT_MAX_IDS, nflLiveHeat, NFL_HEAT_MAX_IDS } from "@/lib/live/providers/apiSports";

// Statistik der laufenden TV-Spiele für die Spannungs-Karte im Matchcenter
// (Rene, 27.10.2026). GET /api/live-heat?ids=<id>,<id>,… (Fußball,
// API-Sports-Spiel-IDs). Eine Abfrage für alle Spiele, das CDN teilt sie.
// NFL (Rene, 31.10.2026): GET /api/live-heat?sport=NFL&ids=… (eine Abfrage
// je Spiel, siehe nflLiveHeat).

function json(body: LiveHeatResponse | NflLiveHeatResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=30` },
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const nfl = params.get("sport") === "NFL";
  const raw = params.get("ids") ?? "";
  const ids = raw.split(",").filter((s) => /^\d{1,10}$/.test(s)).map(Number);
  if (ids.length === 0 || ids.length > (nfl ? NFL_HEAT_MAX_IDS : HEAT_MAX_IDS)) return json({ stats: [], error: "Ungültige Anfrage" }, 3600, 400);
  const result = nfl ? await nflLiveHeat(ids) : await footballLiveHeat(ids);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ stats: [], error: result.error }, maxAge);
  return json({ stats: result.stats } as LiveHeatResponse | NflLiveHeatResponse, maxAge);
}
