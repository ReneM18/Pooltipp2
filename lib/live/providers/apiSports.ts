import type { Sport } from "../../types";
import { isLiveLeagueEnabled, sameLeague } from "../../liveConfig";
import { isLiveFinished, liveIntervalSeconds, liveMaxIntervalSeconds, viennaDate } from "../../liveScores";
import { cachedLoad, type LoadResult } from "../cache";
import type { StandingGroup, StandingTeamRow } from "../../standings";
import type { LineupPlayer, LineupTeam, StatTeam } from "../../matchInfo";
import type {
  LiveDayStatus,
  LiveDiagnostics,
  LiveEvent,
  LiveGame,
  LiveProvider,
  LiveProviderRequest,
  LiveProviderResult,
  LiveQuota,
  LiveSource,
  LiveStatus,
} from "../types";

// Anbieter API-Sports (api-sports.io) (Rene, 15.10.2026; seit 16.10.2026 als
// austauschbarer Anbieter, vorher direkt in app/api/live/route.ts). Hier
// steckt ALLES, was API-Sports-spezifisch ist: URLs, Schlüssel-Header,
// Normalisierung, Fehlertexte, Ereignisse, Quoten-Header.
//
// Der Schlüssel steht nur auf dem Server (Umgebungsvariable API_SPORTS_KEY,
// bei Vercel unter Settings → Environment Variables) und kommt nie in den
// Browser. Gratis-Plan: 100 Abfragen pro Tag je Sport-API. Abgefragt wird NUR
// nach Datum: league+season ist im Gratis-Plan für die laufende Saison
// gesperrt; gefiltert wird hier nach league.name (lib/liveConfig.ts).
//
// Fußball – zwei Quellen (Rene, 15.10.2026), weil die Tagesliste
// (fixtures?date=…) 3–4 Min. hinter fixtures?live=all herhinkt:
//  (a) Tagesliste, Ablauf 900 s (vergangene Tage 3600 s) – Anstoßzeiten,
//      nicht begonnene und beendete Spiele.
//  (b) live=all, Ablauf 60 s (Pro-Plan) bzw. 180 s – nur abgerufen, wenn laut Tagesliste ein Spiel
//      im Fenster Anpfiff −5 Min. bis Anpfiff +150 Min. liegt und noch nicht
//      beendet ist. Spiele aus (b) überschreiben die aus (a) (über die
//      fixture.id); ist ein Spiel laut Tagesliste schon beendet, gilt (a).
//
// (Rene, 16.10.2026: ohne stilles Festhängen) Abrufe mit cache: "no-store"
// über den eigenen In-Memory-Cache (lib/live/cache.ts) statt Next.js Data
// Cache mit stale-while-revalidate. Schlägt live=all fehl, wird das
// ehrlich gemeldet (liveError, source "day" bzw. "stale"), nicht mehr still
// auf die Tagesliste zurückgefallen.
//
// Abfragen-Budget (Gratis-Plan 100/Tag): live=all am Europa-League-Abend
// (18:45 + 21:00) ca. 18:40–23:10 = 270 Min. / 3 = ~90 Abfragen, Tagesliste
// ~5–20. Achtung: der Cache gilt pro Server-Instanz; das CDN (Cache-Control
// der Route) teilt die Antwort aber für alle Nutzer, sodass meist nur eine
// Instanz abfragt. Die Quote steht in jeder Antwort (quota) und im Admin.
// (Rene, 16.10.2026) Fußball-Abend 16.10. mit Rapid 19:30, Frankfurt 20:30,
// Frosinone 20:45: live=all 19:25 bis zum letzten Abpfiff ca. 22:40 =
// 195 Min. / 3 = ~65 Abfragen, Tagesliste ~10–20 → ca. 75–85 von 100.
// Eishockey zählt auf ein eigenes Kontingent (siehe otherSport).
//
// Ereignisse (Rene, 15.10.2026: Spieltag-Umbau): live=all liefert je Spiel
// "events" (Tore, Karten, Wechsel) gleich mit. Die Tagesliste hat keine.
// Für beendete Spiele werden die Ereignisse aus dem letzten Live-Stand
// weitergereicht, den sich diese Server-Instanz gemerkt hat (LAST_EVENTS).
// KEINE zusätzlichen Abfragen pro Spiel.

