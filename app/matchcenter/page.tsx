"use client";

import EmptyState from "@/components/EmptyState";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  fetchRecentResults,
  fetchStandings,
  LEAGUE_IDS,
  ResultRow,
  StandingRow,
} from "@/lib/sportsApi";
import AdBanner from "@/components/AdBanner";
import FitText from "@/components/FitText";
import {
  isLiveFinished,
  isLiveRunning,
  liveIntervalSeconds,
  updatedAgoText,
  viennaDate,
  type LiveGame,
  type LiveResponse,
} from "@/lib/liveScores";
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";

const LEAGUES = Object.keys(LEAGUE_IDS);

// Berechnet die aktuelle Saison automatisch aus dem heutigen Datum, statt sie
// fest zu codieren (europäische Fußball-Saisons laufen Sommer bis Sommer:
// ab Juli zählt das laufende Jahr als Start-Jahr der neuen Saison).
function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
const CURRENT_SEASON = getCurrentSeason();

export default function MatchcenterPage() {
  const [league, setLeague] = useState(LEAGUES[0]);
  const [view, setView] = useState<"ergebnisse" | "tabelle">("tabelle");
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const leagueId = LEAGUE_IDS[league];
    setLoading(true);
    setError(null);

    const request =
      view === "tabelle"
        ? fetchStandings(leagueId, CURRENT_SEASON).then(setStandings)
        : fetchRecentResults(leagueId).then(setResults);

    request.catch(() => setError("Daten konnten gerade nicht geladen werden."))
      .finally(() => setLoading(false));
    // retryCount hat keinen eigenen Effekt außer den useEffect erneut
    // auszulösen – genau das braucht der "Erneut versuchen"-Button unten.
  }, [league, view, retryCount]);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Matchcenter</h1>

      {/* (Rene, 15.10.2026: Europa League zum Testen) */}
      <EuropaLeagueSection />

      <AdBanner />

      <div className="mb-5 flex flex-wrap gap-2">
        {LEAGUES.map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              league === l
                ? "border-gold bg-gold/10 text-gold"
                : "border-edge text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted">Lädt…</p>}
      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && view === "tabelle" && (
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          <div className={`${TABLE_GRID} border-b border-edge py-2 text-xs text-muted`}>
            <span>#</span>
            <span>Team</span>
            <span className="text-center">Sp</span>
            <span className="text-center sm:hidden">S-U-N</span>
            <span className="hidden text-center sm:block">S</span>
            <span className="hidden text-center sm:block">U</span>
            <span className="hidden text-center sm:block">N</span>
            <span className="text-right">Pkt</span>
          </div>
          {(standings ?? []).length === 0 && (
            <EmptyState
              emoji="📊"
              title="Noch keine Tabelle"
              text="Für diese Liga gibt es gerade keine Tabellendaten. Schau später nochmal vorbei."
              className="m-3 border-none bg-transparent"
            />
          )}
          {(standings ?? []).map((row) => (
            <div
              key={row.rank}
              className={`${TABLE_GRID} items-center border-b border-edge py-2.5 text-sm last:border-0`}
            >
              <span className="text-muted">{row.rank}</span>
              <FitText text={row.teamName} className="leading-tight text-ink" />
              <span className="text-center text-muted">{row.played}</span>
              <span className="whitespace-nowrap text-center text-xs text-muted sm:hidden">
                {row.win}-{row.draw}-{row.loss}
              </span>
              <span className="hidden text-center text-muted sm:block">{row.win}</span>
              <span className="hidden text-center text-muted sm:block">{row.draw}</span>
              <span className="hidden text-center text-muted sm:block">{row.loss}</span>
              <span className="text-right font-semibold text-ink">{row.points}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && view === "ergebnisse" && (
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          {(results ?? []).length === 0 && (
            <EmptyState
              emoji="⚽"
              title="Noch keine Ergebnisse"
              text="Für diese Liga gibt es gerade keine Ergebnisse. Schau später nochmal vorbei."
              className="lg:col-span-2"
            />
          )}
          {(results ?? []).map((r) => (
            <div key={r.id} className="rounded-card border border-edge bg-surface px-4 py-3">
              <p className="mb-1.5 text-xs text-muted">{formatDate(r.date)}</p>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                <FitText text={r.homeTeam} className="leading-tight text-ink" />
                <span className="font-display font-semibold text-ink">{r.homeScore}</span>
                <FitText text={r.awayTeam} className="leading-tight text-ink" />
                <span className="font-display font-semibold text-ink">{r.awayScore}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Daten von{" "}
        <a href="https://www.thesportsdb.com/" className="underline" target="_blank" rel="noreferrer">
          TheSportsDB
        </a>
      </p>
    </main>
  );
}

// Am Handy werden Siege/Unentschieden/Niederlagen zu einer Spalte "S-U-N"
// zusammengefasst, damit für den Teamnamen genug Platz bleibt.
const TABLE_GRID =
  "grid grid-cols-[1.25rem_1fr_1.5rem_3.25rem_1.75rem] gap-2 px-3 sm:grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3rem] sm:px-4";

// "2026-09-27" -> "27.09.2026"
function formatDate(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
}

function SubTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative py-2.5 font-display text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// UEFA Europa League (Rene, 15.10.2026: Europa League zum Testen)
// Live-Daten von API-Sports über die Server-Route /api/live (der Schlüssel
// bleibt auf dem Server). Im Gratis-Plan gibt es nur gestern/heute/morgen
// und keine Tabellen – deshalb "Ergebnisse" nur von heute und gestern und
// bei "Tabelle" nur ein Hinweis ohne Abfrage.

const EL_LEAGUE = "UEFA Europa League";
const EL_SPORT = "Fußball" as const;
const EL_POLL_MS = liveIntervalSeconds(EL_SPORT) * 1000; // gleicher Takt wie die Route (180 s)
const EL_MAX_LIVE_MS = 4 * 60 * 60 * 1000;

type ElView = "live" | "ergebnisse" | "tabelle";

interface ElDay {
  games: LiveGame[] | null;
  error: string | null;
  loading: boolean;
  fetchedAt: number;
  // Letzter erfolgreicher Abruf (für "aktualisiert vor …" und die
  // mitlaufende Minute; Rene, 15.10.2026: Live-Gefühl).
  gamesAt: number;
}

const EMPTY_DAY: ElDay = { games: null, error: null, loading: false, fetchedAt: 0, gamesAt: 0 };

// "2026-10-15" -> "2026-10-14"
function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function viennaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" });
}

async function fetchElDay(date: string): Promise<{ games: LiveGame[]; error: string | null }> {
  try {
    const params = new URLSearchParams({ sport: EL_SPORT, date, league: EL_LEAGUE });
    const res = await fetch(`/api/live?${params.toString()}`);
    const data = (await res.json()) as LiveResponse;
    const games = Array.isArray(data.games) ? data.games : [];
    return { games, error: games.length === 0 && data.error ? data.error : null };
  } catch {
    return { games: [], error: "Live-Daten nicht erreichbar" };
  }
}

// Läuft das Spiel (oder müsste es laut Anstoß gleich/gerade laufen)?
function needsPolling(g: LiveGame, now: number): boolean {
  if (isLiveRunning(g.status)) return true;
  if (g.status !== "NS") return false;
  const kickoff = new Date(g.kickoff).getTime();
  return now >= kickoff && now - kickoff < EL_MAX_LIVE_MS;
}

function EuropaLeagueSection() {
  const [view, setView] = useState<ElView>("live");
  const [today, setToday] = useState<string | null>(null);
  const [days, setDays] = useState<Record<string, ElDay>>({});
  const [now, setNow] = useState<number | null>(null);
  const loadingRef = useRef(new Set<string>());

  const load = useCallback(async (date: string) => {
    if (loadingRef.current.has(date)) return;
    loadingRef.current.add(date);
    setDays((d) => ({ ...d, [date]: { ...(d[date] ?? EMPTY_DAY), loading: true } }));
    const { games, error } = await fetchElDay(date);
    loadingRef.current.delete(date);
    setDays((d) => {
      const prev = d[date] ?? EMPTY_DAY;
      // Bei einem Fehler (z. B. Tageslimit) bleiben die letzten Daten stehen.
      const keep = error && prev.games && prev.games.length > 0;
      return {
        ...d,
        [date]: {
          games: keep ? prev.games : games,
          error: keep ? null : error,
          loading: false,
          fetchedAt: Date.now(),
          gamesAt: keep ? prev.gamesAt : Date.now(),
        },
      };
    });
  }, []);

  // Datum und Uhr erst im Browser (sonst Hydration-Fehler), Uhr alle 30 s.
  useEffect(() => {
    setToday(viennaDate(Date.now()));
    setNow(Date.now());
    const t = setInterval(() => {
      setNow(Date.now());
      setToday(viennaDate(Date.now()));
    }, 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const yesterday = today ? previousDate(today) : null;
  const todayDay = (today && days[today]) || EMPTY_DAY;
  const yesterdayDay = (yesterday && days[yesterday]) || EMPTY_DAY;

  // Heute einmal laden (Livestand und Ergebnisse brauchen das).
  useEffect(() => {
    if (today && !days[today]) void load(today);
  }, [today, days, load]);

  // Gestern erst, wenn "Ergebnisse" geöffnet wird (1 h Cache auf dem Server).
  useEffect(() => {
    if (view === "ergebnisse" && yesterday && !days[yesterday]) void load(yesterday);
  }, [view, yesterday, days, load]);

  // Automatisch aktualisieren – nur solange ein Spiel läuft, im 180-s-Takt.
  const polling =
    now !== null && !!todayDay.games && todayDay.games.some((g) => needsPolling(g, now));
  useEffect(() => {
    if (!polling || !today || now === null) return;
    if (!todayDay.loading && now - todayDay.fetchedAt >= EL_POLL_MS) void load(today);
  }, [polling, today, now, todayDay.loading, todayDay.fetchedAt, load]);

  const retry = () => {
    if (today) void load(today);
    if (view === "ergebnisse" && yesterday) void load(yesterday);
  };

  return (
    <section className="mb-6 rounded-card border border-edge bg-surface px-3 pt-3 pb-4 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink sm:text-lg">UEFA Europa League</h2>
        <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[11px] font-semibold text-muted">
          Test
        </span>
      </div>

      <div className="mb-4 flex gap-4 border-b border-edge">
        <SubTab label="Livestand" active={view === "live"} onClick={() => setView("live")} />
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
      </div>

      {view === "live" && <ElLive day={todayDay} now={now} polling={polling} onRetry={retry} />}
      {view === "ergebnisse" && (
        <ElResults today={today} todayDay={todayDay} yesterdayDay={yesterdayDay} onRetry={retry} />
      )}
      {view === "tabelle" && (
        <EmptyState
          emoji="📊"
          title="Die Tabelle kommt mit dem größeren Datenpaket."
          text="Im aktuellen Datenpaket gibt es noch keine Tabelle. Livestand und Ergebnisse funktionieren schon."
          className="border-none bg-transparent"
        />
      )}

      <p className="mt-4 text-center text-[11px] text-muted">
        Daten von{" "}
        <a href="https://www.api-football.com/" className="underline" target="_blank" rel="noreferrer">
          API-Sports
        </a>
        {polling && " · aktualisiert sich alle 3 Minuten"}
      </p>
    </section>
  );
}

function ElError({ error, onRetry }: { error: string; onRetry: () => void }) {
  const text = error.includes("Tageslimit")
    ? "Das Tageslimit der Live-Daten ist erreicht. Morgen geht's weiter."
    : "Die Live-Daten sind gerade nicht verfügbar. Schau später nochmal vorbei.";
  return (
    <div className="flex flex-col items-center gap-3 py-6 text-center">
      <p className="text-sm text-muted">{text}</p>
      <button
        onClick={onRetry}
        className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
      >
        Erneut versuchen
      </button>
    </div>
  );
}

function ElLive({
  day,
  now,
  polling,
  onRetry,
}: {
  day: ElDay;
  now: number | null;
  polling: boolean;
  onRetry: () => void;
}) {
  if (!day.games) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  if (day.error) return <ElError error={day.error} onRetry={onRetry} />;
  if (day.games.length === 0) {
    return (
      <EmptyState
        emoji="⚽"
        title="Heute keine Europa-League-Spiele"
        text="Sobald wieder gespielt wird, siehst du hier alle Spiele live."
        className="border-none bg-transparent"
      />
    );
  }

  // Nach Anstoßzeit gruppieren (18:45, 21:00 …).
  const sorted = [...day.games].sort(
    (a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime() || a.home.localeCompare(b.home),
  );
  const groups: { time: string; games: LiveGame[] }[] = [];
  for (const g of sorted) {
    const time = viennaTime(g.kickoff);
    const last = groups[groups.length - 1];
    if (last && last.time === time) last.games.push(g);
    else groups.push({ time, games: [g] });
  }

  const liveCount = day.games.filter((g) => isLiveRunning(g.status)).length;

  return (
    <div className="flex flex-col gap-4">
      {liveCount > 0 && <ElLiveHeader count={liveCount} dataAt={day.gamesAt} />}
      {groups.map((group) => {
        const running = now !== null && group.games.some((g) => isLiveRunning(g.status));
        return (
          <div key={group.time}>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
              Anstoß {group.time} Uhr
              {/* (Rene, 15.10.2026: kein Rot mehr in der Überschrift – ruhiger) */}
              {running && <span className="text-ink/70">· läuft</span>}
            </p>
            <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
              {group.games.map((g) => (
                <ElGameCard key={g.id} game={g} dataAt={day.gamesAt} />
              ))}
            </div>
          </div>
        );
      })}
      {polling && day.loading && <p className="text-center text-[11px] text-muted">Aktualisiert…</p>}
    </div>
  );
}

// Kopf des Livestands: "● 8 Spiele live · aktualisiert vor 1 Min.", Zeit
// zählt mit (Rene, 15.10.2026: Live-Gefühl).
function ElLiveHeader({ count, dataAt }: { count: number; dataAt: number }) {
  const now = useMinuteTick(dataAt || null);
  return (
    <p className="flex items-center justify-center gap-1.5 text-xs text-muted" aria-live="polite">
      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 animate-live-dot" />
      <span className="font-semibold text-ink">
        {count} {count === 1 ? "Spiel" : "Spiele"} live
      </span>
      {now !== null && dataAt > 0 && <span>· {updatedAgoText(dataAt, now)}</span>}
    </p>
  );
}

function ElResults({
  today,
  todayDay,
  yesterdayDay,
  onRetry,
}: {
  today: string | null;
  todayDay: ElDay;
  yesterdayDay: ElDay;
  onRetry: () => void;
}) {
  if (!todayDay.games || !yesterdayDay.games) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const finished = [...todayDay.games, ...yesterdayDay.games]
    .filter((g) => isLiveFinished(g.status))
    .sort((a, b) => new Date(b.kickoff).getTime() - new Date(a.kickoff).getTime() || a.home.localeCompare(b.home));
  if (finished.length === 0) {
    const error = todayDay.error ?? yesterdayDay.error;
    if (error) return <ElError error={error} onRetry={onRetry} />;
    return (
      <EmptyState
        emoji="⚽"
        title="Noch keine Ergebnisse"
        text="Von gestern und heute gibt es noch keine beendeten Europa-League-Spiele."
        className="border-none bg-transparent"
      />
    );
  }
  return (
    <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
      {finished.map((g) => (
        <ElGameCard
          key={g.id}
          game={g}
          dateLabel={`${viennaDate(g.kickoff) === today ? "Heute" : "Gestern"}, ${viennaTime(g.kickoff)} Uhr`}
        />
      ))}
    </div>
  );
}

const OTHER_STATUS: Record<string, string> = {
  PST: "Verschoben",
  CANC: "Abgesagt",
  ABD: "Abgebrochen",
  SUSP: "Unterbrochen",
  INT: "Unterbrochen",
  AWD: "Gewertet",
  WO: "Kampflos",
};

function elStatus(g: LiveGame): { live: boolean; text: string } {
  if (g.status === "HT") return { live: true, text: "Halbzeit" };
  if (isLiveRunning(g.status)) return { live: true, text: g.statusText || "Live" };
  // (Rene, 15.10.2026: nicht begonnen nur noch die Anstoßzeit, grau)
  if (g.status === "NS") return { live: false, text: viennaTime(g.kickoff) };
  if (g.status === "AET") return { live: false, text: "Beendet · n. V." };
  if (g.status === "PEN") {
    const pen = g.penaltyHome !== undefined && g.penaltyAway !== undefined ? ` ${g.penaltyHome}:${g.penaltyAway}` : "";
    return { live: false, text: `Beendet · n. E.${pen}` };
  }
  if (g.status === "FT") return { live: false, text: "Beendet" };
  return { live: false, text: OTHER_STATUS[g.statusShort.toUpperCase()] ?? "—" };
}

// Tor-Hervorhebung (Rene, 15.10.2026): letzter bekannter Stand pro Spiel-ID.
// Liegt außerhalb der Komponente, damit er auch einen Reiterwechsel
// (Livestand ↔ Ergebnisse) übersteht. Ändert sich der Stand gegenüber dem
// letzten Abruf, leuchtet das Ergebnis ~8 s golden auf.
const EL_GOAL_FLASH_MS = 8000;
const elLastScore = new Map<string, string>();

function useGoalFlash(id: string, score: string | null): boolean {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (score === null) return;
    const prev = elLastScore.get(id);
    elLastScore.set(id, score);
    if (prev === undefined || prev === score) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), EL_GOAL_FLASH_MS);
    return () => clearTimeout(t);
  }, [id, score]);
  return flash;
}

// Ein Spiel: Heim – Stand – Gast, darunter Minute/Status.
// (Rene, 15.10.2026: ruhiger Stil wie Sofascore – neutrale Kachel, Stand
// weiß/fett, Rot nur noch als kleiner Punkt vor der Minute.)
// (Rene, 15.10.2026: Live-Gefühl) Laufend: "● LIVE 18'" mit pulsierendem
// Punkt, Minute zählt im Browser mit, unten ein dünner roter Balken
// (Minute/90, Halbzeit 50 %). Kein roter Rahmen.
function ElGameCard({ game, dateLabel, dataAt = 0 }: { game: LiveGame; dateLabel?: string; dataAt?: number }) {
  const { live, text: apiText } = elStatus(game);
  const clock = useLiveClock(EL_SPORT, game.statusShort, game.elapsed, dataAt);
  const running = live && game.status === "LIVE";
  const text = live && clock ? clock.text : apiText;
  const progress = live ? (clock?.progress ?? (game.status === "HT" ? 0.5 : running ? 1 : null)) : null;
  const hasScore = game.homeScore !== null && game.awayScore !== null && game.status !== "NS";
  const flash = useGoalFlash(game.id, hasScore ? `${game.homeScore}:${game.awayScore}` : null);
  return (
    // (Rene, 15.10.2026: Rahmen eine Spur heller als border-edge, damit man die
    // Kacheln besser sieht – neutral, gleich für alle Spielzustände.)
    <div className="relative overflow-hidden rounded-card border border-muted/25 bg-surface px-3 py-2.5 sm:px-4">
      {dateLabel && <p className="mb-1 text-xs text-muted">{dateLabel}</p>}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-sm">
        <FitText text={game.home} className="text-right leading-tight text-ink" />
        <span
          className={`min-w-[3.25rem] rounded-md px-1.5 py-0.5 text-center font-display text-base font-bold tabular-nums transition-colors duration-700 ${
            flash ? "bg-gold/15 text-gold" : hasScore ? "bg-transparent text-ink" : "bg-transparent text-muted"
          }`}
        >
          {hasScore ? `${game.homeScore} : ${game.awayScore}` : "– : –"}
        </span>
        <FitText text={game.away} className="leading-tight text-ink" />
      </div>
      <p className={`mt-1 text-center text-xs tabular-nums ${live ? "font-semibold text-ink" : "text-muted"}`}>
        {live ? (
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 shrink-0 rounded-full bg-red-500 ${running ? "animate-live-dot" : ""}`}
            />
            {running ? (
              <span className="text-[10px] font-bold tracking-wide text-red-400">LIVE</span>
            ) : (
              <span className="sr-only">Live: </span>
            )}
            <span className="text-ink">{text}</span>
          </span>
        ) : (
          text
        )}
      </p>
      {progress !== null && (
        <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] bg-edge/40">
          <span
            className="block h-full rounded-full bg-red-500 transition-[width] duration-700"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </span>
      )}
    </div>
  );
}
