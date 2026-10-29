import { NextResponse } from "next/server";
import { ALL_SPORTS, type Sport } from "@/lib/types";
import { isLiveSportEnabled } from "@/lib/liveConfig";
import { viennaDate } from "@/lib/liveScores";
import { getLiveProvider } from "@/lib/live";
import { hasStadiumSearch, searchTeamStadiums, type StadiumCandidate } from "@/lib/live/providers/apiSports";
import { teamMatchScore } from "@/lib/liveScores";
import { leagueNicknameMatch } from "@/lib/teamGroups";
import { HOCKEY_ARENAS } from "@/lib/hockeyArenas";
import { DEFAULT_COUNTRY_CODE } from "@/lib/flags";
import { canLookupStadium, stadiumSearchTerms, type StadiumLookup } from "@/lib/teamStadium";

// Heimstadion eines Vereins von der API (Rene, 29.10.2026), fürs Füllen im
// Admin unter Teams.
// GET /api/team-stadium?sport=Fußball&name=Austria Lustenau[&name=…]&country=AT[&national=1]
// Mehrere "name" = eigener Name plus verknüpfte API-Namen (Vereinsnamen).
//
// Fußball und American Football: Team-Suche der API. Basketball: die API
// kennt kein Heimstadion, darum die Halle aus den Heimspielen der nächsten
// Tage (dieselben Tageslisten wie Matchcenter und Tippkarten, also kaum
// zusätzliche Abfragen). Eishockey: feste Liste (lib/hockeyArenas.ts).

const GAME_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function json(body: StadiumLookup, maxAge: number, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": `public, max-age=0, s-maxage=${Math.max(1, Math.floor(maxAge))}, stale-while-revalidate=3600` },
  });
}

function countryInEnglish(code: string): string | null {
  try {
    return code ? new Intl.DisplayNames(["en"], { type: "region" }).of(code.toUpperCase()) ?? null : null;
  } catch {
    return null;
  }
}

// Wie gut passt ein API-Team zu den Namen des eigenen Teams? 0 = gar nicht.
function stadiumTeamScore(sport: Sport, names: string[], countryCode: string, apiTeam: string): number {
  let best = 0;
  for (const n of names) {
    best = Math.max(best, teamMatchScore(n, apiTeam));
    if (leagueNicknameMatch(sport, { name: n, countryCode }, apiTeam)) best = Math.max(best, 3);
  }
  return best;
}

// Bester Treffer: höchste Namens-Übereinstimmung (mind. "alle Wörter
// enthalten"), bei Gleichstand das gleiche Land. Bleibt es mehrdeutig,
// lieber nichts eintragen als das falsche Stadion.
function pick(sport: Sport, candidates: StadiumCandidate[], names: string[], countryCode: string, national: boolean) {
  const country = countryInEnglish(countryCode)?.toLowerCase() ?? null;
  const scored = candidates
    .filter((c) => c.national === national || sport !== "Fußball")
    .map((c) => ({
      c,
      score: stadiumTeamScore(sport, names, countryCode, c.apiTeam) + (country && c.country?.toLowerCase() === country ? 0.5 : 0),
    }))
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score);
  if (scored.length === 0) return null;
  if (scored.length > 1 && scored[1].score === scored[0].score && scored[1].c.name !== scored[0].c.name) return null;
  return scored[0].c;
}

async function fromGames(sport: Sport, names: string[], countryCode: string): Promise<StadiumLookup> {
  const provider = getLiveProvider();
  const configError = provider.configError();
  if (configError) return { found: null, error: configError };
  const now = Date.now();
  const dates = Array.from({ length: GAME_DAYS }, (_, i) => viennaDate(now + i * DAY_MS));
  const days = await Promise.all(dates.map((date) => provider.getDay({ sport, date, league: null })));
  const counts = new Map<string, { name: string; apiTeam: string; n: number }>();
  let error: string | undefined;
  for (const day of days) {
    if (!day.ok) {
      error = day.error;
      continue;
    }
    for (const g of day.snapshot.games) {
      if (!g.venue || stadiumTeamScore(sport, names, countryCode, g.home) < 2) continue;
      const entry = counts.get(g.venue) ?? { name: g.venue, apiTeam: g.home, n: 0 };
      entry.n += 1;
      counts.set(g.venue, entry);
    }
  }
  const best = Array.from(counts.values()).sort((a, b) => b.n - a.n)[0];
  if (best) return { found: { name: best.name, capacity: null, venueId: null, apiTeam: best.apiTeam } };
  return { found: null, ...(error ? { error } : {}) };
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const sport = ALL_SPORTS.find((s) => s === params.get("sport"));
  const names = params
    .getAll("name")
    .map((n) => n.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 5);
  const countryCode = (params.get("country") ?? "").trim().slice(0, 3);
  const national = params.get("national") === "1";
  if (!sport || names.length === 0) return json({ found: null, error: "Ungültige Anfrage" }, 3600, 400);
  if (!canLookupStadium(sport) || !isLiveSportEnabled(sport)) {
    return json({ found: null, error: "Die API kennt hier kein Stadion – bitte von Hand eintragen." }, 3600);
  }

  // Eishockey: feste Liste statt API (Rene, 29.10.2026).
  if (sport === "NHL") {
    // Land passt nicht zur Liga → Halle nicht in Frage ("DE" = Standard, unbekannt).
    const cc = countryCode.toUpperCase();
    const northAmerica = cc === "US" || cc === "CA";
    const unknown = !cc || cc === DEFAULT_COUNTRY_CODE;
    const scored = HOCKEY_ARENAS.filter((a) => unknown || !!a.nhl === northAmerica).map((a) => ({
      a,
      score: Math.max(...a.names.map((n) => stadiumTeamScore(sport, names, countryCode, n))),
    }))
      .filter((x) => x.score >= 2)
      .sort((x, y) => y.score - x.score);
    const hit = scored.length === 1 || (scored.length > 1 && scored[1].score < scored[0].score) ? scored[0].a : null;
    return json(
      { found: hit ? { name: hit.arena, capacity: hit.capacity ?? null, venueId: null, apiTeam: hit.names[0] } : null },
      3600,
    );
  }

  let error: string | undefined;
  if (hasStadiumSearch(sport)) {
    for (const term of stadiumSearchTerms(names)) {
      const res = await searchTeamStadiums(sport, term);
      if (!res.ok) {
        error = res.error;
        continue;
      }
      const hit = pick(sport, res.candidates, names, countryCode, national);
      if (hit) {
        return json({ found: { name: hit.name, capacity: hit.capacity, venueId: hit.venueId, apiTeam: hit.apiTeam } }, 24 * 3600);
      }
    }
  }
  // Basketball immer, American Football falls die Suche nichts hatte.
  if (sport !== "Fußball") {
    const res = await fromGames(sport, names, countryCode);
    if (res.found) return json(res, 6 * 3600);
    error = error ?? res.error;
  }
  return json({ found: null, ...(error ? { error } : {}) }, error ? 60 : 3600);
}
