"use client";

import EmptyState from "@/components/EmptyState";
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SWIPE_EVENT, type SwipeDetail } from "@/components/SwipeNav";
import AdBanner from "@/components/AdBanner";
import FitText from "@/components/FitText";
import { StadiumIcon, TvIcon } from "@/components/Icons";
import {
  appSideEvents,
  appSideShootout,
  appSidePenalties,
  findLiveGame,
  isLiveFinished,
  isLiveRunning,
  isLiveDelayed,
  updatedAgoText,
  type LiveGame,
  type LiveSource,
  type LiveMatchResult,
} from "@/lib/liveScores";
import { reloadLiveDay, useLiveDay, useLivePolling, useStadium, type LiveDay } from "@/lib/useLiveScores";
import { CUP_ZONES, cupZone, TABLE_LEAGUES, type CupZone, type StandingGroup, type StandingsResponse } from "@/lib/standings";
import { LIVE_SPORTS, leagueRank, liveGameCountry, liveGameLeague } from "@/lib/liveConfig";
import { flagEmoji } from "@/lib/flags";
import {
  currentRoundIndex,
  FIXTURE_LEAGUES,
  groupRounds,
  type FixtureLeague,
  type FixtureRound,
  type FixturesResponse,
} from "@/lib/competitionFixtures";
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";
import { useAppData } from "@/lib/AppDataContext";
import { competitionFlag } from "@/lib/competitionFlag";
import { displayOrder, isAwayFirst, scoreText, type TeamOrder } from "@/lib/teamOrder";
import { SPORT_ICONS, sportLabel, type Match, type Sport, type Team } from "@/lib/types";
import TeamBadge, { jerseyFor, matchJerseyProps, teamColorProps } from "@/components/TeamBadge";
import { LineupView, PreviewView, StatsView, useMatchInfo, useMatchPreview } from "@/components/MatchInfo";
import Emoji from "@/components/Emoji";
import type { F1Session } from "@/lib/live/providers/apiSports";
import { viennaDate } from "@/lib/liveScores";
import type { Formula1Response } from "@/app/api/formula1/route";
import LiveTvHeat, { type TvGame } from "@/components/LiveTvHeat";
import MatchSheet from "@/components/MatchSheet";
import {
  EventTimeline,
  ShootoutList,
  LivePill,
  Scoreboard,
  StateDot,
  useBoardClock,
  type BoardSide,
} from "@/components/LiveMatch";
import { liveTipLabel } from "@/lib/liveTipText";
import { appTeamForApiName, appTeamName } from "@/lib/teamApiNames";
import { fixtureJerseyFor, fixtureTvFor } from "@/lib/fixtureTv";
import { GUEST_PRIMARY_COLOR, GUEST_SECONDARY_COLOR } from "@/lib/guestTeam";
import { useUser } from "@/lib/UserContext";
import { COUNTDOWN_FROM } from "@/components/Countdown";
import { deadlineText } from "@/lib/dayGroups";
import { isMatchTippable, isMorningAfterNight, isNightKickoff, planDayRange, relativeDayLabel, sportDay, tipCardHref, viennaCalendarDay } from "@/lib/matchcenterLink";
import Link from "next/link";
import { signalAppReady } from "@/lib/appReady";
import { useStartExperience } from "@/lib/useStartExperience";
import { DuelTourButtons } from "@/components/NavTabs";
import { findLiveFor, isMinorTournament, shortPlayer, tournamentPointsText, tournamentRank, type TennisListResponse, type TennisLiveGame, type TennisLiveResponse, type TennisPlanGame, type TennisRankRow, type TennisStatsResponse } from "@/lib/tennisLive";

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

// Eigenes Team zu einem API-Namen (Vereinsnamen oder gleicher Name), damit
// auch Spiele ohne Tippspiel Trikots zeigen (Rene, 28.10.2026).
function useApiTeam(sport: Sport | undefined): (apiName: string) => Team | undefined {
  const { teams, apiNameLinks } = useAppData();
  return useMemo(
    () => (apiName: string) => (sport ? appTeamForApiName(teams, apiNameLinks, sport, apiName) : undefined),
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

      {/* Live-Bereich mit Detail (Rene, 15.10.2026: Spieltag-Umbau), nur die
          in lib/liveConfig.ts eingeschalteten Ligen (zum Testen Europa League). */}
      {LIVE_SPORT && <LiveCenter />}

      <AdBanner />
    </main>
  );
}

