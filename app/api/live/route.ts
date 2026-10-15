import { NextResponse } from "next/server";
import { ALL_SPORTS, type Sport } from "@/lib/types";
import { liveIntervalSeconds, type LiveGame, type LiveResponse, type LiveStatus } from "@/lib/liveScores";

// Live-Spielstände von API-Sports (Rene, 15.10.2026).
// GET /api/live?sport=<App-Sportart>&date=YYYY-MM-DD
// Der Schlüssel steht nur auf dem Server (Umgebungsvariable API_SPORTS_KEY,
// bei Vercel unter Settings → Environment Variables) und kommt nie in den
// Browser. Die Antwort der API wird für alle Nutzer gemeinsam zwischen-
// gespeichert (Fußball 180 s, sonst 300 s), damit das Gratis-Kontingent
// (100 Abfragen pro Tag je Sport-API) reicht. Ohne Schlüssel oder bei einem
// Fehler kommt eine leere Liste mit Fehlertext – die App läuft normal weiter.
// Abgefragt wird NUR nach Datum: league+season ist im Gratis-Plan für die
// laufende Saison gesperrt.

const ENDPOINTS: Record<Sport, string> = {
  "Fußball": "https://v3.football.api-sports.io/fixtures",
  NHL: "https://v1.hockey.api-sports.io/games",
  NBA: "https://v1.basketball.api-sports.io/games",
  NFL: "https://v1.american-football.api-sports.io/games",
  Handball: "https://v1.handball.api-sports.io/games",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function json(body: LiveResponse, maxAge: number) {
  return NextResponse.json(body, {
    headers: {
      // Zusätzlich im Vercel-CDN zwischenspeichern (pro Sportart und Tag).
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=60`,
    },
  });
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return null;
}

// Punkte/Tore robust lesen: Eishockey und Handball liefern eine Zahl,
// Basketball und American Football ein Objekt mit "total".
function readScore(value: unknown): number | null {
  if (value && typeof value === "object") return toNumber((value as { total?: unknown }).total);
  return toNumber(value);
}

// Anpfiff als ISO-Zeit: bevorzugt der Unix-Zeitstempel, sonst das Datum.
function readKickoff(g: Raw): string | null {
  const ts = toNumber(g?.fixture?.timestamp ?? g?.timestamp ?? g?.game?.date?.timestamp);
  if (ts !== null) return new Date(ts * 1000).toISOString();
  const raw = g?.fixture?.date ?? (typeof g?.date === "string" ? g.date : null) ?? g?.game?.date?.date;
  if (typeof raw !== "string") return null;
  const time = g?.game?.date?.time;
  const d = new Date(typeof time === "string" && !raw.includes("T") ? `${raw}T${time}` : raw);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

const PERIOD_NAME: Partial<Record<Sport, string>> = { NHL: "Drittel", NBA: "Viertel", NFL: "Viertel" };

// Status der API (Kürzel je Sportart) → einheitlicher Status + deutscher Text.
function mapStatus(sport: Sport, short: string, elapsed: number | null): { status: LiveStatus; text: string } {
  const s = short.toUpperCase();
  const minute = elapsed !== null && elapsed > 0 ? `${elapsed}'` : "";
  if (s === "NS" || s === "TBD") return { status: "NS", text: "Noch nicht begonnen" };
  if (s === "HT") return { status: "HT", text: "Halbzeit" };
  if (s === "FT") return { status: "FT", text: "Beendet" };
  if (s === "AET" || s === "AOT") return { status: "AET", text: sport === "Fußball" || sport === "Handball" ? "n. V." : "n. OT" };
  if (s === "PEN" || s === "AP") return { status: "PEN", text: sport === "NHL" ? "n. Penaltys" : sport === "Handball" ? "n. 7m" : "n. E." };
  if (s === "BT") return { status: "BREAK", text: "Pause" };

  if (sport === "Fußball") {
    if (s === "1H" || s === "2H" || s === "LIVE") return { status: "LIVE", text: minute || "Live" };
    if (s === "ET") return { status: "LIVE", text: minute ? `${minute} n. V.` : "Verlängerung" };
    if (s === "P") return { status: "LIVE", text: "Elfmeter" };
    if (s === "INT") return { status: "BREAK", text: "Unterbrochen" };
    return { status: "OTHER", text: "" };
  }
  if (sport === "Handball") {
    if (s === "1H") return { status: "LIVE", text: minute || "1. Halbzeit" };
    if (s === "2H") return { status: "LIVE", text: minute || "2. Halbzeit" };
    if (s === "ET") return { status: "LIVE", text: "Verlängerung" };
    if (s === "PT") return { status: "LIVE", text: "7m-Werfen" };
    return { status: "OTHER", text: "" };
  }
  // Eishockey: P1–P3, OT, PT; Basketball/American Football: Q1–Q4, OT.
  const period = /^[PQ]([1-4])$/.exec(s);
  if (period) {
    // Ohne Uhr im Text: bleibt kurz, damit "🔴 LIVE · 2. Drittel" am Handy
    // einzeilig in die Kopfzeile passt.
    return { status: "LIVE", text: `${period[1]}. ${PERIOD_NAME[sport] ?? "Abschnitt"}` };
  }
  if (s === "OT") return { status: "LIVE", text: "Verlängerung" };
  if (s === "PT") return { status: "LIVE", text: "Penaltys" };
  if (s === "LIVE") return { status: "LIVE", text: "Live" };
  return { status: "OTHER", text: "" };
}

function normalize(sport: Sport, g: Raw): LiveGame | null {
  const isFootball = sport === "Fußball";
  const statusObj = isFootball ? g?.fixture?.status : g?.status ?? g?.game?.status;
  const short = typeof statusObj?.short === "string" ? statusObj.short : "";
  const elapsed = toNumber(isFootball ? statusObj?.elapsed : statusObj?.timer);
  const kickoff = readKickoff(g);
  const home = g?.teams?.home?.name;
  const away = g?.teams?.away?.name;
  if (!kickoff || typeof home !== "string" || typeof away !== "string") return null;
  const id = isFootball ? g?.fixture?.id : g?.id ?? g?.game?.id;
  const { status, text } = mapStatus(sport, short, elapsed);
  const homeScore = readScore(isFootball ? g?.goals?.home : g?.scores?.home);
  const awayScore = readScore(isFootball ? g?.goals?.away : g?.scores?.away);
  return {
    id: String(id ?? `${home}-${away}-${kickoff}`),
    kickoff,
    home,
    away,
    homeScore,
    awayScore,
    status,
    statusShort: short,
    statusText: text,
    elapsed,
    league: [g?.league?.name, g?.league?.country ?? g?.country?.name].filter((x) => typeof x === "string" && x).join(" · "),
  };
}

// "errors" ist bei API-Sports ein leeres Array oder ein Objekt wie
// { requests: "You have reached the request limit for the day…" }.
function readApiError(data: Raw): string | null {
  const errors = data?.errors;
  if (!errors) return null;
  if (Array.isArray(errors)) return errors.length > 0 ? String(errors[0]) : null;
  if (typeof errors === "object") {
    const keys = Object.keys(errors);
    if (keys.length === 0) return null;
    if ("requests" in errors) return "Tageslimit der Live-Daten erreicht";
    return String((errors as Record<string, unknown>)[keys[0]]);
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sportParam = searchParams.get("sport") ?? "";
  const date = searchParams.get("date") ?? "";
  const sport = ALL_SPORTS.find((s) => s === sportParam);
  if (!sport || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ sport: sportParam, date, games: [], error: "Ungültige Anfrage" }, { status: 400 });
  }
  const revalidate = liveIntervalSeconds(sport);
  const key = process.env.API_SPORTS_KEY;
  if (!key) return json({ sport, date, games: [], error: "Kein API_SPORTS_KEY gesetzt" }, revalidate);

  try {
    const url = `${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`;
    const res = await fetch(url, {
      headers: { "x-apisports-key": key },
      // Gemeinsamer Server-Cache für alle Nutzer (Next.js Data Cache).
      next: { revalidate },
    });
    if (!res.ok) return json({ sport, date, games: [], error: `Live-Daten nicht erreichbar (${res.status})` }, 60);
    const data: Raw = await res.json();
    const apiError = readApiError(data);
    if (apiError) return json({ sport, date, games: [], error: apiError }, revalidate);
    const list: Raw[] = Array.isArray(data?.response) ? data.response : [];
    const games = list.map((g) => normalize(sport, g)).filter((g): g is LiveGame => g !== null);
    return json({ sport, date, games }, revalidate);
  } catch {
    return json({ sport, date, games: [], error: "Live-Daten nicht erreichbar" }, 60);
  }
}
