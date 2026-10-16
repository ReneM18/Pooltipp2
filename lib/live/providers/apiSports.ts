import type { Sport } from "../../types";
import { isLiveLeagueEnabled, sameLeague } from "../../liveConfig";
import { isLiveFinished, liveIntervalSeconds, viennaDate } from "../../liveScores";
import { cachedLoad, type LoadResult } from "../cache";
import type {
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
//  (b) live=all, Ablauf 180 s – nur abgerufen, wenn laut Tagesliste ein Spiel
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
// (Fußball 180 s, sonst 300 s, siehe liveIntervalSeconds).
const DAY_TTL = 900;
const PAST_TTL = 3600;
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

function readQuota(headers: Headers): LiveQuota | null {
  const limit = Number(headers.get("x-ratelimit-requests-limit"));
  const remaining = Number(headers.get("x-ratelimit-requests-remaining"));
  if (!headers.has("x-ratelimit-requests-limit") || !Number.isFinite(limit) || !Number.isFinite(remaining) || limit <= 0) {
    return null;
  }
  return { used: Math.max(0, limit - remaining), limit };
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

// Eine echte Abfrage bei API-Sports (ohne Next.js Data Cache).
async function apiGet(url: string, key: string): Promise<LoadResult<Raw[]>> {
  const fail = (error: string): LoadResult<Raw[]> => {
    diag.lastError = error;
    diag.lastErrorAt = Date.now();
    return { ok: false, error };
  };
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-apisports-key": key },
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
    diag.quotaAt = Date.now();
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
    snapshot: { games, fetchedAt, source, ...(liveError ? { liveError } : {}), ...(diag.quota ? { quota: diag.quota } : {}) },
    expiresAt,
  };
}

// Fußball: Tagesliste + Live-Liste kombiniert (Rene, 15.10./16.10.2026).
async function football(date: string, league: string | null, key: string): Promise<LiveProviderResult> {
  const sport = "Fußball" as const;
  const isPast = date < viennaDate(Date.now());
  const day = await load(`${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`, key, isPast ? PAST_TTL : DAY_TTL);
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
    const live = await load(`${ENDPOINTS[sport]}?live=all&timezone=Europe/Vienna`, key, liveIntervalSeconds(sport));
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
  return snapshotResult(games, fetchedAt, source, expiresAt, liveError);
}

// Andere Sportarten: nur die Tagesliste, die hier zugleich der Live-Stand
// ist (Ablauf = Takt, 300 s). Deshalb source "live", vergangene Tage "day".
async function otherSport(sport: Sport, date: string, league: string | null, key: string): Promise<LiveProviderResult> {
  const isPast = date < viennaDate(Date.now());
  const day = await load(`${ENDPOINTS[sport]}?date=${date}&timezone=Europe/Vienna`, key, isPast ? PAST_TTL : liveIntervalSeconds(sport));
  if (!day.ok) return { ok: false, error: day.error, expiresAt: day.expiresAt };
  return snapshotResult(normalizeAll(sport, day.hit.value, league), day.hit.at, isPast ? "day" : "live", day.hit.expiresAt);
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

// ---------------------------------------------------------------------------

export const apiSportsProvider: LiveProvider = {
  id: "api-sports",
  name: "API-Sports",
  url: "https://www.api-football.com/",
  configError() {
    return process.env.API_SPORTS_KEY ? null : "Kein API_SPORTS_KEY gesetzt";
  },
  async getDay({ sport, date, league }: LiveProviderRequest): Promise<LiveProviderResult> {
    const key = process.env.API_SPORTS_KEY;
    if (!key) return { ok: false, error: "Kein API_SPORTS_KEY gesetzt", expiresAt: Date.now() + 300 * 1000 };
    return sport === "Fußball" ? football(date, league, key) : otherSport(sport, date, league, key);
  },
  diagnostics(): LiveDiagnostics {
    return { provider: "api-sports", providerName: "API-Sports", ...diag };
  },
};
