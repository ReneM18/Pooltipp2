// Tennis-Live (Rene, 10.11.2026): tennis-api.com über RapidAPI.
// GET /tennis/v2/extend/api/events/live liefert { data: [...] } mit
// score "6-3,2-1" (Games je Satz aus Sicht von Spieler 1), points "40-15",
// indicator "1,0" (Spieler 1 schlägt auf), tourType "atp"/"wta",
// startTimestamp (Sekunden), updatedAt (Millisekunden). Keine Länder.

export interface TennisLiveGame {
  id: string;
  player1: string;
  player2: string;
  // Länder kommen im Live-Feed meist nicht mit; dann aus der Weltrangliste.
  country1: string | null;
  country2: string | null;
  tournament: string;
  tour: "atp" | "wta" | string;
  // Games je Satz, z. B. [[6, 3], [2, 1]]; der letzte läuft noch.
  sets: [number, number][];
  // Gewonnene Sätze (nur abgeschlossene Sätze zählen).
  setsWon: [number, number];
  points: string | null;
  serve: 1 | 2 | null;
  status: string;
  start: number; // ms
  updatedAt: number | null; // ms
}

export interface TennisLiveResponse {
  ok: boolean;
  error: string | null;
  fetchedAt: number | null;
  games: TennisLiveGame[];
}

/** Satz fertig: 6 Games mit 2 Vorsprung, 7:5, 7:6 (Tiebreak). */
export function isSetDone(a: number, b: number): boolean {
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  return (hi >= 6 && hi - lo >= 2) || (hi === 7 && (lo === 5 || lo === 6));
}

