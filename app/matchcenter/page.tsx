"use client";

import EmptyState from "@/components/EmptyState";
import { useEffect, useMemo, useRef, useState } from "react";
import AdBanner from "@/components/AdBanner";
import FitText from "@/components/FitText";
import { TvIcon } from "@/components/Icons";
import {
  appSideEvents,
  findLiveGame,
  isLiveFinished,
  isLiveRunning,
  isLiveDelayed,
  updatedAgoText,
  type LiveGame,
  type LiveSource,
  type LiveMatchResult,
} from "@/lib/liveScores";
import { reloadLiveDay, useLiveDay, useLiveDays, useLivePolling, type LiveDay } from "@/lib/useLiveScores";
import { TABLE_LEAGUES, type StandingGroup, type StandingsResponse } from "@/lib/standings";
import { LIVE_SPORTS, liveGameCountry, liveGameLeague } from "@/lib/liveConfig";
import { flagEmoji } from "@/lib/flags";
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";
import { useLiveForecast } from "@/lib/liveForecast";
import { friendsRowTable, useFriendsLive } from "@/lib/friendsLive";
import { FriendsLivePanel, FriendsLiveRow, FriendsLiveSheet } from "@/components/FriendsLive";
import { useAppData } from "@/lib/AppDataContext";
import { classifyRankingTip, RANKING_POINTS } from "@/lib/poolScore";
import { competitionFlag } from "@/lib/competitionFlag";
import { displayOrder, isAwayFirst, scoreText, type TeamOrder } from "@/lib/teamOrder";
import { SPORT_ICONS, isSportActive, sportLabel, type Match, type Sport, type Team } from "@/lib/types";
import TeamBadge, { matchJerseyProps } from "@/components/TeamBadge";
import CommentThread from "@/components/CommentThread";
import { LineupView, StatsView, useMatchInfo } from "@/components/MatchInfo";
import Emoji from "@/components/Emoji";
import LiveTvHeat, { type TvGame } from "@/components/LiveTvHeat";
import { CommunityTrend } from "@/components/MatchCard";
import { useBeginnerShieldLeft } from "@/components/BeginnerShieldHint";
import {
  EventTimeline,
  LivePill,
  LiveTipLine,
  Scoreboard,
  StateDot,
  signedPoints,
  useBoardClock,
  type BoardSide,
} from "@/components/LiveMatch";
import { liveTipLabel } from "@/lib/liveTipText";
import { appTeamName } from "@/lib/teamApiNames";
import { fixtureTvFor } from "@/lib/fixtureTv";
import { useUser } from "@/lib/UserContext";
import { COUNTDOWN_FROM } from "@/components/Countdown";
import { deadlineText } from "@/lib/dayGroups";
import { isMatchTippable, isNightKickoff, sportDay, tipCardHref } from "@/lib/matchcenterLink";
import Link from "next/link";
import { useStartExperience } from "@/lib/useStartExperience";

// TV-Sender eines Spiels: beim Tippspiel der Sender am Spiel, sonst der im
// Matchcenter eingetragene (Rene, 28.10.2026, lib/fixtureTv.ts).
function useGameTv(sport: Sport): (game: LiveGame, link: AppLink | null | undefined) => string | null {
  const { fixtureTv } = useAppData();
  return useMemo(
    () => (game: LiveGame, link: AppLink | null | undefined) =>
      link ? link.match.tvChannel?.trim() || null : fixtureTvFor(fixtureTv, sport, game.id),
    [fixtureTv, sport],
  );
}

// Eigene Vereinsnamen statt API-Namen (Rene, 27.10.2026, lib/teamApiNames.ts).
function useApiTeamName(sport: Sport | undefined): (apiName: string) => string {
  const { teams, apiNameLinks } = useAppData();
  return useMemo(
    () => (apiName: string) => (sport ? appTeamName(teams, apiNameLinks, sport, apiName) : apiName),
    [teams, apiNameLinks, sport],
  );
}

