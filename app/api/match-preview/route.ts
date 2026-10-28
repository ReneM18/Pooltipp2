import { NextResponse } from "next/server";
import type { MatchPreviewResponse } from "@/lib/matchInfo";
import { footballMatchPreview } from "@/lib/live/providers/apiSports";

// Vor dem Spiel: Form, direkter Vergleich, Tabellenplatz (Rene, 28.10.2026).
// GET /api/match-preview?fixture=<API-Sports-Spiel-ID>. Das CDN teilt die
// Antwort so lange, wie der Anbieter sie sich merkt.

function json(body: MatchPreviewResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=60` },
  });
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("fixture") ?? "";
  const fixture = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(fixture) || fixture <= 0) {
    return json({ fixture: 0, teams: [], h2h: [], error: "Ungültige Anfrage" }, 3600, 400);
  }
  const result = await footballMatchPreview(fixture);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ fixture, teams: [], h2h: [], error: result.error }, maxAge);
  return json({ fixture, teams: result.teams, h2h: result.h2h }, maxAge);
}
