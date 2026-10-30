"use client";

import EmptyState from "@/components/EmptyState";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
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
import { useLiveClock, useMinuteTick } from "@/lib/useLiveMinute";
import { useAppData } from "@/lib/AppDataContext";
import { competitionFlag } from "@/lib/competitionFlag";
import { displayOrder, isAwayFirst, scoreText, type TeamOrder } from "@/lib/teamOrder";
import { SPORT_ICONS, sportLabel, type Match, type Sport, type Team } from "@/lib/types";
import TeamBadge, { jerseyFor, matchJerseyProps, teamColorProps } from "@/components/TeamBadge";
import { LineupView, PreviewView, StatsView, useMatchInfo, useMatchPreview } from "@/components/MatchInfo";
import Emoji from "@/components/Emoji";
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
import { isNightKickoff, planDayRange, relativeDayLabel, sportDay, viennaCalendarDay } from "@/lib/matchcenterLink";
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
// Abstand).
function SubTab({ label, active, onClick }: { label: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`relative flex h-10 min-w-0 flex-auto items-center justify-center whitespace-nowrap px-1 font-display text-[12.5px] font-semibold transition-colors min-[400px]:text-[13px] sm:h-auto sm:flex-none sm:px-0 sm:py-3 sm:text-base ${
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
  // Nur echte Ländercodes ("FR", "GB-SCT"); ein unbekannter Ländername der
  // API ergäbe sonst kaputte Zeichen statt einer Flagge.
  return country && /^[A-Z]{2}(-[A-Z]{3})?$/.test(country) ? flagEmoji(country) : null;
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
  // (Namen erst ab lg:). Kein Tippspiel-Kästchen mehr (Rene, 29.10.2026:
  // im Matchcenter nur das echte Spiel).
  // Am Handy mind. 48 × 44 px pro Knopf, damit man gut mit dem Finger
  // trifft (Rene, 28.10.2026).
  const switcher = (
    <div className="mb-3 flex items-center gap-2">
      {LIVE_SPORTS.length > 1 && (
        <div className="flex gap-2" role="tablist" aria-label="Sportart">
          {LIVE_SPORTS.map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sport === s}
              aria-label={sportLabel(s)}
              onClick={() => pick(s)}
              className={`flex min-h-11 min-w-12 items-center justify-center gap-1.5 rounded-full border px-3 font-semibold transition-colors lg:px-4 ${
                sport === s ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
              }`}
            >
              <span className="text-xl leading-none">
                <Emoji e={SPORT_ICONS[s]} />
              </span>
              <span className="hidden text-[15px] lg:inline">{sportLabel(s)}</span>
            </button>
          ))}
        </div>
      )}
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
      setPlanDay(null);
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
  const todayGames = useMemo(() => sportDayGames(todayCal.games, tomorrowCal.games), [todayCal.games, tomorrowCal.games]);
  const todayDay = mergeSportDay(todayCal, tomorrowCal, todayGames);
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
  // Je Tag auch die Nacht danach (Sporttag): ein Kalendertag mehr laden.
  const planCal = useLiveDay(sport, view === "spielplan" ? shownPlanDay : null);
  const planNightCal = useLiveDay(sport, view === "spielplan" && shownPlanDay ? addDays(shownPlanDay, 1) : null);
  const planGames = useMemo(() => sportDayGames(planCal.games, planNightCal.games), [planCal.games, planNightCal.games]);
  const planDayData = mergeSportDay(planCal, planNightCal, planGames);

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
  const pollToday = partNeedsPolling(todayCal.games, false, now);
  const pollTomorrow = partNeedsPolling(tomorrowCal.games, true, now);
  const polling = pollToday || pollTomorrow;
  useLivePolling(sport, today, pollToday);
  useLivePolling(sport, tomorrow, pollTomorrow);

  const retry = () => {
    if (today) reloadLiveDay(sport, today);
    if (tomorrow) reloadLiveDay(sport, tomorrow);
    if (view === "spielplan" && shownPlanDay) {
      reloadLiveDay(sport, shownPlanDay);
      reloadLiveDay(sport, addDays(shownPlanDay, 1));
    }
  };

  // App-Spiele den API-Spielen zuordnen (gleiche Zuordnung wie die Tippkarten).
  const allGames = useMemo(() => {
    const seen = new Set((todayDay.games ?? []).map((g) => g.id));
    return [...(todayDay.games ?? []), ...(planDayData.games ?? []).filter((g) => !seen.has(g.id))];
  }, [todayDay.games, planDayData.games]);
  const links = useMemo(() => {
    const map = new Map<string, AppLink>();
    if (allGames.length === 0) return map;
    for (const m of matches) {
      if (m.sport !== sport || m.draft || m.status === "cancelled") continue;
      const day = sportDay(m.kickoff);
      if (day !== today && !(view === "spielplan" && day === shownPlanDay)) continue;
      const home = getTeam(m.homeTeamId);
      const away = getTeam(m.awayTeamId);
      if (!home || !away) continue;
      const result = findLiveGame(allGames, m.kickoff, home.name, away.name);
      if (result && !map.has(result.game.id)) map.set(result.game.id, { match: m, home, away, result });
    }
    return map;
    // apiNameLinks: verknüpfte Vereinsnamen zählen bei findLiveGame mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allGames, matches, getTeam, sport, today, view, shownPlanDay, apiNameLinks]);
  const tippedMatchIds = useMemo(
    () => new Set(myTips.filter((t) => !t.refunded).map((t) => t.matchId)),
    [myTips],
  );
  const isTipped = (g: LiveGame) => {
    const link = links.get(g.id);
    return !!link && tippedMatchIds.has(link.match.id);
  };

  // Von der Tippkarte: ein Spiel von heute steht unter "Heute", eines von
  // einem anderen Tag im Spielplan an seinem Tag (Rene, 30.10.2026).
  const targetDay = target ? sportDay(target.kickoff) : null;
  const targetInPlan = targetDay !== today && inPlanRange(targetDay);
  useEffect(() => {
    if (!targetDay || !targetInPlan) return;
    setView("spielplan");
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
  const listProps = { sport, links, selectedId, onSelect: select };

  const selectedLink = selected ? links.get(selected.id) ?? null : null;
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
            if (view === "spielplan") setPlanDay(null);
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
                  {shownPlanDay && planFirst && planLast && (
                    <DayNav
                      date={shownPlanDay}
                      now={now}
                      canBack={shownPlanDay > planFirst}
                      canAhead={shownPlanDay < planLast}
                      onPick={(days) => setPlanDay(addDays(shownPlanDay, days))}
                    />
                  )}
                  <LcDay key={shownPlanDay} games={planDayData.games} error={planDayData.error} onRetry={retry} {...listProps} />
                </>
              ) : (
                <LcLive onlyLive={onlyLive} games={todayDay.games} error={todayDay.error} dataAt={todayDay.dataAt} source={todayDay.source} loading={polling && todayDay.loading} onRetry={retry} {...listProps} />
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
                <LiveTvHeat games={tvGames} selectedId={selectedId} onSelect={select} />
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

// Kopf einer Liga (Rene, 30.10.2026, Variante A wie Livescore): Flagge im
// Kreis und Liganame, ohne ausgeschriebenes Land ("es reicht die Flagge").
// Ohne passende Flagge steht das Sport-Symbol im Kreis.
function LeagueHeading({ sport, game }: { sport: Sport; game: LiveGame }) {
  const { competitions } = useAppData();
  const flag = liveLeagueFlag(sport, game, competitions);
  const name = leagueName(game, sport);
  return (
    <p className="mb-2.5 flex items-center gap-2.5 font-display text-[15px] font-bold leading-tight text-ink lg:text-base">
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-edge bg-surface-hover text-lg"
      >
        <Emoji e={flag ?? SPORT_ICONS[sport]} />
      </span>
      <span className="min-w-0">{name}</span>
    </p>
  );
}

// Ligen untereinander, getrennt durch eine feine Linie über die ganze Breite
// (Rene, 30.10.2026: "klare Abgrenzung zu einer neuen Liga").
function LeagueGroups({ sport, games, renderRow }: { sport: Sport; games: LiveGame[]; renderRow: (g: LiveGame) => ReactNode }) {
  return (
    <div className="flex flex-col divide-y divide-edge">
      {groupByLeague(sport, games).map((group) => (
        <div key={group.league} className="py-4 first:pt-0 last:pb-0">
          <LeagueHeading sport={sport} game={group.games[0]} />
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
        games={[...running, ...upcoming, ...finished]}
        renderRow={(g) => <GameRow key={g.id} game={g} dataAt={dataAt} {...listProps} />}
      />
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
    <button
      type="button"
      onClick={() => onPick(dir)}
      disabled={!enabled}
      aria-label={dir < 0 ? "Vorheriger Tag" : "Nächster Tag"}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge text-ink transition-colors [@media(hover:hover)]:hover:border-gold [@media(hover:hover)]:hover:text-gold disabled:pointer-events-none disabled:opacity-30"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
      </svg>
    </button>
  );
  return (
    <div className="mb-3 flex items-center justify-between gap-3 border-b border-edge pb-3">
      {arrow(-1, canBack)}
      <p className="min-w-0 text-center leading-tight" aria-live="polite">
        <span className="block font-display text-base font-bold text-ink lg:text-lg">{relative ?? weekday}</span>
        <span className="block text-xs text-muted">
          {relative ? `${weekday}, ${short}` : short}
        </span>
      </p>
      {arrow(1, canAhead)}
    </div>
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
    <LeagueGroups sport={list.sport} games={[...games].sort(byKickoff)} renderRow={(g) => <GameRow key={g.id} game={g} {...list} />} />
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
      <LeaguePicker leagueId={leagueId} onPick={setLeagueId} />
      <div className="mb-4 hidden flex-wrap gap-2 lg:flex">
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
function LeaguePicker({ leagueId, onPick }: { leagueId: number; onPick: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const index = Math.max(0, TABLE_LEAGUES.findIndex((l) => l.id === leagueId));
  const current = TABLE_LEAGUES[index];

  useEffect(() => {
    if (!open) return;
    const body = document.body.style;
    const prevOverflow = body.overflow;
    body.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      body.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = (l: (typeof TABLE_LEAGUES)[number]) => (
    <>
      <span aria-hidden className="w-6 shrink-0 text-center">
        <Emoji e={l.country ? flagEmoji(l.country) : "🏆"} />
      </span>
      <span className="truncate">{l.label}</span>
    </>
  );
  const arrow = (dir: -1 | 1) => {
    const next = TABLE_LEAGUES[index + dir];
    return (
      <button
        type="button"
        onClick={() => next && onPick(next.id)}
        disabled={!next}
        aria-label={dir < 0 ? "Vorherige Liga" : "Nächste Liga"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-edge text-ink transition-colors [@media(hover:hover)]:hover:border-gold [@media(hover:hover)]:hover:text-gold disabled:pointer-events-none disabled:opacity-30"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d={dir < 0 ? "M15 6l-6 6 6 6" : "M9 6l6 6-6 6"} />
        </svg>
      </button>
    );
  };

  return (
    <div className="mb-4 flex items-center gap-3 lg:hidden">
      {arrow(-1)}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full border border-edge bg-surface px-3 font-display text-base font-bold text-ink"
      >
        {label(current)}
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-muted" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {arrow(1)}
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
              {TABLE_LEAGUES.map((l) => {
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
    // heute/morgen/gestern nach dem Kalendertag in Wien (Rene, 30.10.2026:
    // um 03:30 stand bei den Spielen von heute "morgen").
    const today = viennaCalendarDay(Date.now());
    const day = sportDay(game.kickoff);
    const sub = isNightKickoff(game.kickoff)
      ? "Nacht"
      : day === today ? "heute" : day < today ? "gestern" : day === addDays(today, 1) ? "morgen" : dayLabel(day).split(",")[0];
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
// (Minute/90). Kein "Getippt"/"Tippen" mehr (Rene, 29.10.2026: im Matchcenter
// nur das echte Spiel).
// Rahmen eine Spur heller als border-edge, neutral für alle Zustände.
function GameRow({ sport, game, dataAt = 0, links, selectedId, onSelect }: ListProps & { game: LiveGame; dataAt?: number }) {
  const clock = useLiveClock(sport, game.statusShort, game.elapsed, dataAt);
  const running = isLiveRunning(game.status);
  const hasScore = game.homeScore !== null && game.awayScore !== null && game.status !== "NS";
  const flash = useGoalFlash(game.id, hasScore ? `${game.homeScore}:${game.awayScore}` : null);
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
  const nameTone = (wins: boolean) => (!done ? "text-ink" : wins ? "font-semibold text-ink" : "text-muted");
  const scoreTone = (wins: boolean) => (done && !wins ? "text-muted" : "");
  // Laufend (Rene, 27.10.2026): Spielstand rot.
  const scoreColor = hasScore ? (running ? "text-red-500" : "text-ink") : "text-muted";
  // n. V. / i. E. 5:4 / n. P. steht direkt beim Ergebnis statt abgeschnitten
  // in der schmalen Status-Spalte (Rene, 29.10.2026: "du hast so viel platz
  // in der zeile"; am PC war es mit Sender als "Endstand i…" abgeschnitten):
  // am Handy neben den Toren, am PC unter der Ergebnis-Box.
  const endNote = done ? sub : null;
  const [endNoteMain, endNoteScore] = endNote ? splitEndNote(endNote) : [null, null];
  const statusSub = endNote ? null : sub;

  return (
    <button
      type="button"
      onClick={() => onSelect(game.id)}
      aria-pressed={selected}
      style={glow ? { boxShadow: GLOW[glow] } : undefined}
      // Gewählt: hellerer Hintergrund und weißlicher Rahmen statt Gold, damit
      // der rote Live-Rand klar bleibt (Rene, 27.10.2026).
      className={`relative w-full overflow-hidden rounded-card border px-3 py-2 text-left transition-[color,background-color,border-color,box-shadow] sm:pl-4 ${
        moved ? "motion-safe:animate-lc-row-in" : ""
      } ${
        selected
          ? "border-ink/50 bg-surface-hover"
          : done
              ? "border-muted/15 bg-surface/50 hover:border-muted/40"
              : "border-muted/25 bg-surface hover:border-muted/50"
      }`}
    >
      <div className="grid grid-cols-[4.75rem_1px_minmax(0,1fr)] items-center gap-x-2.5 text-sm">
        {/* Feste Breite, nichts läuft in die Namen (Rene, 16.10.2026):
            Zeile 1 groß/fett, Zeile 2 klein muted. */}
        <span className="flex w-[4.75rem] min-w-0 flex-col gap-0.5 overflow-hidden tabular-nums">
          <span className={`flex min-w-0 items-center gap-1 text-[13px] font-semibold leading-tight ${status.muted ? "text-muted" : "text-ink"}`}>
            {status.dot && <StateDot state={status.dot} />}
            <span className={`min-w-0 ${statusSub && tv ? "shrink-0" : "truncate"}`}>{status.main}</span>
            {/* Mit Sender darunter steht der Zusatz in derselben Zeile
                ("Verl. 122'"), damit jede Zeile höchstens zwei Zeilen hoch
                ist (Rene, 27.10.2026: "die Spalte ist höher"). */}
            {statusSub && tv && <span className="min-w-0 truncate text-[10px] font-normal text-muted">{statusSub}</span>}
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
          className={`grid min-w-0 ${endNote ? "grid-cols-[minmax(0,1fr)_auto_auto]" : "grid-cols-[minmax(0,1fr)_auto]"} grid-rows-[auto_auto] items-center gap-x-2 gap-y-0.5 lg:hidden`}
        >
          <FitText text={firstName} maxLines={2} minPx={12} className={`col-start-1 row-start-1 leading-tight ${nameTone(firstWins)}`} />
          <FitText text={secondName} maxLines={2} minPx={12} className={`col-start-1 row-start-2 leading-tight ${nameTone(secondWins)}`} />
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
        <span className="hidden min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-4 lg:grid">
          <FitText text={firstName} maxLines={2} minPx={12} className={`text-right text-[15px] leading-tight ${nameTone(firstWins)}`} />
          <span className="flex flex-col items-center gap-0.5">
            <span
              className={`flex items-center justify-center rounded-md border border-edge bg-pitch px-2 py-1 font-display text-lg font-bold leading-none tabular-nums transition-colors duration-700 ${
                flash ? "border-gold/50 bg-gold/15 text-gold" : scoreColor
              }`}
            >
              <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(firstWins)}`}>{hasScore ? firstScore : "–"}</span>
              <span className="px-0.5 text-muted">:</span>
              <span className={`min-w-6 whitespace-nowrap text-center ${scoreTone(secondWins)}`}>{hasScore ? secondScore : "–"}</span>
            </span>
            {endNote && <span className="whitespace-nowrap text-[12px] font-semibold leading-none text-muted">{endNote}</span>}
          </span>
          <FitText text={secondName} maxLines={2} minPx={12} className={`text-[15px] leading-tight ${nameTone(secondWins)}`} />
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
  const [tab, setTab] = useState<"spiel" | "aufstellung" | "statistik">("spiel");
  const hasInfo = sport === "Fußball";
  const info = useMatchInfo(hasInfo && tab !== "spiel" ? game.id : null, isLiveRunning(game.status));
  const preview = useMatchPreview(hasInfo && tab === "statistik" ? game.id : null);
  const swapped = !!link?.result.swapped;
  const firstApiName = (leftSide === "home") !== swapped ? game.home : game.away;
  // Startzeit, Sender und Stadion mit Kapazität über der Anzeigetafel (Rene,
  // 29.10.2026: "ober dem ganz schwarzen ... die startzeit den sender und
  // stadion"). Lange Namen brechen um, nichts wird abgeschnitten.
  const kickoffDay = sportDay(game.kickoff);
  const startText = `${kickoffDay === sportDay(Date.now()) ? "" : `${dayLabel(kickoffDay)} · `}${viennaTime(game.kickoff)} Uhr`;
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
          {venue.capacity !== null && <span className="whitespace-nowrap"> · {venue.capacity.toLocaleString("de-DE")} Plätze</span>}
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