export function parseScore(score: unknown): [number, number][] {
  if (typeof score !== "string") return [];
  return score
    .split(",")
    .map((s) => s.trim().match(/^(\d+)\s*-\s*(\d+)/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => [Number(m[1]), Number(m[2])] as [number, number]);
}

export function setsWonOf(sets: [number, number][], finished = false): [number, number] {
  let a = 0;
  let b = 0;
  sets.forEach(([x, y], i) => {
    const last = i === sets.length - 1;
    if (!isSetDone(x, y) && !(finished && last && x !== y)) return;
    if (x > y) a++;
    else if (y > x) b++;
  });
  return [a, b];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseLiveGame(raw: any): TennisLiveGame | null {
  if (!raw || typeof raw !== "object") return null;
  const p1 = String(raw.player1?.name ?? raw.participant1 ?? "").trim();
  const p2 = String(raw.player2?.name ?? raw.participant2 ?? "").trim();
  if (!p1 || !p2) return null;
  const sets = parseScore(raw.score);
  const ind = typeof raw.indicator === "string" ? raw.indicator.replace(/\s/g, "") : "";
  const status = String(raw.status ?? "");
  const finished = /finish|ended|ret|walk/i.test(status);
  const points = typeof raw.points === "string" && raw.points.trim() ? raw.points.trim() : null;
  return {
    id: String(raw.id ?? raw.matchKey ?? `${p1}-${p2}`),
    player1: p1,
    player2: p2,
    country1: countryOf(raw.player1),
    country2: countryOf(raw.player2),
    tournament: String(raw.tournament?.name ?? raw.league ?? "").trim(),
    tour: String(raw.tourType ?? "").toLowerCase(),
    sets,
    setsWon: setsWonOf(sets, finished),
    points: finished ? null : points,
    serve: finished ? null : ind === "1,0" ? 1 : ind === "0,1" ? 2 : null,
    status,
    start: Number(raw.startTimestamp) > 0 ? Number(raw.startTimestamp) * 1000 : 0,
    updatedAt: Number(raw.updatedAt) > 0 ? Number(raw.updatedAt) : null,
  };
}

/**
 * Rang eines Turniers für die Reihenfolge: Grand Slam, Finals, 1000er,
 * 500/250, Challenger, ITF zuletzt. ITF-Turniere (M15, W25 …) blendet das
 * Matchcenter aus.
 */
export function tournamentRank(name: string, tour?: string | null): number {
  const n = name.toLowerCase();
  const pts = tournamentPoints(name, tour);
  if (pts === 1000) return 2;
  if (pts === 500) return 3;
  if (pts === 250) return 4;
  if (/australian open|roland garros|french open|wimbledon|us open/.test(n)) return 0;
  if (/finals/.test(n)) return 1;
  if (/1000|masters/.test(n)) return 2;
  if (/challenger/.test(n)) return 5;
  if (isItf(name)) return 9;
  return 3;
}

/**
 * Kleine Turniere, die das Matchcenter ausblendet: ITF und Challenger
 * (Rene, 10.11.2026: "die interessieren keinen"), bei den Damen WTA 125.
 */
export function isMinorTournament(name: string): boolean {
  return isItf(name) || /challenger|\b125\b/i.test(name);
}

export function isItf(name: string): boolean {
  return /\bitf\b/i.test(name) || /^(m|w)\s?\d{2,3}\b/i.test(name.trim());
}

/** Name vergleichbar machen (Akzente, Groß/klein, Punkte). */
export function normPlayer(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[łŁ]/g, "l")
    .replace(/ß/g, "ss")
    .toLowerCase()
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Gleicher Spieler? Voller Name gleich oder gleicher Nachname + Initiale ("J. Sinner"). */
export function samePlayer(a: string, b: string): boolean {
  const x = normPlayer(a);
  const y = normPlayer(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xs = x.split(" ");
  const ys = y.split(" ");
  const xl = xs[xs.length - 1];
  const yl = ys[ys.length - 1];
  return xl === yl && xl.length > 2 && xs[0][0] === ys[0][0];
}

/** Live-Spiel zu einem Tipp-Spiel (Reihenfolge der Spieler egal). swapped = Spieler 1 der API ist der Gast. */
export function findLiveFor(
  games: TennisLiveGame[],
  home: string,
  away: string,
): { game: TennisLiveGame; swapped: boolean } | null {
  for (const g of games) {
    if (samePlayer(g.player1, home) && samePlayer(g.player2, away)) return { game: g, swapped: false };
    if (samePlayer(g.player1, away) && samePlayer(g.player2, home)) return { game: g, swapped: true };
  }
  return null;
}

/** Kurzname wie auf Livescore-Seiten: "Tallon Griekspoor" -> "T. Griekspoor". */
export function shortPlayer(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2 || /\.$/.test(parts[0])) return name.trim();
  return `${parts[0][0]}. ${parts.slice(1).join(" ")}`;
}

// ---------------------------------------------------------------------------
// Spielplan und Weltrangliste (Rene, 10.11.2026). Formate laut
// docs.tennis-api.com: Rangliste data[] { position, rankingPoints|point,
// player { name, countryAcr } }, Spielplan matches[] { date, player1/2
// { name, countryAcr }, tournament { name }, round { name } }.

export interface TennisRankRow {
  rank: number;
  name: string;
  country: string | null; // ISO-2 für die Flagge
  points: number | null;
}

export interface TennisPlanGame {
  id: string;
  start: number; // ms
  player1: string;
  player2: string;
  country1: string | null;
  country2: string | null;
  tournament: string;
  round: string | null;
}

export interface TennisListResponse<T> {
  ok: boolean;
  error: string | null;
  fetchedAt: number | null;
  rows: T[];
}

// Länderkürzel im Tennis (IOC, 3 Buchstaben) -> ISO-2 für die Flagge.
const IOC_TO_ISO2: Record<string, string> = {
  ARG: "AR", AUS: "AU", AUT: "AT", BEL: "BE", BIH: "BA", BLR: "BY", BOL: "BO", BRA: "BR", BUL: "BG", CAN: "CA",
  CHI: "CL", CHN: "CN", COL: "CO", CRO: "HR", CYP: "CY", CZE: "CZ", DEN: "DK", ECU: "EC", EGY: "EG", ESP: "ES",
  EST: "EE", FIN: "FI", FRA: "FR", GBR: "GB", GEO: "GE", GER: "DE", GRE: "GR", HKG: "HK", HUN: "HU", IND: "IN",
  INA: "ID", IRL: "IE", ISR: "IL", ITA: "IT", JPN: "JP", KAZ: "KZ", KOR: "KR", LAT: "LV", LTU: "LT", LUX: "LU",
  MAR: "MA", MDA: "MD", MEX: "MX", MON: "MC", MNE: "ME", NED: "NL", NOR: "NO", NZL: "NZ", PAR: "PY", PER: "PE",
  PHI: "PH", POL: "PL", POR: "PT", PUR: "PR", ROU: "RO", RSA: "ZA", RUS: "RU", SLO: "SI", SRB: "RS", SUI: "CH",
  SVK: "SK", SWE: "SE", THA: "TH", TPE: "TW", TUN: "TN", TUR: "TR", UKR: "UA", URU: "UY", USA: "US", UZB: "UZ",
  VEN: "VE", ALG: "DZ", ARM: "AM", AZE: "AZ", DOM: "DO", ESA: "SV", ISL: "IS", JOR: "JO", LIB: "LB", MKD: "MK",
  MLT: "MT", QAT: "QA", KSA: "SA", UAE: "AE", VIE: "VN", ZIM: "ZW", BAR: "BB", JAM: "JM", TTO: "TT", CRC: "CR",
  GUA: "GT", PAN: "PA",
};

export function countryToIso2(code: unknown): string | null {
  if (typeof code !== "string") return null;
  const c = code.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(c)) return c;
  return IOC_TO_ISO2[c] ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Raw = any;

export function firstArray(body: Raw): Raw[] {
  if (Array.isArray(body)) return body;
  for (const k of ["data", "matches", "results", "rankings", "response"]) {
    if (Array.isArray(body?.[k])) return body[k];
    if (body?.[k] && typeof body[k] === "object") {
      const inner = firstArray(body[k]);
      if (inner.length) return inner;
    }
  }
  return [];
}

function countryOf(p: Raw): string | null {
  return countryToIso2(p?.countryAcr ?? p?.country?.acronym ?? p?.country?.code ?? p?.countryCode ?? p?.country);
}

export function parseRankRow(raw: Raw): TennisRankRow | null {
  const p = raw?.player ?? raw;
  const name = String(p?.name ?? raw?.name ?? "").trim();
  const rank = Number(raw?.position ?? raw?.rank ?? raw?.ranking);
  if (!name || !(rank > 0)) return null;
  const pts = Number(raw?.rankingPoints ?? raw?.point ?? raw?.points);
  return { rank, name, country: countryOf(p), points: Number.isFinite(pts) ? pts : null };
}

export function parsePlanGame(raw: Raw): TennisPlanGame | null {
  const p1 = raw?.player1 ?? raw?.home;
  const p2 = raw?.player2 ?? raw?.away;
  const n1 = String(p1?.name ?? raw?.participant1 ?? "").trim();
  const n2 = String(p2?.name ?? raw?.participant2 ?? "").trim();
  const iso = raw?.startTime ?? raw?.date ?? null;
  const start = typeof iso === "string" ? Date.parse(iso) : Number(raw?.startTimestamp) > 0 ? Number(raw.startTimestamp) * 1000 : NaN;
  if (!n1 || !n2 || !Number.isFinite(start)) return null;
  const round = raw?.round?.name ?? null;
  return {
    id: String(raw?.matchId ?? raw?.id ?? `${n1}-${n2}-${start}`),
    start,
    player1: n1,
    player2: n2,
    country1: countryOf(p1),
    country2: countryOf(p2),
    tournament: String(raw?.tournament?.name ?? raw?.league ?? "").trim(),
    round: typeof round === "string" && round.trim() ? round.trim() : null,
  };
}

// ---------------------------------------------------------------------------
// Spiel-Statistik (Rene, 10.11.2026: "rechts sollte was kommen, wo das Spiel
// größer wird und mehr Statistik wie beim Fußball"). Laut docs.tennis-api.com
// GET /tennis/v2/extend/api/event/get/statistics/{eventId}:
// statistics.{ALL|1ST|2ND…}.{Kategorie}.{Wert}.{player1|player2}
// { value, total?, percentage? }. Älteres Format: result.stats
// { aces: [a, b], double_faults: [a, b], … }.

export interface TennisStatRow {
  key: string;
  label: string;
  // Zahl für den Balken (bei Quoten der Prozentwert).
  v1: number;
  v2: number;
  text1: string;
  text2: string;
}

export interface TennisStatsResponse {
  ok: boolean;
  error: string | null;
  fetchedAt: number | null;
  rows: TennisStatRow[];
}

type StatFmt = "n" | "pct" | "frac";
const STAT_DEFS: [string, string, string, StatFmt][] = [
  ["service", "aces", "Asse", "n"],
  ["service", "doubleFaults", "Doppelfehler", "n"],
  ["service", "firstServeAccuracy", "1. Aufschlag im Feld", "pct"],
  ["service", "firstServePointsAccuracy", "Punkte nach 1. Aufschlag", "pct"],
  ["service", "secondServePointsAccuracy", "Punkte nach 2. Aufschlag", "pct"],
  ["return", "breakPointsScored", "Breakbälle genutzt", "frac"],
  ["service", "breakPointsSaved", "Breakbälle abgewehrt", "frac"],
  ["games", "serviceGamesWon", "Aufschlagspiele gewonnen", "n"],
  ["points", "pointsTotal", "Punkte gesamt", "n"],
  ["games", "maxGamesInRow", "Games in Folge (max.)", "n"],
];

function statCell(p: Raw, fmt: StatFmt): { v: number; text: string } | null {
  const value = Number(p?.value);
  if (!Number.isFinite(value)) return null;
  const total = Number(p?.total);
  const hasTotal = Number.isFinite(total) && total > 0;
  if (fmt === "n" || !hasTotal) return { v: value, text: String(value) };
  const pct = Number.isFinite(Number(p?.percentage)) ? Number(p.percentage) : (value / total) * 100;
  if (fmt === "pct") return { v: pct, text: `${Math.round(pct)} %` };
  return { v: pct, text: `${value}/${total}` };
}

function findStatistics(body: Raw): Raw {
  for (const c of [body?.statistics, body?.result?.statistics, body?.data?.statistics, body?.results?.statistics]) {
    if (c && typeof c === "object") return c;
  }
  return null;
}

export function parseTennisStats(body: Raw): TennisStatRow[] {
  const stats = findStatistics(body);
  if (stats) {
    const period = stats.ALL ?? stats.all ?? stats[Object.keys(stats)[0]];
    const rows: TennisStatRow[] = [];
    for (const [cat, metric, label, fmt] of STAT_DEFS) {
      const m = period?.[cat]?.[metric];
      const a = statCell(m?.player1, fmt);
      const b = statCell(m?.player2, fmt);
      if (a && b) rows.push({ key: metric, label, v1: a.v, v2: b.v, text1: a.text, text2: b.text });
    }
    if (rows.length) return rows;
  }
  // Älteres Format: zwei Werte je Eintrag.
  const legacy = body?.result?.stats ?? body?.stats;
  const LEGACY: [string, string][] = [
    ["aces", "Asse"],
    ["double_faults", "Doppelfehler"],
    ["win_1st_serve", "Punkte nach 1. Aufschlag"],
    ["break_point_conversions", "Breakbälle genutzt"],
  ];
  const rows: TennisStatRow[] = [];
  if (legacy && typeof legacy === "object") {
    for (const [k, label] of LEGACY) {
      const pair = legacy[k];
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const num = (x: unknown) => parseFloat(String(x).replace("%", ""));
      const a = num(pair[0]);
      const b = num(pair[1]);
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
      rows.push({ key: k, label, v1: a, v2: b, text1: String(pair[0]), text2: String(pair[1]) });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Ranglistenpunkte für den Turniersieg (Rene, 10.11.2026: "neben dem Turnier
// immer angeben, um wie viele Punkte es geht"). Die API liefert nur den
// Namen, darum nach Name und Tour: Grand Slam 2000, Finals bis 1500,
// 1000er, 500er (Liste der Orte), sonst 250. Unbekannte Tour: null.

const ATP_1000 = /indian wells|miami|monte.?carlo|madrid|rome|roma|internazionali|canada|montreal|toronto|cincinnati|shanghai|paris|rolex|masters/;
const ATP_500 = /rotterdam|dallas|rio de janeiro|rio open|acapulco|doha|qatar|dubai|barcelona|munich|münchen|halle|queen|hamburg|washington|citi open|beijing|china open|tokyo|japan open|basel|swiss indoors|vienna|wien|erste bank/;
const WTA_1000 = /doha|qatar|dubai|indian wells|miami|madrid|rome|roma|internazionali|canada|montreal|toronto|cincinnati|beijing|china open|wuhan/;
const WTA_500 = /brisbane|adelaide|abu dhabi|linz|charleston|stuttgart|berlin|queen|bad homburg|eastbourne|washington|citi open|monterrey|seoul|korea|tokyo|pan pacific|ningbo|zhengzhou|san diego|strasbourg/;

export function tournamentPoints(name: string, tour?: string | null): number | null {
  const n = name.toLowerCase();
  if (!n || isMinorTournament(name)) return null;
  if (/australian open|roland garros|french open|wimbledon|us open/.test(n)) return 2000;
  if (/finals/.test(n)) return /next gen/.test(n) ? null : 1500;
  const t = (tour ?? "").toLowerCase() || (/\bwta\b/.test(n) ? "wta" : /\batp\b/.test(n) ? "atp" : "");
  const explicit = n.match(/\b(1000|500|250)\b/);
  if (explicit) return Number(explicit[1]);
  if (t === "atp") return ATP_1000.test(n) ? 1000 : ATP_500.test(n) ? 500 : 250;
  if (t === "wta") return WTA_1000.test(n) ? 1000 : WTA_500.test(n) ? 500 : 250;
  return null;
}

/** Nur die Zahl, z. B. "250", "2000" (Rene, 11.11.2026: ohne "Punkte"). */
export function tournamentPointsText(name: string, tour?: string | null): string | null {
  const p = tournamentPoints(name, tour);
  return p === null ? null : String(p);
}

/** Land eines Spielers aus bekannten Listen (Weltrangliste, Spielplan, App-Spieler). */
export function countryLookup(known: { name: string; country: string | null }[]): (name: string) => string | null {
  const withCountry = known.filter((k) => k.country);
  const exact = new Map(withCountry.map((k) => [normPlayer(k.name), k.country!]));
  return (name: string) => {
    const hit = exact.get(normPlayer(name));
    if (hit) return hit;
    return withCountry.find((k) => samePlayer(k.name, name))?.country ?? null;
  };
}
