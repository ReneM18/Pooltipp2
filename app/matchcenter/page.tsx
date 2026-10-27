"use client";

import EmptyState from "@/components/EmptyState";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  fetchRecentResults,
  fetchStandings,
  getCurrentSeason,
  LEAGUE_IDS,
  LEAGUE_SPORTS,
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
  isLiveDelayed,
  updatedAgoText,
  viennaDate,
  type LiveGame,
  type LiveSource,
  type LiveMatchResult,
} from "@/lib/liveScores";
import { reloadLiveDay, useLiveDay, useLivePolling } from "@/lib/useLiveScores";
import { LIVE_SPORTS, liveGameCountry, liveGameLeague } from "@/lib/liveConfig";
import { liveIntervalSeconds } from "@/lib/liveScores";
import { flagEmoji } from "@/lib/flags";
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";
import { useLiveForecast } from "@/lib/liveForecast";
import { friendsRowTable, useFriendsLive } from "@/lib/friendsLive";
import { FriendsLivePanel, FriendsLiveRow, FriendsLiveSheet } from "@/components/FriendsLive";
import { useAppData } from "@/lib/AppDataContext";
import { classifyRankingTip, RANKING_POINTS } from "@/lib/poolScore";
import { competitionFlag } from "@/lib/competitionFlag";
import { displayOrder, scoreText, type TeamOrder } from "@/lib/teamOrder";
import { SPORT_ICONS, isSportActive, sportLabel, type Match, type Sport, type Team } from "@/lib/types";
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
import { liveTipLabel } from "@/lib/liveTipText";
import { appTeamName } from "@/lib/teamApiNames";
import { isMatchTippable, tipCardHref } from "@/lib/matchcenterLink";
import Link from "next/link";
import { useStartExperience } from "@/lib/useStartExperience";

// Eigene Vereinsnamen statt API-Namen (Rene, 27.10.2026, lib/teamApiNames.ts).
function useApiTeamName(sport: Sport | undefined): (apiName: string) => string {
  const { teams, apiNameLinks } = useAppData();
  return useMemo(
    () => (apiName: string) => (sport ? appTeamName(teams, apiNameLinks, sport, apiName) : apiName),
    [teams, apiNameLinks, sport],
  );
}

const LEAGUES = Object.keys(LEAGUE_IDS);

// Saison automatisch aus dem heutigen Datum (lib/sportsApi.ts).
const CURRENT_SEASON = getCurrentSeason();

