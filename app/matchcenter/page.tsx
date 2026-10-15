"use client";

import EmptyState from "@/components/EmptyState";
import { useEffect, useMemo, useRef, useState } from "react";
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
  appSideEvents,
  findLiveGame,
  isLiveFinished,
  isLiveRunning,
  scorerLine,
  updatedAgoText,
  viennaDate,
  type LiveGame,
  type LiveMatchResult,
} from "@/lib/liveScores";
import { reloadLiveDay, useLiveDay, useLivePolling } from "@/lib/useLiveScores";
import { LIVE_SPORTS } from "@/lib/liveConfig";
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";
import { useLiveForecast } from "@/lib/liveForecast";
import { useAppData } from "@/lib/AppDataContext";
import { classifyRankingTip, RANKING_POINTS } from "@/lib/poolScore";
import { competitionFlag } from "@/lib/competitionFlag";
import { displayOrder, scoreText, type TeamOrder } from "@/lib/teamOrder";
import type { Match, Sport, Team } from "@/lib/types";
import TeamBadge, { matchJerseyProps } from "@/components/TeamBadge";
import CommentThread from "@/components/CommentThread";
import Emoji from "@/components/Emoji";
import { CommunityTrend } from "@/components/MatchCard";
import { useBeginnerShieldLeft } from "@/components/BeginnerShieldHint";
import {
  EventTimeline,
  LivePill,
  LiveTipLine,
  ProgressBar,
  Scoreboard,
  StateDot,
  signedPoints,
  useBoardClock,
  type BoardSide,
} from "@/components/LiveMatch";

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

      {/* Live-Bereich mit Detail (Rene, 15.10.2026: Spieltag-Umbau), nur die
          in lib/liveConfig.ts eingeschalteten Ligen (zum Testen Europa League). */}
      {LIVE_SPORT && <LiveCenterSection sport={LIVE_SPORT} />}

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
// Live-Bereich (Rene, 15.10.2026: Spieltag-Umbau, vorher nur "UEFA Europa
// League"). Live-Daten von API-Sports über /api/live, aus demselben Speicher
// wie die Tippkarten (lib/useLiveScores.ts). Nur eingeschaltete Ligen laut
// lib/liveConfig.ts (die Route filtert schon). Im Gratis-Plan gibt es nur
// gestern/heute/morgen und keine Tabellen – "Ergebnisse" deshalb von heute
// und gestern, bei "Tabelle" nur ein Hinweis ohne Abfrage.
//
// Am PC zweispaltig: links die Liste, rechts (~360 px) das Detail des
// gewählten Spiels. Am Handy steht das Detail unter der Liste, beim
// Antippen wird dorthin gescrollt. Standardmäßig ist das erste getippte
// laufende Spiel gewählt.

// Erste eingeschaltete Sportart (derzeit nur Fußball).
const LIVE_SPORT: Sport | null = LIVE_SPORTS[0] ?? null;
const MAX_LIVE_MS = 4 * 60 * 60 * 1000;

type LcView = "live" | "ergebnisse" | "tabelle";

// API-Spiel ↔ App-Spiel (für "GETIPPT", "Dein Tipp", Community, Kommentare).
interface AppLink {
  match: Match;
  home: Team;
  away: Team;
  result: LiveMatchResult;
}

// "2026-10-15" -> "2026-10-14"
function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

function viennaTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" });
}

// league der Route ist "Name · Land".
function leagueName(g: LiveGame): string {
  return g.league.split(" · ")[0] || "Weitere Spiele";
}

// Läuft das Spiel (oder müsste es laut Anstoß gleich/gerade laufen)?
function needsPolling(g: LiveGame, now: number): boolean {
  if (isLiveRunning(g.status)) return true;
  if (g.status !== "NS") return false;
  const kickoff = new Date(g.kickoff).getTime();
  return now >= kickoff && now - kickoff < MAX_LIVE_MS;
}

const byKickoff = (a: LiveGame, b: LiveGame) =>
  new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime() || a.home.localeCompare(b.home);

