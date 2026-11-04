import type { LiveGame, LiveStatus } from "./live/types";

// Spielplan je Bewerb (Rene, 04.11.2026: "wenn jetzt zB Championsleague
// ist, wie kann ich nachschauen wer als nächstes gegeneinander spielt").
// Im Matchcenter unter Spielplan → "Nach Bewerb" (Variante A): Bewerb
// wählen, mit Pfeilen durch die Spieltage bzw. Runden blättern.
//
// Daten: API-Sports fixtures?league=…&season=… (alle Spiele einer Saison,
// jedes mit league.round, z. B. "Regular Season - 11"), über
// GET /api/fixtures?league=<id>. Nur Fußball: Die Saison-Abfrage ist im
// Gratis-Plan gesperrt, nur Fußball hat den Pro-Plan (Rene, 27.10.2026).

// Bewerbe mit Spielplan, IDs von API-Sports (v3.football.api-sports.io/leagues).
// label + country wie in LIVE_LEAGUES (lib/liveConfig.ts), damit die
// Überschrift einer Liga im Matchcenter den passenden Bewerb findet
// (fixtureLeagueOf in app/matchcenter/page.tsx).
// Reihenfolge wie im Matchcenter (nach Wichtigkeit, LIVE_LEAGUES).
// WM, EM, Qualifikationen und Länderspiele fehlen: gerade keine laufende
// Saison bzw. keine Spieltage.
export interface FixtureLeague {
  id: number;
  label: string;
  country: string | null;
}

export const FIXTURE_LEAGUES: readonly FixtureLeague[] = [
  { id: 2, label: "Champions League", country: null },
  { id: 3, label: "Europa League", country: null },
  { id: 848, label: "Conference League", country: null },
  { id: 5, label: "Nations League", country: null },
  { id: 218, label: "Bundesliga", country: "AT" },
  { id: 78, label: "Bundesliga", country: "DE" },
  { id: 39, label: "Premier League", country: "GB-ENG" },
  { id: 140, label: "La Liga", country: "ES" },
  { id: 135, label: "Serie A", country: "IT" },
  { id: 220, label: "ÖFB-Cup", country: "AT" },
  { id: 81, label: "DFB-Pokal", country: "DE" },
  { id: 219, label: "2. Liga", country: "AT" },
  { id: 79, label: "2. Bundesliga", country: "DE" },
];

export function isFixtureLeague(id: number): boolean {
  return FIXTURE_LEAGUES.some((l) => l.id === id);
}

// Antwort von GET /api/fixtures.
export interface FixturesResponse {
  league: number;
  season: number;
  games: LiveGame[];
  fetchedAt?: number;
  error?: string;
}

// Eine Runde (Spieltag) mit ihren Spielen, nach Anstoß.
export interface FixtureRound {
  key: string; // Runde laut API, z. B. "League Stage - 4"
  title: string; // "4. Spieltag", "Achtelfinale"
  phase: string | null; // "Ligaphase", "Liga A" … oder null
  first: string; // erster Anstoß am Termin der Runde (ISO)
  last: string; // letzter Anstoß (ISO)
  core: string[]; // Spiele am Termin der Runde (ohne Nachholspiele)
  games: LiveGame[];
}

const ORDINAL_ROUND = /^(\d+)(?:st|nd|rd|th)\s+(Round|Qualifying Round|Preliminary Round)$/i;