export default function MatchcenterPage() {
  // Neue Spieler: einmal zum Start-Erlebnis (das Matchcenter ist Startseite).
  useStartExperience();
  const [league, setLeague] = useState(LEAGUES[0]);
  const [view, setView] = useState<"ergebnisse" | "tabelle">("tabelle");
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const teamName = useApiTeamName(LEAGUE_SPORTS[league]);

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

      <TodayTipsBox />

      {/* Live-Bereich mit Detail (Rene, 15.10.2026: Spieltag-Umbau), nur die
          in lib/liveConfig.ts eingeschalteten Ligen (zum Testen Europa League). */}
      {LIVE_SPORT && <LiveCenter />}

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
              <FitText text={teamName(row.teamName)} className="leading-tight text-ink" />
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
                <FitText text={teamName(r.homeTeam)} className="leading-tight text-ink" />
                <span className="font-display font-semibold text-ink">{r.homeScore}</span>
                <FitText text={teamName(r.awayTeam)} className="leading-tight text-ink" />
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

function SubTab({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative whitespace-nowrap py-2.5 font-display text-sm font-semibold transition-colors ${
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

// Erste eingeschaltete Sportart (Fußball). Seit 16.10.2026 auch Eishockey:
// bei mehreren Sportarten oben ein Umschalter (Rene, 16.10.2026).
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
// Name des Bewerbs: unser Name, wenn die Liga eingestellt ist (z. B. "Cup"
// aus Österreich → "ÖFB-Cup", Rene, 27.10.2026), sonst der Name der API.
function leagueName(g: LiveGame, sport: Sport): string {
  return liveGameLeague(sport, g.league)?.label ?? (g.league.split(" · ")[0] || "Weitere Spiele");
}

// Flagge einer Live-Liga (Rene, 16.10.2026): aus dem Land der API, damit
// die österreichische und die deutsche "Bundesliga" auseinanderzuhalten
// sind ("World" = international, keine Flagge). Ohne Land wie bisher nach Name.
function liveLeagueFlag(sport: Sport, g: LiveGame, competitions: Parameters<typeof competitionFlag>[2]): string | null {
  if (!g.league.includes(" · ")) return competitionFlag(sport, leagueName(g, sport), competitions);
  const country = liveGameCountry(g.league);
  return country ? flagEmoji(country) : null;
}

// Oben: "Heute N Tippspiele" mit Sprung zur Tipps-Seite (Rene, 27.10.2026).
// Alle Sportarten, nur Spiele mit Anstoß heute (Wiener Zeit). Ohne
// Tippspiele heute stehen die nächsten Tippspiele da (NextTipsBox).
function TodayTipsBox() {
  const { matches, getTeam, myTips, contentLoaded, orderFor } = useAppData();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  // Erst mit den echten Spielen (vorher stehen Demo-Spiele im Speicher).
  if (now === null || !contentLoaded) return null;
  const today = viennaDate(now);
  const list = matches.filter(
    (m) =>
      !m.draft &&
      m.status !== "cancelled" &&
      isSportActive(m.sport) &&
      viennaDate(m.kickoff) === today &&
      !!getTeam(m.homeTeamId) &&
      !!getTeam(m.awayTeamId),
  );
  const tipped = new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId));
  if (list.length === 0) {
    const next = matches
      .filter(
        (m) =>
          !m.draft &&
          m.status !== "cancelled" &&
          isSportActive(m.sport) &&
          isMatchTippable(m, now) &&
          !!getTeam(m.homeTeamId) &&
          !!getTeam(m.awayTeamId),
      )
      .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime())
      .slice(0, 3);
    if (next.length === 0) return null;
    return (
      <section className="mb-4 rounded-card border border-gold/40 bg-gold/5 px-3 py-2.5 sm:px-4">
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-ink">Deine nächsten Tippspiele</h2>
          <Link href="/" className="shrink-0 text-xs font-semibold text-gold hover:opacity-80">
            Alle Tipps ›
          </Link>
        </div>
        <ul className="flex flex-col">
          {next.map((m) => {
            const [a, b] = displayOrder(orderFor(m), getTeam(m.homeTeamId)!, getTeam(m.awayTeamId)!);
            const when = new Date(m.kickoff).toLocaleString("de-AT", {
              weekday: "short",
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Europe/Vienna",
            });
            const done = tipped.has(m.id);
            return (
              <li key={m.id}>
                <Link
                  href={tipCardHref(m.id)}
                  className="flex min-h-11 items-center gap-2.5 border-t border-edge/60 py-1.5 text-sm first:border-t-0"
                >
                  <Emoji e={SPORT_ICONS[m.sport]} />
                  <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                    {a.name} – {b.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{when}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      done ? "bg-action/15 text-action" : "bg-gold/15 text-gold"
                    }`}
                  >
                    {done ? "✓ Getippt" : "Tippen"}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }
  const open = list.filter((m) => !tipped.has(m.id) && isMatchTippable(m, now)).length;
  const sports = Array.from(new Set(list.map((m) => m.sport)));
  return (
    <Link
      href="/"
      className="mb-4 flex items-center gap-3 rounded-card border border-gold/40 bg-gold/5 px-3 py-2.5 transition-colors hover:border-gold sm:px-4"
    >
      <span className="flex shrink-0 gap-0.5 text-lg" aria-hidden>
        {sports.map((s) => (
          <Emoji key={s} e={SPORT_ICONS[s]} />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-sm font-bold text-ink">
          Heute {list.length === 1 ? "1 Tippspiel" : `${list.length} Tippspiele`}
        </span>
        <span className="block text-xs text-muted">
          {open > 0 ? (
            <>
              <span className="font-semibold text-gold">{open} noch offen</span> · hier geht&apos;s zu den Tipps
            </>
          ) : (
            "Hier geht's zu deinen Tipps"
          )}
        </span>
      </span>
      <span className="shrink-0 font-display text-lg font-bold text-gold" aria-hidden>
        ›
      </span>
    </Link>
  );
}

// Mehrere Sportarten (Rene, 16.10.2026): Umschalter ⚽/🏒 über dem
// Live-Bereich; je Sportart eigener Bereich (key → Auswahl beginnt neu).
function LiveCenter() {
  const [sport, setSport] = useState<Sport>(LIVE_SPORT ?? "Fußball");
  // Von der Tippkarte (/matchcenter?spiel=<App-Spiel>, Rene, 27.10.2026):
  // Sportart des Spiels wählen und das Spiel öffnen.
  const { matches } = useAppData();
  const [targetId, setTargetId] = useState<string | null>(null);
  useEffect(() => {
    setTargetId(new URLSearchParams(window.location.search).get("spiel"));
  }, []);
  const target = targetId ? matches.find((m) => m.id === targetId) ?? null : null;
  useEffect(() => {
    if (target && LIVE_SPORTS.includes(target.sport)) setSport(target.sport);
  }, [target]);
  const pick = (s: Sport) => {
    setTargetId(null);
    setSport(s);
  };
  // Sportart in derselben Reihe wie die Reiter (Rene, 27.10.2026): ab md:
  // als Knöpfe (Namen ab lg:), am Handy als kleines Auswahlfeld, damit alles
  // in eine Reihe passt.
  const switcher =
    LIVE_SPORTS.length > 1 ? (
      <>
        <div className="hidden gap-1.5 md:flex" role="tablist" aria-label="Sportart">
          {LIVE_SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              onClick={() => pick(s)}
              className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold transition-colors ${
                sport === s ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
              }`}
            >
              <Emoji e={SPORT_ICONS[s]} /> <span className="hidden lg:inline">{sportLabel(s)}</span>
            </button>
          ))}
        </div>
        {/* Sichtbar nur das Zeichen der Sportart; das unsichtbare
            Auswahlfeld darüber öffnet die Liste mit Namen. */}
        <label className="relative flex items-center gap-1 rounded-full border border-gold bg-gold/10 px-2.5 py-1 text-[13px] font-semibold text-gold md:hidden">
          <Emoji e={SPORT_ICONS[sport]} />
          <span className="text-[9px]" aria-hidden>
            ▼
          </span>
          <select
            value={sport}
            onChange={(e) => pick(e.target.value as Sport)}
            aria-label="Sportart"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            {LIVE_SPORTS.map((s) => (
              <option key={s} value={s}>
                {SPORT_ICONS[s]} {sportLabel(s)}
              </option>
            ))}
          </select>
        </label>
      </>
    ) : null;
  return (
    <LiveCenterSection key={sport} sport={sport} switcher={switcher} target={target?.sport === sport ? target : null} />
  );
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

function LiveCenterSection({ sport, switcher, target }: { sport: Sport; switcher?: React.ReactNode; target: Match | null }) {
  const [view, setView] = useState<LcView>("live");
  // Reiter "Live" (Rene, 27.10.2026): nur laufende Spiele. "Heute" zeigt
  // alle von heute (laufend, später, beendet). Beides ist die Ansicht "live".
  const [onlyLive, setOnlyLive] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hat der Spieler selbst gewählt? Dann nichts mehr automatisch wählen.
  const pickedRef = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const { matches, getTeam, myTips, apiNameLinks } = useAppData();

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
    // apiNameLinks: verknüpfte Vereinsnamen zählen bei findLiveGame mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGames, matches, getTeam, sport, today, yesterday, apiNameLinks]);
  const tippedMatchIds = useMemo(
    () => new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId)),
    [myTips],
  );
  const isTipped = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && tippedMatchIds.has(link.match.id);
  };
  // Tippspiel, das man noch tippen kann (Rene, 27.10.2026: "Tippen").
  const canTip = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && now !== null && isMatchTippable(link.match, now);
  };

  // Von der Tippkarte: Spiel von gestern steht unter "Ergebnisse".
  const targetDay = target ? viennaDate(target.kickoff) : null;
  useEffect(() => {
    if (targetDay && yesterday && targetDay === yesterday) setView("ergebnisse");
  }, [targetDay, yesterday]);
  // ... und sobald es zugeordnet ist, auswählen.
  const targetDoneRef = useRef(false);
  const targetGameId = useMemo(
    () => (target ? Array.from(links).find(([, link]) => link.match.id === target.id)?.[0] ?? null : null),
    [links, target],
  );
  useEffect(() => {
    if (!targetGameId || targetDoneRef.current) return;
    targetDoneRef.current = true;
    select(targetGameId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetGameId]);
  // Daten da, aber das Spiel ist nicht dabei (anderer Tag, andere Liga).
  const targetMissing =
    !!target && !targetGameId && !!todayDay.games && (targetDay !== yesterday || !!yesterdayDay.games);

  // Standard: erstes getipptes laufendes Spiel.
  useEffect(() => {
    if (pickedRef.current || selectedId || !todayDay.games || target) return;
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
  const listProps = { sport, links, isTipped, canTip, selectedId, onSelect: select };

  // Freunde-Live (Rene, 16.10.2026: Freunde-Live): am PC rechts ein Reiter
  // "Freunde" neben dem Spiel-Detail, am Handy eine Zeile im Detail, die
  // die Tabelle als Bottom-Sheet öffnet. Nur eingeloggt und mit Freunden
  // bzw. einer Tipprunde mit Mitspielern.
  const [rightTab, setRightTab] = useState<"spiel" | "freunde">("spiel");
  const [friendsSheet, setFriendsSheet] = useState(false);
  const friendsLive = useFriendsLive(view === "live", view === "live" && rightTab === "freunde");
  const showFriendsTab = view === "live" && !!friendsLive && (friendsLive.hasFriends || friendsLive.tables.length > 0);
  const friendsTab = showFriendsTab && rightTab === "freunde";
  const selectedLink = selected ? links.get(selected.id) ?? null : null;
  const friendsRow =
    // Nur mit mittippenden Freunden (Rene, 16.10.2026), sonst keine Zeile.
    friendsLive && friendsRowTable(friendsLive) && selectedLink && friendsLive.games.some((g) => g.match.id === selectedLink.match.id) ? (
      <div className="lg:hidden">
        <FriendsLiveRow state={friendsLive} onOpen={() => setFriendsSheet(true)} className="-mt-2" />
        <FriendsLiveSheet open={friendsSheet} onClose={() => setFriendsSheet(false)} />
      </div>
    ) : null;

  const runningCount = todayDay.games?.filter((g) => isLiveRunning(g.status)).length ?? 0;

  return (
    <section className="mb-6 rounded-card border border-edge bg-surface px-3 pt-3 pb-4 sm:px-4">
      {/* Eine Reihe (Rene, 27.10.2026): Reiter links, Sportart rechts, ohne
          eigene Überschrift. */}
      <div className="mb-4 flex items-center gap-3 border-b border-edge sm:gap-4">
        <SubTab
          label="Heute"
          active={view === "live" && !onlyLive}
          onClick={() => {
            setView("live");
            setOnlyLive(false);
          }}
        />
        <SubTab
          label={
            <span className="flex items-center gap-1.5">
              <StateDot state="live" />
              Live
              {runningCount > 0 && <span className="hidden min-[400px]:inline">({runningCount})</span>}
            </span>
          }
          active={view === "live" && onlyLive}
          onClick={() => {
            setView("live");
            setOnlyLive(true);
          }}
        />
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
        {switcher && <div className="ml-auto shrink-0 py-1.5">{switcher}</div>}
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
              <LcLive onlyLive={onlyLive} games={todayDay.games} error={todayDay.error} dataAt={todayDay.dataAt} source={todayDay.source} loading={polling && todayDay.loading} onRetry={retry} {...listProps} />
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
            {showFriendsTab && (
              <div className="mb-2 hidden gap-1.5 lg:flex" role="tablist" aria-label="Rechte Spalte">
                {(["spiel", "freunde"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    role="tab"
                    aria-selected={rightTab === t}
                    onClick={() => setRightTab(t)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                      rightTab === t ? "border-muted/50 bg-surface-hover text-ink" : "border-edge text-muted hover:text-ink"
                    }`}
                  >
                    {t === "spiel" ? "Spiel" : "Freunde"}
                  </button>
                ))}
              </div>
            )}
            {friendsTab && (
              <div className="hidden rounded-card border border-muted/25 bg-pitch/40 p-3 sm:p-4 lg:block">
                <FriendsLivePanel state={friendsLive} />
              </div>
            )}
            <div className={friendsTab ? "lg:hidden" : ""}>
              {selected ? (
                <LcDetail
                  key={selected.id}
                  sport={sport}
                  game={selected}
                  link={selectedLink}
                  dataAt={todayDay.games?.some((g) => g.id === selected.id) ? todayDay.dataAt : 0}
                  friendsRow={friendsRow}
                  now={now}
                />
              ) : targetMissing ? (
                <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
                  Dieses Spiel ist (noch) nicht in den Live-Daten. Das Matchcenter zeigt Spiele von heute und gestern.
                </p>
              ) : (
                <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
                  Spiel antippen, um Spielverlauf, Tipps und Kommentare zu sehen.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-muted">
        {/* Anbieter aus der Antwort (Rene, 16.10.2026: austauschbar). */}
        Daten von{" "}
        <a href={todayDay.providerUrl ?? "https://www.api-football.com/"} className="underline" target="_blank" rel="noreferrer">
          {todayDay.providerName ?? "API-Sports"}
        </a>
        {polling && ` · aktualisiert sich alle ${Math.round(liveIntervalSeconds(sport) / 60)} Minuten`}
      </p>
    </section>
  );
}

interface ListProps {
  sport: Sport;
  links: Map<string, AppLink>;
  isTipped: (g: LiveGame) => boolean;
  canTip: (g: LiveGame) => boolean;
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
function LeagueHeading({ sport, game }: { sport: Sport; game: LiveGame }) {
  const { competitions } = useAppData();
  const flag = liveLeagueFlag(sport, game, competitions);
  const name = leagueName(game, sport);
  return (
    <p className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-ink lg:text-base">
      {flag && (
        <span aria-hidden className="text-base lg:text-lg">
          <Emoji e={flag} />
        </span>
      )}
      {name}
    </p>
  );
}

// Gruppiert nach "Name · Land" (Rene, 16.10.2026: sonst landen AT- und
// DE-Bundesliga in einer Gruppe). Reihenfolge = erstes Spiel der Liga.
function groupByLeague(games: LiveGame[]): { league: string; games: LiveGame[] }[] {
  const groups = new Map<string, LiveGame[]>();
  for (const g of games) {
    const key = g.league || "Weitere Spiele";
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return Array.from(groups, ([league, list]) => ({ league, games: list }));
}

function LcLive({
  onlyLive = false,
  games,
  error,
  dataAt,
  source,
  loading,
  onRetry,
  ...listProps
}: ListProps & {
  onlyLive?: boolean;
  games: LiveGame[] | null;
  error: string | null;
  dataAt: number;
  source: LiveSource | null;
  loading: boolean;
  onRetry: () => void;
}) {
  if (!games) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  if (error) return <LcError error={error} onRetry={onRetry} />;
  const { sport } = listProps;
  if (games.length === 0) {
    return (
      <EmptyState
        emoji={SPORT_ICONS[sport]}
        title="Heute keine Spiele"
        text="Sobald wieder gespielt wird, siehst du hier alle Spiele live."
        className="border-none bg-transparent"
      />
    );
  }
  // Reihenfolge (Rene, 27.10.2026): je Liga zusammen (alle ÖFB-Cup-Spiele,
  // alle Serie A …). Ligen mit laufenden Spielen zuerst, dann nach dem
  // nächsten Anstoß. In der Liga: laufende, dann nicht begonnene nach
  // Anstoßzeit, dann beendete; sonstige Zustände (verschoben, abgesagt …)
  // am Ende. Die Auswahl hängt an der Spiel-ID und bleibt beim Wandern
  // erhalten. Reiter "Live" (onlyLive): nur die laufenden.
  const running = games.filter((g) => isLiveRunning(g.status)).sort(byKickoff);
  const upcoming = onlyLive ? [] : games.filter((g) => g.status === "NS").sort(byKickoff);
  const finished = onlyLive
    ? []
    : [
        ...games.filter((g) => isLiveFinished(g.status)).sort(byKickoff),
        ...games.filter((g) => g.status !== "NS" && !isLiveRunning(g.status) && !isLiveFinished(g.status)).sort(byKickoff),
      ];
  if (onlyLive && running.length === 0) {
    return (
      <EmptyState
        emoji={SPORT_ICONS[sport]}
        title="Gerade läuft kein Spiel"
        text="Unter „Heute“ siehst du, wann die nächsten Spiele beginnen."
        className="border-none bg-transparent"
      />
    );
  }
  const rows = (list: LiveGame[]) => (
    <div className="flex flex-col gap-2">
      {list.map((g) => (
        <GameRow key={g.id} game={g} dataAt={dataAt} {...listProps} />
      ))}
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      {running.length > 0 && <LcLiveHeader sport={sport} count={running.length} dataAt={dataAt} source={source} />}
      {groupByLeague([...running, ...upcoming, ...finished]).map((group) => (
        <div key={group.league}>
          <LeagueHeading sport={sport} game={group.games[0]} />
          {rows(group.games)}
        </div>
      ))}
      {loading && <p className="text-center text-[11px] text-muted">Aktualisiert…</p>}
    </div>
  );
}

// Kopf: "● 8 Spiele live · aktualisiert vor 1 Min.", Zeit zählt mit
// (fetchedAt = Abruf beim Anbieter, nicht beim Laden im Browser).
// (Rene, 16.10.2026: ehrliche Aktualität) Hängen die Daten (älter als 2×
// Takt oder nicht aus dem Live-Abruf), steht dezent "Live-Daten verzögert".
function LcLiveHeader({ sport, count, dataAt, source }: { sport: Sport; count: number; dataAt: number; source: LiveSource | null }) {
  const now = useMinuteTick(dataAt || null);
  const delayed = now !== null && isLiveDelayed(sport, dataAt, source, true, now);
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted" aria-live="polite">
      <StateDot state="live" />
      <span className="font-semibold text-ink">
        {count} {count === 1 ? "Spiel" : "Spiele"} live
      </span>
      {now !== null && dataAt > 0 && <span>· {updatedAgoText(dataAt, now)}</span>}
      {delayed && <span className="text-[11px] font-medium text-yellow-400">· Live-Daten verzögert</span>}
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
          {/* Je Liga zusammen (Rene, 27.10.2026). */}
          <div className="flex flex-col gap-3">
            {groupByLeague(day.games).map((group) => (
              <div key={`${day.label}-${group.league}`}>
                <LeagueHeading sport={list.sport} game={group.games[0]} />
                <div className="flex flex-col gap-2">
                  {group.games.map((g) => (
                    <GameRow key={g.id} game={g} {...list} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const OTHER_STATUS: Record<string, string> = {
  PST: "Verschoben",
  POST: "Verschoben",
  INTR: "Unterbrochen",
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

// Wandert ein Spiel in einen anderen Abschnitt (z. B. von laufend nach
// "Beendet"), blendet die Zeile dort sanft ein statt zu springen
// (Rene, 15.10.2026). Letzter Abschnitt pro Spiel-ID außerhalb der Komponente,
// weil die Zeile beim Umzug neu entsteht.
const lastSection = new Map<string, string>();

function useSectionMove(id: string, section: string): boolean {
  const [moved] = useState(() => {
    const prev = lastSection.get(id);
    return prev !== undefined && prev !== section;
  });
  useEffect(() => {
    lastSection.set(id, section);
  }, [id, section]);
  return moved;
}

// Status-Spalte der Spielzeile (Rene, 16.10.2026): kurze, zweizeilige Labels,
// damit "Drittelpause", "Penaltyschießen" & Co. nicht in die Namen laufen.
// Zeile 1 (main) groß/fett mit Punkt, Zeile 2 (sub) klein muted.
interface RowStatus {
  dot?: "live" | "pause";
  main: string;
  sub?: string;
  muted?: boolean;
}

function rowStatus(sport: Sport, game: LiveGame, clockText: string | null): RowStatus {
  const s = game.statusShort.toUpperCase();
  const minute = game.elapsed !== null && game.elapsed > 0 ? `${game.elapsed}'` : undefined;
  if (game.status === "NS") {
    const today = viennaDate(Date.now());
    const day = viennaDate(game.kickoff);
    return { main: viennaTime(game.kickoff), sub: day === today ? "heute" : day < today ? "gestern" : "morgen", muted: true };
  }
  if (isLiveFinished(game.status)) {
    const sub =
      game.status === "AET" ? "n. V." : game.status === "PEN" ? (sport === "Fußball" ? "i. E." : sport === "NHL" ? "n. P." : game.statusText) : undefined;
    return { main: "Beendet", sub, muted: true };
  }
  if (sport === "NHL") {
    if (game.status === "BREAK") {
      // Welches Drittel vorbei ist, steckt im Fortschritt (1/3, 2/3, 3/3).
      const done = game.progress !== undefined ? Math.round(game.progress * 3) : 0;
      return { dot: "pause", main: "Pause", sub: done >= 1 && done <= 3 ? `nach ${done}. Dr.` : undefined };
    }
    const period = /^P([1-3])$/.exec(s);
    if (period) return { dot: "live", main: `${period[1]}. Drittel`, sub: minute };
    if (s === "OT") return { dot: "live", main: "Verl.", sub: minute };
    if (s === "PT") return { dot: "live", main: "Penalty" };
  }
  if (sport === "Fußball") {
    if (game.status === "HT") return { dot: "pause", main: "Pause", sub: "Halbzeit" };
    if (s === "ET") return { dot: "live", main: "Verl.", sub: minute };
    if (s === "P") return { dot: "live", main: "Elfmeter" };
    if (game.status === "LIVE") return { dot: "live", main: clockText ?? minute ?? "Live" };
  }
  if (game.status === "HT" || game.status === "BREAK") return { dot: "pause", main: "Pause", sub: game.statusText && game.statusText !== "Pause" ? game.statusText : undefined };
  if (game.status === "LIVE") return { dot: "live", main: game.statusText || "Live", sub: minute && !game.statusText.includes(minute) ? minute : undefined };
  return { main: OTHER_STATUS[s] ?? "—", muted: true };
}

// Eine Zeile (Rene, 15.10.2026: Spieltag-Umbau): links Status (siehe
// rowStatus, feste Breite seit 16.10.2026), Mitte Heim und Gast
// untereinander, rechts die Tore untereinander, unten ein dünner Balken
// (Minute/90). "Getippt" klein in Gold unter dem Status, gewählte Zeile mit Gold-Rand.
// Rahmen eine Spur heller als border-edge, neutral für alle Zustände.
function GameRow({ sport, game, dataAt = 0, links, isTipped, canTip, selectedId, onSelect }: ListProps & { game: LiveGame; dataAt?: number }) {
  const clock = useLiveClock(sport, game.statusShort, game.elapsed, dataAt);
  const running = isLiveRunning(game.status);
  const hasScore = game.homeScore !== null && game.awayScore !== null && game.status !== "NS";
  const flash = useGoalFlash(game.id, hasScore ? `${game.homeScore}:${game.awayScore}` : null);
  const tipped = isTipped(game);
  const tippable = !tipped && canTip(game);
  const selected = selectedId === game.id;
  const link = links.get(game.id);
  const teamName = useApiTeamName(sport);
  // Mit App-Spiel: Namen wie in der App (gleiche Schreibweise wie auf der
  // Tippkarte), sonst der eigene Vereinsname zum API-Namen.
  const homeName = link ? (link.result.swapped ? link.away.name : link.home.name) : teamName(game.home);
  const awayName = link ? (link.result.swapped ? link.home.name : link.away.name) : teamName(game.away);

  const status = rowStatus(sport, game, clock?.text ?? null);
  // Eishockey: Fortschritt über 60 Min. vom Anbieter (Rene, 16.10.2026).
  const progress = running ? (clock?.progress ?? (game.status === "HT" ? 0.5 : game.progress ?? null)) : null;
  const moved = useSectionMove(game.id, running ? "live" : game.status === "NS" ? "ns" : "done");

  return (
    <button
      type="button"
      onClick={() => onSelect(game.id)}
      aria-pressed={selected}
      className={`relative w-full overflow-hidden rounded-card border bg-surface pl-3 pr-3 pb-2.5 pt-3 text-left transition-colors sm:pl-4 ${
        moved ? "motion-safe:animate-lc-row-in" : ""
      } ${
        selected ? "border-gold" : "border-muted/25 hover:border-muted/50"
      }`}
    >
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)_auto] items-center gap-x-2.5 text-sm">
        {/* "Getippt" steht klein unter dem Status statt absolut über der
            Tor-Spalte – dort überlappte es die obere Tor-Zahl (Rene, 15.10.2026). */}
        {/* Feste Breite, nichts läuft in die Namen (Rene, 16.10.2026):
            Zeile 1 groß/fett, Zeile 2 klein muted, "Getippt" darunter. */}
        <span className="flex w-[4.75rem] min-w-0 flex-col gap-0.5 overflow-hidden tabular-nums">
          <span className={`flex min-w-0 items-center gap-1 text-[13px] font-semibold leading-tight ${status.muted ? "text-muted" : "text-ink"}`}>
            {status.dot && <StateDot state={status.dot} />}
            <span className="min-w-0 truncate">{status.main}</span>
          </span>
          {status.sub && <span className="truncate text-[10px] leading-tight text-muted">{status.sub}</span>}
          {tipped && <span className="truncate text-[10px] font-semibold leading-tight text-gold">Getippt</span>}
          {/* Tippspiel, noch nicht getippt (Rene, 27.10.2026). */}
          {tippable && (
            <span className="w-fit rounded-full bg-gold/15 px-1.5 text-[10px] font-bold leading-[1.4] text-gold">Tippen</span>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <FitText text={homeName} maxLines={2} minPx={12} className="leading-tight text-ink" />
          <FitText text={awayName} maxLines={2} minPx={12} className="leading-tight text-ink" />
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
function LcDetail({
  sport,
  game,
  link,
  dataAt,
  friendsRow,
  now,
}: {
  sport: Sport;
  game: LiveGame;
  link: AppLink | null;
  dataAt: number;
  friendsRow?: React.ReactNode;
  now: number | null;
}) {
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
  const teamName = useApiTeamName(sport);
  const appHome = link ? link.home.name : teamName(game.home);
  const appAway = link ? link.away.name : teamName(game.away);
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
    };
  };

  const tippable = !!match && now !== null && isMatchTippable(match, now);
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
  // Live-Zeile kurz: "Sieg Frankfurt" / "Unentschieden" / "3:1" (Rene, 16.10.2026).
  const liveTipTextShort =
    tip && match && link
      ? liveTipLabel(tip.predictedHomeScore, tip.predictedAwayScore, isOneXTwo, link.home.name, link.away.name, tipText)
      : "";
  const tendency = match ? tipTendencies[match.id] : undefined;
  const flag = liveLeagueFlag(sport, game, competitions);
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
          <span className="min-w-0 truncate">{leagueName(game, sport)}</span>
        </span>
        {liveLike && (
          <span className="shrink-0 whitespace-nowrap">
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
          tipText={liveTipTextShort}
          points={points}
          finished={!isLiveRunning(game.status)}
          forecast={forecast}
        />
      )}
      {liveLike && !appFinal && friendsRow}
      {tip && tip.evaluated && appFinal && (
        <p className="rounded-lg border border-edge bg-pitch px-3 py-2 text-[13px] text-muted">
          Dein Tipp: <span className="font-semibold text-ink">{tipText}</span>
          {tip.rangDelta !== undefined && (
            <span className={tip.rangDelta > 0 ? "text-gold" : ""}> · {signedPoints(tip.rangDelta)} Punkte</span>
          )}
        </p>
      )}
      {/* Direkt zur Tippkarte, solange getippt werden kann (Rene, 27.10.2026). */}
      {match && !tip && tippable && (
        <Link
          href={tipCardHref(match.id)}
          className="flex items-center justify-center gap-1.5 rounded-full bg-action-hover py-2.5 text-center font-display text-sm font-semibold tracking-wide text-pitch transition-all hover:brightness-110"
        >
          🎯 Jetzt tippen
        </Link>
      )}
      {tip && !tip.evaluated && !started && (
        <p className="flex items-center justify-between gap-2 rounded-lg border border-gold/40 bg-gold/5 px-3 py-2 text-[13px] text-muted">
          <span>
            Dein Tipp: <span className="font-semibold text-gold">{tipText}</span>
          </span>
          {match && tippable && (
            <Link href={tipCardHref(match.id)} className="shrink-0 font-semibold text-ink underline-offset-2 hover:underline">
              Ändern ›
            </Link>
          )}
        </p>
      )}

      {/* Ohne Ereignisse vom Anbieter (Eishockey) kein Spielverlauf (Rene, 16.10.2026). */}
      {liveLike && game.events !== undefined && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Spielverlauf</p>
          {/* Immer sichtbar, daher kein Pulsknopf: neues Tor erkennt der
              Spielverlauf selbst und hinterlegt es ~3 s golden (Rene, 15.10.2026). */}
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