const ENDPOINTS: Record<Sport, string> = {
  "Fußball": "https://v3.football.api-sports.io/fixtures",
  NHL: "https://v1.hockey.api-sports.io/games",
  NBA: "https://v1.basketball.api-sports.io/games",
  NFL: "https://v1.american-football.api-sports.io/games",
  Handball: "https://v1.handball.api-sports.io/games",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

// Ablaufzeiten in Sekunden (Rene, 16.10.2026). Live = Takt der Sportart
// (Fußball 60 s mit Pro-Plan, 180 s im Gratis-Plan, sonst 300 s, siehe
// liveTtl).
const DAY_TTL = 900;
const PAST_TTL = 3600;
// Spielplan der nächsten Tage (Rene, 27.10.2026): ändert sich selten.
const FUTURE_TTL = 3 * 3600;
// Tabellen (Rene, 27.10.2026): nach Abpfiff reicht eine halbe Stunde.
const STANDINGS_TTL = 1800;
// Fehler nur kurz merken, danach erneut versuchen.
const ERROR_TTL = 30;
// Abbruch, wenn API-Sports nicht antwortet.
const TIMEOUT_MS = 8000;
const LIVE_BEFORE_MS = 5 * 60 * 1000;
const LIVE_AFTER_MS = 150 * 60 * 1000;

// ---------------------------------------------------------------------------
// Diagnose (Rene, 16.10.2026): Stand der letzten echten Abfrage dieser
// Server-Instanz, für den Admin-Bereich. Die Quote kommt aus den Headern
// x-ratelimit-requests-limit / -remaining, die API-Sports bei jeder Antwort
// mitschickt (Tageskontingent) – kostet keine zusätzliche Abfrage.

const diag: Omit<LiveDiagnostics, "provider" | "providerName"> = {
  lastFetchAt: null,
  lastSource: null,
  lastError: null,
  lastErrorAt: null,
  quota: null,
  quotaAt: null,
};

// Quote je API-Host (Rene, 16.10.2026: Diagnose aus den Antworten): Fußball
// und Eishockey haben bei API-Sports getrennte Tageskontingente. at = Zeitpunkt
// der Anbieter-Antwort, aus deren Headern die Werte stammen.
const QUOTA_BY_HOST = new Map<string, LiveQuota>();

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function quotaFor(sport: Sport): LiveQuota | null {
  return QUOTA_BY_HOST.get(hostOf(ENDPOINTS[sport])) ?? null;
}

function readQuota(headers: Headers): LiveQuota | null {
  const limit = Number(headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(headers.get("x-ratelimit-requests-remaining"));
  if (!headers.has("x-ratelimit-requests-limit") || !Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) {
    return null;
  }
  return { used: Math.max(0, limit - remaining), limit, at: Date.now() };
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
    if ("rateLimit" in errors) return "Zu viele Abfragen pro Minute";
    if ("token" in errors) return "API-Schlüssel ungültig";
    return String((errors as Record<string, unknown>)[keys[0]]);
  }
  return null;
}

// Eigener Server mit fester IP (Rene, 26.10.2026): API-Sports sperrt die
// geteilten IPs von Vercel. Jede Abfrage geht über diesen Server:
// https://v3.football.api-sports.io/fixtures?… wird zu
// <API_SPORTS_PROXY_URL>/football/fixtures?… (Einrichtung: scripts/api-proxy/).
// (Rene, 26.10.2026: "schau immer, dass wir nicht wieder gesperrt werden")
// Fehlt API_SPORTS_PROXY_URL oder API_SPORTS_PROXY_TOKEN, wird GAR NICHT
// abgefragt – nie direkt von Vercel, auch nicht als Rückfall. Cache-Schlüssel
// und Quote je Host bleiben bei der Original-URL.
function proxyConfigError(): string | null {
  if (!process.env.API_SPORTS_PROXY_URL?.trim() || !process.env.API_SPORTS_PROXY_TOKEN?.trim()) {
    return "Kein eigener Server eingetragen (API_SPORTS_PROXY_URL/API_SPORTS_PROXY_TOKEN)";
  }
  return null;
}

function proxied(url: string): { url: string; headers: Record<string, string> } {
  const base = process.env.API_SPORTS_PROXY_URL!.trim().replace(/\/+$/, "");
  const token = process.env.API_SPORTS_PROXY_TOKEN!.trim();
  const u = new URL(url);
  // "v3.football.api-sports.io" → "football"
  const sport = u.host.split(".")[1];
  return { url: `${base}/${sport}${u.pathname}${u.search}`, headers: { "x-proxy-token": token } };
}

// Tageslimit nie ausreizen (Rene, 26.10.2026): Zeigt die letzte Antwort
// dieses Hosts heute (API-Sports zählt nach UTC-Tag) nur noch BUDGET_RESERVE
// oder weniger freie Abfragen, wird bis Mitternacht (UTC) nicht mehr gefragt.
// Die Reserve bleibt für den Admin und für andere Server-Instanzen.
const BUDGET_RESERVE = 5;

// Pro-Plan (Rene, 27.10.2026: Fußball Pro mit 7.500 Abfragen pro Tag): ab
// FAST_PLAN_LIMIT Abfragen pro Tag (laut Antwort-Header) im kurzen Takt,
// sonst im langen. Läuft der Pro-Plan aus, geht es von selbst zurück.
const FAST_PLAN_LIMIT = 1000;

function liveTtl(sport: Sport): number {
  const quota = quotaFor(sport);
  return quota && quota.limit >= FAST_PLAN_LIMIT ? liveIntervalSeconds(sport) : liveMaxIntervalSeconds(sport);
}

function budgetExhausted(url: string): boolean {
  const quota = QUOTA_BY_HOST.get(hostOf(url));
  if (!quota) return false;
  const sameUtcDay = new Date(quota.at ?? 0).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
  return sameUtcDay && quota.limit - quota.used <= BUDGET_RESERVE;
}

// Eine echte Abfrage bei API-Sports (ohne Next.js Data Cache).
async function apiGet(url: string, key: string): Promise<LoadResult<Raw[]>> {
  const fail = (error: string): LoadResult<Raw[]> => {
    diag.lastError = error;
    diag.lastErrorAt = Date.now();
    return { ok: false, error };
  };
  const proxyError = proxyConfigError();
  if (proxyError) return fail(proxyError);
  if (budgetExhausted(url)) return fail("Tageslimit fast erreicht – Pause bis Mitternacht (UTC)");
  let res: Response;
  try {
    const target = proxied(url);
    res = await fetch(target.url, {
      headers: { ...target.headers, "x-apisports-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    return fail(name === "TimeoutError" || name === "AbortError" ? "Zeitüberschreitung beim Abruf" : "Live-Daten nicht erreichbar");
  }
  const quota = readQuota(res.headers);
  if (quota) {
    diag.quota = quota;
    diag.quotaAt = quota.at ?? Date.now();
    QUOTA_BY_HOST.set(hostOf(url), quota);
  }
  if (!res.ok) return fail(res.status === 429 ? "Zu viele Abfragen (HTTP 429)" : `Live-Daten nicht erreichbar (HTTP ${res.status})`);
  let data: Raw;
  try {
    data = await res.json();
  } catch {
    return fail("Ungültige Antwort der Live-Daten");
  }
  const apiError = readApiError(data);
  if (apiError) return fail(apiError);
  const date = Date.parse(res.headers.get("date") ?? "");
  const at = Number.isFinite(date) ? Math.min(date, Date.now()) : Date.now();
  diag.lastFetchAt = at;
  return { ok: true, value: Array.isArray(data?.response) ? data.response : [], at };
}

function load(url: string, key: string, ttlSeconds: number) {
  return cachedLoad<Raw[]>(
    url,
    // Nie Daten älter als 2× Ablaufzeit verwenden (Rene, 16.10.2026).
    { ttlMs: ttlSeconds * 1000, maxAgeMs: 2 * ttlSeconds * 1000, errorTtlMs: ERROR_TTL * 1000 },
    () => apiGet(url, key),
  );
}

// ---------------------------------------------------------------------------
// Letzte Ereignisse je Spiel aus live=all (Rene, 15.10.2026: Spieltag-Umbau).
// Nur im Speicher dieser Server-Instanz. Höchstens MAX_CACHED_EVENTS Spiele,
// Einträge älter als 2 Tage fliegen raus.
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

// Letzter erfolgreicher live=all-Stand (Rene, 16.10.2026): fällt ein
// Live-Abruf aus, wird er – ehrlich als "stale" markiert – gezeigt, falls er
// neuer ist als die Tagesliste.
let lastLive: { list: Raw[]; at: number } | null = null;

// Land eines Spiels: Fußball league.country (Text), Eishockey/Basketball
// country.name, American Football league.country.name (Rene, 26.10.2026).
function rawCountry(g: Raw): string | null {
  if (typeof g?.league?.country === "string") return g.league.country;
  if (typeof g?.league?.country?.name === "string") return g.league.country.name;
  if (typeof g?.country?.name === "string") return g.country.name;
  return null;
}

// Liga-Filter über Name UND Land (Rene, 16.10.2026). Strikt – ohne
// passendes Land kein Treffer (z. B. brasilianische "Serie A").
function leagueFilter(sport: Sport, league: string | null) {
  return (g: Raw) => {
    const name = typeof g?.league?.name === "string" ? g.league.name : null;
    const country = rawCountry(g);
    return isLiveLeagueEnabled(sport, name, country, true) && (!league || (!!name && sameLeague(league, name)));
  };
}

function normalizeAll(sport: Sport, list: Raw[], league: string | null): LiveGame[] {
  return list
    .filter(leagueFilter(sport, league))
    .map((g) => normalize(sport, g))
    .filter((g): g is LiveGame => g !== null);
}

// Letzter Stand je Sportart + Tag (Rene, 16.10.2026: Zuordnungs-Check im
// Admin). Nur was ohnehin abgefragt wurde, ohne league-Einschränkung.
const MAX_DAYS = 12;
const LAST_DAYS = new Map<string, LiveDayStatus>();

function rememberDay(sport: Sport, date: string, league: string | null, games: LiveGame[], fetchedAt: number) {
  if (league) return;
  const key = `${sport}|${date}`;
  LAST_DAYS.delete(key);
  LAST_DAYS.set(key, { sport, date, fetchedAt, games });
  while (LAST_DAYS.size > MAX_DAYS) LAST_DAYS.delete(LAST_DAYS.keys().next().value as string);
}

function snapshotResult(
  games: LiveGame[],
  fetchedAt: number,
  source: LiveSource,
  expiresAt: number,
  liveError?: string,
): LiveProviderResult {
  diag.lastSource = source;
  return {
    ok: true,
    snapshot: { games, fetchedAt, source, ...(liveError ? { liveError } : {}) },
    expiresAt,
  };
}

// Fußball: Tagesliste + Live-Liste kombiniert (Rene, 15.10./16.10.2026).
async function football(date: string, league: string | null, key: string): Promise<LiveProviderResult> {
  const sport = "Fußball" as const;
  const today = viennaDate(Date.now());
  const isPast = date < today;
  const ttl = isPast ? PAST_TTL : date > today ? FUTURE_TTL : DAY_TTL;
  const day = await load(`${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`, key, ttl);
  if (!day.ok) return { ok: false, error: day.error, expiresAt: day.expiresAt };
  const games = normalizeAll(sport, day.hit.value, league);

  const now = Date.now();
  const needLive =
    date === viennaDate(now) &&
    games.some((g) => {
      if (isLiveFinished(g.status)) return false;
      const kickoff = new Date(g.kickoff).getTime();
      return now >= kickoff - LIVE_BEFORE_MS && now <= kickoff + LIVE_AFTER_MS;
    });

  let source: LiveSource = "day";
  let fetchedAt = day.hit.at;
  let expiresAt = day.hit.expiresAt;
  let liveError: string | undefined;
  let liveList: Raw[] | null = null;
  if (needLive) {
    const live = await load(`${ENDPOINTS[sport]}?live=all&timezone=Europe/Vienna`, key, liveTtl(sport));
    expiresAt = Math.min(expiresAt, live.ok ? live.hit.expiresAt : live.expiresAt);
    if (live.ok) {
      if (!lastLive || live.hit.at >= lastLive.at) lastLive = { list: live.hit.value, at: live.hit.at };
      liveList = live.hit.value;
      source = "live";
      fetchedAt = live.hit.at;
    } else {
      // Kein stilles Zurückfallen mehr: Fehler mitschicken. Ist der letzte
      // Live-Stand mindestens so neu wie die Tagesliste (die hinkt ohnehin
      // 3–4 Min. hinterher), diesen als "stale" zeigen.
      liveError = live.error;
      if (lastLive && lastLive.at >= day.hit.at) {
        liveList = lastLive.list;
        source = "stale";
        fetchedAt = lastLive.at;
      }
    }
  }
  if (liveList) {
    const liveGames = normalizeAll(sport, liveList, league);
    if (source === "live") rememberEvents(liveGames, fetchedAt);
    const byId = new Map(liveGames.map((g) => [g.id, g]));
    for (let i = 0; i < games.length; i++) {
      const fresh = byId.get(games[i].id);
      if (fresh && !isLiveFinished(games[i].status)) games[i] = fresh;
    }
  }
  // Tagesliste ohne Ereignisse: letzte bekannte aus dem Live-Stand ergänzen.
  for (let i = 0; i < games.length; i++) {
    if (games[i].events && games[i].events!.length > 0) continue;
    const cached = LAST_EVENTS.get(games[i].id);
    games[i] = { ...games[i], events: cached ? cached.events : [] };
  }
  rememberDay(sport, date, league, games, fetchedAt);
  return snapshotResult(games, fetchedAt, source, expiresAt, liveError);
}

// Andere Sportarten: nur die Tagesliste, die hier zugleich der Live-Stand
// ist (Ablauf = Takt, 300 s). Deshalb source "live", vergangene Tage "day".
//
// Eishockey (Rene, 16.10.2026): games?date=…&timezone=Europe/Vienna,
// eigenes Kontingent 100/Tag (hockey.api-sports.io). Abgerufen wird im
// 300-s-Takt NUR im Spielfenster (Anpfiff −5 Min. bis Abpfiff, höchstens
// Anpfiff +4 h). Außerhalb davon bleibt die Tagesliste liegen bis kurz vor
// dem nächsten Anpfiff (höchstens 3 h, siehe holdUntil).
// Rechnung für heute (16./17.10.):
//  - ICE Hockey League 19:15 (2 Spiele gleichzeitig, eine Abfrage für
//    alle): 19:10 bis ca. 21:50 = 160 Min. / 5 = ~32 Abrufe
//  - NHL Sa 03:00 + 04:00 (Wiener Datum 17.10., eigene URL): 02:55 bis
//    ca. 06:45 = 230 Min. / 5 = ~46 Abrufe
//  - Tagesliste außerhalb der Fenster: höchstens alle 3 h = ~4–8 Abrufe
//  → zusammen ca. 80–85 von 100. Achtung: gilt pro Server-Instanz; das CDN
//    teilt die Antwort aber für alle Nutzer (s-maxage), daher meist eine.
const WINDOW_BEFORE_MS = 5 * 60 * 1000;
const WINDOW_AFTER_MS = 4 * 60 * 60 * 1000;
const MAX_HOLD_MS = 3 * 60 * 60 * 1000;

// Gemerkte Tagesliste außerhalb der Spielfenster: url → Daten + bis wann.
const HOLD = new Map<string, { list: Raw[]; at: number; until: number }>();

// Bis wann darf die Tagesliste ohne neuen Abruf liegen bleiben? null =
// gerade Spielfenster (also im Takt abrufen).
function holdUntil(games: LiveGame[], now: number): number | null {
  let next = Infinity;
  for (const g of games) {
    if (isLiveFinished(g.status) || g.status === "OTHER") continue;
    const kickoff = new Date(g.kickoff).getTime();
    if (now >= kickoff - WINDOW_BEFORE_MS && now <= kickoff + WINDOW_AFTER_MS) return null;
    if (kickoff - WINDOW_BEFORE_MS > now) next = Math.min(next, kickoff - WINDOW_BEFORE_MS);
  }
  return Math.min(next, now + MAX_HOLD_MS);
}

async function otherSport(sport: Sport, date: string, league: string | null, key: string): Promise<LiveProviderResult> {
  const now = Date.now();
  const isPast = date < viennaDate(now);
  const url = `${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`;
  const held = HOLD.get(url);
  if (!isPast && held && now < held.until) {
    const games = normalizeAll(sport, held.list, league);
    // Inzwischen im Spielfenster (Uhr läuft weiter)? Dann neu abrufen.
    if (holdUntil(games, now) !== null) {
      rememberDay(sport, date, league, games, held.at);
      return snapshotResult(games, held.at, "live", held.until);
    }
  }
  const day = await load(url, key, isPast ? PAST_TTL : liveTtl(sport));
  if (!day.ok) return { ok: false, error: day.error, expiresAt: day.expiresAt };
  const games = normalizeAll(sport, day.hit.value, league);
  let expiresAt = day.hit.expiresAt;
  if (!isPast) {
    // Alle Ligen der Sportart prüfen (nicht nur league), damit ein
    // Matchcenter-Filter das Fenster nicht verschluckt.
    const all = league ? normalizeAll(sport, day.hit.value, null) : games;
    const until = holdUntil(all, Date.now());
    if (until !== null && until > day.hit.expiresAt) {
      HOLD.set(url, { list: day.hit.value, at: day.hit.at, until });
      expiresAt = until;
    } else {
      HOLD.delete(url);
    }
  }
  rememberDay(sport, date, league, games, day.hit.at);
  return snapshotResult(games, day.hit.at, isPast ? "day" : "live", expiresAt);
}

// ---------------------------------------------------------------------------
// Normalisierung

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
  // Eishockey eigene Texte (Rene, 16.10.2026), siehe hockeyStatus.
  if (sport === "NHL") return hockeyStatus(s, elapsed);
  const minute = elapsed !== null && elapsed > 0 ? `${elapsed}'` : "";
  if (s === "NS" || s === "TBD") return { status: "NS", text: "Noch nicht begonnen" };
  if (s === "HT") return { status: "HT", text: "Halbzeit" };
  if (s === "FT") return { status: "FT", text: "Beendet" };
  if (s === "AET" || s === "AOT") return { status: "AET", text: sport === "Fußball" || sport === "Handball" ? "n. V." : "n. OT" };
  if (s === "PEN" || s === "AP") return { status: "PEN", text: sport === "Handball" ? "n. 7m" : "n. E." };
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

// Eishockey (Rene, 16.10.2026). Kürzel von hockey.api-sports.io:
// NS, P1/P2/P3 (Drittel), BT (Drittelpause), OT (Verlängerung), PT
// (Penaltyschießen), FT, AOT (nach Verlängerung), AP (nach Penalty),
// POST/CANC/INTR/ABD/AWD (verschoben, abgesagt …). Minute = timer im
// Drittel, falls vorhanden, sonst nur das Drittel.
function hockeyStatus(s: string, minute: number | null): { status: LiveStatus; text: string } {
  if (s === "NS" || s === "TBD") return { status: "NS", text: "Noch nicht begonnen" };
  const period = /^P([1-3])$/.exec(s);
  if (period) return { status: "LIVE", text: `${period[1]}. Drittel${minute !== null && minute > 0 ? ` ${minute}'` : ""}` };
  if (s === "BT") return { status: "BREAK", text: "Drittelpause" };
  if (s === "OT") return { status: "LIVE", text: "Verlängerung" };
  if (s === "PT") return { status: "LIVE", text: "Penaltyschießen" };
  if (s === "FT") return { status: "FT", text: "Beendet" };
  if (s === "AOT") return { status: "AET", text: "n. V." };
  if (s === "AP") return { status: "PEN", text: "n. P." };
  if (s === "LIVE") return { status: "LIVE", text: "Live" };
  return { status: "OTHER", text: "" };
}

// Eishockey: Minute im Drittel und Fortschritt über 60 Min. timer kann je
// nach Liga die Minute im Drittel (≤ 20) oder die Gesamtminute sein – beides
// wird erkannt. Drittelpause: Ende des zuletzt gespielten Drittels (aus
// periods.first/second/third).
function hockeyClock(g: Raw, s: string): { minute: number | null; progress?: number } {
  const timer = toNumber(g?.timer ?? g?.status?.timer);
  const period = /^P([1-3])$/.exec(s);
  if (period) {
    const p = Number(period[1]);
    const start = (p - 1) * 20;
    if (timer === null || timer <= 0) return { minute: null, progress: start / 60 };
    const inPeriod = Math.min(20, timer > 20 ? timer - start : timer);
    if (inPeriod <= 0) return { minute: null, progress: start / 60 };
    return { minute: inPeriod, progress: Math.min(60, start + inPeriod) / 60 };
  }
  if (s === "BT") {
    const played = ["first", "second", "third"].filter((k) => g?.periods?.[k] !== null && g?.periods?.[k] !== undefined).length;
    return { minute: null, progress: Math.max(1, Math.min(3, played || 1)) / 3 };
  }
  if (s === "OT" || s === "PT") return { minute: null, progress: 1 };
  return { minute: null };
}

function normalize(sport: Sport, g: Raw): LiveGame | null {
  const isFootball = sport === "Fußball";
  const statusObj = isFootball ? g?.fixture?.status : g?.status ?? g?.game?.status;
  const short = typeof statusObj?.short === "string" ? statusObj.short : "";
  const hockey = sport === "NHL" ? hockeyClock(g, short.toUpperCase()) : null;
  const elapsed = hockey ? hockey.minute : toNumber(isFootball ? statusObj?.elapsed : statusObj?.timer);
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
    ...(hockey?.progress !== undefined ? { progress: hockey.progress } : {}),
    league: [g?.league?.name, rawCountry(g)].filter((x) => typeof x === "string" && x).join(" · "),
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

// ---------------------------------------------------------------------------
// Fußball-Tabellen (Rene, 27.10.2026: Pro-Plan, laufende Saison freigeschaltet).
// standings?league=…&season=… – eine Abfrage je Liga, 30 Min. gemerkt.
// Mehrere Gruppen (z. B. Meister-/Qualifikationsgruppe in Österreich,
// Gruppen der Ligaphase) kommen als eigene Listen.

export type StandingsResult =
  | { ok: true; groups: StandingGroup[]; fetchedAt: number; expiresAt: number }
  | { ok: false; error: string; expiresAt: number };

const STANDINGS_URL = "https://v3.football.api-sports.io/standings";

function toRow(r: Raw): StandingTeamRow | null {
  const team = typeof r?.team?.name === "string" ? r.team.name : null;
  const rank = toNumber(r?.rank);
  if (!team || rank === null) return null;
  const n = (v: unknown) => toNumber(v) ?? 0;
  return {
    rank,
    team,
    logo: typeof r?.team?.logo === "string" ? r.team.logo : null,
    played: n(r?.all?.played),
    win: n(r?.all?.win),
    draw: n(r?.all?.draw),
    loss: n(r?.all?.lose),
    goalsFor: n(r?.all?.goals?.for),
    goalsAgainst: n(r?.all?.goals?.against),
    goalDiff: n(r?.goalsDiff),
    points: n(r?.points),
    description: typeof r?.description === "string" && r.description.trim() ? r.description : null,
  };
}

export async function footballStandings(leagueId: number, season: number): Promise<StandingsResult> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) return { ok: false, error: "Kein API_SPORTS_KEY gesetzt", expiresAt: Date.now() + 300 * 1000 };
  const res = await load(`${STANDINGS_URL}?league=${leagueId}&season=${season}`, key, STANDINGS_TTL);
  if (!res.ok) return { ok: false, error: res.error, expiresAt: res.expiresAt };
  const lists: Raw[] = res.hit.value[0]?.league?.standings ?? [];
  const groups = (Array.isArray(lists) ? lists : [])
    .map((list: Raw): StandingGroup => {
      const rows = (Array.isArray(list) ? list : []).map(toRow).filter((r): r is StandingTeamRow => r !== null);
      const name = Array.isArray(list) && typeof list[0]?.group === "string" ? list[0].group : "";
      return { name, rows };
    })
    .filter((g) => g.rows.length > 0);
  return { ok: true, groups, fetchedAt: res.hit.at, expiresAt: res.hit.expiresAt };
}

// ---------------------------------------------------------------------------
// Aufstellungen und Statistik eines Fußballspiels (Rene, 27.10.2026: Pro-Plan).
// fixtures/lineups und fixtures/statistics – je eine Abfrage pro Spiel.
// Aufstellungen ändern sich nach der Bekanntgabe nicht mehr (10 Min.
// gemerkt), die Statistik läuft im Spiel mit (2 Min.).

export type MatchInfoResult =
  | { ok: true; lineups: LineupTeam[]; stats: StatTeam[]; lineupsError?: string; statsError?: string; expiresAt: number }
  | { ok: false; error: string; expiresAt: number };

const LINEUPS_URL = "https://v3.football.api-sports.io/fixtures/lineups";
const STATISTICS_URL = "https://v3.football.api-sports.io/fixtures/statistics";
const LINEUPS_TTL = 600;
const STATISTICS_TTL = 120;

function hexColor(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-fA-F]{6}$/.test(value) ? value : null;
}

function toPlayer(p: Raw): LineupPlayer | null {
  const player = p?.player;
  if (typeof player?.name !== "string") return null;
  const grid = typeof player.grid === "string" ? /^(\d+):(\d+)$/.exec(player.grid) : null;
  return {
    name: player.name,
    number: toNumber(player.number),
    pos: typeof player.pos === "string" ? player.pos : null,
    row: grid ? Number(grid[1]) : null,
    col: grid ? Number(grid[2]) : null,
  };
}

function toLineup(l: Raw): LineupTeam | null {
  if (typeof l?.team?.name !== "string") return null;
  const players = (list: unknown) => (Array.isArray(list) ? list : []).map(toPlayer).filter((x): x is LineupPlayer => x !== null);
  return {
    team: l.team.name,
    logo: typeof l.team.logo === "string" ? l.team.logo : null,
    formation: typeof l.formation === "string" ? l.formation : null,
    coach: typeof l.coach?.name === "string" ? l.coach.name : null,
    color: hexColor(l.team.colors?.player?.primary),
    numberColor: hexColor(l.team.colors?.player?.number),
    keeperColor: hexColor(l.team.colors?.goalkeeper?.primary),
    startXI: players(l.startXI),
    substitutes: players(l.substitutes),
  };
}

function toStats(t: Raw): StatTeam | null {
  if (typeof t?.team?.name !== "string") return null;
  const stats = (Array.isArray(t.statistics) ? t.statistics : [])
    .filter((x: Raw) => typeof x?.type === "string")
    .map((x: Raw) => ({
      type: x.type as string,
      value: typeof x.value === "number" || typeof x.value === "string" ? x.value : null,
    }));
  return { team: t.team.name, stats };
}

export async function footballMatchInfo(fixtureId: number): Promise<MatchInfoResult> {
  const key = process.env.API_SPORTS_KEY;
  if (!key) return { ok: false, error: "Kein API_SPORTS_KEY gesetzt", expiresAt: Date.now() + 300 * 1000 };
  const [lineups, stats] = await Promise.all([
    load(`${LINEUPS_URL}?fixture=${fixtureId}`, key, LINEUPS_TTL),
    load(`${STATISTICS_URL}?fixture=${fixtureId}`, key, STATISTICS_TTL),
  ]);
  if (!lineups.ok && !stats.ok) return { ok: false, error: lineups.error, expiresAt: Math.min(lineups.expiresAt, stats.expiresAt) };
  return {
    ok: true,
    lineups: lineups.ok ? lineups.hit.value.map(toLineup).filter((x): x is LineupTeam => x !== null) : [],
    stats: stats.ok ? stats.hit.value.map(toStats).filter((x): x is StatTeam => x !== null) : [],
    ...(lineups.ok ? {} : { lineupsError: lineups.error }),
    ...(stats.ok ? {} : { statsError: stats.error }),
    expiresAt: Math.min(lineups.ok ? lineups.hit.expiresAt : lineups.expiresAt, stats.ok ? stats.hit.expiresAt : stats.expiresAt),
  };
}

// ---------------------------------------------------------------------------

export const apiSportsProvider: LiveProvider = {
  id: "api-sports",
  name: "API-Sports",
  url: "https://www.api-football.com/",
  configError() {
    return process.env.API_SPORTS_KEY ? proxyConfigError() : "Kein API_SPORTS_KEY gesetzt";
  },
  async getDay({ sport, date, league }: LiveProviderRequest): Promise<LiveProviderResult> {
    const key = process.env.API_SPORTS_KEY;
    if (!key) return { ok: false, error: "Kein API_SPORTS_KEY gesetzt", expiresAt: Date.now() + 300 * 1000 };
    const result = await (sport === "Fußball" ? football(date, league, key) : otherSport(sport, date, league, key));
    // Quote dieser Sportart (ihres API-Hosts) in jede Antwort, auch bei
    // Fehlern (Rene, 16.10.2026: Diagnose aus den Antworten).
    const quota = quotaFor(sport);
    if (!quota) return result;
    return result.ok ? { ...result, snapshot: { ...result.snapshot, quota } } : { ...result, quota };
  },
  diagnostics(): LiveDiagnostics {
    return { provider: "api-sports", providerName: "API-Sports", ...diag, days: Array.from(LAST_DAYS.values()) };
  },
};