export default function MatchcenterPage() {
  // Neue Spieler: einmal zum Start-Erlebnis (das Matchcenter ist Startseite).
  useStartExperience();
  return (
    // Kompakt (Rene, 27.10.2026, Variante C): Spiele sollen gleich oben
    // stehen, darum ohne sichtbare Überschrift und mit wenig Abstand.
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-4 pt-3 pb-8 sm:px-5 sm:pt-4">
      <h1 className="sr-only">Matchcenter</h1>

      <TodayTipsBox />

      {/* Live-Bereich mit Detail (Rene, 15.10.2026: Spieltag-Umbau), nur die
          in lib/liveConfig.ts eingeschalteten Ligen (zum Testen Europa League). */}
      {LIVE_SPORT && <LiveCenter />}

      <AdBanner />
    </main>
  );
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
// lib/liveConfig.ts (die Route filtert schon). "Ergebnisse" von heute und
// gestern. Seit dem Pro-Plan für Fußball (Rene, 27.10.2026) dazu
// "Spielplan" (nächste 7 Tage) und "Tabelle" (API-Sports, /api/standings);
// bei den anderen Sportarten steht unter "Tabelle" ein Hinweis.
//
// Am PC zweispaltig: links die Liste, rechts (400–460 px) das Detail des
// gewählten Spiels. Am Handy steht das Detail unter der Liste, beim
// Antippen wird dorthin gescrollt. Standardmäßig ist das erste getippte
// laufende Spiel gewählt.

// Erste eingeschaltete Sportart (Fußball). Seit 16.10.2026 auch Eishockey:
// bei mehreren Sportarten oben ein Umschalter (Rene, 16.10.2026).
const LIVE_SPORT: Sport | null = LIVE_SPORTS[0] ?? null;
const MAX_LIVE_MS = 4 * 60 * 60 * 1000;

type LcView = "live" | "spielplan" | "ergebnisse" | "tabelle";

// Spielplan (Rene, 27.10.2026: Pro-Plan): so viele Tage ab morgen.
const UPCOMING_DAYS = 7;
// Ab so vielen Abfragen pro Tag gilt der Pro-Plan (wie FAST_PLAN_LIMIT in
// lib/live/providers/apiSports.ts).
const PRO_PLAN_LIMIT = 1000;
const NO_DATES: readonly string[] = [];

// API-Spiel ↔ App-Spiel (für "GETIPPT", "Dein Tipp", Community, Kommentare).
interface AppLink {
  match: Match;
  home: Team;
  away: Team;
  result: LiveMatchResult;
}

// "2026-10-15" -> "2026-10-14" (days = -1), "2026-10-16" (days = 1)
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function previousDate(date: string): string {
  return addDays(date, -1);
}

// Sporttag aus zwei Kalendertagen (Rene, 28.10.2026: US-Spiele in der
// Nacht): vom Kalendertag die Spiele ab 06:00, vom nächsten die Nacht-
// Spiele bis 06:00 (lib/matchcenterLink.ts, sportDay). Zeitstand und Quelle
// vom Teil mit laufenden Spielen, damit "verzögert" ehrlich bleibt.
function sportDayGames(day: LiveGame[] | null, night: LiveGame[] | null): LiveGame[] | null {
  if (!day || !night) return null;
  return [...day.filter((g) => !isNightKickoff(g.kickoff)), ...night.filter((g) => isNightKickoff(g.kickoff))];
}

// games: schon zusammengesetzt (useMemo), damit die Liste nicht bei jedem
// Rendern neu entsteht.
function mergeSportDay(day: LiveDay, night: LiveDay, games = sportDayGames(day.games, night.games)): LiveDay {
  const nightRunning = !!games?.some((g) => isNightKickoff(g.kickoff) && isLiveRunning(g.status));
  const dayRunning = !!games?.some((g) => !isNightKickoff(g.kickoff) && isLiveRunning(g.status));
  const pick = nightRunning && !dayRunning ? night : day;
  return {
    games,
    // Fehler nur, wenn gar nichts da ist (sonst verdeckt er die Spiele).
    error: games && games.length > 0 ? null : day.error ?? night.error,
    loading: day.loading || night.loading,
    loadedAt: Math.min(day.loadedAt, night.loadedAt),
    dataAt: pick.dataAt,
    source: pick.source,
    liveError: pick.liveError,
    providerName: day.providerName ?? night.providerName,
    providerUrl: day.providerUrl ?? night.providerUrl,
    quota: day.quota ?? night.quota,
  };
}

// Läuft im Sporttag-Teil dieses Kalendertags ein Spiel (bzw. sollte es)?
function partNeedsPolling(games: LiveGame[] | null, night: boolean, now: number | null): boolean {
  return now !== null && !!games && games.some((g) => isNightKickoff(g.kickoff) === night && needsPolling(g, now));
}

// "2026-10-30" -> "Do., 30.10."
function dayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("de-AT", {
    timeZone: "UTC",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
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
// Tippspiele von heute (Wiener Zeit), null solange die echten Spiele noch
// nicht geladen sind (vorher stehen Demo-Spiele im Speicher).
function useTodayTips() {
  const { matches, getTeam, myTips, contentLoaded } = useAppData();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null || !contentLoaded) return null;
  const today = sportDay(now);
  const list = matches.filter(
    (m) =>
      !m.draft &&
      m.status !== "cancelled" &&
      isSportActive(m.sport) &&
      sportDay(m.kickoff) === today &&
      !!getTeam(m.homeTeamId) &&
      !!getTeam(m.awayTeamId),
  );
  const tipped = new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId));
  const open = list.filter((m) => !tipped.has(m.id) && isMatchTippable(m, now)).length;
  return { now, list, tipped, open };
}

// Kleines Kästchen "🎯 7 · 5 offen ›" oben in der Reihe der Sportarten
// (Rene, 27.10.2026: Variante C), führt zu den Tipps.
function TodayTipsMini() {
  const today = useTodayTips();
  if (!today || today.list.length === 0) return null;
  const { list, open } = today;
  return (
    <Link
      href="/"
      className="ml-auto flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/40 bg-gold/5 px-2.5 py-1 text-xs transition-colors hover:border-gold"
      aria-label={`Heute ${list.length} Tippspiele, ${open} offen – zu den Tipps`}
    >
      <span aria-hidden>🎯</span>
      <span className="font-display font-bold text-ink">
        {list.length}
        <span className="hidden sm:inline"> {list.length === 1 ? "Tippspiel" : "Tippspiele"}</span>
      </span>
      {open > 0 && <span className="font-semibold text-gold">· {open} offen</span>}
      <span className="font-bold text-gold" aria-hidden>
        ›
      </span>
    </Link>
  );
}

