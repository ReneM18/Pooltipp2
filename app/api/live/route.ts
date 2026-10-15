import { NextResponse } from "next/server";
import { ALL_SPORTS, type Sport } from "@/lib/types";
import { isLiveLeagueEnabled, isLiveSportEnabled, sameLeague } from "@/lib/liveConfig";
import {
  isLiveFinished,
  liveIntervalSeconds,
  viennaDate,
  type LiveEvent,
  type LiveGame,
  type LiveResponse,
  type LiveStatus,
} from "@/lib/liveScores";

// Live-Spielstände von API-Sports (Rene, 15.10.2026).
// GET /api/live?sport=<App-Sportart>&date=YYYY-MM-DD[&league=<Wettbewerb>]
// (Rene, 15.10.2026: Europa League zum Testen) "league" grenzt zusätzlich auf
// einen Wettbewerb ein (fürs Matchcenter). Vergangene Tage ändern sich nicht
// mehr und werden 1 h zwischengespeichert. Die Upstream-Abfrage bleibt pro
// Sportart und Tag dieselbe, kostet also keine zusätzlichen Abfragen.
// Der Schlüssel steht nur auf dem Server (Umgebungsvariable API_SPORTS_KEY,
// bei Vercel unter Settings → Environment Variables) und kommt nie in den
// Browser. Die Antwort der API wird für alle Nutzer gemeinsam zwischen-
// gespeichert (Fußball 180 s, sonst 300 s), damit das Gratis-Kontingent
// (100 Abfragen pro Tag je Sport-API) reicht. Ohne Schlüssel oder bei einem
// Fehler kommt eine leere Liste mit Fehlertext – die App läuft normal weiter.
// Abgefragt wird NUR nach Datum: league+season ist im Gratis-Plan für die
// laufende Saison gesperrt.
//
// Fußball (Rene, 15.10.2026: Live-Liste statt Tagesliste): Die Tagesliste
// (fixtures?date=…) hinkt bei API-Sports 3–4 Min. hinter fixtures?live=all
// her. Deshalb zwei Quellen:
//  (a) Tagesliste, Cache 900 s (vergangene Tage 3600 s) – Anstoßzeiten,
//      nicht begonnene und beendete Spiele.
//  (b) live=all, Cache 180 s – nur abgerufen, wenn laut Tagesliste ein Spiel
//      im Fenster Anpfiff −5 Min. bis Anpfiff +150 Min. liegt und noch nicht
//      beendet ist. Spiele aus (b) überschreiben die aus (a) (über die
//      fixture.id); ist ein Spiel laut Tagesliste schon beendet, gilt (a).
// Abfragen-Budget (Gratis-Plan 100/Tag), Cache gilt für alle Nutzer, die
// API wird nur bei Aufrufen gefragt:
//  - live=all: Europa-League-Abend (18:45 + 21:00) Fenster ca. 18:40–23:10
//    (endet, sobald die Tagesliste alles als beendet zeigt) = 270 Min. / 3
//    = ~90 Abfragen; an Tagen ohne Spiel 0.
//  - Tagesliste: höchstens 4 pro Stunde, realistisch (Aufrufe vor allem am
//    Abend) ~10–20 am Spieltag, ~5 an anderen Tagen.
//  → am vollen Spielabend knapp an 100. Bei Bedarf LIVE_REVALIDATE erhöhen
//    (240 s = ~68 Abfragen). Ist das Limit erreicht, bleibt die Tagesliste.
//
// Ereignisse (Rene, 15.10.2026: Spieltag-Umbau): live=all liefert je Spiel
// "events" (Tore, Karten, Wechsel) gleich mit – normalisiert in "events".
// Die Tagesliste hat keine Ereignisse. Für beendete Spiele werden deshalb
// die Ereignisse aus dem letzten Live-Stand weitergereicht, den sich diese
// Server-Instanz gemerkt hat (LAST_EVENTS); sonst bleibt die Liste leer.
// KEINE zusätzlichen Abfragen pro Spiel (Gratis-Plan 100/Tag).