// Am Handy 40 px hoch, alle in einer Reihe ohne Wischen, damit man nicht
// zwei Reiter auf einmal trifft (Rene, 28.10.2026). Ohne Rahmen, nur Text mit
// goldenem Strich wie am PC, damit sie sich von den eingekreisten Sportarten
// abheben (Rene, 29.10.2026, Variante A). Ab sm etwas größer (16 px, mehr
// Abstand). Handy-Schrift 13,5/14 px statt 12,5/13 px (Rene, 06.11.2026:
// "nur um ganz wenig größer"), passt auch bei 320 px in eine Reihe.
function SubTab({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex h-10 min-w-0 flex-auto items-center justify-center whitespace-nowrap px-1 font-display text-[13.5px] font-semibold transition-colors min-[400px]:text-[14px] sm:h-auto sm:flex-none sm:px-0 sm:py-3 sm:text-base ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-1.5 -bottom-px h-[3px] rounded-full bg-gold sm:inset-x-0 sm:h-0.5" />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Live-Bereich (Rene, 15.10.2026: Spieltag-Umbau, vorher nur "UEFA Europa
// League"). Live-Daten von API-Sports über /api/live, aus demselben Speicher
// wie die Tippkarten (lib/useLiveScores.ts). Nur eingeschaltete Ligen laut
// lib/liveConfig.ts (die Route filtert schon). "Spielplan" mit einem Tag
// zum Blättern (Rene, 30.10.2026, statt "Ergebnisse" und der Liste der
// nächsten 7 Tage) und "Tabelle" (API-Sports, /api/standings); bei den
// anderen Sportarten steht unter "Tabelle" ein Hinweis.
//
// Am PC zweispaltig: links die Liste, rechts (400–460 px) das Detail des
// gewählten Spiels. Am Handy steht das Detail unter der Liste, beim
// Antippen wird dorthin gescrollt. Standardmäßig ist das erste getippte
// laufende Spiel gewählt.

// Erste eingeschaltete Sportart (Fußball). Seit 16.10.2026 auch Eishockey:
// bei mehreren Sportarten oben ein Umschalter (Rene, 16.10.2026).
const LIVE_SPORT: Sport | null = LIVE_SPORTS[0] ?? null;
const MAX_LIVE_MS = 4 * 60 * 60 * 1000;

type LcView = "live" | "spielplan" | "tabelle";

// Ab so vielen Abfragen pro Tag gilt der Pro-Plan (wie FAST_PLAN_LIMIT in
// lib/live/providers/apiSports.ts).
const PRO_PLAN_LIMIT = 1000;

// API-Spiel ↔ App-Spiel (für "GETIPPT", "Dein Tipp", Community, Kommentare).
interface AppLink {
  match: Match;
  home: Team;
  away: Team;
  result: LiveMatchResult;
}

// Am PC (ab lg) steht das Detail rechts, am Handy öffnet es als Fenster.
function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

// "2026-10-15" -> "2026-10-14" (days = -1), "2026-10-16" (days = 1)
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Sporttag aus zwei Kalendertagen (Rene, 28.10.2026: US-Spiele in der
// Nacht): vom Kalendertag die Spiele ab 06:00, vom nächsten die Nacht-
// Spiele bis 06:00 (lib/matchcenterLink.ts, sportDay). Zeitstand und Quelle
// vom Teil mit laufenden Spielen, damit "verzögert" ehrlich bleibt.
// Nacht-Spiele vom Morgen dieses Kalendertags (00:00–05:59), die zum
// Sporttag davor gehören, bleiben unter "Heute" (Rene, 10.11.2026:
// Islanders – Sharks lief um 06:50 noch, stand aber nur unter "Gestern"):
// carry "running" = nur die, die noch laufen (bis Schluss), "morning" =
// alle, also auch die beendeten mit Endstand (bis 12:00, isMorningAfterNight).
type Carry = "none" | "running" | "morning";
function sportDayGames(day: LiveGame[] | null, night: LiveGame[] | null, carry: Carry = "none"): LiveGame[] | null {
  if (!day || !night) return null;
  const keep = (g: LiveGame) => carry === "morning" || (carry === "running" && isLiveRunning(g.status));
  return [
    ...day.filter((g) => !isNightKickoff(g.kickoff) || keep(g)),
    ...night.filter((g) => isNightKickoff(g.kickoff)),
  ];
}

// Was für "Heute" mitgenommen wird (siehe sportDayGames). Nur wenn der
// Kalendertag der Sporttag ist (ab 06:00), sonst wären es Spiele von vor
// einem Tag.
function todayCarry(now: number | null): Carry {
  if (now === null || isNightKickoff(now)) return "none";
  return isMorningAfterNight(now) ? "morning" : "running";
}

// Läuft im Kalendertag noch ein Nacht-Spiel vom Morgen (siehe sportDayGames)?
function hasRunningCarryOver(day: LiveGame[] | null): boolean {
  return !!day && day.some((g) => isNightKickoff(g.kickoff) && isLiveRunning(g.status));
}

// games: schon zusammengesetzt (useMemo), damit die Liste nicht bei jedem
// Rendern neu entsteht.
function mergeSportDay(day: LiveDay, night: LiveDay, games = sportDayGames(day.games, night.games)): LiveDay {
  // Nach Herkunft der Liste (ein noch laufendes Nacht-Spiel vom Morgen
  // stammt aus der Liste des Kalendertags, nicht aus der Nacht danach).
  const fromDay = new Set(day.games ?? []);
  const nightRunning = !!games?.some((g) => !fromDay.has(g) && isLiveRunning(g.status));
  const dayRunning = !!games?.some((g) => fromDay.has(g) && isLiveRunning(g.status));
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
  // Nur echte Ländercodes ("FR", "GB-SCT"); ein unbekannter Ländername der
  // API ergäbe sonst kaputte Zeichen statt einer Flagge.
  return country && /^[A-Z]{2}(-[A-Z]{3})?$/.test(country) ? flagEmoji(country) : null;
}

// Farbverlauf je Sportart für die Knöpfe oben (--a hell, --z dunkel).
const SPORT_CHIP_COLORS: Record<string, CSSProperties> = {
  "Fußball": { "--a": "#2f9e5b", "--z": "#0f3b2a" } as CSSProperties,
  NHL: { "--a": "#3b82c4", "--z": "#172a4a" } as CSSProperties,
  NBA: { "--a": "#e0452b", "--z": "#4b2a8f" } as CSSProperties,
  NFL: { "--a": "#a0522d", "--z": "#1f2c4f" } as CSSProperties,
  Handball: { "--a": "#d97706", "--z": "#3b2410" } as CSSProperties,
  Tennis: { "--a": "#a3c93a", "--z": "#1f4d1f" } as CSSProperties,
  motorsport: { "--a": "#d02a2a", "--z": "#1b1b1b" } as CSSProperties,
};

// Mehrere Sportarten (Rene, 16.10.2026): Umschalter ⚽/🏒 über dem
// Live-Bereich; je Sportart eigener Bereich (key → Auswahl beginnt neu).
function LiveCenter() {
  const [sport, setSport] = useState<Sport>(LIVE_SPORT ?? "Fußball");
  // Motorsport (Rene, 30.10.2026) steht neben den Sportarten, ist aber
  // (noch) keine Tipp-Sportart: eigener Bereich, siehe MotorsportCenter.
  const [motorsport, setMotorsport] = useState(false);
  // Tennis (Rene, 10.11.2026): eigener Bereich mit den Tennis-Tippspielen,
  // bis die Tennis-API angebunden ist (dann Live, Spielplan, Weltrangliste).
  const [tennis, setTennis] = useState(false);
  // Von der Tippkarte (/matchcenter?spiel=<App-Spiel>, Rene, 27.10.2026):
  // Sportart des Spiels wählen und das Spiel öffnen.
  const { matches } = useAppData();
  const [targetId, setTargetId] = useState<string | null>(null);
  useEffect(() => {
    setTargetId(new URLSearchParams(window.location.search).get("spiel"));
  }, []);
  const target = targetId ? matches.find((m) => m.id === targetId) ?? null : null;
  useEffect(() => {
    if (target && LIVE_SPORTS.includes(target.sport)) {
      setSport(target.sport);
      setMotorsport(false);
      setTennis(false);
    }
    if (target && target.sport === "Tennis") {
      setMotorsport(false);
      setTennis(true);
    }
  }, [target]);
  // Logo = Anfangsseite (Rene, 01.11.2026): wieder Fußball (bzw. die
  // erste Sportart), auch wenn man gerade NHL, NBA, NFL oder Motorsport
  // offen hat. "Heute", nach oben usw. setzt LiveCenterSection zurück.
  useEffect(() => {
    function backToStart() {
      setTargetId(null);
      setSport(LIVE_SPORT ?? "Fußball");
      setMotorsport(false);
      setTennis(false);
    }
    window.addEventListener("pooltipp:logo", backToStart);
    return () => window.removeEventListener("pooltipp:logo", backToStart);
  }, []);
  const pick = (s: Sport) => {
    setTargetId(null);
    setMotorsport(false);
    // Tennis hat einen eigenen Bereich (Knopf "Heute in anderen Sportarten").
    if (s === "Tennis") {
      setTennis(true);
      return;
    }
    setSport(s);
    setTennis(false);
  };
  // Sportart-Knöpfe mit Farbverlauf und Tiefe (Rene, 06.11.2026,
  // Variante A): jede Sportart hat ihre Farbe, die gewählte hat einen
  // scharfen Goldring, die anderen sind etwas gedämpft. Kein Rahmen, am Handy
  // kein Name (Name steht in aria-label), am PC der Name daneben.
  const sportButton = (key: string, label: string, icon: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={active}
      aria-label={label}
      onClick={onClick}
      className={`group flex min-h-11 min-w-12 items-center justify-center gap-2.5 font-semibold lg:gap-2 transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      <span className={`sport-chip ${active ? "sport-chip-on" : ""}`} style={SPORT_CHIP_COLORS[key]}>
        <span className="sport-chip-icon text-[22px] leading-none">
          <Emoji e={icon} />
        </span>
      </span>
      <span className="hidden text-[15px] lg:inline">{label}</span>
    </button>
  );
  // Oben eine Reihe (Rene, 27.10.2026, Variante C): die Sportarten einzeln
  // (Namen erst ab lg:). Kein Tippspiel-Kästchen mehr (Rene, 29.10.2026:
  // im Matchcenter nur das echte Spiel).
  // Am Handy mind. 48 × 44 px pro Knopf, damit man gut mit dem Finger
  // trifft (Rene, 28.10.2026).
  const switcher = (
    <div className="mb-3 flex items-center gap-2">
      {/* Am PC deutlich mehr Abstand zwischen den Sportarten als zwischen
          Icon und Name (Rene, 10.11.2026: sonst unklar, welcher Name zu
          welchem Icon gehört). */}
      <div className="flex gap-2 min-[380px]:gap-2.5 lg:gap-5 xl:gap-10" role="tablist" aria-label="Sportart">
        {LIVE_SPORTS.map((s) =>
          // "NFL" statt "American Football" (Rene, 10.11.2026).
          sportButton(s, s === "NFL" ? "NFL" : sportLabel(s), SPORT_ICONS[s], !motorsport && !tennis && sport === s, () => pick(s))
        )}
        {sportButton("Tennis", "Tennis", "🎾", tennis, () => {
          setTargetId(null);
          setMotorsport(false);
          setTennis(true);
        })}
        {/* Zielflagge statt Rennauto (Rene, 30.10.2026: "nicht nur an Formel 1
            denken, deswegen heißt es Motorsport"). */}
        {sportButton("motorsport", "Motorsport", "🏁", motorsport, () => {
          setTargetId(null);
          setTennis(false);
          setMotorsport(true);
        })}
      </div>
      {/* Am PC rechts in derselben Zeile: Duelle + Turniere (Rene,
          06.11.2026, Variante A). Am Handy sind sie in der Leiste unten. */}
      <DuelTourButtons className="ml-auto hidden lg:flex" />
    </div>
  );
  if (motorsport) return <MotorsportCenter switcher={switcher} />;
  if (tennis) return <TennisCenter switcher={switcher} />;
  return (
    <LiveCenterSection key={sport} sport={sport} switcher={switcher} target={target?.sport === sport ? target : null} onPickSport={pick} />
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

function LiveCenterSection({
  sport,
  switcher,
  target,
  onPickSport,
}: {
  sport: Sport;
  switcher?: React.ReactNode;
  target: Match | null;
  onPickSport?: (s: Sport) => void;
}) {
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
      setPlanDay(null);
      setPlanMode("tag");
      setRoundKey(null);
      // Gewähltes Spiel vergessen: wie beim Öffnen wieder automatisch das
      // erste laufende (getippte) Spiel zeigen (Rene, 01.11.2026).
      pickedRef.current = false;
      setSelectedId(null);
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
  // Kalendertag in Wien: davon geht der Spielplan aus ("Heute", Rene
  // 30.10.2026). Um 03:30 ist der Sporttag noch gestern, der Kalendertag
  // schon heute.
  const [calToday, setCalToday] = useState<string | null>(null);
  // Gewählter Tag im Spielplan, null = heute.
  const [planDay, setPlanDay] = useState<string | null>(null);
  // Spielplan "Nach Tag" oder "Nach Bewerb" (Rene, 04.11.2026, Variante A),
  // dazu der gewählte Bewerb und Spieltag (null = aktueller Spieltag).
  const [planMode, setPlanMode] = useState<PlanMode>("tag");
  const [fixtureLeagueId, setFixtureLeagueId] = useState(FIXTURE_LEAGUES[0].id);
  const [roundKey, setRoundKey] = useState<string | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Hat der Spieler selbst gewählt? Dann nichts mehr automatisch wählen.
  const pickedRef = useRef(false);
  const detailRef = useRef<HTMLDivElement>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const isDesktop = useIsDesktop();
  const { matches, getTeam, myTips, apiNameLinks } = useAppData();

  // Datum und Uhr erst im Browser (sonst Hydration-Fehler), Uhr alle 30 s.
  // today = Sporttag (06:00 bis 06:00 Wiener Zeit, Rene 28.10.2026).
  useEffect(() => {
    setToday(sportDay(Date.now()));
    setCalToday(viennaCalendarDay(Date.now()));
    setNow(Date.now());
    const t = setInterval(() => {
      setNow(Date.now());
      setToday(sportDay(Date.now()));
      setCalToday(viennaCalendarDay(Date.now()));
    }, 30 * 1000);
    return () => clearInterval(t);
  }, []);

  const tomorrow = today ? addDays(today, 1) : null;
  // Heute immer (Kalendertag + Nacht danach).
  const todayCal = useLiveDay(sport, today);
  const tomorrowCal = useLiveDay(sport, tomorrow);
  const carry = todayCarry(now);
  const todayGames = useMemo(
    () => sportDayGames(todayCal.games, tomorrowCal.games, carry),
    [todayCal.games, tomorrowCal.games, carry],
  );
  const todayDay = mergeSportDay(todayCal, tomorrowCal, todayGames);
  // Startbild am Handy ausblenden, sobald die Spiele von heute da sind
  // (lib/appReady.ts). Anderer Reiter beim Öffnen: gleich.
  const todayShown = todayDay.games !== null || !!todayDay.error || view !== "live";
  useEffect(() => {
    if (todayShown) signalAppReady();
  }, [todayShown]);
  // Spielplan (Rene, 30.10.2026): ein Tag, mit Pfeilen einen Tag zurück
  // oder vor. Mit Pro-Plan (Tageskontingent laut API-Sports ab
  // PRO_PLAN_LIMIT, Fußball) eine Woche in jede Richtung, im Gratis-Plan nur
  // gestern bis morgen. Vergangene Tage zeigen die Ergebnisse.
  const hasPlan = (todayDay.quota?.limit ?? 0) >= PRO_PLAN_LIMIT;
  const planRange = planDayRange(hasPlan);
  const planFirst = calToday ? addDays(calToday, -planRange.back) : null;
  const planLast = calToday ? addDays(calToday, planRange.ahead) : null;
  const inPlanRange = (date: string | null): date is string =>
    !!date && !!planFirst && !!planLast && date >= planFirst && date <= planLast;
  const shownPlanDay = planDay && inPlanRange(planDay) ? planDay : calToday;
  // Spielplan nach Bewerb: nur Fußball und nur mit Pro-Plan (die
  // Saison-Abfrage ist im Gratis-Plan gesperrt). Solange die Quote noch
  // unbekannt ist (erste Antwort), bleibt es angeboten.
  const hasBewerb = sport === "Fußball" && (!todayDay.quota || hasPlan);
  // Tag-Ansicht des Spielplans (sonst nach Bewerb, dann keine Tage laden).
  const dayPlanActive = view === "spielplan" && !(hasBewerb && planMode === "bewerb");
  // Je Tag auch die Nacht danach (Sporttag): ein Kalendertag mehr laden.
  const planCal = useLiveDay(sport, dayPlanActive ? shownPlanDay : null);
  const planNightCal = useLiveDay(sport, dayPlanActive && shownPlanDay ? addDays(shownPlanDay, 1) : null);
  const planGames = useMemo(() => sportDayGames(planCal.games, planNightCal.games), [planCal.games, planNightCal.games]);
  const planDayData = mergeSportDay(planCal, planNightCal, planGames);

  const bewerbActive = hasBewerb && view === "spielplan" && planMode === "bewerb";
  const fixtures = useFixtures(bewerbActive ? fixtureLeagueId : null);
  const rounds = useMemo(() => groupRounds(fixtures.data?.games ?? []), [fixtures.data]);
  const currentRound = now !== null ? currentRoundIndex(rounds, now) : -1;
  const pickedRound = roundKey ? rounds.findIndex((r) => r.key === roundKey) : -1;
  const roundIndex = pickedRound >= 0 ? pickedRound : currentRound;
  const shownRound: FixtureRound | null = bewerbActive ? rounds[roundIndex] ?? null : null;
  // Laufende Spiele von heute mit dem frischen Stand aus der Tagesliste
  // (der Spielplan selbst ist bis zu 30 Min. alt).
  const roundGames = useMemo(() => {
    if (!shownRound) return null;
    const fresh = new Map((todayDay.games ?? []).map((g) => [g.id, g]));
    return shownRound.games.map((g) => fresh.get(g.id) ?? g);
  }, [shownRound, todayDay.games]);
  const roundDays = useMemo(() => new Set((roundGames ?? []).map((g) => sportDay(g.kickoff))), [roundGames]);

  function openLeague(id: number) {
    setFixtureLeagueId(id);
    setRoundKey(null);
    setPlanMode("bewerb");
    setView("spielplan");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Am Handy seitlich wischen = Nachbar-Reiter (Rene, 29.10.2026), statt zur
  // nächsten Menüseite. Am ersten/letzten Reiter passiert nichts. Wo nicht
  // gewischt wird (Tabellen, Liga-Knöpfe, Spiel-Fenster), regelt SwipeNav.
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function onSwipe(e: Event) {
      e.preventDefault();
      const tabs: string[] = ["heute", "live", "spielplan", "tabelle"];
      const cur = view === "live" ? (onlyLive ? "live" : "heute") : view;
      const { dir } = (e as CustomEvent<SwipeDetail>).detail;
      const next = tabs[tabs.indexOf(cur) + (dir === "next" ? 1 : -1)];
      if (!next) return;
      setView(next === "heute" || next === "live" ? "live" : (next as LcView));
      setOnlyLive(next === "live");
      const el = listRef.current;
      if (el && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const cls = dir === "next" ? "animate-swipe-from-right" : "animate-swipe-from-left";
        el.classList.remove("animate-swipe-from-right", "animate-swipe-from-left");
        void el.offsetWidth;
        el.classList.add(cls);
        el.addEventListener("animationend", () => el.classList.remove(cls), { once: true });
      }
    }
    window.addEventListener(SWIPE_EVENT, onSwipe);
    return () => window.removeEventListener(SWIPE_EVENT, onSwipe);
  }, [view, onlyLive]);

  // Automatisch aktualisieren – nur solange ein Spiel läuft, im 180-s-Takt
  // (gemeinsam mit den Tippkarten, pausiert im Hintergrund).
  // Je Kalendertag nur, wenn in seinem Teil des Sporttags etwas läuft.
  const pollToday = partNeedsPolling(todayCal.games, false, now) || (carry !== "none" && hasRunningCarryOver(todayCal.games));
  const pollTomorrow = partNeedsPolling(tomorrowCal.games, true, now);
  const polling = pollToday || pollTomorrow;
  useLivePolling(sport, today, pollToday);
  useLivePolling(sport, tomorrow, pollTomorrow);

  const retry = () => {
    if (today) reloadLiveDay(sport, today);
    if (tomorrow) reloadLiveDay(sport, tomorrow);
    if (dayPlanActive && shownPlanDay) {
      reloadLiveDay(sport, shownPlanDay);
      reloadLiveDay(sport, addDays(shownPlanDay, 1));
    }
    if (bewerbActive) fixtures.reload();
  };

  // App-Spiele den API-Spielen zuordnen (gleiche Zuordnung wie die Tippkarten).
  const allGames = useMemo(() => {
    const seen = new Set((todayDay.games ?? []).map((g) => g.id));
    const list = [...(todayDay.games ?? [])];
    for (const g of [...(planDayData.games ?? []), ...(roundGames ?? [])]) {
      if (seen.has(g.id)) continue;
      seen.add(g.id);
      list.push(g);
    }
    return list;
  }, [todayDay.games, planDayData.games, roundGames]);
  const links = useMemo(() => {
    const map = new Map<string, AppLink>();
    if (allGames.length === 0) return map;
    for (const m of matches) {
      if (m.sport !== sport || m.draft || m.status === "cancelled") continue;
      const day = sportDay(m.kickoff);
      if (day !== today && !(view === "spielplan" && day === shownPlanDay) && !roundDays.has(day)) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const result = findLiveGame(allGames, m.kickoff, home.name, away.name);
      if (result && !map.has(result.game.id)) map.set(result.game.id, { match: m, home, away, result });
    }
    return map;
    // apiNameLinks: verknüpfte Vereinsnamen zählen bei findLiveGame mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGames, matches, getTeam, sport, today, view, shownPlanDay, roundDays, apiNameLinks]);
  const tippedMatchIds = useMemo(
    () => new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId)),
    [myTips],
  );
  const isTipped = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && tippedMatchIds.has(link.match.id);
  };
  // Tippspiel, das man noch tippen kann: in der Liste steht "Tippen" (Rene,
  // 30.10.2026: "da war doch immer Tippen", kam mit #401 weg).
  const canTip = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && now !== null && isMatchTippable(link.match, now);
  };

  // Von der Tippkarte: ein Spiel von heute steht unter "Heute", eines von
  // einem anderen Tag im Spielplan an seinem Tag (Rene, 30.10.2026).
  const targetDay = target ? sportDay(target.kickoff) : null;
  const targetInPlan = targetDay !== today && inPlanRange(targetDay);
  useEffect(() => {
    if (!targetDay || !targetInPlan) return;
    setView("spielplan");
    setPlanMode("tag");
    setPlanDay(targetDay);
  }, [targetDay, targetInPlan]);
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
    !!target && !targetGameId && !!todayDay.games && (!targetInPlan || (shownPlanDay === targetDay && !!planDayData.games));

  // Standard: erstes getipptes laufendes Spiel, sonst das erste laufende
  // (Rene, 29.10.2026: rechts steht das echte Spiel, nicht der Tipp).
  useEffect(() => {
    if (pickedRef.current || selectedId || !todayDay.games || target) return;
    const runningGames = todayDay.games.filter((g) => isLiveRunning(g.status)).sort(byKickoff);
    const first = runningGames.find((g) => isTipped(g)) ?? runningGames[0];
    if (first) setSelectedId(first.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayDay.games, links, tippedMatchIds, selectedId]);

  function select(id: string) {
    pickedRef.current = true;
    setSelectedId(id);
    if (typeof window === "undefined") return;
    // Am Handy öffnet das Spiel als Fenster über der Liste, die Liste bleibt
    // an ihrer Stelle (Rene, 28.10.2026).
    if (!window.matchMedia("(min-width: 1024px)").matches) {
      setSheetOpen(true);
      return;
    }
    // Am PC steht das Detail rechts oben: ist man in der Liste weit unten,
    // nach oben springen, sonst sieht man das gewählte Spiel nicht (Rene,
    // 28.10.2026). Steht der Anfang des Details schon im Bild, nichts tun.
    requestAnimationFrame(() => {
      const el = detailRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top;
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (top < margin || top > window.innerHeight * 0.6) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const selected = selectedId ? allGames.find((g) => g.id === selectedId) ?? null : null;
  const listProps = { sport, links, isTipped, canTip, selectedId, onSelect: select, onLeague: hasBewerb ? openLeague : undefined };

  const selectedLink = selected ? links.get(selected.id) ?? null : null;
  const runningCount = todayDay.games?.filter((g) => isLiveRunning(g.status)).length ?? 0;
  // "Live im TV" unter dem Detail (Rene, 27.10.2026): laufende Fußball-
  // Spiele mit TV-Sender, seit 28.10.2026 auch ohne Tippspiel. Ob die
  // Statistik da ist, prüft die Karte.
  const gameTv = useGameTv(sport);
  const tvTeamName = useApiTeamName(sport);
  const tvGames = useMemo((): TvGame[] => {
    // Fußball und NFL (Rene, 31.10.2026: NBA/NHL laufen nie gleichzeitig im TV).
    if ((sport !== "Fußball" && sport !== "NFL") || view !== "live") return [];
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

  // Spiel-Detail (bzw. Hinweis): am PC rechts, am Handy im Fenster.
  const detailContent = (
    <>
      {selected ? (
        <LcDetail
          key={selected.id}
          sport={sport}
          game={selected}
          link={selectedLink}
          dataAt={todayDay.games?.some((g) => g.id === selected.id) ? todayDay.dataAt : 0}
        />
      ) : targetMissing ? (
        <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
          Dieses Spiel ist (noch) nicht in den Live-Daten.{" "}
          {hasPlan
            ? `Der Spielplan reicht ${planRange.back} Tage zurück und ${planRange.ahead} Tage vor.`
            : "Der Spielplan reicht von gestern bis morgen."}
        </p>
      ) : (
        <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
          Spiel antippen, um Spielverlauf, Aufstellung und Statistik zu sehen.
        </p>
      )}
    </>
  );

  return (
    <section className="mb-6">
      {/* Oben Sportarten + Tippspiel-Kästchen, darunter die Reiter, ohne
          eigene Überschrift (Rene, 27.10.2026, Variante C). */}
      {switcher}
      <div className="mb-3 flex border-b border-edge sm:mb-4 sm:items-center sm:gap-6">
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
              {/* Roter Punkt nur, wenn gerade ein Spiel läuft (Rene, 28.10.2026). */}
              {runningCount > 0 && <StateDot state="live" />}
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
        {/* Kein Reiter "Ergebnisse" mehr (Rene, 30.10.2026): vergangene
            Tage stehen im Spielplan. Nochmal antippen = zurück auf heute. */}
        <SubTab
          label="Spielplan"
          active={view === "spielplan"}
          onClick={() => {
            // Nochmal antippen: zurück auf heute bzw. den aktuellen Spieltag.
            if (view === "spielplan") {
              setPlanDay(null);
              setRoundKey(null);
            }
            setView("spielplan");
          }}
        />
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
      </div>

      <div ref={listRef}>
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
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_460px]">
            {/* Liste, Spiel-Detail und TV-Karte je als eigene Karte mit klarem
                Rand und Abstand (Rene, 28.10.2026: "man muss sehen, dass es
                verschiedene Karten sind"). */}
            <div className="min-w-0 rounded-card border border-muted/40 bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)] lg:p-4">
              {view === "spielplan" ? (
                <>
                  {/* Spielplan-Kopf (Rene, 07.11.2026, Variante C): immer zwei
                      gleiche Leisten. Oben "Alle Ligen" (nach Tag) oder ein
                      Bewerb, darunter ‹ Tag › bzw. ‹ Spieltag ›. Am PC beide in
                      einer Zeile. */}
                  {(hasBewerb || (!bewerbActive && shownPlanDay && planFirst && planLast)) && (
                    <div className="mb-3 flex flex-col gap-2 border-b border-edge pb-3 lg:flex-row">
                      {hasBewerb && (
                        <LeaguePicker
                          leagues={PLAN_LEAGUES}
                          leagueId={bewerbActive ? fixtureLeagueId : ALL_LEAGUES_ID}
                          onPick={(id) => {
                            if (id === ALL_LEAGUES_ID) {
                              setPlanMode("tag");
                              return;
                            }
                            setPlanMode("bewerb");
                            setFixtureLeagueId(id);
                            setRoundKey(null);
                          }}
                          arrows={false}
                          inRow
                        />
                      )}
                      {!bewerbActive && shownPlanDay && planFirst && planLast && (
                        <DayNav
                          date={shownPlanDay}
                          now={now}
                          canBack={shownPlanDay > planFirst}
                          canAhead={shownPlanDay < planLast}
                          onPick={(days) => setPlanDay(addDays(shownPlanDay, days))}
                        />
                      )}
                      {bewerbActive && rounds[roundIndex] && (
                        <RoundNav rounds={rounds} roundIndex={roundIndex} onRound={(i) => rounds[i] && setRoundKey(rounds[i].key)} />
                      )}
                    </div>
                  )}
                  {bewerbActive ? (
                    <LcCompetition
                      rounds={rounds}
                      roundIndex={roundIndex}
                      currentRound={currentRound}
                      games={roundGames}
                      loading={!fixtures.data && !fixtures.failed}
                      error={fixtures.failed ? "" : fixtures.data?.error ?? null}
                      now={now}
                      onRound={(i) => rounds[i] && setRoundKey(rounds[i].key)}
                      onRetry={retry}
                      {...listProps}
                    />
                  ) : (
                  <LcDay key={shownPlanDay} games={planDayData.games} error={planDayData.error} onRetry={retry} {...listProps} />
                  )}
                </>
              ) : (
                <LcLive onlyLive={onlyLive} games={todayDay.games} error={todayDay.error} dataAt={todayDay.dataAt} source={todayDay.source} loading={polling && todayDay.loading} onRetry={retry} today={today} onPickSport={onPickSport} {...listProps} />
              )}
            </div>
            <div ref={detailRef} className="scroll-mt-32">
              <div>
                {isDesktop ? (
                  detailContent
                ) : (
                  <>
                    {!selected && detailContent}
                    <MatchSheet
                      open={sheetOpen && !!selected}
                      title={selected ? `${selectedLink ? selectedLink.home.name : selected.home} – ${selectedLink ? selectedLink.away.name : selected.away}` : ""}
                      onClose={() => setSheetOpen(false)}
                    >
                      {detailContent}
                    </MatchSheet>
                  </>
                )}
                <LiveTvHeat sport={sport} games={tvGames} selectedId={selectedId} onSelect={select} />
              </div>
            </div>
          </div>
        )}
      </div>

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
  // Liganame antippen → Spielplan des Bewerbs (nur Fußball).
  onLeague?: (id: number) => void;
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

// Kopf einer Liga (Rene, 30.10.2026, Variante A wie Livescore): Flagge im
// Kreis und Liganame, ohne ausgeschriebenes Land ("es reicht die Flagge").
// Ohne passende Flagge steht das Sport-Symbol im Kreis.
// Bewerb zur Liga eines Spiels aus der Tagesliste ("Bundesliga · Austria"),
// null = kein Spielplan (z. B. Länderspiel).
function fixtureLeagueOf(league: string): FixtureLeague | null {
  const live = liveGameLeague("Fußball", league);
  if (!live) return null;
  return FIXTURE_LEAGUES.find((l) => l.label === live.label && l.country === live.country) ?? null;
}

function LeagueHeading({ sport, game, onLeague }: { sport: Sport; game: LiveGame; onLeague?: (id: number) => void }) {
  const { competitions } = useAppData();
  const flag = liveLeagueFlag(sport, game, competitions);
  const name = leagueName(game, sport);
  const inner = (
    <>
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-surface-hover text-lg"
      >
        <Emoji e={flag ?? SPORT_ICONS[sport]} />
      </span>
      <span className="min-w-0">{name}</span>
    </>
  );
  // Überschrift antippen = Spielplan des Bewerbs (Rene, 04.11.2026: "wenn
  // man drauf klickt, dass sich der Spielplan öffnet"). Nur Bewerbe mit
  // Spielplan (lib/competitionFixtures.ts), sonst bleibt es reiner Text.
  // Ohne "Spielplan ›" rechts (Rene, 04.11.2026: "brauchen wir nicht, weil
  // es oben steht"); am PC wird der Name beim Drüberfahren gold.
  const fixtureLeague = onLeague && sport === "Fußball" ? fixtureLeagueOf(game.league) : null;
  if (onLeague && fixtureLeague) {
    return (
      <button
        type="button"
        onClick={() => onLeague(fixtureLeague.id)}
        aria-label={`Spielplan ${name}`}
        className="mb-2.5 flex min-h-11 w-full items-center gap-2.5 text-left font-display text-[15px] font-bold leading-tight text-ink transition-colors [@media(hover:hover)]:hover:text-gold"
      >
        {inner}
      </button>
    );
  }
  return <p className="mb-2.5 flex items-center gap-2.5 font-display text-[15px] font-bold leading-tight text-ink lg:text-base">{inner}</p>;
}

// Ligen untereinander, getrennt durch eine feine Linie über die ganze Breite
// (Rene, 30.10.2026: "klare Abgrenzung zu einer neuen Liga").
function LeagueGroups({
  sport,
  games,
  renderRow,
  onLeague,
}: {
  sport: Sport;
  games: LiveGame[];
  renderRow: (g: LiveGame) => ReactNode;
  onLeague?: (id: number) => void;
}) {
  return (
    <div className="flex flex-col divide-y divide-edge">
      {groupByLeague(sport, games).map((group) => (
        <div key={group.league} className="py-4 first:pt-0 last:pb-0">
          <LeagueHeading sport={sport} game={group.games[0]} onLeague={onLeague} />
          <div className="flex flex-col gap-2">{group.games.map(renderRow)}</div>
        </div>
      ))}
    </div>
  );
}

// Gruppiert nach "Name · Land" (Rene, 16.10.2026: sonst landen AT- und
// DE-Bundesliga in einer Gruppe). Reihenfolge der Ligen nach Wichtigkeit
// (Rene, 30.10.2026, siehe leagueRank), bei gleichem Platz (unbekannte
// Ligen) wie bisher nach dem ersten Spiel der Liga.
function groupByLeague(sport: Sport, games: LiveGame[]): { league: string; games: LiveGame[] }[] {
  const groups = new Map<string, LiveGame[]>();
  for (const g of games) {
    const key = g.league || "Weitere Spiele";
    groups.set(key, [...(groups.get(key) ?? []), g]);
  }
  return Array.from(groups, ([league, list]) => ({ league, games: list, rank: leagueRank(sport, league) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ league, games: list }) => ({ league, games: list }));
}

function LcLive({
  onlyLive = false,
  games,
  error,
  dataAt,
  source,
  loading,
  onRetry,
  today,
  onPickSport,
  ...listProps
}: ListProps & {
  today?: string | null;
  onPickSport?: (s: Sport) => void;
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
      <>
        <EmptyState
          emoji={SPORT_ICONS[sport]}
          title="Heute keine Spiele"
          text="Sobald wieder gespielt wird, siehst du hier alle Spiele live."
          className="border-none bg-transparent"
        />
        {!onlyLive && today && onPickSport && <OtherSportsToday sport={sport} today={today} onPick={onPickSport} />}
      </>
    );
  }
  // Reihenfolge (Rene, 27.10.2026): je Liga zusammen (alle ÖFB-Cup-Spiele,
  // alle Serie A …). Ligen nach Wichtigkeit (Rene, 30.10.2026, siehe
  // groupByLeague). In der Liga: laufende, dann nicht begonnene nach
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
  return (
    <div className="flex flex-col gap-4">
      {running.length > 0 && <LcLiveHeader sport={sport} count={running.length} dataAt={dataAt} source={source} />}
      <LeagueGroups
        sport={sport}
        onLeague={listProps.onLeague}
        games={[...running, ...upcoming, ...finished]}
        renderRow={(g) => <GameRow key={g.id} game={g} dataAt={dataAt} {...listProps} />}
      />
      {loading && <p className="text-center text-[11px] text-muted">Aktualisiert…</p>}
    </div>
  );
}

// Heute in anderen Sportarten (Rene, 09.11.2026): In der Länderspielpause
// stand am Start (Fußball) nur "Heute keine Spiele", obwohl in der Nacht
// NBA/NHL/NFL laufen. Die stehen unter ihrer Sportart (Sporttag 06:00 bis
// 06:00), hier als Knopf zum Hinwechseln. Lädt dieselben Tageslisten wie der
// Reiter der Sportart (gemeinsamer Speicher, keine Extra-Abfragen danach).
function useSportDayGames(sport: Sport, today: string): LiveGame[] | null {
  const day = useLiveDay(sport, today);
  const night = useLiveDay(sport, addDays(today, 1));
  // Wie der Reiter "Heute" der Sportart (Nacht-Spiele vom Morgen dabei).
  const carry = todayCarry(Date.now());
  return useMemo(() => sportDayGames(day.games, night.games, carry), [day.games, night.games, carry]);
}

function OtherSportsToday({ sport, today, onPick }: { sport: Sport; today: string; onPick: (s: Sport) => void }) {
  // LIVE_SPORTS ist fest, die Hooks laufen also immer gleich oft.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const perSport = LIVE_SPORTS.map((s) => ({ sport: s, games: useSportDayGames(s, today) }));
  const others: { sport: Sport; count: number; running: number; next: LiveGame | null }[] = perSport
    .filter((x) => x.sport !== sport && x.games && x.games.length > 0)
    .map((x) => {
      const list = x.games!;
      const running = list.filter((g) => isLiveRunning(g.status)).length;
      const next = list.filter((g) => g.status === "NS").sort(byKickoff)[0] ?? null;
      return { sport: x.sport, count: list.length, running, next };
    });
  // Tennis (Rene, 10.11.2026): laufende Spiele aus der Tennis-API, ohne ITF und
  // Challenger wie im Tennis-Bereich.
  const tennisLive = useTennisLive();
  const tennisCount = (tennisLive?.games ?? []).filter((g) => !isMinorTournament(g.tournament)).length;
  if (sport !== "Tennis" && tennisCount > 0) others.push({ sport: "Tennis", count: tennisCount, running: tennisCount, next: null });
  if (others.length === 0) return null;
  return (
    <div className="mx-auto mt-1 max-w-md px-1 pb-2">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted">Heute in anderen Sportarten</p>
      <div className="flex flex-col gap-2">
        {others.map((o) => (
          <button
            key={o.sport}
            type="button"
            onClick={() => {
              onPick(o.sport);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-edge bg-surface px-3 py-2 text-left transition-colors hover:border-gold/60"
          >
            <span className="text-[22px] leading-none" aria-hidden>
              <Emoji e={SPORT_ICONS[o.sport]} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[15px] font-semibold text-ink">{sportLabel(o.sport)}</span>
              <span className="block text-xs text-muted">
                {o.count} {o.count === 1 ? "Spiel" : "Spiele"}
                {o.running > 0
                  ? ` · ${o.running} live`
                  : o.next
                    ? ` · ab ${viennaTime(o.next.kickoff)}${viennaCalendarDay(o.next.kickoff) > viennaCalendarDay(Date.now()) ? " (morgen)" : ""}`
                    : ""}
              </span>
            </span>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="flex-none text-muted" aria-hidden>
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        ))}
      </div>
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

// Pfeil zum Blättern (Tag, Spieltag, Liga, Grand Prix), am Rand ausgegraut.
// Ein großes Feld (48 × 48 px) am Rand der Leiste (NavCapsule), mit Strich
// zum Text (Rene, 07.11.2026, Variante C).
function NavArrow({ dir, enabled, label, onClick }: { dir: -1 | 1; enabled: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-label={label}
      className={`flex w-12 shrink-0 items-center justify-center border-edge text-ink transition-colors [@media(hover:hover)]:hover:bg-surface-hover [@media(hover:hover)]:hover:text-gold disabled:pointer-events-none disabled:text-ink/25 ${
        dir < 0 ? "border-r" : "border-l"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
}

// Leiste ‹ Text › über die ganze Breite, 48 px hoch (Rene, 07.11.2026,
// Variante C): Tag, Spieltag, Liga (Tabelle am Handy) und Grand Prix sehen
// gleich aus wie die Liga-Auswahl darüber.
function NavCapsule({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex h-12 w-full min-w-0 items-stretch overflow-hidden rounded-[14px] border border-edge bg-pitch ${className}`}>{children}</div>
  );
}

// Text in der Mitte einer Leiste, zwei Zeilen.
function NavLabel({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <p className="flex min-w-0 flex-1 flex-col items-center justify-center px-2 text-center leading-tight" aria-live="polite">
      <span className="block max-w-full truncate font-display text-base font-bold text-ink">{title}</span>
      {sub && <span className="block max-w-full truncate text-xs text-muted">{sub}</span>}
    </p>
  );
}

// Spielplan-Kopf (Rene, 30.10.2026): "Heute" mit Pfeil links/rechts, je
// einen Tag zurück oder vor. Pfeile 44 × 44 px, damit man sie am Handy gut
// trifft. Am Rand des Bereichs ist der Pfeil ausgegraut.
function DayNav({
  date,
  now,
  canBack,
  canAhead,
  onPick,
}: {
  date: string;
  now: number | null;
  canBack: boolean;
  canAhead: boolean;
  onPick: (days: number) => void;
}) {
  const relative = now !== null ? relativeDayLabel(date, now) : null;
  const weekday = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-AT", { timeZone: "UTC", weekday: "long" });
  const short = new Date(`${date}T12:00:00Z`).toLocaleDateString("de-AT", { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const arrow = (dir: -1 | 1, enabled: boolean) => (
    <NavArrow dir={dir} enabled={enabled} label={dir < 0 ? "Vorheriger Tag" : "Nächster Tag"} onClick={() => onPick(dir)} />
  );
  return (
    <NavCapsule className="lg:flex-1">
      {arrow(-1, canBack)}
      <NavLabel title={relative ?? weekday} sub={relative ? `${weekday}, ${short}` : short} />
      {arrow(1, canAhead)}
    </NavCapsule>
  );
}

// Spieltag eines Bewerbs mit Pfeilen, gleiche Leiste wie der Tag.
function RoundNav({ rounds, roundIndex, onRound }: { rounds: FixtureRound[]; roundIndex: number; onRound: (index: number) => void }) {
  const round = rounds[roundIndex];
  const arrow = (dir: -1 | 1) => (
    <NavArrow
      dir={dir}
      enabled={!!rounds[roundIndex + dir]}
      label={dir < 0 ? "Vorheriger Spieltag" : "Nächster Spieltag"}
      onClick={() => onRound(roundIndex + dir)}
    />
  );
  return (
    <NavCapsule className="lg:flex-1">
      {arrow(-1)}
      <NavLabel title={round.title} sub={`${round.phase ? `${round.phase} · ` : ""}${roundDates(round.first, round.last)}`} />
      {arrow(1)}
    </NavCapsule>
  );
}

// Spiele eines Tages im Spielplan (Rene, 30.10.2026): je Liga, nach Anstoß.
// Vergangene Tage mit Endstand, heute auch laufende, später "Tippen".
function LcDay({
  games,
  error,
  onRetry,
  ...list
}: ListProps & { games: LiveGame[] | null; error: string | null; onRetry: () => void }) {
  if (!games) return <p className="py-6 text-center text-sm text-muted">Lädt…</p>;
  if (games.length === 0) {
    if (error) return <LcError error={error} onRetry={onRetry} />;
    return (
      <EmptyState
        emoji={SPORT_ICONS[list.sport]}
        title="Keine Spiele an diesem Tag"
        text="In unseren Bewerben ist an diesem Tag nichts los. Mit den Pfeilen zum nächsten Tag."
        className="border-none bg-transparent"
      />
    );
  }
  return (
    <LeagueGroups
      sport={list.sport}
      onLeague={list.onLeague}
      games={[...games].sort(byKickoff)}
      renderRow={(g) => <GameRow key={g.id} game={g} {...list} />}
    />
  );
}

type PlanMode = "tag" | "bewerb";

// Spielplan eines Bewerbs über /api/fixtures, im Browser je Bewerb 30 Min.
// gemerkt (so lange wie auf dem Server).
const FIXTURES_KEEP_MS = 30 * 60 * 1000;
const fixturesCache = new Map<number, { body: FixturesResponse; at: number }>();

function cachedFixtures(leagueId: number): FixturesResponse | null {
  const hit = fixturesCache.get(leagueId);
  return hit && Date.now() - hit.at < FIXTURES_KEEP_MS ? hit.body : null;
}

function useFixtures(leagueId: number | null): { data: FixturesResponse | null; failed: boolean; reload: () => void } {
  const [data, setData] = useState<FixturesResponse | null>(() => (leagueId === null ? null : cachedFixtures(leagueId)));
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (leagueId === null) return;
    const cached = cachedFixtures(leagueId);
    setData(cached);
    setFailed(false);
    if (cached) return;
    let cancelled = false;
    fetch(`/api/fixtures?league=${leagueId}`)
      .then((res) => res.json() as Promise<FixturesResponse>)
      .then((body) => {
        if (cancelled) return;
        if (!body.error) fixturesCache.set(leagueId, { body, at: Date.now() });
        setData(body);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [leagueId, retry]);
  return {
    data: leagueId !== null && data?.league === leagueId ? data : null,
    failed,
    reload: () => {
      if (leagueId !== null) fixturesCache.delete(leagueId);
      setRetry((r) => r + 1);
    },
  };
}

// "04.11." bzw. "04.–05.11." bzw. "28.11.–02.12." (Wiener Zeit).
function roundDates(first: string, last: string): string {
  const fmt = (iso: string) => {
    const [, m, d] = viennaCalendarDay(iso).split("-");
    return { d, m };
  };
  const a = fmt(first);
  const b = fmt(last);
  if (a.d === b.d && a.m === b.m) return `${a.d}.${a.m}.`;
  if (a.m === b.m) return `${a.d}.–${b.d}.${b.m}.`;
  return `${a.d}.${a.m}.–${b.d}.${b.m}.`;
}

// Spielplan nach Bewerb (Rene, 04.11.2026: "wer als nächstes gegeneinander
// spielt"): Bewerb wählen (Handy eine Zeile wie bei der Tabelle, PC
// Knöpfe), darunter ein Spieltag mit Pfeilen, Spiele je Tag.
function LcCompetition({
  rounds,
  roundIndex,
  currentRound,
  games,
  loading,
  error,
  now,
  onRound,
  onRetry,
  ...list
}: ListProps & {
  rounds: FixtureRound[];
  roundIndex: number;
  currentRound: number;
  games: LiveGame[] | null;
  loading: boolean;
  error: string | null;
  now: number | null;
  onRound: (index: number) => void;
  onRetry: () => void;
}) {
  const round = rounds[roundIndex] ?? null;
  const byDay = useMemo(() => {
    const map = new Map<string, LiveGame[]>();
    for (const g of games ?? []) {
      const day = sportDay(g.kickoff);
      map.set(day, [...(map.get(day) ?? []), g]);
    }
    return Array.from(map).sort(([a], [b]) => a.localeCompare(b));
  }, [games]);
  return (
    <div>
      {error !== null ? (
        <LcError error={error} onRetry={onRetry} />
      ) : loading ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : !round ? (
        <EmptyState
          emoji="🗓️"
          title="Noch kein Spielplan"
          text="Für diesen Bewerb gibt es in dieser Saison noch keine Spiele. Schau später nochmal vorbei."
          className="border-none bg-transparent"
        />
      ) : (
        <>
          {roundIndex !== currentRound && currentRound >= 0 && (
            <button
              type="button"
              onClick={() => onRound(currentRound)}
              className="mx-auto mb-3 flex min-h-9 items-center rounded-full border border-edge px-4 text-xs font-semibold text-muted transition-colors [@media(hover:hover)]:hover:text-ink"
            >
              Zum aktuellen Spieltag
            </button>
          )}
          <div className="flex flex-col gap-4">
            {byDay.map(([day, dayGames]) => {
              const relative = now !== null ? relativeDayLabel(day, now) : null;
              // "Di 03.11."
              const weekday = new Date(`${day}T12:00:00Z`)
                .toLocaleDateString("de-AT", { timeZone: "UTC", weekday: "short" })
                .replace(".", "");
              const [, mm, dd] = day.split("-");
              const label = `${weekday} ${dd}.${mm}.`;
              return (
                <div key={day}>
                  <p className="mb-2 px-0.5 text-xs font-bold uppercase tracking-wide text-muted">
                    {relative ? `${relative} · ${label}` : label}
                  </p>
                  <div className="flex flex-col gap-2">
                    {[...dayGames].sort(byKickoff).map((g) => (
                      <GameRow key={g.id} game={g} {...list} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
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

// Farben der Europacup-Ligaphase (lib/standings.ts, cupZone).
const CUP_ZONE_COLOR: Record<CupZone, string> = {
  r16: "bg-emerald-500",
  playoff: "bg-sky-500",
  out: "bg-red-500",
};

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
      <LeaguePicker leagues={TABLE_LEAGUES} leagueId={leagueId} onPick={setLeagueId} />
      <LeaguePills leagues={TABLE_LEAGUES} leagueId={leagueId} onPick={setLeagueId} />
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
            <StandingsGroupTable key={`${group.name}-${i}`} leagueId={data.league} group={group} showName={data.groups.length > 1} teamName={teamName} />
          ))}
        </div>
      )}
    </div>
  );
}

// Liga-Auswahl der Tabelle am Handy (Rene, 30.10.2026: "die Ligaauswahl
// nimmt zu viel Platz ein"): eine Zeile wie beim Spielplan, Pfeile blättern
// zur Nachbar-Liga, Tippen auf den Namen öffnet unten die Liste aller Ligen.
// Am PC (ab lg) bleiben die Knöpfe.
interface PickLeague {
  id: number;
  label: string;
  country: string | null;
  emoji?: string;
}

// Spielplan oben (Variante C): "Alle Ligen" = nach Tag, sonst ein Bewerb.
const ALL_LEAGUES_ID = 0;
const PLAN_LEAGUES: readonly PickLeague[] = [{ id: ALL_LEAGUES_ID, label: "Alle Ligen", country: null, emoji: "⚽" }, ...FIXTURE_LEAGUES];

// arrows=false: nur der Knopf mit der Liste, über die ganze Breite (im
// Spielplan nach Bewerb blättern die Pfeile schon durch die Spieltage).
// inRow: rechts neben "Tag | Bewerb" (Rene, 07.11.2026), auch am PC; dort
// geht die Liste als Menü unter dem Knopf auf statt unten am Rand.
function LeaguePicker({
  leagues,
  leagueId,
  onPick,
  arrows = true,
  inRow = false,
}: {
  leagues: readonly PickLeague[];
  leagueId: number;
  onPick: (id: number) => void;
  arrows?: boolean;
  inRow?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const index = Math.max(0, leagues.findIndex((l) => l.id === leagueId));
  const current = leagues[index];

  useEffect(() => {
    if (!open) return;
    const body = document.body.style;
    const prevOverflow = body.overflow;
    // Am PC (Menü unter dem Knopf) darf die Seite weiter scrollen.
    if (!(inRow && window.matchMedia("(min-width: 1024px)").matches)) body.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      body.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, inRow]);

  const label = (l: PickLeague) => (
    <>
      <span aria-hidden className="w-6 shrink-0 text-center">
        <Emoji e={l.emoji ?? (l.country ? flagEmoji(l.country) : "🏆")} />
      </span>
      <span className="truncate">{l.label}</span>
    </>
  );
  const arrow = (dir: -1 | 1) => {
    const next = leagues[index + dir];
    return <NavArrow dir={dir} enabled={!!next} label={dir < 0 ? "Vorherige Liga" : "Nächste Liga"} onClick={() => next && onPick(next.id)} />;
  };

  return (
    <div className={inRow ? "relative flex min-w-0 lg:w-[300px] lg:shrink-0" : "mb-3 flex lg:hidden"}>
      {/* Mit Pfeilen (Tabelle am Handy): Pfeile und Liga in einer Kapsel. */}
      <Wrap when={arrows && !inRow}>
      {arrows && arrow(-1)}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 font-display text-base font-bold text-ink transition-colors ${
          inRow
            ? "h-12 rounded-[14px] border border-edge bg-pitch px-4 [@media(hover:hover)]:hover:border-gold"
            : arrows
              ? "px-2 [@media(hover:hover)]:hover:text-gold"
              : "h-11 rounded-full border border-edge bg-surface px-3"
        }`}
      >
        {label(current)}
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {arrows && arrow(1)}
      </Wrap>
      {open && inRow && (
        <>
          <div className="fixed inset-0 z-40 hidden lg:block" onClick={() => setOpen(false)} />
          <div
            role="listbox"
            aria-label="Liga wählen"
            className="absolute left-0 right-0 top-full z-50 mt-2 hidden max-h-[60vh] min-w-64 overflow-y-auto rounded-xl border border-edge bg-surface p-1.5 shadow-[0_14px_40px_-12px_rgba(0,0,0,0.9)] lg:block"
          >
            {leagues.map((l) => {
              const active = l.id === leagueId;
              return (
                <button
                  key={l.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onPick(l.id);
                    setOpen(false);
                  }}
                  className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-semibold transition-colors ${
                    active ? "bg-gold/10 text-gold" : "text-ink hover:bg-surface-hover"
                  }`}
                >
                  {label(l)}
                  {active && (
                    <svg viewBox="0 0 24 24" className="ml-auto h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12l5 5 9-10" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60] flex items-end bg-pitch/70 backdrop-blur-[2px] lg:hidden" onClick={() => setOpen(false)}>
            <div
              role="dialog"
              aria-label="Liga wählen"
              onClick={(e) => e.stopPropagation()}
              className="max-h-[80vh] w-full animate-[sheetUp_0.2s_ease-out] overflow-y-auto rounded-t-2xl border-t border-edge bg-surface px-2 pb-[calc(0.75rem+var(--safe-bottom))] pt-3"
            >
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-edge" />
              {leagues.map((l) => {
                const active = l.id === leagueId;
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => {
                      onPick(l.id);
                      setOpen(false);
                    }}
                    className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-[15px] font-semibold transition-colors ${
                      active ? "bg-gold/10 text-gold" : "text-ink active:bg-surface-hover"
                    }`}
                  >
                    {label(l)}
                    {active && (
                      <svg viewBox="0 0 24 24" className="ml-auto h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M5 12l5 5 9-10" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

// Liga mit Pfeilen in der Kapsel, sonst nur der Knopf.
function Wrap({ when, children }: { when: boolean; children: ReactNode }) {
  return when ? <NavCapsule>{children}</NavCapsule> : <>{children}</>;
}

// Bewerbe am PC (ab lg) als Knöpfe.
function LeaguePills({ leagues, leagueId, onPick }: { leagues: readonly PickLeague[]; leagueId: number; onPick: (id: number) => void }) {
  return (
    <div className="mb-4 hidden flex-wrap gap-2 lg:flex">
      {leagues.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onPick(l.id)}
          className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
            leagueId === l.id ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
          }`}
        >
          <span aria-hidden>
            <Emoji e={l.country ? flagEmoji(l.country) : "🏆"} />
          </span>
          {l.label}
        </button>
      ))}
    </div>
  );
}

function StandingsGroupTable({
  leagueId,
  group,
  showName,
  teamName,
}: {
  leagueId: number;
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
          const zone = cupZone(leagueId, row, group.rows.length);
          const color = zone ? CUP_ZONE_COLOR[zone] : rankColor(row.description);
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
      {group.rows.some((row) => cupZone(leagueId, row, group.rows.length)) && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          {CUP_ZONES.map(({ zone, label }) => (
            <span key={zone} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-3 w-1 rounded ${CUP_ZONE_COLOR[zone]}`} />
              {label}
            </span>
          ))}
        </div>
      )}
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

// fromDevice: Stand vom letzten Öffnen (Gerätespeicher) – nicht merken, der
// Wechsel auf den frischen Stand ist kein neues Tor (Rene, 03.11.2026).
function useGoalFlash(id: string, score: string | null, fromDevice = false): boolean {
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (score === null || fromDevice) return;
    const prev = lastScore.get(id);
    lastScore.set(id, score);
    if (prev === undefined || prev === score) return;
    setFlash(true);
    const t = setTimeout(() => setFlash(false), GOAL_FLASH_MS);
    return () => clearTimeout(t);
  }, [id, score, fromDevice]);
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
    // heute/morgen/gestern nach dem Kalendertag in Wien (Rene, 30.10.2026:
    // um 03:30 stand bei den Spielen von heute "morgen"). Nacht-Spiele
    // (00:00 bis 05:59) gehören zwar zum Vortag (Sporttag), heißen aber nach
    // ihrem echten Tag: um 01:00 in der Nacht auf Mittwoch steht unter
    // "Heute, Dienstag" also "morgen" (Rene, 10.11.2026, Variante C; vorher
    // "Nacht", dann "Nacht auf Mi" – beides war unklar bzw. zu viel).
    const today = viennaCalendarDay(Date.now());
    const day = viennaCalendarDay(game.kickoff);
    const sub = day === today ? "heute" : day < today ? "gestern" : day === addDays(today, 1) ? "morgen" : dayLabel(day).split(",")[0];
    return { main: viennaTime(game.kickoff), sub, muted: true };
  }
  if (isLiveFinished(game.status)) {
    // Elfmeterschießen mit Ergebnis ("i. E. 5:4"), Heim zuerst wie die Zeile
    // (im Fußball steht nie der Gast zuerst).
    const shootout =
      sport === "Fußball" && game.penaltyHome !== undefined && game.penaltyAway !== undefined ? ` ${game.penaltyHome}:${game.penaltyAway}` : "";
    const sub =
      game.status === "AET" ? "n. V." : game.status === "PEN" ? (sport === "Fußball" ? `i. E.${shootout}` : sport === "NHL" ? "n. P." : game.statusText) : undefined;
    return { main: "Endstand", sub, muted: true };
  }
  if (sport === "NHL") {
    if (game.status === "BREAK") {
      // Nur ein Wort, ohne Zusatz (Rene, 04.11.2026: "für was brauchen wir
      // beides", "Pause Ha…" war abgeschnitten).
      return { dot: "pause", main: "Pause" };
    }
    const period = /^P([1-3])$/.exec(s);
    if (period) return { dot: "live", main: `${period[1]}. Drittel`, sub: minute };
    if (s === "OT") return { dot: "live", main: "Verl.", sub: minute };
    if (s === "PT") return { dot: "live", main: "Penalty" };
  }
  if (sport === "Fußball") {
    // Halbzeit nur "Pause" statt "Pause Halbzeit", das am Handy und am PC
    // als "Pause Ha…" abgeschnitten war (Rene, 04.11.2026: "eigentlich
    // können wir Pause nehmen").
    if (game.status === "HT") return { dot: "pause", main: "Pause" };
    if (s === "ET") return { dot: "live", main: "Verl.", sub: minute };
    if (s === "P") return { dot: "live", main: "Elfmeter" };
    if (game.status === "LIVE") return { dot: "live", main: clockText ?? minute ?? "Live" };
  }
  // Halbzeit und andere Pausen nur "Pause", ohne Zusatz (Rene, 04.11.2026).
  if (game.status === "HT" || game.status === "BREAK") return { dot: "pause", main: "Pause" };
  if (game.status === "LIVE") {
    // "Verlängerung" passt nicht in die Spalte, kurz wie im Fußball und im
    // Eishockey "Verl." (Rene, 04.11.2026).
    const main = game.statusText === "Verlängerung" ? "Verl." : game.statusText || "Live";
    return { dot: "live", main, sub: minute && !game.statusText.includes(minute) ? minute : undefined };
  }
  return { main: OTHER_STATUS[s] ?? "—", muted: true };
}

// "i. E. 5:4" → ["i. E.", "5:4"], damit am Handy das Elfmeter-Ergebnis
// unter dem Kürzel steht.
function splitEndNote(note: string): [string, string | null] {
  const m = /^(.*?)\s+(\d+:\d+)$/.exec(note);
  return m ? [m[1], m[2]] : [note, null];
}

// Gast zuerst bei API-Spielen ohne App-Spiel: wie isAwayFirst, Land aus der
// API-Liga (z. B. "NHL · USA").
function liveAwayFirst(sport: Sport, game: LiveGame): boolean {
  return isAwayFirst(sport, { countryCode: liveGameCountry(game.league) });
}

// Eine Zeile (Rene, 15.10.2026: Spieltag-Umbau): links Status (siehe
// rowStatus, feste Breite seit 16.10.2026), Mitte Heim und Gast
// untereinander, rechts die Tore untereinander, unten ein dünner Balken
// (Minute/90). Tippspiele zeigen vor Tippschluss klein "Tippen" und ab 3 Std.
// vor Tippschluss den Countdown (Rene, 30.10.2026: wieder da, nach #401),
// getippte nur "Getippt" (nie den Tipp selbst), beides klein unter der Uhrzeit (Rene, 04.11.2026), neben den
// Namen kleine Trikots (Rene, 03.11.2026, Variante A).
// Rahmen eine Spur heller als border-edge, neutral für alle Zustände.
function GameRow({ sport, game, dataAt = 0, links, isTipped, canTip, selectedId, onSelect }: ListProps & { game: LiveGame; dataAt?: number }) {
  const clock = useLiveClock(sport, game.statusShort, game.elapsed, dataAt);
  const running = isLiveRunning(game.status);
  const hasScore = game.homeScore !== null && game.awayScore !== null && game.status !== "NS";
  const flash = useGoalFlash(game.id, hasScore ? `${game.homeScore}:${game.awayScore}` : null, !!game.fromDevice);
  const tipped = isTipped(game);
  // Tippschluss noch nicht vorbei: "Tippen"/"Getippt" und Countdown rechts.
  const open = canTip(game);
  const tippable = !tipped && open;
  const selected = selectedId === game.id;
  const link = links.get(game.id);
  const teamName = useApiTeamName(sport);
  const apiTeam = useApiTeam(sport);
  const { orderFor, fixtureTv } = useAppData();
  // Mit App-Spiel: Namen wie in der App (gleiche Schreibweise wie auf der
  // Tippkarte), sonst der eigene Vereinsname zum API-Namen.
  const homeName = link ? (link.result.swapped ? link.away.name : link.home.name) : teamName(game.home);
  const awayName = link ? (link.result.swapped ? link.home.name : link.away.name) : teamName(game.away);
  // Sender vom Admin: am Tippspiel bzw. im Matchcenter-Detail eingetragen.
  const tv = useGameTv(sport)(game, link);
  // Kleine Trikots neben den Namen (Rene, 03.11.2026, Variante A: "mehr
  // Leben"): Trikot wie auf der Tippkarte bzw. im Detail, ohne eigenes Team
  // das graue Gast-Trikot, damit die Namen in jeder Zeile gleich stehen.
  const homeTeam = link ? (link.result.swapped ? link.away : link.home) : apiTeam(game.home);
  const awayTeam = link ? (link.result.swapped ? link.home : link.away) : apiTeam(game.away);
  const jersey = (team: Team | undefined, apiSide: "home" | "away", size: number) => {
    if (!team) return <TeamBadge sport={sport} primaryColor={GUEST_PRIMARY_COLOR} secondaryColor={GUEST_SECONDARY_COLOR} size={size} />;
    const props = link
      ? matchJerseyProps(link.match, team)
      : (() => {
          const j = jerseyFor(team, { variant: fixtureJerseyFor(fixtureTv, sport, game.id, apiSide), style: "solid" });
          return { ...teamColorProps(team), jerseyStyle: j.style, variant: j.variant };
        })();
    return <TeamBadge sport={sport} {...props} isNationalTeam={team.isNationalTeam} countryCode={team.countryCode} size={size} />;
  };

  const status = rowStatus(sport, game, clock?.text ?? null);
  const sub = status.sub && status.sub !== "heute" ? status.sub : null;
  // Läuft: leuchtender Rand links statt roter Zeitlinie unten (Rene,
  // 27.10.2026, Variante C): rot = läuft, gelb = Pause.
  const glow = running ? (status.dot === "pause" ? "pause" : "live") : null;
  const moved = useSectionMove(game.id, running ? "live" : game.status === "NS" ? "ns" : "done");
  // Beendet (Rene, 27.10.2026: "müssen anders aussehen"): Zeile blasser,
  // "Endstand", Sieger und seine Tore hell und fett, der Rest gedämpft.
  const done = isLiveFinished(game.status) && hasScore;
  // Bei Gleichstand nach Elfmeterschießen gewinnt, wer mehr Elfmeter traf.
  const shootout = game.status === "PEN" && game.penaltyHome !== undefined && game.penaltyAway !== undefined && game.homeScore === game.awayScore;
  const homeWins = done && (shootout ? game.penaltyHome! > game.penaltyAway! : game.homeScore! > game.awayScore!);
  const awayWins = done && (shootout ? game.penaltyAway! > game.penaltyHome! : game.awayScore! > game.homeScore!);
  // US-Ligen "Gast @ Heim": Gast zuerst (oben bzw. links), Heim danach, wie
  // auf der Tippkarte (Rene, 28.10.2026).
  const awayFirst = link ? orderFor(link.match).awayFirst : liveAwayFirst(sport, game);
  const [firstName, secondName] = awayFirst ? [awayName, homeName] : [homeName, awayName];
  const [firstWins, secondWins] = awayFirst ? [awayWins, homeWins] : [homeWins, awayWins];
  const [firstScore, secondScore] = awayFirst ? [game.awayScore, game.homeScore] : [game.homeScore, game.awayScore];
  const [firstTeam, secondTeam] = awayFirst ? [awayTeam, homeTeam] : [homeTeam, awayTeam];
  const [firstSide, secondSide]: ("home" | "away")[] = awayFirst ? ["away", "home"] : ["home", "away"];
  const nameTone = (wins: boolean) => (!done ? "text-ink" : wins ? "font-semibold text-ink" : "text-muted");
  const scoreTone = (wins: boolean) => (done && !wins ? "text-muted" : "");
  // Laufend (Rene, 27.10.2026): Spielstand rot.
  const scoreColor = hasScore ? (running ? "text-red-500" : "text-ink") : "text-muted";
  // n. V. / i. E. 5:4 / n. P. steht direkt beim Ergebnis statt abgeschnitten
  // in der schmalen Status-Spalte (Rene, 29.10.2026: "du hast so viel platz
  // in der zeile"; am PC war es mit Sender als "Endstand i…" abgeschnitten):
  // am Handy neben den Toren, am PC unter der Ergebnis-Box.
  const endNote = done && !(open && link) ? sub : null;
  const [endNoteMain, endNoteScore] = endNote ? splitEndNote(endNote) : [null, null];
  const statusSub = endNote ? null : sub;
  // Mit Sender steht der Zusatz in derselben Zeile. Neben langen Texten
  // ("2. Drittel", "3. Viertel") ist dafür kein Platz, dann fällt die Minute
  // weg statt abgeschnitten zu werden (Rene, 04.11.2026: "Pause Ha…").
  const inlineSub = statusSub && tv && status.main.length <= 5 ? statusSub : null;

  // Offenes Tippspiel: schmaler Balken "Tippen" rechts hinter der Zeile.
  // Vereinsnamen haben in jeder Zeile dieselbe Größe, lange Namen brechen
  // um statt kleiner zu werden (Rene, 05.11.2026: Größen waren verschieden).
  // Getippt: kein Balken mehr, nur der rechte Rand der Zeile bleibt gold.
  // Nicht getippt und Tippschluss vorbei: nichts (Rene, 04.11.2026).
  const tipTab = tippable && link ? link : null;
  const tippedEdge = tipped && !!link;
  const row = (
    <button
      type="button"
      onClick={() => onSelect(game.id)}
      aria-pressed={selected}
      style={glow ? { boxShadow: GLOW[glow] } : undefined}
      // Zeilen heller grau als der Liga-Kasten (Rene, 06.11.2026, Variante B).
      // Gewählt: hellerer Hintergrund und weißlicher Rahmen statt Gold, damit
      // der rote Live-Rand klar bleibt (Rene, 27.10.2026).
      // Kein Goldrand an offenen Tippspielen, der Knopf "Tippen" reicht
      // (Rene, 03.11.2026: "mach die goldene umrandung weg").
      // Alle Zeilen gleich hoch, auch mit Tipp, "Dein Tipp" oder Countdown
      // (Rene, 03.11.2026: Abstände wirkten unruhig).
      // Am PC haben Zeilen ohne Balken rechts so viel Innenabstand, wie der
      // Balken breit ist: so steht das Ergebnis in jeder Zeile genau gleich.
      className={`relative z-[1] flex min-h-[3.875rem] w-full flex-col justify-center overflow-hidden rounded-card border px-3 py-2 text-left lg:min-h-[3.6875rem] transition-[color,background-color,border-color,box-shadow] sm:pl-4 ${
        tipTab ? "" : "lg:pr-[4.375rem]"
      } ${tippedEdge ? "border-r-[2.5px] border-r-gold" : ""} ${
        moved ? "motion-safe:animate-lc-row-in" : ""
      } ${
        selected
          ? "border-ink/50 bg-row-hover"
          : done
              ? "border-muted/15 bg-row/55 hover:border-muted/40"
              : "border-muted/25 bg-row hover:border-muted/50"
      }`}
    >
      <div className="grid grid-cols-[4.75rem_1px_minmax(0,1fr)] items-center gap-x-2.5 text-sm">
        {/* Feste Breite, nichts läuft in die Namen (Rene, 16.10.2026):
            Zeile 1 groß/fett, Zeile 2 klein muted. */}
        {/* Zwei Zeilen (Zeit, Sender) mit knappem Abstand, damit
            die Zeile nicht höher wird als die anderen. */}
        <span className={`flex w-[4.75rem] min-w-0 flex-col gap-0.5 overflow-hidden tabular-nums`}>
          <span className={`flex min-w-0 items-center gap-1 text-[13px] font-semibold leading-tight ${status.muted ? "text-muted" : "text-ink"}`}>
            {status.dot && <StateDot state={status.dot} />}
            <span className={`min-w-0 ${inlineSub ? "shrink-0" : "truncate"}`}>{status.main}</span>
            {/* Mit Sender darunter steht der Zusatz in derselben Zeile
                ("Verl. 122'"), damit jede Zeile höchstens zwei Zeilen hoch
                ist (Rene, 27.10.2026: "die Spalte ist höher"). */}
            {inlineSub && <span className="min-w-0 truncate text-[10px] font-normal text-muted">{inlineSub}</span>}
          </span>
          {/* "heute" steht schon im Reiter, nur "morgen"/"gestern" zeigen (Rene, 27.10.2026: flachere Zeilen). */}
          {statusSub && !tv && <span className="truncate text-[10px] leading-tight text-muted">{statusSub}</span>}
          {/* Sender unter der Uhrzeit (Rene, 28.10.2026). */}
          {tv && (
            <span className="flex min-w-0 items-start gap-1 text-[10px] font-medium leading-tight text-muted" title={tv}>
              <TvIcon className="h-3 w-3 shrink-0" />
              {/* Sender nie abschneiden, sondern in die nächste Zeile
                  umbrechen ("RTL, / DAZN" statt "RTL, DAZ...", Rene,
                  29.10.2026), am Handy und am PC. Breiter machen ging nicht:
                  dann werden lange Vereinsnamen abgeschnitten. */}
              <span className="min-w-0 break-words">{tv}</span>
            </span>
          )}
        </span>
        {/* Feiner senkrechter Strich zwischen Zeit und Vereinen (Rene,
            30.10.2026, wie Livescore). */}
        <span aria-hidden className="w-px self-stretch bg-muted/30" />
        {/* Namen und Tore in einem Raster (Rene, 27.10.2026): jede Tor-Zahl
            steht genau neben ihrem Verein, auch wenn ein Name zwei Zeilen
            braucht. Die Tore stehen mittig in einer festen Spalte, so liegen
            "1" und "0" sauber untereinander (Poppins hat schmale Einsen). */}
        <span
          data-fit-group
          className={`grid min-w-0 ${endNote ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 lg:hidden`}
        >
          <span className="col-start-1 row-start-1 flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0">{jersey(firstTeam, firstSide, 18)}</span>
            <FitText text={firstName} maxLines={2} minPx={12} className={`leading-tight ${nameTone(firstWins)}`} />
          </span>
          <span className="col-start-1 row-start-2 flex min-w-0 items-center gap-1.5">
            <span className="flex shrink-0">{jersey(secondTeam, secondSide, 18)}</span>
            <FitText text={secondName} maxLines={2} minPx={12} className={`leading-tight ${nameTone(secondWins)}`} />
          </span>
          <span
            className={`${endNote ? "col-start-3" : "col-start-2"} row-span-2 row-start-1 grid grid-rows-subgrid rounded-md font-display text-[15px] font-bold leading-tight tabular-nums transition-colors duration-700 ${
              flash ? "bg-gold/15 text-gold" : scoreColor
            }`}
          >
            <span className={`min-w-7 whitespace-nowrap text-center ${scoreTone(firstWins)}`}>{hasScore ? firstScore : "–"}</span>
            <span className={`min-w-7 whitespace-nowrap text-center ${scoreTone(secondWins)}`}>{hasScore ? secondScore : "–"}</span>
          </span>
          {endNote && (
            <span className="col-start-2 row-span-2 row-start-1 flex flex-col items-end text-right text-[11px] font-semibold leading-tight text-muted">
              <span className="whitespace-nowrap">{endNoteMain}</span>
              {endNoteScore && <span className="whitespace-nowrap font-normal tabular-nums">{endNoteScore}</span>}
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
        <span data-fit-group className="hidden min-w-0 grid-cols-[minmax(0,1fr)_minmax(7rem,auto)_minmax(0,1fr)] items-center gap-x-4 lg:grid">
          <span className="flex min-w-0 items-center justify-end gap-2">
            <FitText text={firstName} maxLines={2} minPx={12} className={`text-right text-[15px] leading-tight ${nameTone(firstWins)}`} />
            {jersey(firstTeam, firstSide, 20)}
          </span>
          {/* Ergebnisfeld bleibt in jeder Zeile gleich, Tippen/Getippt steht
              links unter der Uhrzeit (Rene, 04.11.2026). */}
          <span className="flex flex-col items-center gap-0.5">
            <span
              className={`flex min-w-[4.75rem] items-center justify-center rounded-md border border-edge bg-pitch px-2 py-1 font-display text-lg font-bold leading-none tabular-nums transition-colors duration-700 ${
                flash ? "border-gold/50 bg-gold/15 text-gold" : scoreColor
              }`}
            >
              <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(firstWins)}`}>{hasScore ? firstScore : "–"}</span>
              <span className="px-0.5 text-muted">:</span>
              <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(secondWins)}`}>{hasScore ? secondScore : "–"}</span>
            </span>
            {endNote && <span className="whitespace-nowrap text-[12px] font-semibold leading-none text-muted">{endNote}</span>}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            {jersey(secondTeam, secondSide, 20)}
            <FitText text={secondName} maxLines={2} minPx={12} className={`text-[15px] leading-tight ${nameTone(secondWins)}`} />
          </span>
        </span>
      </div>
    </button>
  );
  if (!tipTab) return row;
  // "Tippen" als schmaler Balken rechts, immer sichtbar, aber ruhig: grau
  // wie die Zeile, nur der rechte Rand gold. Die runde Ecke der Zeile ragt
  // in den Balken (Rene, 04.11.2026: "der balken hatte eine coole form",
  // "nur der rechte rand gold", "nicht so breit"). Mitte und links bleiben
  // frei für alle, die nur Ergebnisse anschauen. Führt direkt zur Tippkarte.
  return (
    <div className="relative pr-[3.25rem] lg:pr-[3.625rem]">
      <Link
        href={tipCardHref(tipTab.match.id)}
        className={`absolute inset-y-0 right-0 flex w-[5rem] items-center justify-center rounded-card border border-r-[2.5px] border-muted/25 bg-row pl-7 transition-colors hover:bg-row-hover lg:w-[5.375rem] border-r-gold`}
      >
        <TipStatus deadline={tipTab.match.tipDeadline} kickoff={tipTab.match.kickoff} />
      </Link>
      {row}
    </div>
  );
}

// Inhalt des Balkens "Tippen" rechts neben offenen Tippspielen (Rene,
// 04.11.2026). Ab 3 Std. vor Tippschluss läuft darunter der Countdown mit,
// gleiche Regel wie auf der Tippkarte (components/Countdown.tsx, Rene
// 28.10.2026: "der Countdown muss zum Tippschluss passen"), letzte 30 Min.
// orange. Davor nur "Tippen", kein "bis 20:45" (Rene, 28.10.2026:
// verwirrend neben der Anstoßzeit); nur wenn der Tippschluss vor dem Anstoß
// liegt, steht "bis …" darunter.
function TipStatus({ deadline, kickoff }: { deadline: string; kickoff: string }) {
  const target = Date.parse(deadline);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const ms = now === null ? null : Math.max(0, target - now);
  const counting = ms !== null && ms <= COUNTDOWN_FROM;
  const soon = ms !== null && ms <= 30 * 60 * 1000;
  let extra: string | null = null;
  let label: string | undefined;
  if (ms !== null && now !== null) {
    const left = Math.floor(ms / 1000);
    const h = Math.floor(left / 3600);
    const m = Math.floor((left % 3600) / 60);
    const sec = left % 60;
    const pad = (n: number) => String(n).padStart(2, "0");
    if (counting) {
      extra = h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
      label = `Tippen, noch ${h > 0 ? `${h} Std. ` : ""}${m} Min. bis Tippschluss`;
    } else if (target < Date.parse(kickoff)) {
      extra = `bis ${deadlineText(target, now)}`;
    }
  }
  return (
    // Countdown mit etwas Luft unter "Tippen" (Rene, 04.11.2026: "zu knapp").
    <span className="flex flex-col items-center gap-1.5 whitespace-nowrap leading-none" role={counting ? "timer" : undefined} aria-label={label}>
      <span className="font-display text-[12px] font-bold text-gold">Tippen</span>
      {extra && <span className={`text-[10px] font-medium tabular-nums opacity-85 ${soon ? "text-[#FF9B5C]" : "text-gold"}`}>{extra}</span>}
    </span>
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

// Admin: Trikots für ein Spiel ohne Tippspiel (Rene, 28.10.2026: "auch wenn
// ich keinen Tipp erstelle"). Je Verein ein Link in den Admin: vorhandenes
// Team bearbeiten oder neues Team mit Trikot anlegen (wird dann mit dem
// API-Namen verknüpft). Darunter die Wahl Heim-/Auswärtstrikot für dieses
// Spiel (Rene, 30.10.2026). Reihenfolge wie auf der Anzeige.
function FixtureJerseyEditor({
  sport,
  game,
  sides,
}: {
  sport: Sport;
  game: LiveGame;
  sides: ["home" | "away", "home" | "away"];
}) {
  const { isAdmin } = useUser();
  const { fixtureTv, saveFixtureJersey } = useAppData();
  const apiTeam = useApiTeam(sport);
  // Land für ein neues Team aus der Liga ("Premier League · England").
  const country = liveGameCountry(game.league);
  if (!isAdmin) return null;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-edge px-3 py-2 text-[13px]">
      <span className="text-muted">Trikots (nur Admin)</span>
      <div className="grid grid-cols-2 gap-2">
        {sides.map((side) => {
          const apiName = side === "home" ? game.home : game.away;
          const team = apiTeam(apiName);
          const variant = fixtureJerseyFor(fixtureTv, sport, game.id, side);
          // Nationalteams zeigen die Flagge, Football den Helm: nichts zu wählen.
          const canPick = !!team && !team.isNationalTeam && sport !== "NFL";
          const href = team
            ? `/admin?tab=teams&team=${encodeURIComponent(team.id)}`
            : `/admin?tab=teams&neu=${encodeURIComponent(apiName)}&sport=${encodeURIComponent(sport)}${
                country ? `&land=${encodeURIComponent(country)}` : ""
              }`;
          return (
            <div key={side} className="flex min-w-0 flex-col gap-1.5">
              <Link
                href={href}
                className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg border border-edge px-2.5 py-1.5 text-ink transition-colors hover:border-gold/60"
              >
                {team ? (
                  <TeamBadge
                    sport={sport}
                    {...teamColorProps(team)}
                    jerseyStyle={jerseyFor(team, { variant, style: "solid" }).style}
                    variant={variant}
                    size={22}
                  />
                ) : (
                  <span aria-hidden className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-dashed border-muted text-muted">
                    +
                  </span>
                )}
                {/* Name nie abschneiden: bis 2 Zeilen, darunter was der Link tut. */}
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="line-clamp-2 break-words">{team ? team.name : apiName}</span>
                  <span className="text-xs font-semibold text-gold">{team ? "Trikot ändern" : "Trikot anlegen"}</span>
                </span>
              </Link>
              {team && canPick && (
                <div className="grid grid-cols-2 gap-1" role="group" aria-label={`Trikot ${team.name} in diesem Spiel`}>
                  {(
                    [
                      ["heim", "Heim"],
                      ["auswaerts", "Auswärts"],
                    ] as const
                  ).map(([v, label]) => {
                    const active = variant === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={active}
                        onClick={() => !active && saveFixtureJersey({ sport, fixtureId: game.id, kickoff: game.kickoff }, side, v)}
                        className={`flex min-h-10 min-w-0 items-center justify-center gap-1 rounded-lg border px-1 text-xs transition-colors ${
                          active ? "border-gold bg-gold/10 font-semibold text-gold" : "border-edge text-muted hover:border-muted"
                        }`}
                      >
                        {/* Kleines Trikot nur am PC; am Handy ist es zu eng, das
                            gewählte Trikot zeigt dort die Karte darüber. */}
                        <span className="hidden shrink-0 sm:inline-flex">
                          <TeamBadge
                            sport={sport}
                            {...teamColorProps(team)}
                            jerseyStyle={jerseyFor(team, { variant: v, style: "solid" }).style}
                            variant={v}
                            size={16}
                          />
                        </span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Kann man das App-Spiel noch tippen? Minütlich neu geprüft.
function useTippable(match: Match | null): boolean {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  return !!match && now !== null && isMatchTippable(match, now);
}

type DetailTab = "spiel" | "aufstellung" | "statistik";

// Detail rechts: Liga + Pill, Anzeigetafel (dieselbe wie auf der Tippkarte),
// "Dein Tipp", Spiel / Aufstellung / Statistik.
function LcDetail({
  sport,
  game,
  link,
  dataAt,
}: {
  sport: Sport;
  game: LiveGame;
  link: AppLink | null;
  dataAt: number;
}) {
  const { myTips, orderFor, competitions } = useAppData();
  const started = game.status !== "NS" && game.homeScore !== null && game.awayScore !== null;
  const liveLike = started && (isLiveRunning(game.status) || isLiveFinished(game.status));
  const clock = useBoardClock(sport, liveLike ? { ...game, dataAt, ...(link ? appSidePenalties(link.result) : {}) } : null);
  const match = link?.match ?? null;
  const tip = match ? myTips.find((t) => t.matchId === match.id && !t.refunded) ?? null : null;
  const tippable = useTippable(match);
  const order: TeamOrder = match ? orderFor(match) : { sport, awayFirst: liveAwayFirst(sport, game) };
  const awayFirst = !!order.awayFirst;

  // Alles in App-Heim/-Gast (Seiten der API ggf. gedreht).
  const teamName = useApiTeamName(sport);
  const appHome = link ? link.home.name : teamName(game.home);
  const appAway = link ? link.away.name : teamName(game.away);
  const homeScore = link ? link.result.homeScore : game.homeScore;
  const awayScore = link ? link.result.awayScore : game.awayScore;
  const events = link ? appSideEvents(link.result) : game.events ?? [];
  const shootout = link ? appSideShootout(link.result) : game.shootout ?? [];
  const pens = link ? appSidePenalties(link.result) : game;
  const shootoutResult =
    pens.penaltyHome !== undefined && pens.penaltyAway !== undefined ? { home: pens.penaltyHome, away: pens.penaltyAway } : null;
  const leftSide: "home" | "away" = awayFirst ? "away" : "home";
  const rightSide: "home" | "away" = awayFirst ? "home" : "away";
  // Ohne Tippspiel das eigene Team zum API-Namen, beide im Heimtrikot. Hat
  // nur ein Verein ein Trikot, trägt der andere das graue Gast-Trikot, damit
  // beide Seiten gleich hoch stehen.
  const apiTeam = useApiTeam(sport);
  const teamOf = (s: "home" | "away") =>
    link ? (s === "home" ? link.home : link.away) : apiTeam(s === "home" ? game.home : game.away);
  const anyJersey = !!teamOf("home") || !!teamOf("away");
  // Ohne Tippspiel: Heim-/Auswärtstrikot, wie der Admin es im Matchcenter wählt.
  const { fixtureTv } = useAppData();
  const fixtureJerseyProps = (team: Team, s: "home" | "away") => {
    const j = jerseyFor(team, { variant: fixtureJerseyFor(fixtureTv, sport, game.id, s), style: "solid" });
    return { ...teamColorProps(team), jerseyStyle: j.style, variant: j.variant };
  };
  // Vereine in der Reihenfolge der API (fürs Stadion).
  const swappedSides = !!link?.result.swapped;
  const venue = useStadium(
    teamOf(swappedSides ? "away" : "home"),
    teamOf(swappedSides ? "home" : "away"),
    game.venue ?? null,
    game.venueId ?? null,
  );
  const tv = useGameTv(sport)(game, link);
  // Spieltag vom Tippspiel (wanderte von der Tippkarte hierher, 29.10.2026).
  const matchday = link?.match.matchday ?? null;
  const side = (s: "home" | "away"): BoardSide => {
    const team = teamOf(s);
    const badge = !anyJersey ? undefined : team ? (
      <TeamBadge
        sport={sport}
        {...(match ? matchJerseyProps(match, team) : fixtureJerseyProps(team, s))}
        isNationalTeam={team.isNationalTeam}
        countryCode={team.countryCode}
        size={34}
      />
    ) : (
      <TeamBadge sport={sport} primaryColor={GUEST_PRIMARY_COLOR} secondaryColor={GUEST_SECONDARY_COLOR} size={34} />
    );
    return { name: s === "home" ? appHome : appAway, badge };
  };

  const isOneXTwo = match?.tipMode === "1x2";
  // "Sieg Graz" / "Unentschieden" / "3:1" (lib/liveTipText.ts).
  const tipText =
    tip && link
      ? liveTipLabel(
          tip.predictedHomeScore,
          tip.predictedAwayScore,
          isOneXTwo,
          link.home.name,
          link.away.name,
          scoreText(order, tip.predictedHomeScore, tip.predictedAwayScore),
        )
      : "";
  const flag = liveLeagueFlag(sport, game, competitions);
  const [leftKick, rightKick] = displayOrder(order, appHome, appAway);
  // Reiter Spiel / Aufstellung / Statistik (Rene, 27.10.2026: Pro-Plan),
  // nur Fußball. Daten erst laden, wenn ein Reiter offen ist.
  // Welcher Reiter offen ist (Rene, 04.11.2026): vor Anpfiff Statistik, sobald
  // die Aufstellung da ist Aufstellung, ab Anpfiff (auch nach Schluss) Spiel.
  // Tippt man selbst einen Reiter an, bleibt der offen.
  const hasInfo = sport === "Fußball";
  const [pickedTab, setTab] = useState<DetailTab | null>(null);
  // Bis 90 Min. vor Anpfiff alle 2 Min. nachsehen, ob die Aufstellung da ist.
  const lineupSoon = !started && Date.parse(game.kickoff) - Date.now() < 90 * 60 * 1000;
  const autoTab: DetailTab = !hasInfo || started ? "spiel" : "statistik";
  const info = useMatchInfo(
    hasInfo && (pickedTab ?? autoTab) !== "spiel" ? game.id : null,
    isLiveRunning(game.status) || lineupSoon,
  );
  const hasLineup = !!info.data?.lineups.some((t) => t.startXI.length > 0);
  const tab: DetailTab = pickedTab ?? (autoTab === "statistik" && hasLineup ? "aufstellung" : autoTab);
  const preview = useMatchPreview(hasInfo && tab === "statistik" ? game.id : null);
  const swapped = !!link?.result.swapped;
  const firstApiName = (leftSide === "home") !== swapped ? game.home : game.away;
  // Startzeit, Sender und Stadion mit Kapazität über der Anzeigetafel (Rene,
  // 29.10.2026: "ober dem ganz schwarzen ... die startzeit den sender und
  // stadion"). Lange Namen brechen um, nichts wird abgeschnitten.
  const kickoffDay = sportDay(game.kickoff);
  // Nacht-Spiel von heute früh, das noch unter "Heute" steht (10.11.2026):
  // ohne Datum, sonst stünde dort das Datum von gestern.
  const isToday = kickoffDay === sportDay(Date.now()) || viennaCalendarDay(game.kickoff) === viennaCalendarDay(Date.now());
  const startText = `${isToday ? "" : `${dayLabel(kickoffDay)} · `}${viennaTime(game.kickoff)} Uhr`;
  const infoRow = (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[13px] text-muted">
      {matchday && <span>Spieltag {matchday}</span>}
      {matchday && <span aria-hidden>·</span>}
      <span className="whitespace-nowrap">
        {game.status === "NS" ? "Anstoß " : "Start "}
        {startText}
      </span>
      {tv && (
        <span className="flex items-center gap-1.5 rounded-full border border-edge bg-pitch py-0.5 pl-2 pr-2.5 font-semibold text-ink">
          <TvIcon className="h-4 w-4 shrink-0 text-ink" />
          {tv}
        </span>
      )}
      {venue && (
        <span className="min-w-0 break-words">
          <StadiumIcon className="mr-1.5 inline-block h-[22px] w-[22px] -translate-y-px align-middle" />
          {venue.name}
          {venue.capacity !== null && <span className="whitespace-nowrap"> · {venue.capacity.toLocaleString("de-DE")}</span>}
        </span>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-4 rounded-card border border-muted/40 bg-surface shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)] p-3 sm:p-4">
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

      {infoRow}

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
          {/* Die Anstoßzeit steht schon darüber. */}
          {game.status !== "NS" && <p className="mt-1 text-xs text-muted">{OTHER_STATUS[game.statusShort.toUpperCase()] ?? "—"}</p>}
        </div>
      )}

      {!link && <FixtureTvEditor sport={sport} game={game} />}
      {!link && (
        <FixtureJerseyEditor
          sport={sport}
          game={game}
          sides={[leftSide, rightSide]}
        />
      )}

      {/* Matchcenter = nur das echte Spiel (Rene, 29.10.2026): keine Punkte,
          Community, Kommentare oder Freunde mehr, nur der eigene Tipp. */}
      {tipText && (
        <p className="truncate rounded-lg border border-edge bg-pitch px-3 py-2 text-[13px] text-muted">
          Dein Tipp: <span className="font-semibold text-ink">{tipText}</span>
        </p>
      )}
      {/* Direkt zur Tippkarte, solange getippt werden kann (Rene, 30.10.2026:
          "Tippen" wieder da). */}
      {match && !tip && tippable && (
        <Link
          href={tipCardHref(match.id)}
          className="flex items-center justify-center gap-1.5 rounded-full bg-action-hover py-2.5 text-center font-display text-sm font-semibold tracking-wide text-pitch transition-all hover:brightness-110"
        >
          🎯 Jetzt tippen
        </Link>
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
      {/* Ab Anpfiff oben die Werte im Spiel, darunter immer Tabelle, Form
          und direkter Vergleich (Rene, 28.10.2026). */}
      {tab === "statistik" && (
        <div className="flex flex-col gap-4">
          {started && (
            <div>
              <p className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted">Im Spiel</p>
              <StatsView info={info.data} failed={info.failed} onRetry={info.retry} firstApiName={firstApiName} started={started} />
            </div>
          )}
          <PreviewView info={preview.data} failed={preview.failed} onRetry={preview.retry} firstApiName={firstApiName} teamName={teamName} />
        </div>
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
          {liveLike && shootout.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Elfmeterschießen</p>
              <ShootoutList kicks={shootout} leftSide={leftSide} result={shootoutResult} />
            </div>
          )}

        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Motorsport (Rene, 30.10.2026: "Motorsport anlegen … neben American
// Football"). Reiter Formel 1 und MotoGP (MotoGP noch ohne Daten), nur zum
// Anschauen, ohne Tippen.
// Daten von API-Sports über /api/formula1 (eigenes Kontingent, 100 pro Tag
// im Gratis-Plan). "Wochenende": die Sessions eines Grand Prix (‹ › zum
// Blättern), darunter bzw. am PC rechts die Wertung der gewählten Session,
// die sich bei laufender Session alle 2 Min. neu lädt. "WM-Stand": Fahrer.
// Sperrt der Gratis-Plan die laufende Saison, stehen nur die Sessions von
// heute und morgen da (Abfrage nach Datum).

const F1_TYPES: Record<string, string> = {
  "1st practice": "1. Training",
  "2nd practice": "2. Training",
  "3rd practice": "3. Training",
  "sprint shootout": "Sprint-Qualifying",
  "sprint qualifying": "Sprint-Qualifying",
  sprint: "Sprint",
  "1st qualifying": "Qualifying 1",
  "2nd qualifying": "Qualifying 2",
  "3rd qualifying": "Qualifying 3",
  qualifying: "Qualifying",
  race: "Rennen",
};

const f1TypeLabel = (type: string) => F1_TYPES[type.toLowerCase()] ?? type;
const F1_RANKING_POLL_MS = 120_000;
// Ungefähre Dauer je Session (mit Puffer für Unterbrechungen). Die Liste
// der Sessions wird nicht laufend neu geladen (gemerkt 6 Std.), darum gilt
// eine Session in diesem Fenster ab Beginn als live – so lädt die Wertung
// nicht länger als nötig alle 2 Min. neu.
function f1DurationMs(type: string): number {
  const t = type.toLowerCase();
  const min = t === "race" ? 150 : t.includes("sprint") ? 60 : t.includes("qualifying") ? 75 : 70;
  return min * 60 * 1000;
}

function f1IsLive(s: F1Session, now: number): boolean {
  if (/complete|finished|cancel|postpone/i.test(s.status)) return false;
  const start = Date.parse(s.start);
  return now >= start && now - start < f1DurationMs(s.type);
}

const f1Done = (s: F1Session, now: number) =>
  /complete|finished/i.test(s.status) || now - Date.parse(s.start) >= f1DurationMs(s.type);

function f1When(iso: string): string {
  return new Date(iso).toLocaleString("de-AT", {
    timeZone: "Europe/Vienna",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function f1ErrorText(error: string): string {
  if (/plan|season/i.test(error)) return "Der Gratis-Plan gibt diese Daten nicht frei.";
  if (error.includes("Tageslimit")) return "Das Tageslimit der Formel-1-Daten ist erreicht. Morgen geht's weiter.";
  return "Die Formel-1-Daten sind gerade nicht verfügbar. Schau später nochmal vorbei.";
}

async function loadF1(params: string): Promise<Formula1Response> {
  try {
    const res = await fetch(`/api/formula1?${params}`);
    return (await res.json()) as Formula1Response;
  } catch {
    return { ok: false, error: "Nicht erreichbar", quota: null };
  }
}

interface F1Weekend {
  gp: string;
  circuit: string | null;
  place: string | null;
  sessions: F1Session[];
}

function f1Weekends(sessions: F1Session[]): F1Weekend[] {
  const map = new Map<string, F1Weekend>();
  for (const s of [...sessions].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
    let w = map.get(s.gp);
    if (!w) {
      w = { gp: s.gp, circuit: s.circuit, place: [s.city, s.country].filter(Boolean).join(", ") || null, sessions: [] };
      map.set(s.gp, w);
    }
    w.sessions.push(s);
  }
  return Array.from(map.values());
}

// Aktuelles Wochenende: das erste, dessen letzte Session nicht länger als
// einen Tag her ist; sonst das letzte.
function currentWeekend(weekends: F1Weekend[], now: number): number {
  const i = weekends.findIndex((w) => Date.parse(w.sessions[w.sessions.length - 1].start) > now - 24 * 60 * 60 * 1000);
  return i >= 0 ? i : Math.max(0, weekends.length - 1);
}

// Standard-Session: laufende, sonst die zuletzt begonnene, sonst die erste.
function defaultSession(w: F1Weekend, now: number): number | null {
  const live = w.sessions.find((s) => f1IsLive(s, now));
  if (live) return live.id;
  const started = w.sessions.filter((s) => Date.parse(s.start) <= now);
  return (started[started.length - 1] ?? w.sessions[0])?.id ?? null;
}

// Reiter je Rennserie (Rene, 30.10.2026: "ein Unterreiter mit Formel 1 und
// MotoGP"). In der Formel 1 umschaltbar zwischen Wochenende und WM-Stand.
// Tennis im Matchcenter (Rene, 10.11.2026). Solange es noch keine
// Tennis-API gibt, stehen hier die Tennis-Tippspiele aus dem Admin: Spieler
// mit Flagge, Uhrzeit bzw. Satzergebnis und rechts "Tippen"/"Getippt".
// Live-Stände, Spielplan aller Turniere und Weltrangliste kommen mit der API.
function TennisCenter({ switcher }: { switcher: React.ReactNode }) {
  const { matches, getTeam, myTips } = useAppData();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const tipped = useMemo(() => new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId)), [myTips]);
  const live = useTennisLive();
  // Reiter (Rene, 10.11.2026): Heute (Live + Tippspiele), Spielplan, Weltrangliste.
  const [view, setView] = useState<"heute" | "plan" | "rang">("heute");
  const [rankTour, setRankTour] = useState<"atp" | "wta">("atp");
  const [sideTour, setSideTour] = useState<"atp" | "wta">("atp");
  const since = now - 2 * 24 * 3600e3;
  const list = matches
    .filter((m) => m.sport === "Tennis" && !m.draft && m.status !== "cancelled" && Date.parse(m.kickoff) >= since)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const days: { day: string; games: Match[] }[] = [];
  for (const m of list) {
    const day = viennaCalendarDay(m.kickoff);
    const last = days[days.length - 1];
    if (last && last.day === day) last.games.push(m);
    else days.push({ day, games: [m] });
  }
  // Live: Turniere nach Wichtigkeit, ITF (M15, W25 …) ausgeblendet wie
  // kleine Länderspiele beim Fußball.
  const liveGames = (live?.games ?? []).filter((g) => !isMinorTournament(g.tournament));
  const groups: { name: string; games: TennisLiveGame[] }[] = [];
  for (const g of [...liveGames].sort((a, b) => tournamentRank(a.tournament, a.tour) - tournamentRank(b.tournament, b.tour) || a.tournament.localeCompare(b.tournament))) {
    const last = groups[groups.length - 1];
    if (last && last.name === g.tournament) last.games.push(g);
    else groups.push({ name: g.tournament, games: [g] });
  }
  // Spiel-Detail (Rene, 10.11.2026: "rechts sollte was kommen, wo das Spiel
  // größer wird und mehr Statistik wie beim Fußball"): am PC rechts, am
  // Handy als Fenster von unten. Am PC ist das erste Live-Spiel gewählt.
  const isDesktop = useIsDesktop();
  const [selId, setSelId] = useState<string | null>(null);
  const [picked, setPicked] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const firstLiveId = groups[0]?.games[0]?.id ?? null;
  useEffect(() => {
    if (!picked && isDesktop && firstLiveId && !selId) setSelId(firstLiveId);
  }, [picked, isDesktop, firstLiveId, selId]);
  const selGame = selId ? liveGames.find((g) => g.id === selId) ?? null : null;
  const selectLive = (id: string) => {
    setPicked(true);
    setSelId(id);
    if (!window.matchMedia("(min-width: 1024px)").matches) setSheetOpen(true);
  };
  const liveFor = (m: Match) => {
    const h = getTeam(m.homeTeamId)?.name;
    const a = getTeam(m.awayTeamId)?.name;
    return h && a && live ? findLiveFor(liveGames, h, a) : null;
  };
  return (
    <section className="mb-6">
      {switcher}
      <div className="mb-3 flex border-b border-edge sm:mb-4 sm:items-center sm:gap-6">
        <SubTab label={<><span className="mr-1 text-red-400">●</span>Heute</>} active={view === "heute"} onClick={() => setView("heute")} />
        <SubTab label="Spielplan" active={view === "plan"} onClick={() => setView("plan")} />
        <SubTab label="Weltrangliste" active={view === "rang"} onClick={() => setView("rang")} />
      </div>
      {/* Am PC wie Fußball (Rene, 10.11.2026: "im Web komisch, Zeilen zu
          lange"): links die Liste als Karte, rechts eine Karte mit der
          Weltrangliste (Top 10). Am Handy nur die Liste. */}
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className="min-w-0 lg:rounded-card lg:border lg:border-muted/40 lg:bg-surface lg:p-4 lg:shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)]">
      {view === "plan" ? (
        <TennisPlanView now={now} />
      ) : view === "rang" ? (
        <TennisRankView tour={rankTour} onTour={setRankTour} />
      ) : (
      <>
      {groups.length > 0 && (
        <div className="mb-5">
          <p className="mb-2 flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
            <span className="text-red-400">● Live</span>
            {live?.fetchedAt ? (
              <span className="text-[11px] font-normal normal-case tracking-normal text-muted/80">
                Stand {new Date(live.fetchedAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" })}
              </span>
            ) : null}
          </p>
          <div className="flex flex-col gap-4">
            {groups.map((grp) => (
              <div key={grp.name}>
                <p className="mb-2 flex items-center gap-2 font-display text-[16px] font-bold text-ink">
                  <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-row text-[14px]">🏆</span>
                  <span className="min-w-0 break-words">{grp.name}</span>
                  <PointsTag name={grp.name} tour={grp.games[0]?.tour} />
                </p>
                <div className={TENNIS_GRID}>
                  {grp.games.map((g) => (
                    <TennisLiveRow key={g.id} game={g} selected={isDesktop && selGame?.id === g.id} onSelect={() => selectLive(g.id)} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {days.length === 0 ? (
        groups.length === 0 && (
          <EmptyState
            emoji="🎾"
            title={live === null ? "Tennis wird geladen …" : "Gerade kein Tennis live"}
            text="Hier stehen die laufenden Tennis-Spiele und deine Tennis-Tippspiele."
            className="border-none bg-transparent"
          />
        )
      ) : (
        <div className="flex flex-col gap-4">
          {days.map(({ day, games }) => (
            <div key={day}>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                {relativeDayLabel(day, now) ?? new Date(games[0].kickoff).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Vienna" })}
              </p>
              <div className={TENNIS_GRID}>
                {games.map((m) => (
                  <TennisRow
                    key={m.id}
                    match={m}
                    home={getTeam(m.homeTeamId)}
                    away={getTeam(m.awayTeamId)}
                    now={now}
                    tipped={tipped.has(m.id)}
                    live={liveFor(m)}
                    onSelect={selectLive}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </>
      )}
      </div>
      <aside className="hidden lg:flex lg:flex-col lg:gap-6">
        {view === "heute" &&
          (selGame ? (
            <TennisDetail key={selGame.id} game={selGame} />
          ) : (
            <p className="rounded-card border border-dashed border-edge px-4 py-8 text-center text-sm text-muted">
              Live-Spiel antippen, um Spielstand und Statistik zu sehen.
            </p>
          ))}
        <TennisTopTen
          tour={view === "rang" ? (rankTour === "atp" ? "wta" : "atp") : sideTour}
          onTour={view === "rang" ? undefined : setSideTour}
          onAll={(t) => {
            setRankTour(t);
            setView("rang");
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      </aside>
      </div>
      {!isDesktop && (
        <MatchSheet
          open={sheetOpen && !!selGame}
          title={selGame ? `${shortPlayer(selGame.player1)} – ${shortPlayer(selGame.player2)}` : ""}
          onClose={() => setSheetOpen(false)}
        >
          {selGame && <TennisDetail key={selGame.id} game={selGame} />}
        </MatchSheet>
      )}
    </section>
  );
}

// Eine Spalte wie beim Fußball; am PC steht die Liste in der linken Karte
// (Rene, 10.11.2026: zwei Spalten sahen zerrissen aus).
const TENNIS_GRID = "flex flex-col gap-2";

const TOURS = [
  ["atp", "ATP Herren"],
  ["wta", "WTA Damen"],
] as const;

function TourPills({ tour, onChange }: { tour: "atp" | "wta"; onChange: (t: "atp" | "wta") => void }) {
  return (
    <div className="mb-3 flex gap-2" role="tablist" aria-label="Tour">
      {TOURS.map(([id, label]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={tour === id}
          onClick={() => onChange(id)}
          className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
            tour === id ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function useTennisList<T>(kind: "plan" | "rank", tour: "atp" | "wta"): TennisListResponse<T> | null {
  const [data, setData] = useState<{ key: string; res: TennisListResponse<T> } | null>(null);
  const key = `${kind}-${tour}`;
  useEffect(() => {
    let alive = true;
    fetch(`/api/tennis/list?kind=${kind}&tour=${tour}`)
      .then((r) => r.json() as Promise<TennisListResponse<T>>)
      .then((res) => alive && setData({ key, res }))
      .catch(() => alive && setData({ key, res: { ok: false, error: "Tennis-Daten gerade nicht erreichbar.", fetchedAt: null, rows: [] } }));
    return () => {
      alive = false;
    };
  }, [kind, tour, key]);
  return data && data.key === key ? data.res : null;
}

// Um wie viele Ranglistenpunkte es geht, dezent neben dem Turniernamen.
function PointsTag({ name, tour }: { name: string; tour?: string | null }) {
  const text = tournamentPointsText(name, tour);
  if (!text) return null;
  return (
    <span className="shrink-0 whitespace-nowrap rounded-full border border-edge px-2 py-0.5 font-sans text-[11px] font-semibold text-muted">
      {text}
    </span>
  );
}

function TennisFlag({ code }: { code: string | null }) {
  return (
    <span className="inline-flex w-5 shrink-0 justify-center text-[15px] leading-none">{code ? flagEmoji(code) : "🎾"}</span>
  );
}

// Spielplan: kommende Spiele der Tour nach Tag und Turnier (ITF ausgeblendet).
function TennisPlanView({ now }: { now: number }) {
  const [tour, setTour] = useState<"atp" | "wta">("atp");
  const data = useTennisList<TennisPlanGame>("plan", tour);
  const rows = (data?.rows ?? []).filter((g) => !isMinorTournament(g.tournament) && g.start > now - 3 * 3600e3);
  const days: { day: string; groups: { name: string; games: TennisPlanGame[] }[] }[] = [];
  for (const g of rows) {
    const day = viennaCalendarDay(g.start);
    let d = days.find((x) => x.day === day);
    if (!d) days.push((d = { day, groups: [] }));
    let grp = d.groups.find((x) => x.name === g.tournament);
    if (!grp) d.groups.push((grp = { name: g.tournament, games: [] }));
    grp.games.push(g);
  }
  days.forEach((d) => d.groups.sort((a, b) => tournamentRank(a.name, tour) - tournamentRank(b.name, tour)));
  return (
    <div>
      <TourPills tour={tour} onChange={setTour} />
      {data === null ? (
        <p className="py-8 text-center text-sm text-muted">Spielplan wird geladen …</p>
      ) : days.length === 0 ? (
        <EmptyState
          emoji="🗓️"
          title="Keine Spiele im Spielplan"
          text={data.error ?? "Für die nächsten Tage stehen noch keine Spiele fest."}
          className="border-none bg-transparent"
        />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((d) => (
            <div key={d.day}>
              <p className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-muted">
                {relativeDayLabel(d.day, now) ??
                  new Date(d.groups[0].games[0].start).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "2-digit", timeZone: "Europe/Vienna" })}
              </p>
              <div className="flex flex-col gap-4">
                {d.groups.map((grp) => (
                  <div key={grp.name}>
                    <p className="mb-2 flex items-center gap-2 font-display text-[15px] font-bold text-ink">
                      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-row text-[14px]">🏆</span>
                      <span className="min-w-0 break-words">{grp.name}</span>
                      <PointsTag name={grp.name} tour={tour} />
                    </p>
                    <div className={TENNIS_GRID}>
                      {grp.games.map((g) => (
                        <div key={g.id} className="flex items-stretch rounded-xl border border-muted/25 bg-row px-3 py-2">
                          <div className="mr-3 flex w-[58px] shrink-0 flex-col justify-center border-r border-edge pr-2 text-[13px] text-muted">
                            {new Date(g.start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" })}
                            {g.round && <span className="truncate text-[11px] text-muted/80">{g.round}</span>}
                          </div>
                          <div className="min-w-0 flex-1">
                            {[
                              [g.player1, g.country1],
                              [g.player2, g.country2],
                            ].map(([name, cc], i) => (
                              <div key={i} className="flex min-h-[26px] items-center gap-2">
                                <TennisFlag code={cc} />
                                <span className="min-w-0 break-words text-[15px] leading-tight text-ink">{name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Weltrangliste Einzel, Top 100 (ATP/WTA).
function TennisRankView({ tour, onTour: setTour }: { tour: "atp" | "wta"; onTour: (t: "atp" | "wta") => void }) {
  const data = useTennisList<TennisRankRow>("rank", tour);
  const rows = data?.rows ?? [];
  return (
    <div>
      <TourPills tour={tour} onChange={setTour} />
      {data === null ? (
        <p className="py-8 text-center text-sm text-muted">Weltrangliste wird geladen …</p>
      ) : rows.length === 0 ? (
        <EmptyState emoji="🏆" title="Weltrangliste nicht verfügbar" text={data.error ?? "Gerade keine Daten."} className="border-none bg-transparent" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-muted/25 bg-row">
          <div className="flex items-center border-b border-edge px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
            <span className="w-9">#</span>
            <span className="flex-1">Spieler{tour === "wta" ? "in" : ""}</span>
            <span>Punkte</span>
          </div>
          {rows.map((r) => (
            <div key={`${r.rank}-${r.name}`} className="flex min-h-[44px] items-center border-b border-edge/60 px-3 last:border-b-0">
              <span className={`w-9 font-display text-[15px] font-bold ${r.rank <= 3 ? "text-gold" : "text-muted"}`}>{r.rank}</span>
              <TennisFlag code={r.country} />
              <span className="ml-2 min-w-0 flex-1 break-words text-[15px] leading-tight text-ink">{r.name}</span>
              <span className="ml-2 shrink-0 tabular-nums text-[14px] text-muted">{r.points !== null ? r.points.toLocaleString("de-DE") : ""}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Spiel-Detail wie beim Fußball: Karte mit Turnier, großem Spielstand und
// den Reitern Spiel / Statistik. Fehlt etwas in den Daten, bleibt es leer.
function useTennisStats(id: string): TennisStatsResponse | null {
  const [data, setData] = useState<{ id: string; res: TennisStatsResponse } | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch(`/api/tennis/stats?id=${encodeURIComponent(id)}`)
        .then((r) => r.json() as Promise<TennisStatsResponse>)
        .then((res) => alive && setData({ id, res: { ...res, rows: Array.isArray(res?.rows) ? res.rows : [] } }))
        .catch(() => alive && setData((cur) => cur ?? { id, res: { ok: false, error: "Statistik gerade nicht erreichbar.", fetchedAt: null, rows: [] } }));
    load();
    const t = setInterval(load, 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);
  return data && data.id === id ? data.res : null;
}

function TennisDetail({ game }: { game: TennisLiveGame }) {
  const [tab, setTab] = useState<"spiel" | "statistik">("spiel");
  const stats = useTennisStats(game.id);
  const setNo = Math.max(1, game.sets.length);
  const pts = game.points ? game.points.split("-").slice(0, 2) : null;
  // Nur gespielte Sätze, keine leeren Spalten.
  const cols = Math.max(1, game.sets.length);
  const player = (name: string, side: 0 | 1) => (
    <div className="flex min-h-[44px] items-center gap-2 border-b border-edge/60 last:border-b-0">
      <span className="min-w-0 flex-1 break-words font-display text-[17px] font-semibold leading-tight text-ink">
        {name}
        {game.serve === side + 1 && <span aria-label="Aufschlag" className="ml-2 inline-block h-2 w-2 -translate-y-px rounded-full bg-gold align-middle" />}
      </span>
      {Array.from({ length: cols }, (_, i) => {
        const set = game.sets[i];
        const current = i === game.sets.length - 1;
        return (
          <span key={i} className={`w-7 text-center font-display text-[18px] tabular-nums ${!set ? "text-muted/40" : current ? "font-bold text-ink" : "text-muted"}`}>
            {set ? set[side] : ""}
          </span>
        );
      })}
      <span className="w-9 text-center text-[15px] font-semibold tabular-nums text-gold/90">{pts ? pts[side] : ""}</span>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold font-display text-[20px] font-bold text-gold">{game.setsWon[side]}</span>
    </div>
  );
  return (
    <div className="flex flex-col gap-4 rounded-card border border-muted/40 bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)] sm:p-4">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
          <span aria-hidden>🏆</span>
          <span className="min-w-0 break-words">{game.tournament || "Tennis"}</span>
          <PointsTag name={game.tournament} tour={game.tour} />
        </span>
        <span className="shrink-0 whitespace-nowrap font-semibold text-red-400">
          ● Live · {setNo}. Satz
        </span>
      </div>
      <div className="rounded-lg border border-edge bg-pitch/60 px-3 py-1">
        <div className="flex items-center gap-2 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
          <span className="flex-1">{game.tour === "wta" ? "WTA" : game.tour === "atp" ? "ATP" : ""}</span>
          {Array.from({ length: cols }, (_, i) => (
            <span key={i} className="w-7 text-center">{i + 1}</span>
          ))}
          <span className="w-9 text-center">Pkt</span>
          <span className="w-9 text-center">Sätze</span>
        </div>
        {player(game.player1, 0)}
        {player(game.player2, 1)}
      </div>
      <div className="flex gap-1 rounded-full border border-edge bg-pitch/60 p-1" role="tablist">
        {(
          [
            ["spiel", "Spiel"],
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
      {tab === "spiel" ? (
        <div className="flex flex-col divide-y divide-edge/60 text-[14px]">
          {game.sets.map(([a, b], i) => {
            const done = i < game.sets.length - 1;
            return (
              <div key={i} className="flex min-h-[40px] items-center gap-2">
                <span className="flex-1 text-muted">{i + 1}. Satz</span>
                <span className={`font-display text-[16px] font-bold tabular-nums ${done ? "text-ink" : "text-red-400"}`}>
                  {a} : {b}
                </span>
                <span className="w-24 text-right text-[12px] text-muted">{done ? (a > b ? shortPlayer(game.player1) : shortPlayer(game.player2)) : "läuft"}</span>
              </div>
            );
          })}
          {game.sets.length === 0 && <p className="py-6 text-center text-sm text-muted">Das Spiel hat gerade begonnen.</p>}
        </div>
      ) : stats === null ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : stats.rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{stats.error ?? "Für dieses Spiel gibt es noch keine Statistik."}</p>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between gap-2 text-[12px] font-semibold text-muted">
            <span className="min-w-0 break-words">{shortPlayer(game.player1)}</span>
            <span className="min-w-0 break-words text-right">{shortPlayer(game.player2)}</span>
          </div>
          {stats.rows.map((r) => {
            const max = Math.max(r.v1, r.v2);
            const pa = max > 0 ? (r.v1 / max) * 100 : 0;
            const pb = max > 0 ? (r.v2 / max) * 100 : 0;
            // Bei Doppelfehlern ist weniger besser.
            const lowGood = r.key === "doubleFaults" || r.key === "double_faults";
            const aBetter = lowGood ? r.v1 < r.v2 : r.v1 > r.v2;
            const bBetter = lowGood ? r.v2 < r.v1 : r.v2 > r.v1;
            return (
              <div key={r.key}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
                  <span className={`font-display font-bold tabular-nums ${aBetter ? "text-gold" : "text-ink"}`}>{r.text1}</span>
                  <span className="text-center text-[12px] text-muted">{r.label}</span>
                  <span className={`font-display font-bold tabular-nums ${bBetter ? "text-gold" : "text-ink"}`}>{r.text2}</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  <span className="flex h-1.5 justify-end overflow-hidden rounded-full bg-edge/60">
                    <span className={`h-full rounded-full ${aBetter ? "bg-gold" : "bg-muted/60"}`} style={{ width: `${pa}%` }} />
                  </span>
                  <span className="flex h-1.5 overflow-hidden rounded-full bg-edge/60">
                    <span className={`h-full rounded-full ${bBetter ? "bg-gold" : "bg-muted/60"}`} style={{ width: `${pb}%` }} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Rechte Karte am PC: Top 10 der Weltrangliste, wie die TV-Karte beim Fußball.
function TennisTopTen({
  tour,
  onTour,
  onAll,
}: {
  tour: "atp" | "wta";
  onTour?: (t: "atp" | "wta") => void;
  onAll: (t: "atp" | "wta") => void;
}) {
  const data = useTennisList<TennisRankRow>("rank", tour);
  const rows = (data?.rows ?? []).slice(0, 10);
  return (
    <div className="rounded-card border border-muted/40 bg-surface p-4 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)]">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="flex-1 font-display text-[16px] font-bold text-ink">Weltrangliste</h3>
        {onTour ? (
          <div className="flex gap-1" role="tablist" aria-label="Tour">
            {TOURS.map(([id]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tour === id}
                onClick={() => onTour(id)}
                className={`min-h-8 rounded-full border px-3 text-xs font-semibold transition-colors ${
                  tour === id ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
                }`}
              >
                {id.toUpperCase()}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-xs font-semibold text-muted">{tour === "atp" ? "ATP Herren" : "WTA Damen"}</span>
        )}
      </div>
      {data === null ? (
        <p className="py-6 text-center text-sm text-muted">Lädt …</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{data.error ?? "Gerade keine Daten."}</p>
      ) : (
        <ol className="flex flex-col divide-y divide-edge/60">
          {rows.map((r) => (
            <li key={`${r.rank}-${r.name}`} className="flex min-h-[38px] items-center">
              <span className={`w-7 font-display text-[14px] font-bold ${r.rank <= 3 ? "text-gold" : "text-muted"}`}>{r.rank}</span>
              <TennisFlag code={r.country} />
              <span className="ml-2 min-w-0 flex-1 break-words text-[14px] leading-tight text-ink">{r.name}</span>
              <span className="ml-2 shrink-0 tabular-nums text-[13px] text-muted">{r.points !== null ? r.points.toLocaleString("de-DE") : ""}</span>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={() => onAll(tour)}
        className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg border border-edge text-sm font-semibold text-gold hover:border-gold/60"
      >
        Ganze Weltrangliste ›
      </button>
    </div>
  );
}

// Live-Stände holen (Server speichert zwischen, siehe app/api/tennis).
// null = lädt noch.
function useTennisLive(): TennisLiveResponse | null {
  const [data, setData] = useState<TennisLiveResponse | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/tennis")
        .then((r) => r.json() as Promise<TennisLiveResponse>)
        .then((d) => alive && setData(d))
        .catch(() => alive && setData((cur) => cur ?? { ok: false, error: "offline", fetchedAt: null, games: [] }));
    load();
    const t = setInterval(load, 30 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return data;
}

// Live-Zeile wie im Konzept (Rene, 10.11.2026): links Live + Satz, Spieler
// untereinander mit gelbem Aufschlag-Punkt, Games je Satz, rechts im
// Goldkasten die gewonnenen Sätze, darunter der Punktestand im Game.
function TennisLiveRow({ game, selected, onSelect }: { game: TennisLiveGame; selected: boolean; onSelect: () => void }) {
  const setNo = Math.max(1, game.sets.length);
  const player = (name: string, side: 1 | 2) => (
    <div className="flex min-h-[26px] items-center gap-1.5">
      <span className="min-w-0 break-words text-[15px] leading-tight text-ink">{name}</span>
      {game.serve === side && <span aria-label="Aufschlag" className="h-[7px] w-[7px] shrink-0 rounded-full bg-gold" />}
    </div>
  );
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex w-full items-stretch rounded-xl border px-2.5 py-2 text-left transition-colors sm:px-3 ${
        selected ? "border-red-300/80 bg-row-hover" : "border-red-400/50 bg-row hover:bg-row-hover"
      }`}
    >
      <div className="mr-2 flex w-[52px] shrink-0 sm:mr-3 sm:w-[64px] flex-col justify-center border-r border-edge pr-2 text-[13px]">
        <span className="font-semibold text-red-400">● Live</span>
        <span className="text-[11px] text-muted">{setNo}. Satz</span>
      </div>
      <div className="min-w-0 flex-1">
        {player(shortPlayer(game.player1), 1)}
        {player(shortPlayer(game.player2), 2)}
      </div>
      <div className="ml-1.5 flex shrink-0 items-center gap-0.5 sm:ml-2 sm:gap-1">
        {game.sets.map(([a, b], i) => (
          <div key={i} className="flex w-5 flex-col text-center text-[14px] leading-[26px] text-muted">
            <span className={i === game.sets.length - 1 ? "text-ink" : ""}>{a}</span>
            <span className={i === game.sets.length - 1 ? "text-ink" : ""}>{b}</span>
          </div>
        ))}
        {game.points && (
          <div className="flex w-6 flex-col text-center text-[12px] leading-[26px] text-gold/90 sm:w-7">
            {game.points.split("-").slice(0, 2).map((p, i) => (
              <span key={i}>{p}</span>
            ))}
          </div>
        )}
        <div className="ml-1 flex h-[50px] w-7 flex-col items-center justify-around rounded-md border border-gold font-display text-[15px] font-bold text-gold">
          <span>{game.setsWon[0]}</span>
          <span>{game.setsWon[1]}</span>
        </div>
      </div>
    </button>
  );
}

function TennisRow({
  match,
  home,
  away,
  now,
  tipped,
  live,
  onSelect,
}: {
  match: Match;
  home?: Team;
  away?: Team;
  now: number;
  tipped: boolean;
  live: { game: TennisLiveGame; swapped: boolean } | null;
  onSelect: (liveId: string) => void;
}) {
  const finished = match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null;
  // Live-Stand aus der Tennis-API (Spieler nach Namen gefunden), in der
  // Reihenfolge des Tippspiels.
  const liveSets = !finished && live ? (live.swapped ? [live.game.setsWon[1], live.game.setsWon[0]] : live.game.setsWon) : null;
  const tippable = isMatchTippable(match, now);
  const started = !finished && (match.status === "live" || Date.parse(match.kickoff) <= now);
  const winner = finished ? (match.liveHomeScore! > match.liveAwayScore! ? "home" : "away") : null;
  const player = (team: Team | undefined, side: "home" | "away", sets: number | null) => (
    <div className="flex min-h-[26px] items-center gap-2">
      <span className="shrink-0">
        <TeamBadge sport="Tennis" primaryColor="#ffffff" secondaryColor="#000000" countryCode={team?.countryCode} size={20} />
      </span>
      <span className={`min-w-0 flex-1 break-words text-[15px] leading-tight ${winner === side ? "font-bold text-ink" : winner ? "text-muted" : "text-ink"}`}>
        {team?.name ?? "?"}
      </span>
      {sets !== null && <span className="w-5 text-center font-display text-[16px] font-bold text-gold">{sets}</span>}
    </div>
  );
  const time = new Date(match.kickoff).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Vienna" });
  // Läuft das Spiel in den Live-Daten, öffnet ein Klick das Detail.
  const open = !finished && live ? () => onSelect(live.game.id) : null;
  return (
    <div
      role={open ? "button" : undefined}
      tabIndex={open ? 0 : undefined}
      onClick={open ?? undefined}
      onKeyDown={open ? (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), open()) : undefined}
      className={`flex items-stretch rounded-xl border border-muted/25 bg-row px-3 py-2 ${open ? "cursor-pointer hover:bg-row-hover" : ""}`}
    >
      <div className="mr-3 flex w-[64px] shrink-0 flex-col justify-center border-r border-edge pr-2 text-[13px] text-muted">
        {finished ? "Endstand" : started || liveSets ? <span className="font-semibold text-red-400">● Live</span> : time}
        <span className="truncate text-[11px] text-muted/80">{match.competition}</span>
      </div>
      <div className="min-w-0 flex-1">
        {player(home, "home", finished ? match.liveHomeScore : liveSets ? liveSets[0] : null)}
        {player(away, "away", finished ? match.liveAwayScore : liveSets ? liveSets[1] : null)}
      </div>
      {!finished && (tipped ? (
        <span className="ml-2 self-center text-[13px] text-muted">Getippt</span>
      ) : tippable ? (
        <Link
          href={tipCardHref(match.id)}
          onClick={(e) => e.stopPropagation()}
          className="ml-2 self-center rounded-lg border border-edge border-r-[3px] border-r-gold px-2.5 py-1.5 text-[13px] font-bold text-gold"
        >
          Tippen
        </Link>
      ) : null)}
    </div>
  );
}

function MotorsportCenter({ switcher }: { switcher: React.ReactNode }) {
  const [series, setSeries] = useState<"f1" | "motogp">("f1");
  const [view, setView] = useState<"wochenende" | "wm">("wochenende");
  return (
    <section className="mb-6">
      {switcher}
      <div className="mb-3 flex border-b border-edge sm:mb-4 sm:items-center sm:gap-6">
        <SubTab label="Formel 1" active={series === "f1"} onClick={() => setSeries("f1")} />
        <SubTab label="MotoGP" active={series === "motogp"} onClick={() => setSeries("motogp")} />
      </div>
      {series === "motogp" ? (
        <EmptyState
          emoji="🏍️"
          title="MotoGP kommt noch"
          text="Für MotoGP haben wir noch keine Datenquelle. Sobald es eine gibt, stehen hier Rennen und WM-Stand."
          className="border-none bg-transparent"
        />
      ) : (
        <>
          <div className="mb-3 flex gap-2" role="tablist" aria-label="Ansicht">
            {(
              [
                ["wochenende", "Rennwochenende"],
                ["wm", "WM-Stand"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={`min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors ${
                  view === id ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {view === "wochenende" ? <F1WeekendView /> : <F1DriverStandings />}
        </>
      )}
    </section>
  );
}

const F1_CARD = "min-w-0 rounded-card border border-muted/40 bg-surface p-3 shadow-[0_10px_30px_-14px_rgba(0,0,0,0.9)] lg:p-4";

function F1WeekendView() {
  const [sessions, setSessions] = useState<F1Session[] | null>(null);
  const [onlyDays, setOnlyDays] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [weekendIdx, setWeekendIdx] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Ganze Saison (eine Abfrage); gesperrt → heute und morgen nach Datum.
  useEffect(() => {
    let alive = true;
    (async () => {
      const season = await loadF1("kind=races-season");
      if (!alive) return;
      if (season.ok && season.data.kind === "sessions" && season.data.sessions.length > 0) {
        setSessions(season.data.sessions);
        setOnlyDays(false);
        setWeekendIdx(null);
        setError(null);
        return;
      }
      const today = viennaDate(Date.now());
      const days = await Promise.all([today, addDays(today, 1)].map((d) => loadF1(`kind=races-day&date=${d}`)));
      if (!alive) return;
      const list = days.flatMap((d) => (d.ok && d.data.kind === "sessions" ? d.data.sessions : []));
      // Fehler nur zeigen, wenn auch die Tage nicht gehen; gesperrte Saison
      // und heute/morgen nichts = "keine Formel 1".
      const dayError = days.find((d) => !d.ok);
      setSessions(list);
      setOnlyDays(true);
      setWeekendIdx(null);
      setError(list.length === 0 && dayError && !dayError.ok ? dayError.error : null);
    })();
    return () => {
      alive = false;
    };
  }, [reloadKey]);

  const weekends = useMemo(() => (sessions ? f1Weekends(sessions) : []), [sessions]);
  // Startbild am Handy ausblenden (lib/appReady.ts).
  useEffect(() => {
    if (sessions !== null || error) signalAppReady();
  }, [sessions, error]);
  const shownIdx = weekendIdx ?? currentWeekend(weekends, now);
  const weekend = weekends[shownIdx] ?? null;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const shownSessionId =
    weekend && sessionId !== null && weekend.sessions.some((s) => s.id === sessionId)
      ? sessionId
      : weekend
        ? defaultSession(weekend, now)
        : null;
  const shownSession = weekend?.sessions.find((s) => s.id === shownSessionId) ?? null;

  if (sessions === null) return <p className="py-8 text-center text-sm text-muted">Lädt…</p>;
  if (error) {
    return (
      <div className={F1_CARD}>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <p className="text-sm text-muted">{f1ErrorText(error)}</p>
          <button
            onClick={() => setReloadKey((k) => k + 1)}
            className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
          >
            Nochmal versuchen
          </button>
        </div>
      </div>
    );
  }
  if (!weekend) {
    return (
      <EmptyState
        emoji="🏎️"
        title="Heute und morgen keine Formel 1"
        text="Sobald ein Grand Prix ansteht, stehen hier Training, Qualifying und Rennen."
        className="border-none bg-transparent"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start xl:grid-cols-[minmax(0,1fr)_460px]">
      <div className={F1_CARD}>
        {/* Grand Prix mit Pfeilen in der Kapsel (Rene, 07.11.2026, Variante B). */}
        <div className="mb-3">
          <NavCapsule>
            <NavArrow
              dir={-1}
              enabled={shownIdx > 0}
              label="Voriger Grand Prix"
              onClick={() => {
                setWeekendIdx(shownIdx - 1);
                setSessionId(null);
              }}
            />
            <NavLabel title={weekend.gp} sub={[weekend.circuit, weekend.place].filter(Boolean).join(" · ") || undefined} />
            <NavArrow
              dir={1}
              enabled={shownIdx < weekends.length - 1}
              label="Nächster Grand Prix"
              onClick={() => {
                setWeekendIdx(shownIdx + 1);
                setSessionId(null);
              }}
            />
          </NavCapsule>
        </div>
        <ul className="flex flex-col">
          {weekend.sessions.map((s) => {
            const live = f1IsLive(s, now);
            const active = s.id === shownSessionId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSessionId(s.id)}
                  aria-pressed={active}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-lg px-2 text-left transition-colors ${
                    active ? "bg-gold/10" : "hover:bg-surface-hover"
                  }`}
                >
                  <span className="w-20 shrink-0 border-r border-edge pr-3 text-xs tabular-nums text-muted">
                    {live ? (
                      <span className="flex items-center gap-1.5 font-semibold text-red-400">
                        <StateDot state="live" /> LIVE
                      </span>
                    ) : (
                      f1When(s.start)
                    )}
                  </span>
                  <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${active ? "text-gold" : "text-ink"}`}>
                    {f1TypeLabel(s.type)}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {f1Done(s, now) ? "Beendet" : live && s.lapsCurrent && s.lapsTotal ? `Runde ${s.lapsCurrent}/${s.lapsTotal}` : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {onlyDays && <p className="mt-3 text-center text-[11px] text-muted">Im Gratis-Plan nur die Sessions von heute und morgen.</p>}
      </div>
      <div className={F1_CARD}>
        {shownSession ? (
          <F1Ranking key={shownSession.id} session={shownSession} live={f1IsLive(shownSession, now)} />
        ) : (
          <p className="py-8 text-center text-sm text-muted">Session antippen, um die Wertung zu sehen.</p>
        )}
      </div>
    </div>
  );
}

function F1Ranking({ session, live }: { session: F1Session; live: boolean }) {
  const [result, setResult] = useState<Formula1Response | null>(null);
  const started = Date.parse(session.start) <= Date.now();

  useEffect(() => {
    if (!started) return;
    let alive = true;
    const load = () =>
      loadF1(`kind=ranking&race=${session.id}`).then((r) => {
        if (alive) setResult(r);
      });
    void load();
    const t = live ? setInterval(load, F1_RANKING_POLL_MS) : null;
    return () => {
      alive = false;
      if (t) clearInterval(t);
    };
  }, [session.id, live, started]);

  const rows = result?.ok && result.data.kind === "ranking" ? result.data.rows : [];
  const isRace = /race|sprint$/i.test(session.type);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="min-w-0 truncate font-display text-base font-semibold text-ink">{f1TypeLabel(session.type)}</p>
        {live ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-400">
            <StateDot state="live" /> LIVE
          </span>
        ) : (
          <span className="shrink-0 text-xs text-muted">{f1Done(session, Date.now()) ? "Beendet" : f1When(session.start)}</span>
        )}
      </div>
      {!started ? (
        <p className="py-6 text-center text-sm text-muted">Beginnt {f1When(session.start)} Uhr.</p>
      ) : !result ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : !result.ok ? (
        <p className="py-6 text-center text-sm text-muted">{f1ErrorText(result.error)}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Noch keine Wertung.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-edge/60 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.driver}-${i}`} className="flex min-h-10 items-center gap-2.5 py-1.5">
              <span className="w-6 shrink-0 text-right font-display font-semibold tabular-nums text-muted">{r.position ?? "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{r.driver}</span>
                {r.team && <span className="block truncate text-xs text-muted">{r.team}</span>}
              </span>
              <span className="shrink-0 text-right text-xs tabular-nums">
                <span className="block text-ink">{i === 0 ? r.time ?? "" : r.gap ?? r.time ?? ""}</span>
                {isRace && r.pits !== null && <span className="block text-muted">{r.pits} Stopp{r.pits === 1 ? "" : "s"}</span>}
                {!isRace && r.laps !== null && <span className="block text-muted">{r.laps} Runden</span>}
              </span>
            </li>
          ))}
        </ol>
      )}
      {live && <p className="mt-3 text-center text-[11px] text-muted">aktualisiert sich alle 2 Minuten</p>}
    </div>
  );
}

function F1DriverStandings() {
  const [result, setResult] = useState<Formula1Response | null>(null);
  useEffect(() => {
    let alive = true;
    void loadF1("kind=drivers").then((r) => {
      if (alive) setResult(r);
    });
    return () => {
      alive = false;
    };
  }, []);
  const rows = result?.ok && result.data.kind === "drivers" ? result.data.rows : [];
  return (
    <div className={`${F1_CARD} lg:max-w-2xl`}>
      <p className="mb-3 font-display text-base font-semibold text-ink">Fahrer-WM {viennaDate(Date.now()).slice(0, 4)}</p>
      {!result ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : !result.ok ? (
        <p className="py-6 text-center text-sm text-muted">{f1ErrorText(result.error)}</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Noch kein WM-Stand.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-edge/60 text-sm">
          {rows.map((r, i) => (
            <li key={`${r.driver}-${i}`} className="flex min-h-10 items-center gap-2.5 py-1.5">
              <span className="w-6 shrink-0 text-right font-display font-semibold tabular-nums text-muted">{r.position ?? "–"}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-ink">{r.driver}</span>
                {r.team && <span className="block truncate text-xs text-muted">{r.team}</span>}
              </span>
              <span className="shrink-0 text-right tabular-nums">
                <span className="block font-semibold text-ink">{r.points ?? 0}</span>
                <span className="block text-[11px] text-muted">Punkte</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