// Runde der API auf Deutsch (Rene: kurz und so, wie man es kennt).
export function roundLabel(round: string): { title: string; phase: string | null } {
  const r = round.trim();
  // "Regular Season - 11", "League Stage - 4", "League A - 3", "Group A - 2"
  const md = /^(.*?)\s*-\s*(\d+)$/.exec(r);
  if (md) {
    const [, phaseRaw, n] = md;
    const p = phaseRaw.toLowerCase();
    let phase: string | null = null;
    if (p.includes("league stage") || p.includes("league phase")) phase = "Ligaphase";
    else if (/^league [a-d]$/.test(p)) phase = `Liga ${phaseRaw.slice(-1).toUpperCase()}`;
    else if (/^group [a-z]$/.test(p)) phase = `Gruppe ${phaseRaw.slice(-1).toUpperCase()}`;
    else if (p.includes("championship")) phase = "Meistergruppe";
    else if (p.includes("relegation") || p.includes("qualifying")) phase = "Qualifikationsgruppe";
    else if (!p.includes("regular season")) phase = phaseRaw;
    return { title: `${n}. Spieltag`, phase };
  }
  const ord = ORDINAL_ROUND.exec(r);
  if (ord) {
    const kind = ord[2].toLowerCase();
    return { title: kind === "round" ? `${ord[1]}. Runde` : `${ord[1]}. Quali-Runde`, phase: null };
  }
  const known: Record<string, string> = {
    "round of 64": "1/32-Finale",
    "round of 32": "Sechzehntelfinale",
    "16th finals": "Sechzehntelfinale",
    "round of 16": "Achtelfinale",
    "8th finals": "Achtelfinale",
    "quarter-finals": "Viertelfinale",
    "quarter-final": "Viertelfinale",
    "semi-finals": "Halbfinale",
    "semi-final": "Halbfinale",
    "3rd place final": "Spiel um Platz 3",
    final: "Finale",
    "knockout round play-offs": "Play-offs",
    "play-offs": "Play-offs",
    "relegation round": "Relegation",
    relegation: "Relegation",
    "preliminary round": "Vorrunde",
  };
  const hit = known[r.toLowerCase()];
  return { title: hit ?? r, phase: null };
}

// Spiele nach Runde, Runden nach ihrem Termin. Spiele ohne Runde fallen
// raus. Nachholspiele (verschoben, neuer Termin Wochen später) bleiben in
// ihrer Runde, zählen aber nicht für deren Termin: Termin = Spiele höchstens
// 5 Tage um den mittleren Anstoß der Runde.
const CORE_MS = 5 * 24 * 3600 * 1000;

function coreGames(sorted: LiveGame[]): LiveGame[] {
  const regular = sorted.filter((g) => g.status !== "OTHER");
  const list = regular.length > 0 ? regular : sorted;
  const mid = Date.parse(list[Math.floor((list.length - 1) / 2)].kickoff);
  const core = list.filter((g) => Math.abs(Date.parse(g.kickoff) - mid) <= CORE_MS);
  return core.length > 0 ? core : list;
}

export function groupRounds(games: LiveGame[]): FixtureRound[] {
  const map = new Map<string, LiveGame[]>();
  for (const g of games) {
    if (!g.round) continue;
    map.set(g.round, [...(map.get(g.round) ?? []), g]);
  }
  return Array.from(map, ([key, list]) => {
    const sorted = [...list].sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.home.localeCompare(b.home));
    const core = coreGames(sorted);
    return {
      key,
      ...roundLabel(key),
      first: core[0].kickoff,
      last: core[core.length - 1].kickoff,
      core: core.map((g) => g.id),
      games: sorted,
    };
  }).sort((a, b) => a.first.localeCompare(b.first));
}

// Ohne Import aus lib/liveScores.ts, damit der Test (node) diese Datei
// allein laden kann.
const FINISHED: readonly LiveStatus[] = ["FT", "AET", "PEN"];

// Aktuelle Runde: die erste, die an ihrem Termin noch ein nicht beendetes
// Spiel hat (läuft gerade eins, dessen Runde). Abgesagte, verschobene und
// Nachholspiele zählen nicht. Ist die Saison vorbei, die letzte Runde.
export function currentRoundIndex(rounds: FixtureRound[], now: number): number {
  if (rounds.length === 0) return -1;
  let best = -1;
  rounds.forEach((r, i) => {
    if (best !== -1) return;
    const core = new Set(r.core);
    const open = r.games.some(
      (g) =>
        core.has(g.id) &&
        !FINISHED.includes(g.status) &&
        g.status !== "OTHER" &&
        // Spiele, die laut Daten nie fertig wurden (älter als 1 Tag), übergehen.
        Date.parse(g.kickoff) >= now - 24 * 3600 * 1000,
    );
    if (open) best = i;
  });
  return best === -1 ? rounds.length - 1 : best;
}