const ENDPOINTS: Record<Sport, string> = {
  "Fußball": "https://v3.football.api-sports.io/fixtures",
  NHL: "https://v1.hockey.api-sports.io/games",
  NBA: "https://v1.basketball.api-sports.io/games",
  NFL: "https://v1.american-football.api-sports.io/games",
  Handball: "https://v1.handball.api-sports.io/games",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

function json(body: LiveResponse, maxAge: number, swr = 60) {
  return NextResponse.json(body, {
    headers: {
      // Zusätzlich im Vercel-CDN zwischenspeichern (pro Sportart und Tag).
      "Cache-Control": `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=${swr}`,
    },
  });
}

// Fußball (Rene, 15.10.2026): Cache der Tagesliste und der Live-Liste in
// Sekunden, Fenster für die Live-Abfrage (siehe Kopfkommentar).
const DAY_REVALIDATE = 900;
const PAST_REVALIDATE = 3600;
const LIVE_REVALIDATE = 180;
const LIVE_BEFORE_MS = 5 * 60 * 1000;
const LIVE_AFTER_MS = 150 * 60 * 1000;

// Letzte Ereignisse je Spiel aus live=all (Rene, 15.10.2026: Spieltag-Umbau).
// Nur im Speicher dieser Server-Instanz (geht bei einem Neustart verloren,
// dann fehlen die Torschützen bei beendeten Spielen eben). Höchstens
// MAX_CACHED_EVENTS Spiele, Einträge älter als 2 Tage fliegen raus.
const MAX_CACHED_EVENTS = 300;
const EVENTS_KEEP_MS = 2 * 24 * 60 * 60 * 1000;
const LAST_EVENTS = new Map<string, { events: LiveEvent[]; at: number }>();

function rememberEvents(games: LiveGame[], at: number) {
  for (const g of games) {
    if (!g.events || g.events.length === 0) continue;
    LAST_EVENTS.delete(g.id);
    LAST_EVENTS.set(g.id, { events: g.events, at });
  }
  const now = Date.now();
  for (const [id, entry] of LAST_EVENTS) {
    if (LAST_EVENTS.size <= MAX_CACHED_EVENTS && now - entry.at < EVENTS_KEEP_MS) break;
    LAST_EVENTS.delete(id);
  }
}

type ApiResult = { ok: true; list: Raw[]; at: number } | { ok: false; error: string };

// Eine API-Abfrage über den gemeinsamen Server-Cache (Next.js Data Cache).
// "at" = Zeitpunkt des echten Abrufs bei API-Sports (Date-Header, der mit im
// Cache liegt) – nicht der Zeitpunkt dieses Aufrufs.
async function apiGet(url: string, key: string, revalidate: number): Promise<ApiResult> {
  try {
    const res = await fetch(url, { headers: { "x-apisports-key": key }, next: { revalidate } });
    if (!res.ok) return { ok: false, error: `Live-Daten nicht erreichbar (${res.status})` };
    const data: Raw = await res.json();
    const apiError = readApiError(data);
    if (apiError) return { ok: false, error: apiError };
    const date = Date.parse(res.headers.get("date") ?? "");
    return {
      ok: true,
      list: Array.isArray(data?.response) ? data.response : [],
      at: Number.isFinite(date) ? Math.min(date, Date.now()) : Date.now(),
    };
  } catch {
    return { ok: false, error: "Live-Daten nicht erreichbar" };
  }
}

function leagueFilter(sport: Sport, league: string | null) {
  return (g: Raw) => {
    const name = typeof g?.league?.name === "string" ? g.league.name : null;
    return isLiveLeagueEnabled(sport, name) && (!league || (!!name && sameLeague(league, name)));
  };
}

function normalizeAll(sport: Sport, list: Raw[], league: string | null): LiveGame[] {
  return list
    .filter(leagueFilter(sport, league))
    .map((g) => normalize(sport, g))
    .filter((g): g is LiveGame => g !== null);
}

// Fußball: Tagesliste + Live-Liste kombiniert (Rene, 15.10.2026).
async function football(date: string, league: string | null, key: string) {
  const sport = "Fußball" as const;
  const isPast = date < viennaDate(Date.now());
  const day = await apiGet(
    `${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`,
    key,
    isPast ? PAST_REVALIDATE : DAY_REVALIDATE,
  );
  if (!day.ok) return json({ sport, date, games: [], error: day.error }, 60);
  const games = normalizeAll(sport, day.list, league);
  let fetchedAt = day.at;

  const now = Date.now();
  const needLive =
    date === viennaDate(now) &&
    games.some((g) => {
      if (isLiveFinished(g.status)) return false;
      const kickoff = new Date(g.kickoff).getTime();
      return now >= kickoff - LIVE_BEFORE_MS && now <= kickoff + LIVE_AFTER_MS;
    });
  if (needLive) {
    const live = await apiGet(`${ENDPOINTS[sport]}?live=all&timezone=Europe/Vienna`, key, LIVE_REVALIDATE);
    // Fehler bei live=all (z. B. Tageslimit): einfach die Tagesliste zeigen.
    if (live.ok) {
      const liveGames = normalizeAll(sport, live.list, league);
      rememberEvents(liveGames, live.at);
      const byId = new Map(liveGames.map((g) => [g.id, g]));
      for (let i = 0; i < games.length; i++) {
        const fresh = byId.get(games[i].id);
        if (fresh && !isLiveFinished(games[i].status)) games[i] = fresh;
      }
      fetchedAt = live.at;
    }
  }
  // Tagesliste ohne Ereignisse: letzte bekannte aus dem Live-Stand ergänzen.
  for (let i = 0; i < games.length; i++) {
    if (games[i].events && games[i].events!.length > 0) continue;
    const cached = LAST_EVENTS.get(games[i].id);
    games[i] = { ...games[i], events: cached ? cached.events : [] };
  }
  // Heute kaum im CDN zwischenspeichern: die Abfragen schützt der Data Cache
  // oben, so kommt ein neuer Live-Stand ohne zusätzliche Verzögerung an.
  return isPast ? json({ sport, date, games, fetchedAt }, PAST_REVALIDATE) : json({ sport, date, games, fetchedAt }, 10, 0);
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
  // Elfmeterschießen getrennt (nur Fußball), z. B. "n. E. 4:3" im Matchcenter.
  const penaltyHome = isFootball ? toNumber(g?.score?.penalty?.home) : null;
  const penaltyAway = isFootball ? toNumber(g?.score?.penalty?.away) : null;
  return {
    id: String(id ?? `${home}-${away}-${kickoff}`),
    kickoff,
    home,
    away,
    homeScore,
    awayScore,
    ...(penaltyHome !== null && penaltyAway !== null ? { penaltyHome, penaltyAway } : {}),
    status,
    statusShort: short,
    statusText: text,
    elapsed,
    league: [g?.league?.name, g?.league?.country ?? g?.country?.name].filter((x) => typeof x === "string" && x).join(" · "),
    ...(isFootball && Array.isArray(g?.events) ? { events: normalizeEvents(g, homeScore, awayScore) } : {}),
  };
}

// Ereignisse von API-Football vereinheitlichen (Rene, 15.10.2026:
// Spieltag-Umbau). type "Goal" (detail "Normal Goal"/"Own Goal"/"Penalty"/
// "Missed Penalty"), "Card" ("Yellow Card"/"Red Card"/"Second Yellow card"),
// "subst"; alles andere (z. B. "Var") fällt weg.
function normalizeEvents(g: Raw, homeScore: number | null, awayScore: number | null): LiveEvent[] {
  const homeId = g?.teams?.home?.id;
  const awayId = g?.teams?.away?.id;
  const homeName = g?.teams?.home?.name;
  const list: (LiveEvent & { ownTeam: "home" | "away" })[] = [];
  for (const e of g.events as Raw[]) {
    const minute = toNumber(e?.time?.elapsed);
    if (minute === null) continue;
    const teamId = e?.team?.id;
    const ownTeam: "home" | "away" | null =
      teamId != null && teamId === homeId ? "home"
      : teamId != null && teamId === awayId ? "away"
      : typeof e?.team?.name === "string" && e.team.name === homeName ? "home"
      : typeof e?.team?.name === "string" ? "away"
      : null;
    if (!ownTeam) continue;
    const kind = String(e?.type ?? "").toLowerCase();
    const detail = String(e?.detail ?? "").toLowerCase();
    let type: LiveEvent["type"] | null = null;
    if (kind === "goal") {
      type = detail.includes("own") ? "owngoal" : detail.includes("missed") ? "missed_penalty" : detail.includes("penalty") ? "penalty" : "goal";
    } else if (kind === "card") {
      type = detail.includes("red") || detail.includes("second") ? "red" : detail.includes("yellow") ? "yellow" : null;
    } else if (kind === "subst") {
      type = "subst";
    }
    if (!type) continue;
    const extra = toNumber(e?.time?.extra);
    list.push({
      minute,
      extra: extra && extra > 0 ? extra : null,
      type,
      side: ownTeam,
      ownTeam,
      player: typeof e?.player?.name === "string" && e.player.name ? e.player.name : null,
      assist: typeof e?.assist?.name === "string" && e.assist.name ? e.assist.name : null,
    });
  }
  // Eigentor: zählt dem anderen Team als dem des Spielers. Ob "team" bei
  // API-Football das Team des Spielers oder das begünstigte Team ist, prüfen
  // wir am Spielstand: Annahme "Team des Spielers", außer nur die andere
  // Lesart ergibt genau den Spielstand.
  const count = (ownGoalForOther: boolean, side: "home" | "away") =>
    list.filter(
      (e) =>
        (e.type === "goal" || e.type === "penalty" ? e.ownTeam === side : false) ||
        (e.type === "owngoal" && (ownGoalForOther ? e.ownTeam !== side : e.ownTeam === side)),
    ).length;
  const fits = (other: boolean) => count(other, "home") === homeScore && count(other, "away") === awayScore;
  const ownGoalForOther = fits(true) || !fits(false);
  return list.map(({ ownTeam, ...e }) =>
    e.type === "owngoal" ? { ...e, side: ownGoalForOther ? (ownTeam === "home" ? "away" : "home") : ownTeam } : e,
  );
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
  const league = searchParams.get("league");
  const sport = ALL_SPORTS.find((s) => s === sportParam);
  if (!sport || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ sport: sportParam, date, games: [], error: "Ungültige Anfrage" }, { status: 400 });
  }
  // Abgeschaltete Sportarten: leere Liste, keine API-Abfrage (lib/liveConfig.ts).
  // (Rene, 15.10.2026: zum Testen nur Europa League)
  if (!isLiveSportEnabled(sport)) return json({ sport, date, games: [], error: "Live-Stände für diese Sportart abgeschaltet" }, 3600);
  // Vergangene Tage (z. B. Ergebnisse von gestern) 1 h, sonst Live-Takt.
  const revalidate = date < viennaDate(Date.now()) ? 3600 : liveIntervalSeconds(sport);
  const key = process.env.API_SPORTS_KEY;
  if (!key) return json({ sport, date, games: [], error: "Kein API_SPORTS_KEY gesetzt" }, revalidate);
  if (sport === "Fußball") return football(date, league, key);

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
    // Fußball nach Datum abfragen (league=3&season=2026 ist im Gratis-Plan
    // gesperrt) und hier nach league.name auf die eingeschalteten Ligen filtern.
    const games = list
      .filter((g) => {
        const name = typeof g?.league?.name === "string" ? g.league.name : null;
        return isLiveLeagueEnabled(sport, name) && (!league || (!!name && sameLeague(league, name)));
      })
      .map((g) => normalize(sport, g))
      .filter((g): g is LiveGame => g !== null);
    return json({ sport, date, games }, revalidate);
  } catch {
    return json({ sport, date, games: [], error: "Live-Daten nicht erreichbar" }, 60);
  }
}