function TodayTipsBox() {
  const { getTeam, matches, orderFor } = useAppData();
  const today = useTodayTips();
  if (!today) return null;
  const { now, list, tipped, open } = today;
  // Mit Live-Bereich steht das Kästchen dort klein oben (TodayTipsMini).
  if (list.length > 0 && LIVE_SPORT) return null;
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
  const sports = Array.from(new Set(list.map((m) => m.sport)));
  return (
    <Link
      href="/"
      className="mb-3 flex items-center gap-2.5 rounded-card border border-gold/40 bg-gold/5 px-3 py-1.5 transition-colors hover:border-gold sm:mb-4 sm:gap-3 sm:px-4 sm:py-2.5"
    >
      <span className="flex shrink-0 gap-0.5 text-base sm:text-lg" aria-hidden>
        {sports.map((s) => (
          <Emoji key={s} e={SPORT_ICONS[s]} />
        ))}
      </span>
      {/* Am Handy eine Zeile: "Heute 7 Tippspiele · 5 offen". */}
      <span className="min-w-0 flex-1 truncate sm:whitespace-normal">
        <span className="font-display text-sm font-bold text-ink sm:block">
          Heute {list.length === 1 ? "1 Tippspiel" : `${list.length} Tippspiele`}
        </span>
        {open > 0 && (
          <span className="text-xs font-semibold text-gold sm:hidden"> · {open} offen</span>
        )}
        <span className="hidden text-xs text-muted sm:block">
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
  // Oben eine Reihe (Rene, 27.10.2026, Variante C): die Sportarten einzeln
  // (Namen erst ab lg:), rechts das kleine Tippspiel-Kästchen.
  const switcher = (
    <div className="mb-2 flex items-center gap-1.5 sm:mb-3">
      {LIVE_SPORTS.length > 1 && (
        <div className="flex gap-1.5" role="tablist" aria-label="Sportart">
          {LIVE_SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              aria-label={sportLabel(s)}
              onClick={() => pick(s)}
              className={`flex min-h-8 items-center gap-1 rounded-full border px-2.5 text-[13px] font-semibold transition-colors ${
                sport === s ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
              }`}
            >
              <Emoji e={SPORT_ICONS[s]} /> <span className="hidden lg:inline">{sportLabel(s)}</span>
            </button>
          ))}
        </div>
      )}
      <TodayTipsMini />
    </div>
  );
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
  // Logo oder "Spiele" im Menü (Rene, 27.10.2026): zurück auf "Heute" und
  // nach oben, auch wenn das Matchcenter schon offen ist (z. B. auf "Tabelle").
  useEffect(() => {
    function backToToday() {
      setView("live");
      setOnlyLive(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    window.addEventListener("pooltipp:logo", backToToday);
    window.addEventListener("pooltipp:spiele", backToToday);
    return () => {
      window.removeEventListener("pooltipp:logo", backToToday);
      window.removeEventListener("pooltipp:spiele", backToToday);
    };
  }, []);
  const [today, setToday] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hat der Spieler selbst gewählt? Dann nichts mehr automatisch wählen.
  const pickedRef = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const { matches, getTeam, myTips, apiNameLinks } = useAppData();

  // Datum und Uhr erst im Browser (sonst Hydration-Fehler), Uhr alle 30 s.
  // today = Sporttag (06:00 bis 06:00 Wiener Zeit, Rene 28.10.2026).
  useEffect(() => {
    setToday(sportDay(Date.now()));
    setNow(Date.now());
    const t = setInterval(() => {
      setNow(Date.now());
      setToday(sportDay(Date.now()));
    }, 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const yesterday = today ? previousDate(today) : null;
  const tomorrow = today ? addDays(today, 1) : null;
  // Heute immer (Kalendertag + Nacht danach), gestern erst mit "Ergebnisse"
  // (1 h Cache auf dem Server; seine Nacht steckt im Kalendertag heute).
  const todayCal = useLiveDay(sport, today);
  const tomorrowCal = useLiveDay(sport, tomorrow);
  const yesterdayCal = useLiveDay(sport, view === "ergebnisse" ? yesterday : null);
  const todayGames = useMemo(() => sportDayGames(todayCal.games, tomorrowCal.games), [todayCal.games, tomorrowCal.games]);
  const yesterdayGames = useMemo(() => sportDayGames(yesterdayCal.games, todayCal.games), [yesterdayCal.games, todayCal.games]);
  const todayDay = mergeSportDay(todayCal, tomorrowCal, todayGames);
  const yesterdayDay = mergeSportDay(yesterdayCal, todayCal, yesterdayGames);
  // Spielplan nur für Fußball und nur mit Pro-Plan (Tageskontingent laut
  // API-Sports ab PRO_PLAN_LIMIT); der Gratis-Plan kennt nur gestern bis
  // morgen und hat 100 Abfragen pro Tag.
  const hasPlan = sport === "Fußball" && (todayDay.quota?.limit ?? 0) >= PRO_PLAN_LIMIT;
  const upcomingDates = useMemo(
    () => (today && hasPlan && view === "spielplan" ? Array.from({ length: UPCOMING_DAYS }, (_, i) => addDays(today, i + 1)) : NO_DATES),
    [today, hasPlan, view],
  );
  // Je Spielplan-Tag auch die Nacht danach: ein Kalendertag mehr laden.
  const upcomingCalDates = useMemo(
    () => (upcomingDates.length > 0 ? [...upcomingDates, addDays(upcomingDates[upcomingDates.length - 1], 1)] : NO_DATES),
    [upcomingDates],
  );
  const upcomingCalDays = useLiveDays(sport, upcomingCalDates);
  const upcomingDays = upcomingDates.map((_, i) => mergeSportDay(upcomingCalDays[i], upcomingCalDays[i + 1]));
  useEffect(() => {
    if (!hasPlan && view === "spielplan" && todayDay.games !== null) setView("live");
  }, [hasPlan, view, todayDay.games]);

  // Automatisch aktualisieren – nur solange ein Spiel läuft, im 180-s-Takt
  // (gemeinsam mit den Tippkarten, pausiert im Hintergrund).
  // Je Kalendertag nur, wenn in seinem Teil des Sporttags etwas läuft.
  const pollToday = partNeedsPolling(todayCal.games, false, now);
  const pollTomorrow = partNeedsPolling(tomorrowCal.games, true, now);
  const polling = pollToday || pollTomorrow;
  useLivePolling(sport, today, pollToday);
  useLivePolling(sport, tomorrow, pollTomorrow);

  const retry = () => {
    if (today) reloadLiveDay(sport, today);
    if (tomorrow) reloadLiveDay(sport, tomorrow);
    if (view === "ergebnisse" && yesterday) reloadLiveDay(sport, yesterday);
    for (const date of upcomingCalDates) reloadLiveDay(sport, date);
  };

  // App-Spiele den API-Spielen zuordnen (gleiche Zuordnung wie die Tippkarten).
  const upcomingGames = upcomingDays.flatMap((d) => d.games ?? []);
  const upcomingKey = upcomingGames.map((g) => `${g.id}|${g.kickoff}|${g.statusShort}`).join(",");
  const allGames = useMemo(
    () => [...(todayDay.games ?? []), ...(yesterdayDay.games ?? []), ...upcomingGames],
    // upcomingKey: neue Liste nur, wenn sich die Spiele ändern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [todayDay.games, yesterdayDay.games, upcomingKey],
  );
  const links = useMemo(() => {
    const map = new Map<string, AppLink>();
    if (allGames.length === 0) return map;
    for (const m of matches) {
      if (m.sport !== sport || m.draft || m.status === "cancelled") continue;
      const day = sportDay(m.kickoff);
      if (day !== today && day !== yesterday && !upcomingDates.includes(day)) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const result = findLiveGame(allGames, m.kickoff, home.name, away.name);
      if (result && !map.has(result.game.id)) map.set(result.game.id, { match: m, home, away, result });
    }
    return map;
    // apiNameLinks: verknüpfte Vereinsnamen zählen bei findLiveGame mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGames, matches, getTeam, sport, today, yesterday, upcomingDates, apiNameLinks]);
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

  // Von der Tippkarte: Spiel von gestern steht unter "Ergebnisse", eines
  // ab morgen unter "Spielplan" (Rene, 27.10.2026).
  const targetDay = target ? sportDay(target.kickoff) : null;
  useEffect(() => {
    if (targetDay && yesterday && targetDay === yesterday) setView("ergebnisse");
    else if (targetDay && today && hasPlan && targetDay > today) setView("spielplan");
  }, [targetDay, yesterday, today, hasPlan]);
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
    !!target &&
    !targetGameId &&
    !!todayDay.games &&
    (targetDay !== yesterday || !!yesterdayDay.games) &&
    !(targetDay && today && targetDay > today && hasPlan && upcomingDays.some((d) => d.games === null));

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
  // "Live im TV" unter dem Detail (Rene, 27.10.2026): laufende Fußball-
  // Spiele mit TV-Sender, seit 28.10.2026 auch ohne Tippspiel. Ob die
  // Statistik da ist, prüft die Karte.
  const gameTv = useGameTv(sport);
  const tvTeamName = useApiTeamName(sport);
  const tvGames = useMemo((): TvGame[] => {
    if (sport !== "Fußball" || view !== "live") return [];
    return (todayDay.games ?? []).flatMap((g) => {
      const link = links.get(g.id);
      const tv = gameTv(g, link);
      if (!tv || !isLiveRunning(g.status)) return [];
      const home = link ? link.home.name : tvTeamName(g.home);
      const away = link ? link.away.name : tvTeamName(g.away);
      const homeScore = link ? link.result.homeScore : g.homeScore;
      const awayScore = link ? link.result.awayScore : g.awayScore;
      if (homeScore === null || awayScore === null) return [];
      return [{ game: g, tv, home, away, homeScore, awayScore }];
    });
  }, [sport, view, todayDay.games, links, gameTv, tvTeamName]);

  return (
    <section className="mb-6 sm:rounded-card sm:border sm:border-edge sm:bg-surface sm:px-4 sm:pt-3 sm:pb-4">
      {/* Oben Sportarten + Tippspiel-Kästchen, darunter die Reiter, ohne
          eigene Überschrift (Rene, 27.10.2026, Variante C). */}
      {switcher}
      <div className="mb-3 flex items-center gap-3 border-b border-edge sm:mb-4 sm:gap-4">
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
        {/* Ergebnisse vor Spielplan (Rene, 27.10.2026). */}
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
        {hasPlan && <SubTab label="Spielplan" active={view === "spielplan"} onClick={() => setView("spielplan")} />}
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
      </div>

      {view === "tabelle" ? (
        sport === "Fußball" ? (
          <LcTable />
        ) : (
          <EmptyState
            emoji="📊"
            title="Noch keine Tabelle"
            text="Tabellen gibt es im Moment nur für Fußball. NBA, NFL und Eishockey kommen später dazu."
            className="border-none bg-transparent"
          />
        )
      ) : (
        <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_460px]">
          <div className="min-w-0">
            {view === "spielplan" ? (
              <LcUpcoming dates={upcomingDates} days={upcomingDays} onRetry={retry} {...listProps} />
            ) : view === "live" ? (
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
                  Dieses Spiel ist (noch) nicht in den Live-Daten. {hasPlan ? `Das Matchcenter zeigt Spiele von gestern bis in ${UPCOMING_DAYS} Tagen.` : "Das Matchcenter zeigt Spiele von heute und gestern."}
                </p>
              ) : (
                <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
                  Spiel antippen, um Spielverlauf, Tipps und Kommentare zu sehen.
                </p>
              )}
              <LiveTvHeat games={tvGames} selectedId={selectedId} onSelect={select} />
            </div>
          </div>
        </div>
      )}

      {/* Kein Hinweis "Daten von ..." mehr (Rene, 27.10.2026). */}
      {polling && <p className="mt-4 text-center text-[11px] text-muted">aktualisiert sich automatisch</p>}
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
    { label: "Heute", games: finished.filter((g) => sportDay(g.kickoff) === today) },
    { label: "Gestern", games: finished.filter((g) => sportDay(g.kickoff) !== today) },
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

// Spielplan der nächsten Tage (Rene, 27.10.2026: Pro-Plan). Je Tag, darin je
// Liga, nach Anstoß. Tippspiele mit "Tippen" und Countdown wie unter "Heute".
function LcUpcoming({
  dates,
  days,
  onRetry,
  ...list
}: ListProps & { dates: readonly string[]; days: LiveDay[]; onRetry: () => void }) {
  if (days.length === 0 || days.every((d) => d.games === null)) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  const loaded = days.filter((d) => d.games !== null);
  const withGames = dates
    .map((date, i) => ({ date, games: [...(days[i]?.games ?? [])].sort(byKickoff) }))
    .filter((d) => d.games.length > 0);
  if (withGames.length === 0) {
    const error = loaded.find((d) => d.error)?.error;
    if (error && loaded.length === days.length) return <LcError error={error} onRetry={onRetry} />;
    if (loaded.length < days.length) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
    return (
      <EmptyState
        emoji={SPORT_ICONS[list.sport]}
        title="Keine Spiele in den nächsten Tagen"
        text={`In den nächsten ${UPCOMING_DAYS} Tagen stehen in unseren Bewerben keine Spiele an.`}
        className="border-none bg-transparent"
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {withGames.map((day) => (
        <div key={day.date}>
          <p className="mb-2 text-xs font-semibold text-muted">{day.date === dates[0] ? "Morgen" : dayLabel(day.date)}</p>
          <div className="flex flex-col gap-3">
            {groupByLeague(day.games).map((group) => (
              <div key={`${day.date}-${group.league}`}>
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

// Fußball-Tabellen (Rene, 27.10.2026: Pro-Plan) über /api/standings. Im
// Browser je Liga 30 Min. gemerkt (so lange wie auf dem Server).
const STANDINGS_KEEP_MS = 30 * 60 * 1000;
const standingsCache = new Map<number, { body: StandingsResponse; at: number }>();

function cachedStandings(leagueId: number): StandingsResponse | null {
  const hit = standingsCache.get(leagueId);
  return hit && Date.now() - hit.at < STANDINGS_KEEP_MS ? hit.body : null;
}

// Farbstreifen am Rang aus der Beschreibung der API ("Promotion - Champions
// League …", "Relegation …").
function rankColor(description: string | null): string | null {
  if (!description) return null;
  const d = description.toLowerCase();
  if (d.includes("relegation")) return d.includes("promotion") ? "bg-orange-400" : "bg-red-500";
  if (d.includes("champions league")) return "bg-sky-500";
  if (d.includes("europa league")) return "bg-orange-400";
  if (d.includes("conference league")) return "bg-emerald-500";
  if (d.includes("promotion") || d.includes("qualification") || d.includes("round of 16") || d.includes("1/8")) return "bg-emerald-500";
  return null;
}

const STANDINGS_GRID =
  "grid grid-cols-[1.5rem_minmax(0,1fr)_1.5rem_3.25rem_2rem_1.75rem] gap-2 px-3 sm:grid-cols-[2rem_minmax(0,1fr)_2.5rem_2rem_2rem_2rem_3.5rem_2.5rem_3rem] sm:px-4";

function LcTable() {
  const [leagueId, setLeagueId] = useState(TABLE_LEAGUES[0].id);
  const [data, setData] = useState<StandingsResponse | null>(() => cachedStandings(TABLE_LEAGUES[0].id));
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const teamName = useApiTeamName("Fußball");

  useEffect(() => {
    const cached = cachedStandings(leagueId);
    setData(cached);
    setFailed(false);
    if (cached) return;
    let cancelled = false;
    fetch(`/api/standings?league=${leagueId}`)
      .then((res) => res.json() as Promise<StandingsResponse>)
      .then((body) => {
        if (cancelled) return;
        if (!body.error) standingsCache.set(leagueId, { body, at: Date.now() });
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, retry]);

  const error = failed || !!data?.error;
  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {TABLE_LEAGUES.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLeagueId(l.id)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              leagueId === l.id ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
            }`}
          >
            {l.country && (
              <span aria-hidden>
                <Emoji e={flagEmoji(l.country)} />
              </span>
            )}
            {l.label}
          </button>
        ))}
      </div>
      {error ? (
        <LcError error={data?.error ?? ""} onRetry={() => setRetry((r) => r + 1)} />
      ) : !data ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : data.groups.length === 0 ? (
        <EmptyState
          emoji="📊"
          title="Noch keine Tabelle"
          text="Für diesen Bewerb gibt es gerade keine Tabelle. Schau später nochmal vorbei."
          className="border-none bg-transparent"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {data.groups.map((group, i) => (
            <StandingsGroupTable key={`${group.name}-${i}`} group={group} showName={data.groups.length > 1} teamName={teamName} />
          ))}
        </div>
      )}
    </div>
  );
}

function StandingsGroupTable({
  group,
  showName,
  teamName,
}: {
  group: StandingGroup;
  showName: boolean;
  teamName: (apiName: string) => string;
}) {
  return (
    <div>
      {showName && group.name && <p className="mb-2 font-display text-sm font-bold text-ink">{group.name}</p>}
      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        <div className={`${STANDINGS_GRID} border-b border-edge py-2 text-xs text-muted`}>
          <span>#</span>
          <span>Team</span>
          <span className="text-center">Sp</span>
          <span className="text-center sm:hidden">S-U-N</span>
          <span className="hidden text-center sm:block">S</span>
          <span className="hidden text-center sm:block">U</span>
          <span className="hidden text-center sm:block">N</span>
          <span className="hidden text-center sm:block">Tore</span>
          <span className="text-center">TD</span>
          <span className="text-right">Pkt</span>
        </div>
        {group.rows.map((row) => {
          const color = rankColor(row.description);
          return (
            <div key={`${row.rank}-${row.team}`} className={`${STANDINGS_GRID} relative items-center border-b border-edge py-2 text-sm last:border-0`}>
              {color && <span aria-hidden className={`absolute inset-y-1 left-0 w-1 rounded-r ${color}`} />}
              <span className="text-muted tabular-nums">{row.rank}</span>
              <span className="flex min-w-0 items-center gap-2">
                {row.logo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.logo} alt="" width={18} height={18} loading="lazy" className="h-[18px] w-[18px] shrink-0 object-contain" />
                )}
                <FitText text={teamName(row.team)} className="leading-tight text-ink" />
              </span>
              <span className="text-center text-muted tabular-nums">{row.played}</span>
              <span className="whitespace-nowrap text-center text-xs text-muted tabular-nums sm:hidden">
                {row.win}-{row.draw}-{row.loss}
              </span>
              <span className="hidden text-center text-muted tabular-nums sm:block">{row.win}</span>
              <span className="hidden text-center text-muted tabular-nums sm:block">{row.draw}</span>
              <span className="hidden text-center text-muted tabular-nums sm:block">{row.loss}</span>
              <span className="hidden whitespace-nowrap text-center text-muted tabular-nums sm:block">
                {row.goalsFor}:{row.goalsAgainst}
              </span>
              <span className="text-center text-muted tabular-nums">{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</span>
              <span className="text-right font-semibold text-ink tabular-nums">{row.points}</span>
            </div>
          );
        })}
      </div>
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
    // Nacht-Spiele (00:00 bis 05:59) gehören zum Vortag (Sporttag) und
    // stehen mit "Nacht" da (Rene, 28.10.2026).
    const today = sportDay(Date.now());
    const day = sportDay(game.kickoff);
    const sub = isNightKickoff(game.kickoff)
      ? "Nacht"
      : day === today ? "heute" : day < today ? "gestern" : day === addDays(today, 1) ? "morgen" : dayLabel(day).split(",")[0];
    return { main: viennaTime(game.kickoff), sub, muted: true };
  }
  if (isLiveFinished(game.status)) {
    const sub =
      game.status === "AET" ? "n. V." : game.status === "PEN" ? (sport === "Fußball" ? "i. E." : sport === "NHL" ? "n. P." : game.statusText) : undefined;
    return { main: "Endstand", sub, muted: true };
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

// Gast zuerst bei API-Spielen ohne App-Spiel: wie isAwayFirst, Land aus der
// API-Liga (z. B. "NHL · USA").
function liveAwayFirst(sport: Sport, game: LiveGame): boolean {
  return isAwayFirst(sport, { countryCode: liveGameCountry(game.league) });
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
  // Tippschluss noch nicht vorbei: Countdown rechts, getippt oder nicht
  // (Rene, 27.10.2026: "kein Countdown vor dem Spiel"). "Tippen" nur ungetippt.
  const open = canTip(game);
  const tippable = !tipped && open;
  const selected = selectedId === game.id;
  const link = links.get(game.id);
  const teamName = useApiTeamName(sport);
  const { orderFor } = useAppData();
  // Mit App-Spiel: Namen wie in der App (gleiche Schreibweise wie auf der
  // Tippkarte), sonst der eigene Vereinsname zum API-Namen.
  const homeName = link ? (link.result.swapped ? link.away.name : link.home.name) : teamName(game.home);
  const awayName = link ? (link.result.swapped ? link.home.name : link.away.name) : teamName(game.away);
  // Sender vom Admin: am Tippspiel bzw. im Matchcenter-Detail eingetragen.
  const tv = useGameTv(sport)(game, link);

  const status = rowStatus(sport, game, clock?.text ?? null);
  const sub = status.sub && status.sub !== "heute" ? status.sub : null;
  // Läuft: leuchtender Rand links statt roter Zeitlinie unten (Rene,
  // 27.10.2026, Variante C): rot = läuft, gelb = Pause.
  const glow = running ? (status.dot === "pause" ? "pause" : "live") : null;
  const moved = useSectionMove(game.id, running ? "live" : game.status === "NS" ? "ns" : "done");
  // Beendet (Rene, 27.10.2026: "müssen anders aussehen"): Zeile blasser,
  // "Endstand", Sieger und seine Tore hell und fett, der Rest gedämpft.
  const done = isLiveFinished(game.status) && hasScore;
  const homeWins = done && game.homeScore! > game.awayScore!;
  const awayWins = done && game.awayScore! > game.homeScore!;
  // US-Ligen "Gast @ Heim": Gast zuerst (oben bzw. links), Heim danach, wie
  // auf der Tippkarte (Rene, 28.10.2026).
  const awayFirst = link ? orderFor(link.match).awayFirst : liveAwayFirst(sport, game);
  const [firstName, secondName] = awayFirst ? [awayName, homeName] : [homeName, awayName];
  const [firstWins, secondWins] = awayFirst ? [awayWins, homeWins] : [homeWins, awayWins];
  const [firstScore, secondScore] = awayFirst ? [game.awayScore, game.homeScore] : [game.homeScore, game.awayScore];
  const nameTone = (wins: boolean) => (!done ? "text-ink" : wins ? "font-semibold text-ink" : "text-muted");
  const scoreTone = (wins: boolean) => (done && !wins ? "text-muted" : "");
  // Laufend (Rene, 27.10.2026): Spielstand rot.
  const scoreColor = hasScore ? (running ? "text-red-500" : "text-ink") : "text-muted";

  return (
    <button
      type="button"
      onClick={() => onSelect(game.id)}
      aria-pressed={selected}
      style={glow ? { boxShadow: GLOW[glow] } : undefined}
      // Gewählt: hellerer Hintergrund und weißlicher Rahmen statt Gold, damit
      // der rote Live-Rand klar bleibt (Rene, 27.10.2026). Gold nur für "Tippen".
      className={`relative w-full overflow-hidden rounded-card border px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow] sm:pl-4 ${
        moved ? "motion-safe:animate-lc-row-in" : ""
      } ${
        selected
          ? "border-ink/50 bg-surface-hover"
          : tippable
            ? "border-gold/45 bg-surface hover:border-gold/70"
            : done
              ? "border-muted/15 bg-surface/50 hover:border-muted/40"
              : "border-muted/25 bg-surface hover:border-muted/50"
      }`}
    >
      <div className="grid grid-cols-[4.75rem_minmax(0,1fr)] items-center gap-x-2.5 text-sm">
        {/* "Getippt" steht klein unter dem Status statt absolut über der
            Tor-Spalte – dort überlappte es die obere Tor-Zahl (Rene, 15.10.2026). */}
        {/* Feste Breite, nichts läuft in die Namen (Rene, 16.10.2026):
            Zeile 1 groß/fett, Zeile 2 klein muted, "Getippt" darunter. */}
        <span className="flex w-[4.75rem] min-w-0 flex-col gap-0.5 overflow-hidden tabular-nums">
          <span className={`flex min-w-0 items-center gap-1 text-[13px] font-semibold leading-tight ${status.muted ? "text-muted" : "text-ink"}`}>
            {status.dot && <StateDot state={status.dot} />}
            <span className={`min-w-0 ${sub && tv ? "shrink-0" : "truncate"}`}>{status.main}</span>
            {/* Mit Sender darunter steht der Zusatz in derselben Zeile
                ("Verl. 122'"), damit jede Zeile höchstens zwei Zeilen hoch
                ist (Rene, 27.10.2026: "die Spalte ist höher"). */}
            {sub && tv && <span className="min-w-0 truncate text-[10px] font-normal text-muted">{sub}</span>}
          </span>
          {/* "heute" steht schon im Reiter, nur "morgen"/"gestern" zeigen (Rene, 27.10.2026: flachere Zeilen). */}
          {sub && !tv && <span className="truncate text-[10px] leading-tight text-muted">{sub}</span>}
          {/* Sender unter der Uhrzeit (Rene, 28.10.2026), rechts stehen
              "Tippen" und der Countdown. */}
          {tv && (
            <span className="flex min-w-0 items-center gap-1 text-[10px] font-medium leading-tight text-muted" title={tv}>
              <TvIcon className="h-3 w-3 shrink-0" />
              <span className="truncate">{tv}</span>
            </span>
          )}
          {/* Vor Tippschluss steht "Getippt" rechts über dem Countdown. */}
          {tipped && !open && <span className="truncate text-[10px] font-semibold leading-tight text-gold">Getippt</span>}
        </span>
        {/* Namen und Tore in einem Raster (Rene, 27.10.2026): jede Tor-Zahl
            steht genau neben ihrem Verein, auch wenn ein Name zwei Zeilen
            braucht. Die Tore stehen mittig in einer festen Spalte, so liegen
            "1" und "0" sauber untereinander (Poppins hat schmale Einsen).
            Beim Tippspiel steht dort "Tippen" und der Countdown. */}
        <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 lg:hidden">
          <FitText text={firstName} maxLines={2} minPx={12} className={`col-start-1 row-start-1 leading-tight ${nameTone(firstWins)}`} />
          <FitText text={secondName} maxLines={2} minPx={12} className={`col-start-1 row-start-2 leading-tight ${nameTone(secondWins)}`} />
          {open && link ? (
            <span className="col-start-2 row-span-2 row-start-1 justify-self-end">
              <TipStatus deadline={link.match.tipDeadline} tipped={tipped} />
            </span>
          ) : (
            <span
              className={`col-start-2 row-span-2 row-start-1 grid grid-rows-subgrid rounded-md font-display text-[15px] font-bold leading-tight tabular-nums transition-colors duration-700 ${
                flash ? "bg-gold/15 text-gold" : scoreColor
              }`}
            >
              <span className={`min-w-7 whitespace-nowrap text-center ${scoreTone(firstWins)}`}>{hasScore ? firstScore : "–"}</span>
              <span className={`min-w-7 whitespace-nowrap text-center ${scoreTone(secondWins)}`}>{hasScore ? secondScore : "–"}</span>
            </span>
          )}
        </span>
        {/* Am PC eine Zeile wie eine Anzeigetafel (Rene, 27.10.2026: "Handy
            und Web nicht gleich bauen"): Heim rechtsbündig, Ergebnis in der
            Mitte, Gast links. Lange Namen brechen um oder werden kleiner
            statt abgeschnitten. Rechts eine schmale feste Spalte mit "Tippen"
            und dem Countdown (Sender steht links unter der Uhrzeit). Feste Breite, damit
            das Ergebnis in jeder Zeile an derselben Stelle steht. */}
        {/* Ergebnisfelder mit Mindest- statt fester Breite, damit auch
            dreistellige Spielstände (NBA, z. B. 125:124) hineinpassen. */}
        <span className="hidden min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_6.5rem] items-center gap-x-4 lg:grid">
          <FitText text={firstName} maxLines={2} minPx={12} className={`text-right text-[15px] leading-tight ${nameTone(firstWins)}`} />
          <span
            className={`flex items-center justify-center rounded-md border border-edge bg-pitch px-2 py-1 font-display text-lg font-bold leading-none tabular-nums transition-colors duration-700 ${
              flash ? "border-gold/50 bg-gold/15 text-gold" : scoreColor
            }`}
          >
            <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(firstWins)}`}>{hasScore ? firstScore : "–"}</span>
            <span className="px-0.5 text-muted">:</span>
            <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(secondWins)}`}>{hasScore ? secondScore : "–"}</span>
          </span>
          <FitText text={secondName} maxLines={2} minPx={12} className={`text-[15px] leading-tight ${nameTone(secondWins)}`} />
          <span className="flex min-w-0 flex-col items-end">
            {open && link && <TipStatus deadline={link.match.tipDeadline} tipped={tipped} />}
          </span>
        </span>
      </div>
    </button>
  );
}

// Leuchtrand links für laufende Spiele (innen 3 px, außen ein leichter Schein).
const GLOW = {
  live: "inset 3px 0 0 rgb(239 68 68), 0 0 14px -6px rgb(239 68 68)",
  pause: "inset 3px 0 0 rgb(250 204 21)",
} as const;

// Admin: TV-Sender für ein Spiel ohne Tippspiel eintragen (Rene, 28.10.2026).
// Tippspiele bekommen ihren Sender weiter im Admin am Spiel.
function FixtureTvEditor({ sport, game }: { sport: Sport; game: LiveGame }) {
  const { isAdmin } = useUser();
  const { fixtureTv, saveFixtureTv } = useAppData();
  const saved = fixtureTvFor(fixtureTv, sport, game.id) ?? "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);
  if (!isAdmin) return null;
  const changed = value.trim() !== saved;
  return (
    <form
      className="flex items-center gap-2 rounded-lg border border-dashed border-edge px-3 py-2 text-[13px]"
      onSubmit={(e) => {
        e.preventDefault();
        if (changed) saveFixtureTv({ sport, fixtureId: game.id, kickoff: game.kickoff, channel: value });
      }}
    >
      <TvIcon className="h-4 w-4 shrink-0 text-muted" />
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="TV-Sender (nur Admin), z. B. Sky"
        aria-label="TV-Sender"
        className="min-w-0 flex-1 bg-transparent text-ink placeholder:text-muted focus:outline-none"
      />
      {changed && (
        <button type="submit" className="shrink-0 font-semibold text-gold hover:underline">
          {value.trim() ? "Speichern" : "Löschen"}
        </button>
      )}
    </form>
  );
}

// Tippspiel vor Tippschluss: rechts statt der Striche oben "Tippen" (bzw.
// "Getippt"), darunter bis wann. Gleiche Regel wie auf der Tippkarte
// (components/Countdown.tsx, Rene 28.10.2026: "der Countdown muss zum
// Tippschluss passen"): mehr als 3 Std. vorher "bis 20:45", ab 3 Std. ein
// laufender Countdown bis Tippschluss, letzte 30 Min. orange mit ⏰.
// Etwas Abstand zwischen Schild und Zeit (Rene, 28.10.2026: "zu nah").
function TipStatus({ deadline, tipped }: { deadline: string; tipped: boolean }) {
  const target = Date.parse(deadline);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const label = tipped ? (
    <span className="text-[10px] font-semibold leading-[1.4] text-gold">Getippt</span>
  ) : (
    // Goldenes Schild mit Glanz (Rene, 27.10.2026, Variante C; Glanz in globals.css).
    <span className="tip-shine w-fit rounded-full bg-gold px-1.5 text-[10px] font-bold leading-[1.4] text-pitch">Tippen</span>
  );
  if (now === null) {
    return (
      <span className="flex flex-col items-end gap-1">
        {label}
        <span className="text-[13px] leading-tight opacity-0">&nbsp;</span>
      </span>
    );
  }
  const ms = Math.max(0, target - now);
  const left = Math.floor(ms / 1000);
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const sec = left % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const counting = ms <= COUNTDOWN_FROM;
  const soon = ms <= 30 * 60 * 1000;
  return (
    <span className="flex flex-col items-end gap-1">
      {label}
      {counting ? (
        <span
          className={`flex items-baseline gap-1 whitespace-nowrap leading-tight tabular-nums ${soon ? "text-[#FF9B5C]" : "text-gold"}`}
          role="timer"
          aria-label={`Noch ${h > 0 ? `${h} Std. ` : ""}${m} Min. bis Tippschluss`}
        >
          <span className="text-[10px] font-semibold opacity-80">{soon ? "⏰ noch" : "noch"}</span>
          <span className="font-display text-[13px] font-bold">{h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`}</span>
        </span>
      ) : (
        <span className="whitespace-nowrap text-[11px] font-semibold leading-tight text-gold">bis {deadlineText(target, now)}</span>
      )}
    </span>
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
  const order: TeamOrder = match ? orderFor(match) : { sport, awayFirst: liveAwayFirst(sport, game) };
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
  // Reiter Spiel / Aufstellung / Statistik (Rene, 27.10.2026: Pro-Plan),
  // nur Fußball. Daten erst laden, wenn ein Reiter offen ist.
  const [tab, setTab] = useState<"spiel" | "aufstellung" | "statistik">("spiel");
  const hasInfo = sport === "Fußball";
  const info = useMatchInfo(hasInfo && tab !== "spiel" ? game.id : null, isLiveRunning(game.status));
  const swapped = !!link?.result.swapped;
  const firstApiName = (leftSide === "home") !== swapped ? game.home : game.away;

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

      {!link && <FixtureTvEditor sport={sport} game={game} />}

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

      {hasInfo && (
        <div className="flex gap-1 rounded-full border border-edge bg-pitch/60 p-1" role="tablist">
          {(
            [
              ["spiel", "Spiel"],
              ["aufstellung", "Aufstellung"],
              ["statistik", "Statistik"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 rounded-full py-1.5 text-[13px] font-semibold transition-colors ${
                tab === id ? "bg-gold text-pitch" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tab === "aufstellung" && (
        <LineupView info={info.data} failed={info.failed} onRetry={info.retry} firstApiName={firstApiName} teamName={teamName} started={started} />
      )}
      {tab === "statistik" && (
        <StatsView info={info.data} failed={info.failed} onRetry={info.retry} firstApiName={firstApiName} started={started} />
      )}

      {tab === "spiel" && (
        <>
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
        </>
      )}
    </div>
  );
}