function LiveCenterSection({ sport }: { sport: Sport }) {
  const [view, setView] = useState<LcView>("live");
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hat der Spieler selbst gewählt? Dann nichts mehr automatisch wählen.
  const pickedRef = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const { matches, getTeam, myTips } = useAppData();

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
  // Heute immer, gestern erst mit "Ergebnisse" (1 h Cache auf dem Server).
  const todayDay = useLiveDay(sport, today);
  const yesterdayDay = useLiveDay(sport, view === "ergebnisse" ? yesterday : null);

  // Automatisch aktualisieren – nur solange ein Spiel läuft, im 180-s-Takt
  // (gemeinsam mit den Tippkarten, pausiert im Hintergrund).
  const polling = now !== null && !!todayDay.games && todayDay.games.some((g) => needsPolling(g, now));
  useLivePolling(sport, today, polling);

  const retry = () => {
    if (today) reloadLiveDay(sport, today);
    if (view === "ergebnisse" && yesterday) reloadLiveDay(sport, yesterday);
  };

  // App-Spiele den API-Spielen zuordnen (gleiche Zuordnung wie die Tippkarten).
  const allGames = useMemo(
    () => [...(todayDay.games ?? []), ...(yesterdayDay.games ?? [])],
    [todayDay.games, yesterdayDay.games],
  );
  const links = useMemo(() => {
    const map = new Map<string, AppLink>();
    if (allGames.length === 0) return map;
    for (const m of matches) {
      if (m.sport !== sport || m.draft || m.status === "cancelled") continue;
      const day = viennaDate(m.kickoff);
      if (day !== today && day !== yesterday) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const result = findLiveGame(allGames, m.kickoff, home.name, away.name);
      if (result && !map.has(result.game.id)) map.set(result.game.id, { match: m, home, away, result });
    }
    return map;
  }, [allGames, matches, getTeam, sport, today, yesterday]);
  const tippedMatchIds = useMemo(
    () => new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId)),
    [myTips],
  );
  const isTipped = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && tippedMatchIds.has(link.match.id);
  };

  // Standard: erstes getipptes laufendes Spiel.
  useEffect(() => {
    if (pickedRef.current || selectedId || !todayDay.games) return;
    const first = todayDay.games
      .filter((g) => isLiveRunning(g.status))
      .sort(byKickoff)
      .find((g) => isTipped(g));
    if (first) setSelectedId(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDay.games, links, tippedMatchIds, selectedId]);

  function select(id: string) {
    pickedRef.current = true;
    setSelectedId(id);
    // Am Handy steht das Detail unter der Liste: dorthin scrollen.
    if (typeof window !== "undefined" && !window.matchMedia("(min-width: 1024px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }

  const selected = selectedId ? allGames.find((g) => g.id === selectedId) ?? null : null;
  const listProps = { links, isTipped, selectedId, onSelect: select };

  return (
    <section className="mb-6 rounded-card border border-edge bg-surface px-3 pt-3 pb-4 sm:px-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-base font-bold text-ink sm:text-lg">Live-Spiele</h2>
        <span className="shrink-0 rounded-full border border-edge px-2 py-0.5 text-[11px] font-semibold text-muted">
          Test
        </span>
      </div>

      <div className="mb-4 flex gap-4 border-b border-edge">
        <SubTab label="Live" active={view === "live"} onClick={() => setView("live")} />
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
      </div>

      {view === "tabelle" ? (
        <EmptyState
          emoji="📊"
          title="Die Tabelle kommt mit dem größeren Datenpaket."
          text="Im aktuellen Datenpaket gibt es noch keine Tabelle. Live und Ergebnisse funktionieren schon."
          className="border-none bg-transparent"
        />
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="min-w-0">
            {view === "live" ? (
              <LcLive games={todayDay.games} error={todayDay.error} dataAt={todayDay.dataAt} loading={polling && todayDay.loading} onRetry={retry} {...listProps} />
            ) : (
              <LcResults
                today={today}
                todayGames={todayDay.games}
                yesterdayGames={yesterdayDay.games}
                error={todayDay.error ?? yesterdayDay.error}
                onRetry={retry}
                {...listProps}
              />
            )}
          </div>
          <div ref={detailRef} className="scroll-mt-32">
            {selected ? (
              <LcDetail
                key={selected.id}
                sport={sport}
                game={selected}
                link={links.get(selected.id) ?? null}
                dataAt={todayDay.games?.some((g) => g.id === selected.id) ? todayDay.dataAt : 0}
              />
            ) : (
              <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
                Spiel antippen, um Spielverlauf, Tipps und Kommentare zu sehen.
              </p>
            )}
          </div>
        </div>
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

interface ListProps {
  links: Map<string, AppLink>;
  isTipped: (g: LiveGame) => boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function LcError({ error, onRetry }: { error: string; onRetry: () => void }) {
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

// Überschrift einer Liga mit Flagge (falls es eine passende gibt).
function LeagueHeading({ sport, name }: { sport: Sport; name: string }) {
  const { competitions } = useAppData();
  const flag = competitionFlag(sport, name, competitions);
  return (
    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted">
      {flag && (
        <span aria-hidden>
          <Emoji e={flag} />
        </span>
      )}
      {name}
    </p>
  );
}

function groupByLeague(games: LiveGame[]): { league: string; games: LiveGame[] }[] {
  const groups = new Map<string, LiveGame[]>();
  for (const g of games) {
    const name = leagueName(g);
    groups.set(name, [...(groups.get(name) ?? []), g]);
  }
  return Array.from(groups, ([league, list]) => ({ league, games: list }));
}

function LcLive({
  games,
  error,
  dataAt,
  loading,
  onRetry,
  ...list
}: ListProps & { games: LiveGame[] | null; error: string | null; dataAt: number; loading: boolean; onRetry: () => void }) {
  if (!games) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  if (error) return <LcError error={error} onRetry={onRetry} />;
  if (games.length === 0) {
    return (
      <EmptyState
        emoji="⚽"
        title="Heute keine Spiele"
        text="Sobald wieder gespielt wird, siehst du hier alle Spiele live."
        className="border-none bg-transparent"
      />
    );
  }
  // Laufende zuerst, dann beendete – je Liga; nicht begonnene nach Anstoßzeit ("ab 21:00").
  const started = games
    .filter((g) => g.status !== "NS")
    .sort((a, b) => Number(isLiveRunning(b.status)) - Number(isLiveRunning(a.status)) || byKickoff(a, b));
  const upcoming = games.filter((g) => g.status === "NS").sort(byKickoff);
  const upcomingGroups: { time: string; games: LiveGame[] }[] = [];
  for (const g of upcoming) {
    const time = viennaTime(g.kickoff);
    const last = upcomingGroups[upcomingGroups.length - 1];
    if (last && last.time === time) last.games.push(g);
    else upcomingGroups.push({ time, games: [g] });
  }
  const liveCount = games.filter((g) => isLiveRunning(g.status)).length;
  const sport = LIVE_SPORT ?? "Fußball";

  return (
    <div className="flex flex-col gap-4">
      {liveCount > 0 && <LcLiveHeader count={liveCount} dataAt={dataAt} />}
      {groupByLeague(started).map((group) => (
        <div key={group.league}>
          <LeagueHeading sport={sport} name={group.league} />
          <div className="flex flex-col gap-2">
            {group.games.map((g) => (
              <GameRow key={g.id} game={g} dataAt={dataAt} {...list} />
            ))}
          </div>
        </div>
      ))}
      {upcomingGroups.map((group) => (
        <div key={group.time}>
          <p className="mb-2 text-xs font-semibold text-muted">ab {group.time}</p>
          <div className="flex flex-col gap-2">
            {group.games.map((g) => (
              <GameRow key={g.id} game={g} dataAt={dataAt} {...list} />
            ))}
          </div>
        </div>
      ))}
      {loading && <p className="text-center text-[11px] text-muted">Aktualisiert…</p>}
    </div>
  );
}

// Kopf: "● 8 Spiele live · aktualisiert vor 1 Min.", Zeit zählt mit.
function LcLiveHeader({ count, dataAt }: { count: number; dataAt: number }) {
  const now = useMinuteTick(dataAt || null);
  return (
    <p className="flex items-center gap-1.5 text-xs text-muted" aria-live="polite">
      <StateDot state="live" />
      <span className="font-semibold text-ink">
        {count} {count === 1 ? "Spiel" : "Spiele"} live
      </span>
      {now !== null && dataAt > 0 && <span>· {updatedAgoText(dataAt, now)}</span>}
    </p>
  );
}

function LcResults({
  today,
  todayGames,
  yesterdayGames,
  error,
  onRetry,
  ...list
}: ListProps & {
  today: string | null;
  todayGames: LiveGame[] | null;
  yesterdayGames: LiveGame[] | null;
  error: string | null;
  onRetry: () => void;
}) {
  if (!todayGames || !yesterdayGames) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const finished = [...todayGames, ...yesterdayGames]
    .filter((g) => isLiveFinished(g.status))
    .sort((a, b) => byKickoff(b, a));
  if (finished.length === 0) {
    if (error) return <LcError error={error} onRetry={onRetry} />;
    return (
      <EmptyState
        emoji="⚽"
        title="Noch keine Ergebnisse"
        text="Von gestern und heute gibt es noch keine beendeten Spiele."
        className="border-none bg-transparent"
      />
    );
  }
  const days = [
    { label: "Heute", games: finished.filter((g) => viennaDate(g.kickoff) === today) },
    { label: "Gestern", games: finished.filter((g) => viennaDate(g.kickoff) !== today) },
  ].filter((d) => d.games.length > 0);
  return (
    <div className="flex flex-col gap-4">
      {days.map((day) => (
        <div key={day.label}>
          <p className="mb-2 text-xs font-semibold text-muted">{day.label}</p>
          <div className="flex flex-col gap-2">
            {day.games.map((g) => (
              <GameRow key={g.id} game={g} {...list} />
            ))}
          </div>
        </div>
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

// Tor-Hervorhebung (Rene, 15.10.2026): letzter bekannter Stand pro Spiel-ID.
// Liegt außerhalb der Komponente, damit er auch einen Reiterwechsel
// übersteht. Ändert sich der Stand gegenüber dem letzten Abruf, leuchten die
// Tore ~8 s golden auf.
const GOAL_FLASH_MS = 8000;
const lastScore = new Map<string, string>();

function useGoalFlash(id: string, score: string | null): boolean {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (score === null) return;
    const prev = lastScore.get(id);
    lastScore.set(id, score);
    if (prev === undefined || prev === score) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), GOAL_FLASH_MS);
    return () => clearTimeout(t);
  }, [id, score]);
  return flash;
}

// Eine Zeile (Rene, 15.10.2026: Spieltag-Umbau): links Status ("● 44'" mit
// pulsierendem Punkt, "Halbzeit", "21:00", "Beendet"), Mitte Heim und Gast
// untereinander, rechts die Tore untereinander, unten ein dünner Balken
// (Minute/90). Oben rechts "GETIPPT" in Gold, gewählte Zeile mit Gold-Rand.
// Rahmen eine Spur heller als border-edge, neutral für alle Zustände.
function GameRow({ game, dataAt = 0, links, isTipped, selectedId, onSelect }: ListProps & { game: LiveGame; dataAt?: number }) {
  const sport = LIVE_SPORT ?? "Fußball";
  const clock = useLiveClock(sport, game.statusShort, game.elapsed, dataAt);
  const running = isLiveRunning(game.status);
  const pause = game.status === "HT" || game.status === "BREAK";
  const hasScore = game.homeScore !== null && game.awayScore !== null && game.status !== "NS";
  const flash = useGoalFlash(game.id, hasScore ? `${game.homeScore}:${game.awayScore}` : null);
  const tipped = isTipped(game);
  const selected = selectedId === game.id;
  const link = links.get(game.id);
  // Mit App-Spiel: Namen wie in der App (gleiche Schreibweise wie auf der Tippkarte).
  const homeName = link ? (link.result.swapped ? link.away.name : link.home.name) : game.home;
  const awayName = link ? (link.result.swapped ? link.home.name : link.away.name) : game.away;

  let status: React.ReactNode;
  if (running && !pause) {
    status = (
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
        <StateDot state="live" />
        {clock?.text ?? (game.statusText || "Live")}
      </span>
    );
  } else if (pause) {
    status = (
      <span className="inline-flex items-center gap-1.5 text-ink">
        <StateDot state="pause" />
        {game.status === "HT" ? "Halbzeit" : game.statusText || "Pause"}
      </span>
    );
  } else if (game.status === "NS") {
    status = viennaTime(game.kickoff);
  } else if (isLiveFinished(game.status)) {
    status = game.status === "AET" ? "n. V." : game.status === "PEN" ? "n. E." : "Beendet";
  } else {
    status = OTHER_STATUS[game.statusShort.toUpperCase()] ?? "—";
  }
  const progress = running ? (clock?.progress ?? (game.status === "HT" ? 0.5 : null)) : null;

  return (
    <button
      type="button"
      onClick={() => onSelect(game.id)}
      aria-pressed={selected}
      className={`relative w-full overflow-hidden rounded-card border bg-surface pl-3 pr-3 pb-2.5 pt-3 text-left transition-colors sm:pl-4 ${
        selected ? "border-gold" : "border-muted/25 hover:border-muted/50"
      }`}
    >
      {tipped && (
        <span className="absolute right-3 top-1 text-[9px] font-bold uppercase tracking-wider text-gold">Getippt</span>
      )}
      <div className="grid grid-cols-[4.25rem_minmax(0,1fr)_auto] items-center gap-2 text-sm">
        <span className="text-xs tabular-nums text-muted">{status}</span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <FitText text={homeName} className="leading-tight text-ink" />
          <FitText text={awayName} className="leading-tight text-ink" />
        </span>
        <span
          className={`flex min-w-[1.75rem] flex-col items-end gap-0.5 rounded-md px-1 font-display font-bold leading-tight tabular-nums transition-colors duration-700 ${
            flash ? "bg-gold/15 text-gold" : hasScore ? "text-ink" : "text-muted"
          }`}
        >
          <span>{hasScore ? game.homeScore : "–"}</span>
          <span>{hasScore ? game.awayScore : "–"}</span>
        </span>
      </div>
      {progress !== null && <ProgressBar progress={progress} className="absolute inset-x-0 bottom-0" />}
    </button>
  );
}

// Detail rechts: Liga + Pill, Anzeigetafel (dieselbe wie auf der Tippkarte),
// "Dein Tipp", Spielverlauf, Community, Kommentare.
function LcDetail({ sport, game, link, dataAt }: { sport: Sport; game: LiveGame; link: AppLink | null; dataAt: number }) {
  const { myTips, orderFor, tipTendencies, competitions } = useAppData();
  const shieldLeft = useBeginnerShieldLeft();
  const started = game.status !== "NS" && game.homeScore !== null && game.awayScore !== null;
  const liveLike = started && (isLiveRunning(game.status) || isLiveFinished(game.status));
  const clock = useBoardClock(sport, liveLike ? { ...game, dataAt } : null);
  const match = link?.match ?? null;
  const tip = match ? myTips.find((t) => t.matchId === match.id && !t.refunded) ?? null : null;
  const order: TeamOrder = match ? orderFor(match) : { sport, awayFirst: false };
  const awayFirst = !!order.awayFirst;

  // Alles in App-Heim/-Gast (Seiten der API ggf. gedreht).
  const appHome = link ? link.home.name : game.home;
  const appAway = link ? link.away.name : game.away;
  const homeScore = link ? link.result.homeScore : game.homeScore;
  const awayScore = link ? link.result.awayScore : game.awayScore;
  const events = link ? appSideEvents(link.result) : game.events ?? [];
  const leftSide: "home" | "away" = awayFirst ? "away" : "home";
  const rightSide: "home" | "away" = awayFirst ? "home" : "away";
  const side = (s: "home" | "away"): BoardSide => {
    const team = link ? (s === "home" ? link.home : link.away) : null;
    return {
      name: s === "home" ? appHome : appAway,
      badge:
        team && match ? (
          <TeamBadge
            sport={match.sport}
            {...matchJerseyProps(match, team)}
            isNationalTeam={team.isNationalTeam}
            countryCode={team.countryCode}
            size={34}
          />
        ) : undefined,
      scorers: scorerLine(events, s),
    };
  };

  const appFinal = !!match && match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null;
  const pending = !!tip && !tip.evaluated && started && homeScore !== null && awayScore !== null;
  const isOneXTwo = match?.tipMode === "1x2";
  const tier = pending ? classifyRankingTip(tip!.predictedHomeScore, tip!.predictedAwayScore, homeScore!, awayScore!, isOneXTwo) : null;
  const points = tier ? (shieldLeft > 0 ? Math.max(0, RANKING_POINTS[tier]) : RANKING_POINTS[tier]) : 0;
  const forecast = useLiveForecast(sport, pending && isLiveRunning(game.status));
  const tipText = (() => {
    if (!tip || !match || !link) return "";
    if (!isOneXTwo) return scoreText(order, tip.predictedHomeScore, tip.predictedAwayScore);
    const d = Math.sign(tip.predictedHomeScore - tip.predictedAwayScore);
    return d > 0 ? link.home.name : d < 0 ? link.away.name : "Unentschieden";
  })();
  const tendency = match ? tipTendencies[match.id] : undefined;
  const flag = competitionFlag(sport, leagueName(game), competitions);
  const [leftKick, rightKick] = displayOrder(order, appHome, appAway);

  return (
    <div className="flex flex-col gap-4 rounded-card border border-muted/25 bg-pitch/40 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
          {flag && (
            <span aria-hidden>
              <Emoji e={flag} />
            </span>
          )}
          <span className="min-w-0 truncate">{leagueName(game)}</span>
        </span>
        {liveLike && (
          <span className="shrink-0">
            <LivePill state={clock.state} pauseText={game.status === "HT" ? "Halbzeit" : game.statusText || "Pause"} />
          </span>
        )}
      </div>

      {liveLike && homeScore !== null && awayScore !== null ? (
        <Scoreboard
          left={side(leftSide)}
          right={side(rightSide)}
          leftScore={leftSide === "home" ? homeScore : awayScore}
          rightScore={rightSide === "home" ? homeScore : awayScore}
          clock={clock}
        />
      ) : (
        <div className="rounded-lg border border-edge bg-pitch/60 px-3 py-4 text-center">
          <p className="font-display text-sm font-semibold text-ink">
            {leftKick} – {rightKick}
          </p>
          <p className="mt-1 text-xs text-muted">
            {game.status === "NS" ? `Anstoß ${viennaTime(game.kickoff)} Uhr` : OTHER_STATUS[game.statusShort.toUpperCase()] ?? "—"}
          </p>
        </div>
      )}

      {pending && tier && (
        <LiveTipLine
          tipText={tipText}
          tier={tier}
          points={points}
          isOneXTwo={isOneXTwo}
          finished={!isLiveRunning(game.status)}
          forecast={forecast}
        />
      )}
      {tip && tip.evaluated && appFinal && (
        <p className="rounded-lg border border-edge bg-pitch px-3 py-2 text-[13px] text-muted">
          Dein Tipp: <span className="font-semibold text-ink">{tipText}</span>
          {tip.rangDelta !== undefined && (
            <span className={tip.rangDelta > 0 ? "text-gold" : ""}> · {signedPoints(tip.rangDelta)} Rangpunkte</span>
          )}
        </p>
      )}
      {tip && !tip.evaluated && !started && (
        <p className="rounded-lg border border-gold/40 bg-gold/5 px-3 py-2 text-[13px] text-muted">
          Dein Tipp: <span className="font-semibold text-gold">{tipText}</span>
        </p>
      )}

      {liveLike && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Spielverlauf</p>
          <EventTimeline events={events} leftSide={leftSide} />
        </div>
      )}

      {match && tendency && started && (
        <CommunityTrend
          tendency={tendency}
          sport={match.sport}
          order={order}
          homeName={link!.home.name}
          awayName={link!.away.name}
          finalScore={appFinal ? { home: match.liveHomeScore!, away: match.liveAwayScore! } : null}
          myTip={tip ? { home: tip.predictedHomeScore, away: tip.predictedAwayScore } : null}
        />
      )}

      {match && (
        <div className="border-t border-edge pt-3">
          <CommentThread threadId={match.id} />
        </div>
      )}
    </div>
  );
}
