import { NextResponse } from "next/server";
import { footballVenue } from "@/lib/live/providers/apiSports";

// Stadion mit Kapazität für die Tippkarte (Rene, 29.10.2026).
// GET /api/venue?id=<API-Sports-Stadion-ID> (nur Fußball). Das CDN teilt die
// Antwort so lange, wie der Anbieter sie sich merkt.

export interface VenueResponse {
  id: number;
  name: string | null;
  capacity: number | null;
  error?: string;
}

function json(body: VenueResponse, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=3600` },
  });
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("id") ?? "";
  const id = /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(id) || id <= 0) return json({ id: 0, name: null, capacity: null, error: "Ungültige Anfrage" }, 3600, 400);
  const result = await footballVenue(id);
  const maxAge = (result.expiresAt - Date.now()) / 1000;
  if (!result.ok) return json({ id, name: null, capacity: null, error: result.error }, maxAge);
  return json({ id, name: result.name, capacity: result.capacity }, maxAge);
}
