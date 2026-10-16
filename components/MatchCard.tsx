"use client";

import { useEffect, useMemo, useRef, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Match, Sport, Team, SPORT_ICONS, sportLabel } from "@/lib/types";
import { TipResultTier, classifyRankingTip, compareWithOthers, BEGINNER_SHIELD_TIPS, BOOSTER_STAKE, RANKING_BONUS_CAP, RANKING_POINTS, boosterPayouts, gutscheinPayouts, rankingPointsTable } from "@/lib/poolScore";
import { MatchTipper, useMatchTips } from "@/lib/matchTips";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { ExpertResult, JOKER_ICON, TIP_JOKER_EFFECT, TIP_JOKER_LABEL, TipJoker, TrendResult, useJokers } from "@/lib/JokerContext";
import { useTaschen } from "@/lib/TaschenContext";
import type { SeasonEmote } from "@/lib/seasons";
import { allowsDraw as sportAllowsDraw, displayOrder, oneXTwoText, scoreText, type TeamOrder } from "@/lib/teamOrder";
import TeamBadge, { jerseyFor, matchJerseyProps } from "./TeamBadge";
import PlayerAvatar from "./PlayerAvatar";
import CountdownTiles from "./CountdownTiles";
import PassHonorTags, { useOtherPlayersHonors } from "./PassHonors";
import { EmotePicker, MessageBody, StickerDraft, stickerFromText, stickerText } from "./Emotes";
import Countdown from "./Countdown";
import ScoreInput from "./ScoreInput";
import { CoinIcon } from "./CoinIcon";
import { competitionDisplayName, competitionFlag } from "@/lib/competitionFlag";
import { TvIcon, HighlightTvIcon, PeopleIcon, ChatIcon, ThumbUpIcon, TrashIcon } from "./Icons";
import { SeasonCardWatermark } from "./SeasonDeco";
import ShareTipButton from "./ShareTipCard";
import type { ShareCardData } from "@/lib/shareCard";
import Emoji from "@/components/Emoji";
import { useFinishedEvents, useLiveScore } from "@/lib/useLiveScores";
import { isGoalEvent, shortPlayerName, eventMinuteText } from "@/lib/liveScores";
import { useLiveForecast } from "@/lib/liveForecast";
import { useBeginnerShieldLeft } from "./BeginnerShieldHint";
import { EventTimeline, LivePill, LiveTipLine, Scoreboard, forecastPlain, signedPoints, timelineCount, useBoardClock, useNewGoal, type NewGoal } from "./LiveMatch";
import { showGoalToast } from "./GoalToast";
import { FriendsLiveRow, FriendsLiveSheet } from "./FriendsLive";
import { moveText, useFriendsLive } from "@/lib/friendsLive";

const sportIcon: Record<string, string> = SPORT_ICONS;

// Ergebnis-Tipp: Höchstwert und Beschriftung je Sportart (vorher überall
// "Tor-Ergebnis" bis 20 – bei Basketball wurde aus 112 einfach 20).
const scoreLimit: Record<string, { max: number; unit: string }> = {
  "Fußball": { max: 20, unit: "Tore" },
  NHL: { max: 20, unit: "Tore" },
  NFL: { max: 99, unit: "Punkte" },
  NBA: { max: 199, unit: "Punkte" },
  Handball: { max: 60, unit: "Tore" },
};

interface MyTip {
  predictedHomeScore: number;
  predictedAwayScore: number;
  // PoolScore-Auswertung – siehe lib/poolScore.ts. Erst gesetzt, sobald das
  // Spiel beendet und der Tipp ausgewertet wurde.
  evaluated?: boolean;
  resultTier?: TipResultTier;
  // Wirklich gebuchte Rangpunkte; rangCalculated = gerechnet (kann kleiner
  // sein, weil Rangpunkte nie unter 0 fallen).
  rangDelta?: number;
  rangCalculated?: number;
  starsDelta?: number;
  narration?: string;
  // Rankingsystem: feste Punkte (basePoints) + Bonus gegen die Mittipper.
  // Die duel*-Felder stammen von Tipps aus dem früheren Punkte-Modell.
  basePoints?: number;
  bonusPoints?: number;
  opponents?: number;
  beaten?: number;
  joker?: "doppel" | "schutz" | "toleranz";
  // Anfänger-Schutz: Minus auf 0 gesetzt (erste 10 Tipps insgesamt, Rene, 15.10.2026).
  beginnerShielded?: boolean;
  rankingScored?: boolean;
  // Vor dem Neustart der Rangpunkte gewertet: Punkte zählen nicht mehr.
  rankingLegacy?: boolean;
  duelPoints?: number;
  duelsWon?: number;
  duelsDrawn?: number;
  duelsLost?: number;
  scoredWithoutDuels?: boolean;
  stake?: number;
  // Spiel abgesagt, Einsatz kam zurück (keine Wertung).
  refunded?: boolean;
  // Booster-Tipp mit Gutschein aus einer Trainingstasche: nichts bezahlt,
  // daneben kostet er nichts.
  gutschein?: boolean;
}

interface MatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  // Herzensverein des Spielers in dieser Sportart (nur wenn "Für Vereine
  // spielen" an ist): Spielt dieses Team mit, steht am äußeren Kartenrand auf
  // der Seite des Teams der Schriftzug "Dein Verein". Reine Anzeige, an
  // Punkten und Wertung ändert sich nichts.
  fanTeamId?: string | null;
  tipCount: number;
  myTip?: MyTip;
  // Darf ein Promise zurückgeben (Speichern in der Datenbank): Danach wird
  // der Knopf wieder frei, falls der Tipp nicht angenommen wurde.
  // booster: Booster-Spiel mit eingeschaltetem Booster (20 Coins Einsatz)
  onSubmitTip: (homeScore: number, awayScore: number, booster?: boolean) => void | Promise<unknown>;
  // "Ändern": nimmt den Tipp bis Tippschluss zurück (auf allen Geräten),
  // danach ist die Karte wieder leer. true = zurückgenommen. Ohne diese
  // Funktion (z. B. auf Seiten ohne Speicher-Logik) gibt es keinen Knopf.
  onWithdrawTip?: () => Promise<boolean>;
  // Vom Start-Erlebnis vorgeschlagenes Spiel: kurz golden umrandet.
  highlight?: boolean;
  // Top-Spiel ganz oben auf der Tipps-Seite: große Bühne mit Teamfarben-
  // Licht, Countdown-Kacheln und wer schon getippt hat.
  stage?: boolean;
}

// 1X2-Spiele werden nur per Sieger (1 / X / 2 nach Position, siehe
// lib/teamOrder.ts) getippt, nicht per genauem Ergebnis. Codierung als Score-Paar, damit der bestehende
// Tipp-Datenfluss (predictedHomeScore/predictedAwayScore) unverändert bleibt:
// "1" -> 1:0, "X" -> 0:0, "2" -> 0:1.
type OneXTwo = "1" | "X" | "2";

function oneXTwoToScore(pick: OneXTwo): [number, number] {
  if (pick === "1") return [1, 0];
  if (pick === "2") return [0, 1];
  return [0, 0];
}

function scoreToOneXTwo(home: number, away: number): OneXTwo {
  if (home > away) return "1";
  if (away > home) return "2";
  return "X";
}

export default function MatchCard({
  match,
  homeTeam,
  awayTeam,
  fanTeamId = null,
  tipCount,
  myTip,
  onSubmitTip,
  onWithdrawTip,
  highlight = false,
  stage = false,
}: MatchCardProps) {
  const isOneXTwo = match.tipMode === "1x2";
  // US-Liga: Gast links, Heim rechts ("Gast @ Heim"). Nur wenn die Sportart
  // US-Sport ist UND der Wettbewerb eine US-Liga (z. B. nicht die
  // österreichische Eishockey-Liga) – siehe lib/teamOrder.ts (Rene,
  // 15.10.2026). NBA und NHL kennen kein Unentschieden (Verlängerung bzw.
  // Penaltyschießen bis zur Entscheidung), NFL nur ganz selten.
  const { orderFor } = useAppData();
  const order = orderFor(match);
  const isUsSport = order.awayFirst;
  const [leftTeam, rightTeam] = displayOrder(order, homeTeam, awayTeam);
  const allowsDraw = sportAllowsDraw(match.sport);
  const isCancelled = match.status === "cancelled";
  // Flagge der Liga (nicht der Heimmannschaft), siehe lib/competitionFlag.ts.
  // Gewähltes Land des Wettbewerbs zählt zuerst (Rene, 15.10.2026).
  const { competitions } = useAppData();
  const leagueFlag = competitionFlag(match.sport, match.competition, competitions);
  const competitionName = competitionDisplayName(match.sport, match.competition, competitions);
  // Leer (null) statt 0: der Knopf wird erst aktiv, wenn beide Zahlen
  // bewusst eingetragen sind – sonst gab ein versehentliches Antippen 0:0 ab.
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [nflPick, setNflPick] = useState<OneXTwo | null>(null);
  // Schutz gegen Doppel-Tipp durch einen versehentlichen Doppel-Klick/-Tap
  // (am Handy sehr real): submittedRef greift SOFORT (synchron), bevor
  // React überhaupt neu rendert – submitting steuert nur die Optik (Button
  // gesperrt/Text geändert), bis die Karte ohnehin auf die Ergebnis-Ansicht
  // umschaltet.
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  // "Ändern" läuft gerade (Tipp wird in der Datenbank zurückgenommen).
  const [withdrawing, setWithdrawing] = useState(false);
  // Nach "Tipp abgeben"/"Ändern" bleibt die Karte im Blick, siehe keepCardInView.
  const cardRef = useRef<HTMLDivElement>(null);
  const keepInViewRef = useRef(false);
  const hasTippedRef = useRef(false);
  // Startet mit "false" statt sofort mit Date.now() zu vergleichen – Server
  // und Browser haben beim allerersten Rendern nie exakt dieselbe Uhrzeit,
  // das würde sonst zu einem Hydration-Fehler führen (siehe
  // components/Countdown.tsx). Der useEffect weiter unten korrigiert den
  // echten Wert ohnehin binnen Sekundenbruchteilen nach dem Laden.
  const [tippingClosed, setTippingClosed] = useState(false);
  // Vorwarnung in der letzten Minute vor Tippschluss, damit das Formular
  // nicht kommentarlos mitten beim Ausfüllen verschwindet.
  const [closingSoon, setClosingSoon] = useState(false);
  // Anpfiff vorbei, aber noch kein Ergebnis eingetragen.
  const [kickedOff, setKickedOff] = useState(false);
  const { getCommentsForMatch, addComment, removeComment, toggleCommentLike, myBonusAnswers, submitBonusAnswer } =
    useAppData();
  const { tipTendencies } = useAppData();
  const tendency = tipTendencies[match.id];
  const [bonusPick, setBonusPick] = useState<number | null>(null);
  const myBonusAnswer = myBonusAnswers.find((a) => a.matchId === match.id);
  const { displayName, passHonors, shownPassHonors, authUserId, freeStars, sessionChecked, friendEntries } = useUser();
  // Ohne Login wird nichts gespeichert: statt Tipp-Knopf und Kommentarfeld
  // gibt es den Weg zum Einloggen (erst wenn die Sitzung geprüft ist, sonst
  // blitzt der Knopf beim Laden auch bei eingeloggten Spielern kurz auf).
  const isGuest = sessionChecked && !authUserId;
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Liste "Wer hat getippt?" unter der Karte (Klick auf "X getippt").
  const [tippersOpen, setTippersOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  // Ausgewählter Sticker: erst Vorschau, gesendet wird er mit dem Senden-Knopf.
  const [commentSticker, setCommentSticker] = useState<SeasonEmote | null>(null);
  const commentSubmittedRef = useRef(false);
  const matchComments = getCommentsForMatch(match.id);
  // Titel/Abzeichen aus dem Saison-Pass neben den Namen (nur wenn aufgeklappt).
  const commentHonors = useOtherPlayersHonors(
    commentsOpen ? matchComments.map((c) => (c.userId === authUserId ? null : c.userId)) : []
  );

  // Der Jubel beim Auswerten (Sterne + Meldung) kommt zentral aus
  // lib/FeedbackContext.tsx – nur wenn ein Tipp ausgewertet wird, während
  // die App offen ist, nicht mehr bei jedem Öffnen für alte Tipps.

  function handleCommentSubmit(e: FormEvent) {
    e.preventDefault();
    if ((!commentDraft.trim() && !commentSticker) || commentSubmittedRef.current) return;
    // Sticker-Code von Hand eingetippt, ohne den Sticker zu besitzen: nicht senden.
    const typedSticker = stickerFromText(commentDraft);
    if (typedSticker && !passHonors.emotes.some((em) => em.id === typedSticker.id)) return;
    commentSubmittedRef.current = true;
    // Sticker bleibt ein eigener Kommentar (":id:"), der Text kommt danach.
    if (commentSticker) addComment(match.id, displayName, stickerText(commentSticker));
    if (commentDraft.trim()) addComment(match.id, displayName, commentDraft);
    setCommentDraft("");
    setCommentSticker(null);
    commentSubmittedRef.current = false;
  }

  useEffect(() => {
    const deadline = new Date(match.tipDeadline).getTime();
    const kickoff = new Date(match.kickoff).getTime();
    function check() {
      const remaining = deadline - Date.now();
      setTippingClosed(remaining <= 0);
      setClosingSoon(remaining > 0 && remaining <= 60 * 1000);
      setKickedOff(Date.now() >= kickoff);
    }
    // Sofortiger erster Check direkt nach dem Laden, statt die ganze
    // Sekunde bis zum ersten Intervall-Tick zu warten.
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, [match.tipDeadline, match.kickoff]);

  const kickoffLabel = new Date(match.kickoff).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const hasTipped = !!myTip;
  hasTippedRef.current = hasTipped;
  // Kurze Bestätigungs-Animation, sobald ein gerade abgegebener Tipp
  // gespeichert ist (nicht beim normalen Laden der Seite).
  const [justSaved, setJustSaved] = useState(false);
  const awaitingSaveRef = useRef(false);
  useEffect(() => {
    if (!hasTipped || !awaitingSaveRef.current) return;
    awaitingSaveRef.current = false;
    setJustSaved(true);
    const t = window.setTimeout(() => setJustSaved(false), 1600);
    return () => window.clearTimeout(t);
  }, [hasTipped]);

  // Am Handy springt die Seite nach "Tipp abgeben" sonst weg: die Karte wird
  // kleiner/größer, und schließt sich gleichzeitig die Tastatur, verschiebt
  // iOS die Seite. Darum nach dem Umschalten (auch nach "Ändern") prüfen, ob
  // die GANZE Karte (Wettbewerb, Flaggen, Teams und "Dein Tipp") unter der
  // angehefteten Kopfzeile zu sehen ist, und sie sonst dorthin holen –
  // mehrmals, bis die Tastatur sicher zu ist und die Höhe feststeht.
  useEffect(() => {
    if (!keepInViewRef.current) return;
    keepInViewRef.current = false;
    let frame = 0;
    const run = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(keepCardInView);
    };
    const timers = [0, 350, 700, 1100].map((delay) => window.setTimeout(run, delay));
    // Tastatur geht zu (iOS): sichtbarer Bereich wird größer.
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", run);
    const stop = window.setTimeout(() => viewport?.removeEventListener("resize", run), 1500);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(stop);
      cancelAnimationFrame(frame);
      viewport?.removeEventListener("resize", run);
    };
  }, [hasTipped]);

  function keepCardInView() {
    const card = cardRef.current;
    if (!card) return;
    // Unterkante der angehefteten Kopfzeile (Logo + Reiter, components/AppChrome.tsx).
    const header = document.querySelector("[data-pull-anchor]");
    const top = Math.max(0, header?.getBoundingClientRect().bottom ?? 0) + 8;
    const bottom = (window.visualViewport?.height ?? window.innerHeight) - 8;
    const rect = card.getBoundingClientRect();
    if (rect.top >= top - 1 && rect.bottom <= bottom + 1) return;
    // Passt die Karte ganz hinein: mittig darunter. Sonst Kartenanfang
    // (Wettbewerb, Flaggen, Teams) knapp unter die Kopfzeile.
    const space = bottom - top;
    const targetTop = rect.height <= space ? top + (space - rect.height) / 2 : top;
    window.scrollBy({ top: rect.top - targetTop, behavior: "smooth" });
  }

  // Tastatur zu, bevor das Eingabefeld verschwindet (iOS springt sonst).
  function closeKeyboard() {
    const active = document.activeElement;
    if (active instanceof HTMLElement && cardRef.current?.contains(active)) active.blur();
  }
  const canChangeTip = hasTipped && !tippingClosed && !isCancelled && !myTip?.evaluated && !!onWithdrawTip;
  const showResultView = hasTipped || tippingClosed || isCancelled;
  // 1X2-Spiel ohne Auswahl: Knopf ist noch gesperrt.
  const missingPick = isOneXTwo && !nflPick;
  // Ergebnis-Tipp mit leerem Feld: Knopf ebenfalls gesperrt.
  const missingScore = !isOneXTwo && (homeScore === null || awayScore === null);
  // Booster-Spiel: Tipp nur mit vollem Einsatz (20 Sterne). Normale Spiele
  // sind gratis und bringen nur Rangpunkte.
  const isBooster = !!match.booster;
  // Booster freiwillig (Rene, 11.10.2026): bei Booster-Spielen schaltet jeder
  // selbst ein. Nur Vorschau, abgebucht wird erst beim Tipp-Abgeben.
  const [boosterOn, setBoosterOn] = useState(false);
  const boosting = isBooster && boosterOn;
  // Booster-Gutschein aus einer Trainingstasche: Die Datenbank löst ihn beim
  // nächsten Booster-Tipp von selbst ein, der Tipp kostet dann nichts.
  const { gutscheine } = useTaschen();
  const withGutschein = isBooster && !isGuest && gutscheine > 0;
  const notEnoughStars = boosting && !withGutschein && freeStars < BOOSTER_STAKE;
  const notReady = missingPick || missingScore || notEnoughStars;
  const limit = scoreLimit[match.sport] ?? scoreLimit["Fußball"];
  // Echte Tipps aller Spieler: für die Liste und für den Vergleich nach der
  // Auswertung. Fremde Tipps (die Zahlen) erst nach Tippschluss zeigen.
  const { tippers, failed: tippersFailed } = useMatchTips(
    match.id,
    tippersOpen || !!myTip?.evaluated || stage,
    // Auch der eigene Tipp zählt: nimmt man ihn zurück und tippt auf einem
    // anderen Gerät gleich neu, bleibt die Zahl gleich, die Liste nicht.
    `${tipCount}:${myTip ? `${myTip.predictedHomeScore}-${myTip.predictedAwayScore}` : "-"}`
  );
  const finalScore =
    match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null
      ? { home: match.liveHomeScore, away: match.liveAwayScore }
      : null;
  // Live-Stand von API-Sports (lib/useLiveScores.ts), nur solange in der App
  // noch kein Endstand steht und nicht mehr getippt wird. Reine Anzeige, die
  // Wertung bleibt beim offiziellen Endstand (Rene, 15.10.2026).
  const liveScore = useLiveScore(match, homeTeam.name, awayTeam.name);
  const live = !finalScore && !isCancelled && showResultView ? liveScore : null;
  // Anzeigetafel (Rene, 15.10.2026: Spieltag-Umbau): sobald Live-Daten da
  // sind (Live, Pause, nach Abpfiff "Beendet") und ebenso mit offiziellem
  // Endstand ersetzt eine große Tafel die Vereins-Tippzeilen. Kartenrahmen
  // bleibt normal, Live zeigt nur das Pill (ohne roten Rahmen).
  const showBoard = !isCancelled && (!!live || !!finalScore);
  const boardClock = useBoardClock(match.sport, live);
  // Tore/Karten: live mit dem Stand, nach der Wertung aus dem letzten
  // Live-Stand des Servers (falls er ihn noch kennt).
  const finishedEvents = useFinishedEvents(match, homeTeam.name, awayTeam.name, !!finalScore && !isCancelled);
  const events = live ? live.events : finalScore ? finishedEvents : null;
  const leftSide: "home" | "away" = isUsSport ? "away" : "home";
  const rightSide: "home" | "away" = isUsSport ? "home" : "away";
  const shieldLeft = useBeginnerShieldLeft();
  // Vorläufige Wertung des eigenen Tipps mit dem Live-Stand bzw. dem
  // Endstand, solange die Wertung noch fehlt (nur feste Punkte, ohne Bonus
  // und Joker; mit Anfänger-Schutz zählt ein Minus als 0).
  const boardScore = live ? { home: live.homeScore, away: live.awayScore } : finalScore;
  const pendingTip = !!myTip && !myTip.evaluated && !myTip.refunded && !isCancelled && !!boardScore ? myTip : null;
  const pendingTier = pendingTip && boardScore
    ? classifyRankingTip(pendingTip.predictedHomeScore, pendingTip.predictedAwayScore, boardScore.home, boardScore.away, isOneXTwo)
    : null;
  const pendingPoints = pendingTier ? (shieldLeft > 0 ? Math.max(0, RANKING_POINTS[pendingTier]) : RANKING_POINTS[pendingTier]) : 0;
  // "Wenn es so bleibt": vorläufiger Platz in der Rangliste (lib/liveForecast.ts).
  const forecast = useLiveForecast(match.sport, !!live && !!pendingTip);
  // Freunde-Live (Rene, 16.10.2026: Freunde-Live): eine Zeile unter "Dein
  // Tipp" mit deinem Platz unter Freunden am Spieltag, solange das Spiel
  // läuft, Pause hat oder abgepfiffen, aber noch nicht gewertet ist – nur
  // mit mindestens einem Freund. Antippen öffnet die Tabelle als Sheet.
  const friendsLive = useFriendsLive(!!live);
  const showFriendsRow = !!live && !!friendsLive?.hasFriends && friendsLive.games.some((g) => g.match.id === match.id);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  // Ohne bekannte Ereignisse nach Abpfiff kein leerer "Spielverlauf".
  const showEventsButton = showBoard && !!events && (!!live || events.some((e) => e.type !== "subst"));
  // Neues Tor (Rene, 15.10.2026): Knopf "Spielverlauf" pulsiert golden, bis
  // der Spielverlauf aufgeklappt wird, höchstens 60 s. Ist er schon offen,
  // wird das neue Tor dort direkt ~3 s golden hinterlegt.
  const newGoal = useNewGoal(events);
  const [eventsPulse, setEventsPulse] = useState(false);
  const [timelineGlow, setTimelineGlow] = useState<NewGoal | null>(null);
  const eventsOpenRef = useRef(eventsOpen);
  eventsOpenRef.current = eventsOpen;
  useEffect(() => {
    if (!newGoal) return;
    if (eventsOpenRef.current) {
      setTimelineGlow(newGoal);
      return;
    }
    setEventsPulse(true);
    const t = window.setTimeout(() => setEventsPulse(false), 60_000);
    return () => window.clearTimeout(t);
  }, [newGoal]);
  function toggleEvents() {
    if (!eventsOpen) {
      setTimelineGlow(eventsPulse ? newGoal : null);
      setEventsPulse(false);
    }
    setEventsOpen((current) => !current);
  }

  // Tor-Moment (Rene, 15.10.2026: Spieltag-Umbau): Ändert sich der Stand
  // eines getippten Spiels gegenüber dem letzten Abruf, leuchtet der
  // Spielstand ~2,5 s golden und unten kommt ein Hinweis (GoalToast). Nicht
  // beim ersten Laden, jedes Tor nur einmal.
  const [goalFlash, setGoalFlash] = useState(false);
  const lastScoreRef = useRef<{ home: number; away: number } | null>(null);
  const liveKey = live ? `${live.homeScore}:${live.awayScore}` : null;
  useEffect(() => {
    if (!live) return;
    const prev = lastScoreRef.current;
    lastScoreRef.current = { home: live.homeScore, away: live.awayScore };
    if (!prev || !myTip || myTip.refunded) return;
    const homeUp = live.homeScore > prev.home;
    const awayUp = live.awayScore > prev.away;
    if (!homeUp && !awayUp) return;
    setGoalFlash(true);
    const t = window.setTimeout(() => setGoalFlash(false), 2500);
    const side: "home" | "away" = homeUp && !awayUp ? "home" : !homeUp && awayUp ? "away" : live.homeScore - prev.home >= live.awayScore - prev.away ? "home" : "away";
    const team = side === "home" ? homeTeam : awayTeam;
    // Torschütze nur, wenn die Ereignisse schon bis zu diesem Tor reichen.
    const goals = (live.events ?? []).filter((e) => isGoalEvent(e) && e.side === side);
    const scorer = goals.length === (side === "home" ? live.homeScore : live.awayScore)
      ? goals.slice().sort((a, b) => a.minute - b.minute || (a.extra ?? 0) - (b.extra ?? 0))[goals.length - 1]
      : null;
    const tier = classifyRankingTip(myTip.predictedHomeScore, myTip.predictedAwayScore, live.homeScore, live.awayScore, isOneXTwo);
    const detail = [
      scorer ? `${shortPlayerName(scorer.player) || "Tor"} ${eventMinuteText(scorer)}` : null,
      `Dein Tipp liegt ${tier === "falsch" ? "daneben" : "richtig"}`,
      forecast ? `wenn es so bleibt ${forecastPlain(forecast)}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
    // Freunde-Platz geändert (Rene, 16.10.2026: Freunde-Live): Zusatzzeile.
    const friendsMe = friendsLive?.ready ? friendsLive.tables.find((t) => t.key === "friends") : undefined;
    const friendsLine =
      friendsMe && friendsMe.me.move !== 0
        ? `Du bist jetzt ${friendsMe.me.rank}. von ${friendsMe.players.length} ${moveText(friendsMe.me.move)} unter deinen Freunden`
        : undefined;
    showGoalToast(`${match.id}:${live.homeScore}:${live.awayScore}`, {
      title: `⚽ TOR für ${team.name} · ${scoreText(order, live.homeScore, live.awayScore)}`,
      detail,
      ...(friendsLine ? { extra: friendsLine, extraGood: friendsMe!.me.move > 0 } : {}),
    });
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveKey]);
  const comparison =
    myTip?.evaluated && myTip.resultTier && finalScore && tippers
      ? compareWithOthers(
          myTip.resultTier,
          tippers
            .filter((t) => t.userId !== authUserId)
            .flatMap((t) =>
              t.predictedHome === null || t.predictedAway === null
                ? []
                : [{ predictedHome: t.predictedHome, predictedAway: t.predictedAway }]
            ),
          finalScore.home,
          finalScore.away,
          isOneXTwo
        )
      : null;

  // Tipp-Karte zum Teilen (components/ShareTipCard.tsx): nur nach einem
  // Treffer, nicht bei alten Tipps vor dem Neustart der Rangpunkte.
  const shareTier = myTip?.evaluated && !myTip.refunded && !myTip.rankingLegacy ? myTip.resultTier : undefined;
  const shareData = useMemo<ShareCardData | null>(() => {
    if (!myTip || !finalScore || !shareTier || shareTier === "falsch") return null;
    const date = new Date(match.kickoff)
      .toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Vienna" })
      .replace(".,", "");
    const tipText = isOneXTwo
      ? `Mein Tipp: ${oneXTwoText(order, myTip.predictedHomeScore, myTip.predictedAwayScore, homeTeam.name, awayTeam.name)}`
      : shareTier === "exakt"
      ? null
      : `Mein Tipp: ${scoreText(order, myTip.predictedHomeScore, myTip.predictedAwayScore, " : ")}`;
    return {
      exact: shareTier === "exakt",
      playerName: displayName || "Ich",
      leftName: leftTeam.name,
      rightName: rightTeam.name,
      scoreText: scoreText(order, finalScore.home, finalScore.away),
      tipText,
      // Ohne Flagge: Windows zeigt Flaggen-Emojis nur als Buchstaben ("AT").
      metaText: `${competitionName} · ${date}`,
      rangDelta: myTip.rangDelta ?? 0,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    shareTier,
    myTip?.predictedHomeScore,
    myTip?.predictedAwayScore,
    myTip?.rangDelta,
    finalScore?.home,
    finalScore?.away,
    displayName,
    match.kickoff,
    match.sport,
    leftTeam.name,
    rightTeam.name,
    competitionName,
    isOneXTwo,
  ]);

  // 1X2 mit Teamnamen statt "Heimsieg (1)": eindeutig, egal auf welcher
  // Seite das Heimteam steht. Gespeichert wird weiter 1:0 / 0:0 / 0:1.
  // Gleiche Reihenfolge wie die Teams darüber (bei US-Sport Gast-Sieg links).
  const [leftPick, rightPick] = displayOrder<OneXTwo>(order, "1", "2");
  const oneXTwoOptions: OneXTwo[] =
    allowsDraw || nflPick === "X" ? [leftPick, "X", rightPick] : [leftPick, rightPick];

  // Intern "1" = Heimsieg, "2" = Auswärtssieg. Auf dem Knopf steht die
  // Nummer nach Position (links 1, rechts 2) mit dem Teamnamen darunter.
  function pickLabel(pick: OneXTwo) {
    const [h, a] = oneXTwoToScore(pick);
    return oneXTwoText(order, h, a, homeTeam.name, awayTeam.name);
  }

  // Auf der Bühne stehen die Countdown-Kacheln über den Vereins-Zeilen
  // (nicht mehr in der letzten Minute, dann kommt der "Gleich geschlossen"-Hinweis).
  const showTiles = stage && !showResultView && !closingSoon;
  // Leichter Schimmer in den Trikotfarben links und rechts, auf der Bühne als
  // kräftiges Licht von oben.
  const homeGlow = wornColor(match, homeTeam);
  const awayGlow = wornColor(match, awayTeam);
  const [leftGlow, rightGlow] = displayOrder(order, homeGlow, awayGlow);
  const cardBackground = stage
    ? `radial-gradient(110% 70% at 0% 0%, ${hexAlpha(leftGlow, 0.33)} 0%, transparent 60%), radial-gradient(110% 70% at 100% 0%, ${hexAlpha(rightGlow, 0.33)} 0%, transparent 60%), radial-gradient(80% 50% at 50% 115%, rgb(var(--c-action) / 0.22) 0%, transparent 70%)`
    : `linear-gradient(105deg, ${hexAlpha(leftGlow, 0.13)} 0%, transparent 38%), linear-gradient(255deg, ${hexAlpha(rightGlow, 0.13)} 0%, transparent 38%)`;

  // Ergebnis in Anzeige-Reihenfolge (bei US-Sport Gast : Heim).
  function formatScore(home: number, away: number) {
    const [left, right] = displayOrder(order, home, away);
    return `${left} : ${right}`;
  }

  function formatTip(home: number, away: number) {
    return isOneXTwo ? pickLabel(scoreToOneXTwo(home, away)) : formatScore(home, away);
  }

  // Tipp kurz: Sieger-Tipp als Vereinsname bzw. "Unentschieden", sonst "2:1"
  // in Anzeige-Reihenfolge (Rene, 15.10.2026: Spieltag-Umbau).
  function tipName(home: number, away: number) {
    if (!isOneXTwo) return scoreText(order, home, away);
    const pick = scoreToOneXTwo(home, away);
    return pick === "1" ? homeTeam.name : pick === "2" ? awayTeam.name : "Unentschieden";
  }

  // Eine Seite der Anzeigetafel: Trikot, Name (Torschützen nur noch im
  // Spielverlauf, Rene, 15.10.2026).
  function boardSide(team: Team) {
    return {
      name: team.name,
      badge: (
        <TeamBadge
          sport={match.sport}
          {...matchJerseyProps(match, team)}
          isNationalTeam={team.isNationalTeam}
          countryCode={team.countryCode}
          size={stage ? 40 : 34}
        />
      ),
    };
  }

  // "Ändern": Tipp zurücknehmen, danach ist die Karte wie vor dem ersten
  // Tippen (leere Felder, keine Auswahl) – auf jedem Gerät. Booster-Einsatz
  // und Joker kommen zurück, der neue Tipp wird ganz normal abgegeben.
  async function withdrawMyTip() {
    if (!myTip || !onWithdrawTip || withdrawing) return;
    setWithdrawing(true);
    keepInViewRef.current = true;
    try {
      const ok = await onWithdrawTip();
      if (!ok) keepInViewRef.current = false;
      if (ok) {
        setHomeScore(null);
        setAwayScore(null);
        setNflPick(null);
        submittedRef.current = false;
        setSubmitting(false);
      }
    } finally {
      setWithdrawing(false);
    }
  }

  function handleSubmit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);

    // Bonusfrage ist optional und blockiert die eigentliche Tipp-Abgabe
    // nicht – nur wenn eine Auswahl getroffen wurde UND noch keine Antwort
    // existiert, wird sie zusammen mit dem Tipp mit abgeschickt.
    if (match.bonusQuestion && bonusPick !== null && !myBonusAnswer) {
      submitBonusAnswer(match.id, bonusPick);
    }

    if (notReady) {
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }
    const [h, a] = isOneXTwo && nflPick ? oneXTwoToScore(nflPick) : [homeScore ?? 0, awayScore ?? 0];
    closeKeyboard();
    keepInViewRef.current = true;
    awaitingSaveRef.current = true;

    Promise.resolve(onSubmitTip(h, a, boosting)).finally(() => {
      submittedRef.current = false;
      setSubmitting(false);
      // Nicht gespeichert: Karte bleibt offen, nichts zu verschieben.
      if (!hasTippedRef.current) keepInViewRef.current = false;
    });
  }

  // Knopf-Zustände klar unterscheidbar: tippbereit = kräftiges Grün mit
  // Leuchten, noch nicht tippbereit = grau (vorher nur halb durchsichtig,
  // sah aus wie "kaputt"). Ohne Login der Weg zum Einloggen.
  function submitButton(label: string) {
    if (isGuest) {
      return (
        <Link
          href="/registrieren"
          className="block w-full flex-1 rounded-full bg-action-hover py-2.5 text-center font-display text-base font-semibold tracking-wide text-pitch shadow-[0_0_22px_rgb(var(--c-action-hover)/0.45)] transition-all hover:brightness-110"
        >
          Zum Tippen einloggen
        </Link>
      );
    }
    return (
      <button
        onClick={handleSubmit}
        disabled={submitting || notReady}
        className={`w-full min-w-0 flex-1 rounded-full py-2.5 font-display font-semibold tracking-wide text-base transition-all ${
          notReady
            ? "cursor-not-allowed border border-edge bg-edge text-muted"
            : "bg-action-hover text-pitch shadow-[0_0_22px_rgb(var(--c-action-hover)/0.45)] enabled:active:scale-[0.97] enabled:hover:brightness-110 enabled:hover:shadow-[0_0_30px_rgb(var(--c-action-hover)/0.6)] disabled:cursor-wait"
        }`}
      >
        {submitting ? "Wird gespeichert…" : label}
      </button>
    );
  }

  // Kompakte Karte, Variante B (Rene, 15.10.2026, Variante B): Die Vereine
  // stehen untereinander, jeder als eigene Zeile in voller Breite. Beim
  // Sieger-Tipp IST die Vereins-Zeile der Knopf (gespeichert wird weiter
  // 1/X/2 bzw. Heim/Gast wie bisher), beim Ergebnis-Tipp steht rechts das
  // Zahlenfeld für die Tore dieses Vereins.
  const compactPicking = !showResultView && isOneXTwo;
  // Gold markiert: vor dem Abgeben die Auswahl, danach der abgegebene Tipp.
  const compactSelected: OneXTwo | null = compactPicking
    ? nflPick
    : isOneXTwo && myTip
      ? scoreToOneXTwo(myTip.predictedHomeScore, myTip.predictedAwayScore)
      : null;
  // "Unentschieden" nur, wo es erlaubt ist (oder alter X-Tipp bei NHL/NBA).
  const compactShowsDraw = isOneXTwo && (compactPicking ? oneXTwoOptions.includes("X") : allowsDraw || compactSelected === "X");

  // Topspiel (stage) nutzt dieselben Zeilen, nur größer und im Gold-Look
  // (Rene, 15.10.2026).
  function compactRowClass(selected: boolean, clickable: boolean) {
    if (stage) {
      return `flex w-full min-w-0 items-center rounded-xl border text-left transition-colors ${
        selected
          ? "border-gold bg-gold/20 text-gold shadow-[0_0_18px_rgb(var(--c-gold)/0.25)]"
          : `border-gold/25 bg-pitch/70 text-ink ${clickable ? "hover:border-gold/60" : ""}`
      }`;
    }
    return `flex w-full min-w-0 items-center rounded-lg border text-left transition-colors ${
      selected
        ? "border-gold bg-gold/15 text-gold"
        : `border-edge bg-pitch text-ink ${clickable ? "hover:border-muted" : ""}`
    }`;
  }

  // Harmonischer und daumenfreundlich (Rene, 15.10.2026): Vereins-Zeile am
  // Handy mind. 50 px hoch (Topspiel 56 px), mehr Innenabstand, damit der
  // Name nicht am Rand klebt, 10–12 px zwischen Trikot und Name.
  // Mit dem größeren Ergebnisfeld (44–46 px) wachsen die Zeilen mit
  // (Rene, 15.10.2026).
  const rowHeight = stage ? "min-h-[58px] sm:min-h-[60px]" : "min-h-[56px] sm:min-h-[58px]";
  const rowGap = stage ? "gap-3" : "gap-2.5";
  const rowPadding = stage ? "px-4" : "px-3 sm:px-4";
  // Mit Zahlenfeld rechts etwas weniger Abstand zum Rand.
  const rowPaddingScore = stage ? "pl-4 pr-2" : "pl-3 pr-1.5 sm:pl-4";

  // Eine Vereins-Zeile: Trikot, Name einzeilig, rechts dezent "Heim"/"Gast",
  // dahinter Zahlenfeld (Ergebnis-Tipp) bzw. Tore (Endstand).
  function compactTeamRow(team: Team, side: "home" | "away") {
    const pick: OneXTwo = side === "home" ? "1" : "2";
    const selected = compactSelected === pick;
    const isFan = !!fanTeamId && team.id === fanTeamId;
    // Ergebnis-Tipp nach dem Abgeben: die getippten Tore stehen rechts in
    // Gold (Endstand und Live-Stand zeigt die Anzeigetafel).
    const tipGoals =
      showResultView && !isOneXTwo && myTip && !myTip.refunded
        ? side === "home" ? myTip.predictedHomeScore : myTip.predictedAwayScore
        : null;
    const scoreInput = !showResultView && !isOneXTwo ? (side === "home" ? homeScoreInputCompact : awayScoreInputCompact) : null;
    const content = (
      <>
        <span className={`shrink-0 ${stage ? "drop-shadow-[0_4px_8px_rgb(0_0_0/0.5)]" : ""}`}>
          <TeamBadge
            sport={match.sport}
            {...matchJerseyProps(match, team)}
            isNationalTeam={team.isNationalTeam}
            countryCode={team.countryCode}
            size={stage ? 36 : 28}
          />
        </span>
        <TeamLabel name={team.name} inline="left" single big={stage} selected={selected} />
        {/* Getippt: "Dein Tipp" statt Heim/Gast am gewählten Verein
            (Rene, 15.10.2026: Spieltag-Umbau). */}
        <span
          className={`shrink-0 pl-2 text-[11px] font-medium uppercase tracking-wide ${
            selected ? "text-gold/80" : "text-muted/60"
          }`}
        >
          {selected && !compactPicking ? "Dein Tipp" : side === "home" ? "Heim" : "Gast"}
        </span>
        {scoreInput}
        {/* Getippte Tore im selben Kasten-Maß wie das Ergebnisfeld. */}
        {tipGoals !== null && (
          <span className="flex h-11 w-12 shrink-0 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 font-display text-[20px] font-bold leading-none text-gold sm:h-[46px] sm:w-[52px] sm:text-[22px]">
            {tipGoals}
          </span>
        )}
      </>
    );
    return (
      // Dein-Verein-Streifen am äußeren Kartenrand auf Höhe der Zeile des
      // Herzensvereins, liegt im Innenrand der Karte und ragt nie in die
      // Tipp-Felder (Rene, 15.10.2026, Variante B; Topspiel ebenso).
      <div key={side} className="relative">
        {isFan && (
          <span
            className={`pointer-events-none absolute -top-3 -bottom-3 z-[1] flex w-[14px] items-center justify-center border-r border-[#6FA8DC] bg-[#6FA8DC]/30 [-webkit-mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)] [mask-image:linear-gradient(to_bottom,transparent,#000_14%,#000_86%,transparent)] ${
              stage ? "-left-4 sm:-left-5" : "-left-3.5 sm:-left-4"
            }`}
          >
            <span className="rotate-180 whitespace-nowrap text-[8px] font-extrabold uppercase leading-none tracking-[0.06em] text-[#CFE6FF] [writing-mode:vertical-rl]">
              Dein Verein
            </span>
          </span>
        )}
        {compactPicking ? (
          <button
            type="button"
            // Nochmal antippen wählt wieder ab (vor dem Abgeben, löscht keinen Tipp).
            onClick={() => setNflPick((current) => (current === pick ? null : pick))}
            aria-label={pickLabel(pick)}
            aria-pressed={selected}
            className={`${compactRowClass(selected, true)} ${rowHeight} ${rowGap} ${rowPadding} py-1.5`}
          >
            {content}
          </button>
        ) : (
          <div
            className={`${compactRowClass(selected, false)} ${rowHeight} ${rowGap} py-1.5 ${
              scoreInput || tipGoals !== null ? rowPaddingScore : rowPadding
            }`}
          >
            {content}
          </div>
        )}
      </div>
    );
  }

  // Schmalere Zeile "Unentschieden" zwischen den Vereinen, am Handy mind.
  // 40 px hoch (Topspiel 44 px) (Rene, 15.10.2026).
  function compactDrawRow() {
    const selected = compactSelected === "X";
    const className = `${compactRowClass(selected, compactPicking)} ${
      stage ? "min-h-[44px] text-[15px]" : "min-h-[40px] text-sm"
    } justify-center px-3 text-center font-display font-semibold`;
    return compactPicking ? (
      <button
        key="X"
        type="button"
        onClick={() => setNflPick((current) => (current === "X" ? null : "X"))}
        aria-label={pickLabel("X")}
        aria-pressed={selected}
        className={className}
      >
        Unentschieden
      </button>
    ) : (
      <div key="X" className={`${className} gap-2`}>
        Unentschieden
        {selected && <span className="text-[11px] font-medium uppercase tracking-wide text-gold/80">· Dein Tipp</span>}
      </div>
    );
  }

  // Kurzer Hinweis je Tipp-Art direkt über den Vereins-Zeilen, nur solange
  // noch getippt werden kann (Rene, 15.10.2026).
  const tipHint = !isOneXTwo
    ? "Tippe das Endergebnis: Tore pro Team eintragen"
    : compactShowsDraw
      ? "Sieger oder Unentschieden antippen"
      : "Tippe auf den Sieger";

  const homeScoreInputCompact = (
    <ScoreInput
      value={homeScore}
      onChange={setHomeScore}
      onClear={() => setHomeScore(null)}
      max={limit.max}
      label={`${limit.unit} ${homeTeam.name}`}
      className={stage ? scoreInputStageClass : scoreInputCompactClass}
    />
  );
  const awayScoreInputCompact = (
    <ScoreInput
      value={awayScore}
      onChange={setAwayScore}
      onClear={() => setAwayScore(null)}
      max={limit.max}
      label={`${limit.unit} ${awayTeam.name}`}
      className={stage ? scoreInputStageClass : scoreInputCompactClass}
    />
  );

  return (
    <div
      ref={cardRef}
      id={`spiel-${match.id}`}
      className={`relative isolate flex h-full flex-col overflow-hidden match-card-rand rounded-card border bg-surface ${
        highlight ? "outline outline-2 outline-offset-2 outline-gold" : ""
      } ${stage ? "match-card-stage" : ""}`}
      style={{ backgroundImage: cardBackground }}
    >
      {stage && (
        <>
          {/* Flutlicht: zwei schräge Lichtkegel hinter dem Inhalt. */}
          <span aria-hidden className="stage-beam stage-beam-left" />
          <span aria-hidden className="stage-beam stage-beam-right" />
        </>
      )}
      {/* Saison-Design: verblasstes Blatt hinter dem Karteninhalt. */}
      <SeasonCardWatermark variant={match.id.length + match.id.charCodeAt(match.id.length - 1)} />
      {/* Booster-Spiel: eigene goldene Leiste ganz oben, damit man es auch
          zwischen normalen Spielen (z. B. bei den geschlossenen) sofort sieht. */}
      {stage ? (
        <div className="flex items-center justify-between gap-2 border-b border-gold/30 bg-gold/15 px-4 py-1.5 font-display text-xs font-bold uppercase tracking-[0.14em] text-gold sm:grid sm:grid-cols-[1fr_auto_1fr] sm:px-5">
          {/* Links Sportart + Wettbewerb wie in der Kopfzeile normaler Karten,
              "Top-Spiel" zentriert in der Mitte, rechts der Countdown
              (Rene, 14.10.2026). Nur "Top-Spiel" (13.10.2026); dass es ein
              Booster-Spiel ist, zeigt der Booster-Bereich weiter unten.
              Am Handy brach das in drei Zeilen um (Rene, 14.10.2026): dort
              steht der Wettbewerb über dem Datum, hier nur "Top-Spiel" und
              Countdown in einer Zeile. Am PC unverändert. */}
          <span className="hidden min-w-0 items-center gap-1.5 text-sm font-semibold normal-case tracking-normal text-ink sm:flex">
            <span className="shrink-0 text-lg" aria-hidden><Emoji e={sportIcon[match.sport]} /></span>
            {leagueFlag && <span className="shrink-0" aria-hidden><Emoji e={leagueFlag} /></span>}
            <span className="min-w-0 leading-tight">{competitionName}</span>
          </span>
          <span className="whitespace-nowrap sm:text-center">⭐ Top-Spiel</span>
          {/* Countdown rechts oben, genau wie in der Kopfzeile normaler Karten
              (Rene, 13.10.2026: beim Topspiel fehlte die ablaufende Zeit, nach
              dem Tippen gab es sie gar nicht mehr). */}
          <span className="min-w-0 whitespace-nowrap text-right text-xs font-medium normal-case tracking-normal">
            {isCancelled ? (
              <span className="rounded-full border border-red-400/60 bg-red-400/10 px-2 py-0.5 font-semibold text-red-300">
                Abgesagt
              </span>
            ) : showBoard ? (
              <LivePill state={boardClock.state} pauseText={live?.status === "HT" ? "Halbzeit" : live?.statusText || "Pause"} delayed={!!live?.delayed} />
            ) : (
              <Countdown kickoff={match.tipDeadline} remind={!hasTipped} />
            )}
          </span>
        </div>
      ) : isBooster && (
        <div className="border-b border-gold/30 bg-gold/15 px-4 py-1 text-center font-display text-xs font-bold uppercase tracking-wider text-gold sm:px-5">
          ⚡ Booster-Spiel
        </div>
      )}
      {/* Sport-Banner (Spieltag steht unten bei der Anstoßzeit). Lange
          Wettbewerbsnamen wie "NHL Regular Season" brechen an Leerzeichen in
          eine zweite Zeile um statt abgeschnitten zu werden; der Countdown
          bleibt rechts daneben. */}
      {!stage && (
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-surface-hover/80 to-surface/60 px-4 py-2.5 sm:gap-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <span className="shrink-0 text-lg"><Emoji e={sportIcon[match.sport]} /></span>
          {leagueFlag && <span className="shrink-0"><Emoji e={leagueFlag} /></span>}
          <span className="min-w-0 leading-tight">{competitionName}</span>
        </span>
        <span className="ml-auto shrink-0 whitespace-nowrap text-xs font-medium">
          {isCancelled ? (
            <span className="rounded-full border border-red-400/60 bg-red-400/10 px-2 py-0.5 font-semibold text-red-300">
              Abgesagt
            </span>
          ) : showBoard ? (
            <LivePill state={boardClock.state} pauseText={live?.status === "HT" ? "Halbzeit" : live?.statusText || "Pause"} delayed={!!live?.delayed} />
          ) : (
            <Countdown kickoff={match.tipDeadline} remind={!hasTipped} />
          )}
        </span>
        {/* Kompakte Karte (Rene, 14.10.2026): Punkteverteilung als (i) oben
            rechts statt eigener Zeile über dem Knopf. */}
        {!isCancelled && !myTip?.evaluated && (
          <PointsInfoButton isOneXTwo={isOneXTwo} allowsDraw={allowsDraw} isBooster={isBooster} iconOnly />
        )}
      </div>
      )}

      {/* Topspiel am Handy etwas enger, damit es samt Tipp-Knopf auf einen
          Bildschirm passt (Rene, 10.10.2026); am PC wie bisher. */}
      <div className={`flex flex-1 flex-col ${stage ? "mx-auto w-full max-w-xl p-4 sm:p-5" : "px-3.5 pb-4 pt-3 sm:px-4"}`}>
        {/* Datum + Teams in einem Block, an dem der Reiter "Dein Verein" hängt
            (Rene, 13.10.2026): Er reicht von der Unterkante der Kopfzeile bis
            zur Oberkante von "Dein Tipp" bzw. der Eingabefelder und sitzt am
            äußeren Kartenrand auf der Seite des Herzensvereins, Schrift von
            unten nach oben. Die Abstände (-top/-left/-right) sind genau der
            Innenrand des Inhalts, das Ende folgt dem Außenabstand der
            Team-Zeile (mb-5), daher passt es auch bei langen Namen. 14 px
            breit, die Karte wird nicht schmaler. Gedreht wird nur die Schrift
            (innen), damit die Randlinie außen bleibt. Reine Anzeige.
            Wieder nur neben Datum + Teams statt über die ganze Karte, oben und
            unten verblassend, Farbe kräftig wie bisher (Rene, 14.10.2026).
            Kompakte Karte: Streifen reicht bis knapp über "Dein Tipp" (mb-3
            der Team-Zeile), kürzeres Verblassen und etwas kleinere Schrift,
            damit "Dein Verein" auf Höhe des Vereins ganz lesbar ist und nicht
            mehr abgeschnitten wird (Rene, 14.10.2026). */}
        <div className="relative">
          {/* Streifen "Dein Verein" sitzt an der Vereins-Zeile, auch beim Topspiel (Rene, 15.10.2026). */}
        {/* Am Handy steht der Wettbewerb beim Topspiel hier statt in der
            goldenen Leiste (Rene, 14.10.2026). */}
        {stage && (
          <div className="mb-1 flex items-center justify-center gap-1.5 text-center text-sm font-semibold text-ink sm:hidden">
            <span className="shrink-0 text-lg" aria-hidden><Emoji e={sportIcon[match.sport]} /></span>
            {leagueFlag && <span className="shrink-0" aria-hidden><Emoji e={leagueFlag} /></span>}
            <span className="min-w-0 leading-tight">{competitionName}</span>
          </div>
        )}
        <div
          className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-muted ${
            stage ? "mb-4 min-h-[1.75rem] text-[15px]" : "mb-3 text-[13px]"
          }`}
        >
          {match.matchday && !stage ? <span>Spieltag {match.matchday}</span> : null}
          {match.matchday && !stage ? <span aria-hidden>·</span> : null}
          <span>{kickoffLabel}</span>
          {match.tvChannel && (
            <span className="flex items-center gap-1.5 rounded-full border border-edge bg-pitch py-0.5 pl-2 pr-2.5 text-[13px] font-semibold text-ink">
              <TvIcon className="h-4 w-4 shrink-0 text-ink" />
              {match.tvChannel}
            </span>
          )}
        </div>

        {/* Vereine untereinander in voller Breite (Rene, 15.10.2026, Variante B),
            Reihenfolge wie bisher (US-Ligen Gast oben, sonst Heim oben).
            Sieger-Tipp: Verein antippen, "Unentschieden" dazwischen nur wo
            erlaubt. Ergebnis-Tipp: Zahl rechts neben dem Verein. Das Topspiel
            nutzt dieselben Zeilen, größer und im Gold-Look; die Countdown-
            Kacheln stehen dort (ab Tablet-Breite) über den Vereinen. Gleiche
            Abstände zwischen Datum, Vereins-Zeilen und Tipp-Knopf, 8 px
            zwischen den Tipp-Flächen (Rene, 15.10.2026). */}
        <div className={stage ? "mb-4 sm:mb-5" : "mb-3"}>
          {showTiles && (
            <div className="mb-4 hidden justify-center sm:flex">
              <CountdownTiles target={match.tipDeadline} />
            </div>
          )}
          {/* Getippter Ergebnis-Tipp: die Zahlen in den Vereins-Zeilen sind
              der eigene Tipp (Rene, 15.10.2026: Spieltag-Umbau). */}
          {!showBoard && !isOneXTwo && myTip && !myTip.refunded && (
            <p className={`mb-1 text-right text-[10px] font-semibold uppercase tracking-wide text-gold/80 ${stage ? "pr-4" : "pr-3"}`}>
              Dein Tipp
            </p>
          )}
          {!showResultView && (
            <p className={`mb-2 text-center text-muted/80 ${stage ? "text-[13px]" : "text-xs"}`}>{tipHint}</p>
          )}
          {showBoard && boardScore ? (
            // Anzeigetafel statt Vereins-Zeilen (live, Pause, beendet, gewertet),
            // ohne Torschützen; alle Ereignisse im Spielverlauf (Rene, 15.10.2026).
            <Scoreboard
              left={boardSide(leftTeam)}
              right={boardSide(rightTeam)}
              leftScore={leftSide === "home" ? boardScore.home : boardScore.away}
              rightScore={rightSide === "home" ? boardScore.home : boardScore.away}
              clock={boardClock}
              flash={goalFlash}
              stage={stage}
            />
          ) : (
            <div className={`flex flex-col gap-2 ${justSaved ? "animate-tip-saved rounded-lg" : ""}`}>
              {compactTeamRow(leftTeam, leftSide)}
              {compactShowsDraw && compactDrawRow()}
              {compactTeamRow(rightTeam, rightSide)}
            </div>
          )}
          {/* EINE Zeile "Dein Tipp: … · richtig  +5 vorläufig" mit "wenn es so
              bleibt" darunter; nach Abpfiff ohne Wertung "Wertung folgt"
              (Rene, 15.10.2026: Spieltag-Umbau, ersetzt "Stand jetzt"). */}
          {pendingTip && pendingTier && (
            <LiveTipLine
              tipText={tipName(pendingTip.predictedHomeScore, pendingTip.predictedAwayScore)}
              tier={pendingTier}
              points={pendingPoints}
              isOneXTwo={isOneXTwo}
              finished={!live || live.finished}
              forecast={forecast}
            />
          )}
          {showFriendsRow && friendsLive && (
            <>
              <FriendsLiveRow state={friendsLive} onOpen={() => setFriendsOpen(true)} className={pendingTip && pendingTier ? "mt-1.5" : "mt-2.5"} />
              <FriendsLiveSheet open={friendsOpen} onClose={() => setFriendsOpen(false)} />
            </>
          )}
          {!showResultView && closingSoon && (
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#FF9B5C]">
              <span aria-hidden>⏰</span> Gleich geschlossen – jetzt noch schnell tippen!
            </p>
          )}
        </div>
        </div>

        {!showResultView && (
          <>
            {match.bonusQuestion && (
              <div className="mb-5 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span aria-hidden>🎁</span> {match.bonusQuestion.question}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-gold">
                    +{match.bonusQuestion.bonusStars} Coins
                  </span>
                </div>
                {myBonusAnswer ? (
                  <p className="text-xs text-muted">
                    Deine Antwort: <span className="text-ink">{match.bonusQuestion.options[myBonusAnswer.optionIndex]}</span>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {match.bonusQuestion.options.map((option, i) => (
                      <button
                        key={i}
                        onClick={() => setBonusPick(i)}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          bonusPick === i
                            ? "border-gold bg-gold/20 text-gold"
                            : "border-edge bg-pitch text-muted hover:text-ink"
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!tippingClosed && !isCancelled && (
              <TrendRow matchId={match.id} homeName={homeTeam.name} awayName={awayTeam.name} awayFirst={isUsSport} className="mb-3" />
            )}

            {stage ? (
              <>
            {isBooster && (
                <div
                  className={`mb-3 rounded-lg border px-4 py-2.5 transition-colors ${
                    boosterOn ? "border-gold/50 bg-gold/[0.07]" : "border-edge bg-pitch/60"
                  }`}
                >
                  {/* Schalter: an = Vorschau, was man gewinnen/verlieren kann.
                      Abgebucht wird erst mit "Tipp abgeben". */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={boosterOn}
                    onClick={() => setBoosterOn((on) => !on)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <span className="min-w-0 text-sm text-ink">
                      ⚡ <span className="font-semibold">{boosterOn ? "Booster an" : "Booster:"}</span>
                      <span className="text-muted">
                        {boosterOn ? " · " : " "}
                        {withGutschein
                          ? "mit Gutschein gratis"
                          : boosterOn
                            ? `${BOOSTER_STAKE} Coins Einsatz`
                            : `${BOOSTER_STAKE} Coins setzen`}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${boosterOn ? "bg-gold" : "bg-edge"}`}
                    >
                      <span
                        className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
                          boosterOn ? "left-5 bg-pitch" : "left-1 bg-muted"
                        }`}
                      />
                    </span>
                  </button>
                  {boosterOn && (
                    <>
                      {withGutschein && (
                        <p className="mt-1.5 text-xs text-muted">
                          🎟️ Dein Booster-Gutschein wird eingelöst
                          {gutscheine > 1 ? ` (du hast ${gutscheine})` : ""}. Daneben kostet der Tipp nichts.
                        </p>
                      )}
                      <p className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                        <CoinIcon className="h-3 w-3" />
                        {withGutschein ? "Coins: dein Gewinn" : "Coins: dein Gewinn oder Verlust"}
                      </p>
                      <PointsGrid items={withGutschein ? gutscheinPayouts(isOneXTwo) : boosterPayouts(isOneXTwo)} coins />
                      <BoosterRankRow isOneXTwo={isOneXTwo} compactOnPhone={stage} />
                    </>
                  )}
                  {!boosterOn && (
                    <p className="mt-1 flex flex-wrap items-center gap-1 text-xs text-muted">
                      Je genauer dein Tipp, desto mehr <CoinIcon className="h-3.5 w-3.5" /> Coins gewinnst du.
                    </p>
                  )}
                </div>
              )}
              {/* Statt der Punkte-Tabelle nur ein kleiner Hinweis, die
                  Punkteverteilung öffnet sich beim Antippen in einem Fenster.
                  Nur der Booster (was der Tipp an Coins kostet, Gewinn oder
                  Verlust) bleibt als goldene Box auf der Karte, der Hinweis
                  steht immer direkt über dem Knopf. */}
              {/* Schild zur Tipp-Art entfällt, der Hinweis steht seit #269
                  über den Vereinen (Rene, 15.10.2026). */}
              <div className="mb-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
                <PointsInfoButton isOneXTwo={isOneXTwo} allowsDraw={allowsDraw} isBooster={isBooster} />
              </div>
  
              {/* Knopf-Zustände klar unterscheidbar: tippbereit = kräftiges
                  Grün mit Leuchten, noch nicht tippbereit = grau (vorher nur
                  halb durchsichtig, sah aus wie "kaputt"). */}
              {submitButton(`${isOneXTwo ? "Sieger" : "Ergebnis"}${boosting ? " mit Booster" : ""} abgeben`)}
              </>
            ) : (
              <>
                {/* Kompakt: Booster-Schalter links neben dem Knopf, beim
                    Einschalten stehen Gewinn und Verlust direkt darunter. */}
                <div className="flex items-center gap-3">
                  {isBooster && !isGuest && (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={boosterOn}
                      onClick={() => setBoosterOn((on) => !on)}
                      className="flex shrink-0 items-center gap-2 text-sm font-semibold text-gold"
                    >
                      <span
                        aria-hidden
                        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${boosterOn ? "bg-gold" : "bg-edge"}`}
                      >
                        <span
                          className={`absolute top-1 h-4 w-4 rounded-full transition-all ${
                            boosterOn ? "left-5 bg-pitch" : "left-1 bg-muted"
                          }`}
                        />
                      </span>
                      ⚡ {boosterOn ? "Booster an" : "Booster"}
                    </button>
                  )}
                  {submitButton(isBooster && !isGuest ? "Abgeben" : "Tipp abgeben")}
                </div>
                {isBooster && !isGuest && boosterOn && (
                  <div className="mt-2.5">
                    {withGutschein ? (
                      <p className="text-xs text-muted">
                        🎟️ Dein Booster-Gutschein wird eingelöst
                        {gutscheine > 1 ? ` (du hast ${gutscheine})` : ""}. Daneben kostet der Tipp nichts.
                      </p>
                    ) : (
                      <p className="text-xs text-muted">{BOOSTER_STAKE} Coins gesetzt, dein Gewinn oder Verlust:</p>
                    )}
                    <PointsGrid items={withGutschein ? gutscheinPayouts(isOneXTwo) : boosterPayouts(isOneXTwo)} coins />
                  </div>
                )}
                {isBooster && !isGuest && !boosterOn && (
                  <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                    {withGutschein ? "Mit Gutschein gratis:" : `Setz ${BOOSTER_STAKE} Coins:`} je genauer dein Tipp, desto mehr{" "}
                    <CoinIcon className="h-3.5 w-3.5" /> Coins gewinnst du.
                  </p>
                )}
              </>
            )}
            {notEnoughStars && !isGuest && (
              <p className="mt-2 text-center text-xs text-[#FF9B5C]">
                Für einen Booster brauchst du {BOOSTER_STAKE} Coins – du hast {freeStars}.
              </p>
            )}
          </>
        )}

        {showResultView && (
          <div className="flex flex-col gap-3">
            {/* Getippt (Rene, 15.10.2026: Spieltag-Umbau): der Tipp steht in den
                Vereins-Zeilen, hier nur noch Booster-Hinweis und "Tipp ändern"
                (dezent, Umriss). Ersetzt den früheren Kasten "Dein Tipp". */}
            {hasTipped && !showBoard && !myTip?.evaluated && !isCancelled && ((myTip?.stake ?? 0) > 0 || canChangeTip) && (
              <div className="flex flex-col gap-2">
                {(myTip?.stake ?? 0) > 0 && (
                  <p className="text-center">
                    <span
                      title="Mit Booster getippt"
                      className="rounded-full border border-gold/50 bg-gold/15 px-2 py-px text-[10px] font-bold uppercase tracking-wide text-gold"
                    >
                      ⚡ Mit Booster getippt
                    </span>
                  </p>
                )}
                {canChangeTip && (
                  <button
                    onClick={withdrawMyTip}
                    disabled={withdrawing}
                    className="w-full rounded-full border border-edge py-2 text-sm font-semibold text-muted transition-colors hover:border-gold hover:text-ink disabled:cursor-wait disabled:opacity-60"
                  >
                    {withdrawing ? "Wird zurückgenommen…" : "Tipp ändern"}
                  </button>
                )}
              </div>
            )}

            {/* Noch nicht ausgewertet: kurz zeigen, was der Tipp bringen kann.
                Jedes Paar bleibt zusammen ("Tendenz +5" nie getrennt). */}
            {stage && hasTipped && !myTip?.evaluated && !isCancelled && !showBoard && (
              <div className="flex justify-center">
                <PointsInfoButton isOneXTwo={isOneXTwo} allowsDraw={allowsDraw} isBooster={isBooster} />
              </div>
            )}

            {hasTipped && !myTip?.evaluated && !isCancelled && !showBoard && (
              <JokerRow
                matchId={match.id}
                joker={myTip?.joker ?? null}
                canChange={!tippingClosed}
                isOneXTwo={isOneXTwo}
              />
            )}
            {hasTipped && !tippingClosed && !isCancelled && !myTip?.evaluated && (
              <TrendRow matchId={match.id} homeName={homeTeam.name} awayName={awayTeam.name} awayFirst={isUsSport} />
            )}

            {hasTipped && myTip?.evaluated && !myTip.refunded && !isCancelled && (
              <EvaluatedBox
                myTip={myTip!}
                tipText={tipName(myTip!.predictedHomeScore, myTip!.predictedAwayScore)}
                comparison={comparison}
                isOneXTwo={isOneXTwo}
                shareData={shareData}
              />
            )}

            {tippingClosed && !isCancelled && tendency && (
              <CommunityTrend
                tendency={tendency}
                sport={match.sport}
                order={order}
                homeName={homeTeam.name}
                awayName={awayTeam.name}
                finalScore={finalScore}
                myTip={myTip && !myTip.refunded ? { home: myTip.predictedHomeScore, away: myTip.predictedAwayScore } : null}
              />
            )}

            {match.bonusQuestion && myBonusAnswer && (
              <div
                className={`flex items-center justify-between rounded-lg border px-4 py-2.5 ${
                  myBonusAnswer.evaluated
                    ? myBonusAnswer.correct
                      ? "border-gold bg-gold/10"
                      : "border-edge bg-pitch"
                    : "border-gold/30 bg-gold/5"
                }`}
              >
                <span className="text-sm text-muted">
                  🎁 {match.bonusQuestion.question} ·{" "}
                  <span className="text-ink">{match.bonusQuestion.options[myBonusAnswer.optionIndex]}</span>
                </span>
                {myBonusAnswer.evaluated ? (
                  <span className={`shrink-0 font-display text-sm font-bold ${myBonusAnswer.correct ? "text-gold" : "text-muted"}`}>
                    {myBonusAnswer.correct ? `✓ +${myBonusAnswer.starsDelta}` : "✗"}
                  </span>
                ) : (
                  <span className="shrink-0 text-xs text-muted">
                    {isCancelled ? "entfällt" : "wartet auf Auswertung"}
                  </span>
                )}
              </div>
            )}

            {isCancelled ? (
              <CancelledBox stake={hasTipped ? myTip!.stake ?? 0 : null} gutschein={!!myTip?.gutschein} />
            ) : live ? null : (
              <ResultBox
                match={match}
                order={order}
                kickedOff={kickedOff}
                highlightLine={`${leftTeam.name} – ${rightTeam.name}${finalScore ? ` · ${scoreText(order, finalScore.home, finalScore.away)}` : ""}`}
              />
            )}
          </div>
        )}

        {/* "Doris hat schon getippt" nur ab Tablet-Breite – am Handy steht
            unten ohnehin "X getippt" (Platz sparen, Rene 10.10.2026). */}
        {stage && !tippingClosed && !isCancelled && (
          <div className="hidden sm:block">
            <StageTippers tippers={tippers} tipCount={tipCount} myId={authUserId} friendIds={friendEntries.filter((f) => f.relation === "friend").map((f) => f.id)} />
          </div>
        )}

        {/* Footer (Rene, 15.10.2026): immer EINE Zeile (auch 3er-Reihe am PC
            und 375 px): "👥 2 ▼ · Spielverlauf (6) ▾ · 💬 Kommentieren", kleine
            Abstände, Icons statt Wörter, nie umbrechen. */}
        <div className="mt-auto flex flex-nowrap items-center justify-between gap-1.5 whitespace-nowrap pt-3 text-xs text-muted">
          {tipCount > 0 ? (
            <button
              onClick={() => setTippersOpen((current) => !current)}
              aria-expanded={tippersOpen}
              className="flex shrink-0 items-center gap-1 font-semibold text-muted transition-colors hover:text-ink"
            >
              <PeopleIcon className="h-3.5 w-3.5" />
              {tipCount.toLocaleString("de-DE")}
              <span className="sr-only">getippt</span>
              <span aria-hidden className="text-[10px]">{tippersOpen ? "▲" : "▼"}</span>
            </button>
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              <PeopleIcon className="h-3.5 w-3.5" />0<span className="sr-only">getippt</span>
            </span>
          )}
          {/* getippt · Spielverlauf (live, beendet, gewertet) · Kommentieren.
              Neues Tor: Spielverlauf golden mit pulsierendem Punkt.
              Spielverlauf-Knopf (Rene, 15.10.2026): 2 px größer als der Rest
              (14 statt 12 px), Farbe ink statt muted, Pfeil ▾/▴ – ruhig, gold
              nur beim Puls. Damit die Zeile hält, ist "Kommentieren" in der
              engen PC-3er-Reihe (lg bis xl) nur das Sprechblasen-Icon. */}
          <div className="flex min-w-0 items-center gap-2">
            {showEventsButton && (
              <button
                onClick={toggleEvents}
                aria-expanded={eventsOpen}
                aria-label={`Spielverlauf${timelineCount(events) > 0 ? ` (${timelineCount(events)})` : ""}${eventsPulse ? " – neues Tor" : ""}`}
                className={`flex shrink-0 items-center gap-1 text-[14px] font-semibold transition-colors ${
                  eventsPulse ? "text-gold" : "text-ink hover:text-gold"
                }`}
              >
                {eventsPulse && <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-gold animate-live-dot" />}
                <span className={eventsPulse ? "animate-goal-pulse" : ""}>
                  Spielverlauf
                  {timelineCount(events) > 0 ? ` (${timelineCount(events)})` : ""}
                </span>
                <span aria-hidden className="text-[12px] leading-none">{eventsOpen ? "▴" : "▾"}</span>
              </button>
            )}
            <button
              onClick={() => setCommentsOpen((current) => !current)}
              aria-label={matchComments.length === 0 ? "Kommentieren" : undefined}
              title={matchComments.length === 0 ? "Kommentieren" : undefined}
              className="flex min-w-0 items-center gap-1 font-semibold text-muted transition-colors hover:text-ink"
            >
              <ChatIcon className="h-3.5 w-3.5 shrink-0" />
              {matchComments.length === 0 ? (
                <span className="truncate lg:max-xl:hidden">Kommentieren</span>
              ) : (
                <span className="truncate">{matchComments.length.toLocaleString("de-DE")}</span>
              )}
            </button>
          </div>
        </div>

        {eventsOpen && showEventsButton && events && (
          <div className="mt-3 border-t border-edge pt-3">
            <EventTimeline events={events} leftSide={leftSide} glow={timelineGlow} />
          </div>
        )}

        {tippersOpen && tipCount > 0 && (
          <TippersList
            tippers={tippers}
            failed={tippersFailed}
            authUserId={authUserId}
            showTips={tippingClosed}
            formatTip={formatTip}
          />
        )}

        {commentsOpen && (
          <div className="mt-3 border-t border-edge pt-3">
            {matchComments.length === 0 ? (
              <p className="mb-3 text-xs text-muted">
                Noch keine Kommentare – schreib den ersten!
              </p>
            ) : (
              <div className="mb-3 flex max-h-64 flex-col gap-2.5 overflow-y-auto pr-1">
                {matchComments.map((comment) => {
                  const liked = comment.likedBy.includes(displayName);
                  const isMine = comment.author === displayName;
                  const ownHonors = comment.userId && comment.userId === authUserId ? shownPassHonors : null;
                  const honors = ownHonors ?? (comment.userId ? commentHonors[comment.userId] : undefined);
                  return (
                    <div key={comment.id} className="rounded-lg border border-edge bg-pitch px-3 py-2.5">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                          <Link
                            href={`/spieler/${encodeURIComponent(comment.author)}`}
                            className="text-xs font-semibold text-gold [overflow-wrap:anywhere] hover:opacity-80"
                          >
                            {comment.author}
                          </Link>
                          {honors && <PassHonorTags honors={honors} size="sm" />}
                        </div>
                        <span className="shrink-0 text-[11px] text-muted">
                          {new Date(comment.createdAt).toLocaleString("de-DE", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="mb-1.5 text-sm text-ink [overflow-wrap:anywhere]">
                        <MessageBody text={comment.text} />
                      </p>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => toggleCommentLike(comment.id, displayName)}
                          disabled={isGuest}
                          className={`flex items-center gap-1 text-xs font-semibold transition-colors disabled:cursor-default disabled:hover:text-muted ${
                            liked ? "text-gold" : "text-muted hover:text-ink"
                          }`}
                        >
                          <ThumbUpIcon className="h-3.5 w-3.5" filled={liked} />
                          {comment.likedBy.length > 0 ? comment.likedBy.length : ""}
                        </button>
                        {isMine && (
                          <button
                            onClick={() => removeComment(comment.id)}
                            className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-red-400"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                            Löschen
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {isGuest ? (
              <Link
                href="/registrieren"
                className="block rounded-lg border border-edge bg-pitch px-3 py-2 text-center text-sm font-semibold text-gold transition-colors hover:border-gold"
              >
                Zum Kommentieren einloggen
              </Link>
            ) : (
            <form onSubmit={handleCommentSubmit}>
              {commentSticker && (
                <div className="mb-2">
                  <StickerDraft emote={commentSticker} onRemove={() => setCommentSticker(null)} />
                </div>
              )}
              <div className="flex gap-2">
                <EmotePicker
                  onInsertEmoji={(emoji) => setCommentDraft((d) => d + emoji)}
                  onPickSticker={(emote) => setCommentSticker(emote)}
                />
                <input
                  value={commentDraft}
                  onChange={(e) => setCommentDraft(e.target.value)}
                  placeholder={commentSticker ? "Text dazu (optional)" : "Kommentar schreiben…"}
                  className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
                />
                <button
                  type="submit"
                  aria-label="Kommentar senden"
                  className="rounded-lg bg-action px-3 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
                >
                  ➤
                </button>
              </div>
            </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const JOKER_LABEL = { doppel: "Doppel-Joker", schutz: "Schutz-Joker", toleranz: "Toleranz-Joker" } as const;

function TippersList({
  tippers,
  failed,
  authUserId,
  showTips,
  formatTip,
}: {
  tippers: MatchTipper[] | null;
  failed: boolean;
  authUserId: string | null;
  showTips: boolean;
  formatTip: (home: number, away: number) => string;
}) {
  return (
    <div className="mt-3 border-t border-edge pt-3">
      <p className="mb-2 text-xs font-semibold text-ink">Wer hat getippt?</p>
      {tippers === null ? (
        <p className="text-xs text-muted">{failed ? "Konnte nicht geladen werden." : "Wird geladen…"}</p>
      ) : (
        <>
          <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
            {tippers.map((t) => (
              <li
                key={t.userId}
                className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-pitch px-3 py-2"
              >
                <span className="min-w-0 text-sm">
                  <Link
                    href={`/spieler/${encodeURIComponent(t.name)}`}
                    className="font-semibold text-gold [overflow-wrap:anywhere] hover:opacity-80"
                  >
                    {t.name}
                  </Link>
                  {t.userNumber !== null && <span className="ml-1.5 text-xs text-muted">#{t.userNumber}</span>}
                  {t.userId === authUserId && <span className="ml-1.5 text-xs text-muted">(du)</span>}
                </span>
                {showTips && t.predictedHome !== null && t.predictedAway !== null && (
                  // Höchstens gut die Hälfte der Zeile, damit lange Spielernamen
                  // neben "Sieg Columbus Blue Jackets" nicht zerdrückt werden.
                  <span className="max-w-[55%] shrink-0 text-right font-display text-sm font-semibold leading-tight text-ink">
                    {(() => {
                      // "Sieg" leise, der Teamname zählt (wie bei "Dein Tipp").
                      const text = formatTip(t.predictedHome, t.predictedAway);
                      if (!text.startsWith("Sieg ")) return text;
                      return (
                        <>
                          <span className="font-sans font-normal text-muted/70">Sieg</span> {text.slice(5)}
                        </>
                      );
                    })()}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!showTips && (
            <p className="mt-2 text-[11px] text-muted">Die Tipps der anderen siehst du ab Tippschluss.</p>
          )}
        </>
      )}
    </div>
  );
}

// Kleine Tabelle "+10 Exakt | +7 Differenz | …" für Rangpunkte und Sterne.
// coins: Coin-Beträge (Booster) – Münze davor und Gold, damit man sie nie mit
// Rangpunkten (grün) verwechselt (Rene, 09.10.2026).
function PointsGrid({ items, coins = false }: { items: { label: string; net: number }[]; coins?: boolean }) {
  return (
    <div className={`mt-1 grid gap-1.5 text-center ${items.length === 2 ? "grid-cols-2" : "grid-cols-4"}`}>
      {items.map((p) => (
        <div key={p.label} className="rounded-md bg-pitch/60 px-1 py-1">
          <div
            className={`flex items-center justify-center gap-1 whitespace-nowrap font-display text-sm font-bold ${
              p.net > 0 ? (coins ? "text-gold" : "text-[#4FC181]") : p.net < 0 ? "text-[#FF9B5C]" : "text-ink"
            }`}
          >
            {coins && p.net !== 0 && <CoinIcon className="h-3.5 w-3.5" />}
            {p.net > 0 ? `+${p.net}` : p.net < 0 ? `−${-p.net}` : "±0"}
          </div>
          <div className="text-[11px] text-muted">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

// Booster: Rangpunkte gibt es zusätzlich zu den Coins, genau wie bei jedem
// Tipp – als eigene grüne Zeile mit Pokal, damit klar ist: beides zählt.
function BoosterRankRow({ isOneXTwo, compactOnPhone = false }: { isOneXTwo: boolean; compactOnPhone?: boolean }) {
  if (compactOnPhone) {
    // Topspiel am Handy: Rangpunkte in einer Zeile statt vier Kästchen.
    const line = rankingPointsTable(isOneXTwo)
      .map((p) => (p.net > 0 ? `+${p.net}` : `−${-p.net}`))
      .join(" / ");
    return (
      <>
        <p className="mt-2.5 text-center text-xs text-muted sm:hidden">
          🏆 Dazu wie immer Rangpunkte: <b className="text-[#4FC181]">{line}</b> + Platz-Bonus
        </p>
        <div className="hidden sm:block">
          <BoosterRankRow isOneXTwo={isOneXTwo} />
        </div>
      </>
    );
  }
  return (
    <>
      <p className="mt-2.5 text-[11px] uppercase tracking-wide text-muted">🏆 Dazu wie immer: Rangpunkte</p>
      <PointsGrid items={rankingPointsTable(isOneXTwo)} />
      <p className="mt-1.5 text-center text-xs text-muted">+ Platz-Bonus wie bei jedem Tipp</p>
    </>
  );
}

// Zeilen im Fenster "Punkteverteilung": jede Stufe mit kurzer Erklärung.
function tipPointRows(isOneXTwo: boolean, allowsDraw: boolean): { title: string; hint?: string; points: number }[] {
  if (isOneXTwo) {
    return [
      {
        title: "Richtig getippt",
        hint: allowsDraw ? "1, X oder 2 stimmt" : "dein Sieger gewinnt",
        points: RANKING_POINTS.tendenz,
      },
      { title: "Daneben getippt", points: RANKING_POINTS.falsch },
    ];
  }
  return [
    { title: "Richtiges Ergebnis", hint: "genau der Endstand", points: RANKING_POINTS.exakt },
    {
      title: "Richtige Tordifferenz",
      hint: "richtiger Sieger und gleicher Abstand, z.\u00a0B. 2:1 getippt, 3:2 gespielt",
      points: RANKING_POINTS.differenz,
    },
    { title: "Richtige Tendenz", hint: "nur der Sieger oder das Unentschieden stimmt", points: RANKING_POINTS.tendenz },
    { title: "Daneben getippt", points: RANKING_POINTS.falsch },
  ];
}

// Kleiner Hinweis "Punkteverteilung" auf der Karte. Beim Antippen öffnet
// sich ein Fenster mit den Punkten für diesen Kartentyp (Ergebnis oder 1X2),
// dem Bonus gegen die Mittipper und bei Booster-Spielen den Coins.
function PointsInfoButton({
  isOneXTwo,
  allowsDraw,
  isBooster,
  iconOnly = false,
}: {
  isOneXTwo: boolean;
  allowsDraw: boolean;
  isBooster: boolean;
  iconOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={iconOnly ? "Punkteverteilung" : undefined}
        title={iconOnly ? "Punkteverteilung" : undefined}
        className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full text-xs font-semibold text-muted transition-colors hover:text-ink ${
          iconOnly ? "-m-1.5 p-1.5" : "px-1 py-0.5"
        }`}
      >
        <span
          aria-hidden
          className={`flex items-center justify-center rounded-full border border-current font-display font-bold leading-none ${
            iconOnly ? "h-5 w-5 text-[11px]" : "h-4 w-4 text-[10px]"
          }`}
        >
          i
        </span>
        {!iconOnly && "Punkteverteilung"}
      </button>

      {/* Per Portal direkt in <body>, sonst bezieht sich position:fixed auf
          einen Vorfahren mit transform und das Fenster wird abgeschnitten. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-pitch/85 p-4 backdrop-blur-sm sm:items-center"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Punkteverteilung"
              className="flex max-h-[85vh] w-full max-w-sm flex-col overflow-hidden rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="overflow-y-auto px-5 pb-5 pt-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold leading-tight text-ink">So bekommst du Punkte</h2>
                    <p className="text-xs text-muted">{isOneXTwo ? (allowsDraw ? "1X2-Tipp" : "Sieg-Tipp") : "Ergebnis-Tipp"}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Schließen"
                    className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted transition-colors hover:text-ink"
                  >
                    ×
                  </button>
                </div>

                <p className="text-sm font-semibold text-ink">Zuerst zählt dein Tipp:</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {tipPointRows(isOneXTwo, allowsDraw).map((row) => (
                    <li key={row.title} className="flex items-start justify-between gap-3 rounded-md bg-pitch/60 px-3 py-2">
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold leading-snug text-ink">{row.title}</span>
                        {row.hint && <span className="block text-xs leading-snug text-muted">{row.hint}</span>}
                      </span>
                      <span
                        className={`shrink-0 font-display text-base font-bold ${row.points > 0 ? "text-action" : "text-[#FF9B5C]"}`}
                      >
                        {row.points > 0 ? `+${row.points}` : `−${-row.points}`}
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-sm font-semibold text-ink">Dazu kommt der Vergleich mit den anderen:</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  Hast du besser getippt als die meisten, die dasselbe Spiel getippt haben, gibt es Bonuspunkte. Hast
                  du schlechter getippt als die meisten, gibt es Abzug. Wenn du jemanden schlägst, der in der Rangliste
                  vor dir steht, bringt das mehr, als wenn du jemanden schlägst, der hinter dir steht. Genauso kostet
                  es mehr, gegen jemanden hinter dir zu verlieren. Der Bonus oder Abzug ist höchstens{"\u00a0"}
                  {RANKING_BONUS_CAP}{"\u00a0"}Punkte pro Tipp.
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  🐣 Deine ersten {BEGINNER_SHIELD_TIPS} Tipps kosten keine Punkte.
                </p>

                {isBooster && (
                  <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.07] px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">Booster-Einsatz</span>
                      <span className="flex items-center gap-1 font-display font-semibold text-gold">
                        <CoinIcon className="h-[18px] w-[18px]" />
                        {BOOSTER_STAKE}
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted">
                      <CoinIcon className="h-3 w-3" />
                      Coins: dein Gewinn oder Verlust
                    </p>
                    <PointsGrid items={boosterPayouts(isOneXTwo)} coins />
                    <BoosterRankRow isOneXTwo={isOneXTwo} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full shrink-0 bg-action py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
              >
                Schließen
              </button>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}

// Gewertet (Rene, 15.10.2026: Spieltag-Umbau): grüne bzw. rötliche Box
// "Dein Tipp: <Tipp>", darunter "<Stufe> +5 · Bonus +4 · besser als 64 %",
// rechts groß die Summe. Ersetzt die frühere Ergebnis-Box und den Kasten
// "Dein Tipp". Booster-Coins, Joker, Anfänger-Schutz und die Untergrenze 0
// stehen klein darunter, nur wenn sie zutreffen.
const TIER_NAME: Record<TipResultTier, string> = {
  exakt: "Exakt",
  differenz: "Tordifferenz",
  tendenz: "Tendenz",
  falsch: "Daneben",
};

function EvaluatedBox({
  myTip,
  tipText,
  comparison,
  isOneXTwo,
  shareData,
}: {
  myTip: MyTip;
  tipText: string;
  comparison: { beaten: number; tied: number; ahead: number; total: number } | null;
  isOneXTwo: boolean;
  shareData: ShareCardData | null;
}) {
  const tier = myTip.resultTier ?? "falsch";
  const rangDelta = myTip.rangDelta ?? 0;
  const calculated = myTip.rangCalculated ?? rangDelta;
  // Mit Gutschein war nichts bezahlt: daneben kostet der Tipp nichts
  // (supabase/trainingstaschen.sql gleicht das auf dem Konto aus).
  const starsDelta = myTip.gutschein ? Math.max(0, myTip.starsDelta ?? 0) : myTip.starsDelta ?? 0;
  const hasStake = (myTip.stake ?? 0) > 0;
  // Aufschlüsselung: im Rankingsystem immer, bei Tipps aus dem früheren
  // Punkte-Modell (Duelle) mit dessen Zahlen, ganz alte Tipps nur Vergleich.
  const oldDuelOpponents = (myTip.duelsWon ?? 0) + (myTip.duelsDrawn ?? 0) + (myTip.duelsLost ?? 0);
  const breakdown = myTip.rankingScored
    ? { bonus: myTip.bonusPoints ?? 0, beaten: myTip.beaten ?? 0, opponents: myTip.opponents ?? 0 }
    : myTip.duelPoints !== undefined && !myTip.scoredWithoutDuels && oldDuelOpponents > 0
    ? { bonus: myTip.duelPoints, beaten: myTip.duelsWon ?? 0, opponents: oldDuelOpponents }
    : null;
  const fixed = myTip.basePoints ?? (breakdown ? rangDelta - breakdown.bonus : rangDelta);
  const percent =
    breakdown && breakdown.opponents > 0
      ? Math.round((breakdown.beaten / breakdown.opponents) * 100)
      : !breakdown && comparison && comparison.total > 0
      ? Math.round((comparison.beaten / comparison.total) * 100)
      : null;
  const good = tier !== "falsch";
  const tierName = isOneXTwo ? (good ? "Richtig" : "Daneben") : TIER_NAME[tier];
  const summary = [
    `${tierName} ${signedPoints(fixed)}`,
    breakdown && breakdown.opponents > 0 ? `Bonus ${signedPoints(breakdown.bonus)}` : null,
    percent !== null ? `besser als ${percent} %` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const notes: string[] = [];
  if (myTip.rankingLegacy) notes.push("Vor dem Neustart der Rangpunkte gewertet, zählt nicht mehr.");
  if ((breakdown && breakdown.opponents === 0) || (!breakdown && comparison?.total === 0)) {
    notes.push("Außer dir hat niemand getippt, darum kein Bonus.");
  }
  if (myTip.joker) {
    notes.push(
      `${JOKER_ICON[myTip.joker]} ${JOKER_LABEL[myTip.joker]} eingesetzt${
        fixed + (breakdown?.bonus ?? 0) < calculated && !myTip.beginnerShielded ? ": kein Minus" : ""
      }`
    );
  }
  if (myTip.beginnerShielded) notes.push(`🐣 Anfänger-Schutz: kein Minus (deine ersten ${BEGINNER_SHIELD_TIPS} Tipps).`);
  if (calculated !== rangDelta) {
    notes.push(
      `Gerechnet ${signedPoints(calculated)}. Rangpunkte fallen nie unter 0, darum ${
        rangDelta === 0 ? "wurde nichts abgezogen" : `nur ${-rangDelta} abgezogen`
      }.`
    );
  }

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${
        good ? "border-action/50 bg-action/10" : "border-edge bg-red-400/[0.07]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">
            Dein Tipp: <span className={`font-semibold ${good ? "text-gold" : "text-ink"}`}>{tipText}</span>
          </p>
          <p className="mt-0.5 text-xs text-muted">{summary}</p>
        </div>
        {/* Minus sachlich in Grau statt Rot: ein einzelner Tipp ist nur ein Baustein. */}
        <span
          className={`shrink-0 whitespace-nowrap text-right font-display font-bold leading-none ${
            myTip.rankingLegacy ? "text-muted line-through" : rangDelta > 0 ? "text-action" : "text-muted"
          }`}
        >
          <span className="text-[26px]">{signedPoints(rangDelta)}</span>
          <span className="mt-0.5 block text-[10px] font-semibold uppercase tracking-wide">Rangpunkte</span>
        </span>
      </div>
      {hasStake && (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span className={`flex items-center gap-1 font-semibold ${starsDelta >= 0 ? "text-gold" : "text-muted"}`}>
            <CoinIcon className="h-4 w-4" />
            {starsDelta >= 0 ? "+" : ""}
            {starsDelta} Coins
          </span>
          {/* Abrechnung ausgeschrieben: Der Einsatz ist schon beim Tippen weg,
              nach dem Spiel kommt etwas zurück (Rene, 11.10.2026). */}
          <span>
            {myTip.gutschein
              ? "Mit Gutschein getippt, nichts bezahlt."
              : `Einsatz ${myTip.stake} · zurück ${(myTip.stake ?? 0) + starsDelta}`}
          </span>
        </p>
      )}
      {notes.length > 0 && (
        <div className="flex flex-col gap-0.5 text-[11px] leading-snug text-muted">
          {notes.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
      )}
      {shareData && <ShareTipButton data={shareData} />}
    </div>
  );
}

function CancelledBox({ stake, gutschein }: { stake: number | null; gutschein: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-red-400/50 bg-red-400/10 px-4 py-3 text-center">
      <span className="font-display text-sm font-semibold text-red-300">🚫 Spiel abgesagt</span>
      <span className="text-xs text-muted">
        {stake === null
          ? "Dieses Spiel wird nicht gewertet."
          : gutschein
          ? "Dein Booster-Gutschein liegt wieder in deinem Vorrat."
          : stake > 0
          ? `Dein Einsatz von ${stake.toLocaleString("de-DE")} Coins ist zurück auf deinem Konto.`
          : "Dein Tipp wird nicht gewertet."}
      </span>
    </div>
  );
}

function ResultBox({
  match,
  order,
  kickedOff,
  liveFinished = false,
  highlightLine,
}: {
  match: Match;
  order: TeamOrder;
  kickedOff: boolean;
  // Laut Live-Daten abgepfiffen, offizieller Endstand fehlt noch.
  liveFinished?: boolean;
  highlightLine: string;
}) {
  if (match.status === "live") {
    // Nur der echte Spielstand – es gibt keinen Ereignis-Feed. Früher
    // wurden hier Tore und Karten per Zufall erfunden.
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border border-action bg-action/10 px-4 py-3">
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-action" />
        <span className="font-display text-sm font-semibold text-action">LIVE</span>
        <span className="font-display text-xl font-bold text-ink">
          {displayOrder(order, match.liveHomeScore ?? 0, match.liveAwayScore ?? 0).join(" : ")}
        </span>
      </div>
    );
  }

  if (match.status === "finished") {
    // Der Endstand steht oben zwischen den Teams; hier bleibt nur noch der
    // Link zur Zusammenfassung (falls es einen gibt).
    if (!match.summaryVideoUrl) return null;
    return (
      // Highlights-Kachel (Rene, 12.10.2026, Entwurf A): sieht aus wie eine
      // kleine Video-Vorschau. Bewusst ohne fremdes Vorschaubild und ohne
      // Namen der Video-Plattform – nur ein Link zum Video.
      <a
        href={match.summaryVideoUrl}
        target="_blank"
        rel="noreferrer"
        className="group relative flex min-h-[84px] w-full items-center gap-3 overflow-hidden rounded-xl border border-edge px-3.5 py-3 transition-colors hover:border-[#FF0033]/50"
        style={{
          background:
            "linear-gradient(90deg, rgba(10,17,14,0.93) 0%, rgba(10,17,14,0.6) 55%, rgba(10,17,14,0.3) 100%), repeating-linear-gradient(90deg, #2f6b3f 0 34px, #2a6038 34px 68px)",
        }}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#FF0033] text-white shadow-[0_0_18px_rgba(255,0,51,0.45)] transition-transform group-hover:scale-105">
          <HighlightTvIcon className="h-7 w-7" />
        </span>
        <span className="flex min-w-0 flex-col pb-4">
          <span className="font-display text-base font-semibold leading-tight text-ink">Highlights ansehen</span>
          <span className="mt-0.5 text-xs leading-snug text-[#C9CFCB]">{highlightLine}</span>
        </span>
        <span className="absolute bottom-2 right-2.5 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white">
          ▶ Video
        </span>
      </a>
    );
  }

  // "Noch nicht begonnen" sagt nichts Neues (Countdown und Datum stehen
  // oben) – weggelassen (Rene, 15.10.2026: Spieltag-Umbau, keine doppelten
  // Hinweise). Nach Anpfiff ohne Live-Daten bleibt "Spiel läuft".
  if (!kickedOff && !liveFinished) return null;
  return (
    <div className="flex items-center justify-center rounded-lg border border-edge bg-pitch px-4 py-3">
      <span className="text-sm text-muted">
        {liveFinished
          ? "Abgepfiffen – offizielles Ergebnis folgt"
          : "Spiel läuft – Ergebnis folgt"}
      </span>
    </div>
  );
}

// Teamnamen brechen nur an Leerzeichen um, nie mitten im Wort (kein
// "Le-/verkusen"), höchstens zwei Zeilen. Passt ein langes Einzelwort wie "Mönchengladbach" nicht in
// die Spalte, wird die Schrift schrittweise verkleinert, bis es passt.
// single: Name immer einzeilig, nur verkleinert, nie umgebrochen (kompakte
// Karte, Vereins-Zeile in voller Breite). selected: goldene Schrift
// (Rene, 15.10.2026, Variante B). big: Topspiel-Zeile.
// Vereins-Zeile: Grundgröße 15 px (ab sm 16 px), Topspiel 16/17 px;
// verkleinert wird nur als Notlösung und nie unter 13 px (Rene, 15.10.2026).
function TeamLabel({
  name,
  inline,
  single = false,
  big = false,
  selected = false,
}: {
  name: string;
  inline?: "left" | "right";
  single?: boolean;
  big?: boolean;
  selected?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      // Nie mitten im Wort trennen, höchstens 2 Zeilen: passt ein Wort nicht
      // oder wären es mehr Zeilen, wird verkleinert, mehrzeilig bis 12 px
      // (Rene, 15.10.2026, vorher Trennung mit Bindestrich als Notlösung).
      const min = single ? 13 : 12;
      const tooBig = () => el.scrollWidth > el.clientWidth || (!single && el.scrollHeight > el.clientHeight + 1);
      while (tooBig() && size > min) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    // Nach dem Laden der Schrift neu messen (sie ist breiter als die Ersatzschrift).
    document.fonts?.ready.then(fit);
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [name, inline, single, big]);

  return (
    <span
      ref={ref}
      className={
        inline
          ? `min-w-0 flex-1 font-display font-semibold leading-tight [overflow-wrap:normal] ${
              single ? (big ? "text-base sm:text-[17px]" : "text-[15px] sm:text-base") : "text-sm sm:text-[15px]"
            } ${
              selected ? "text-gold" : "text-ink"
            } ${single ? "overflow-hidden text-ellipsis whitespace-nowrap" : "line-clamp-2"} [hyphens:none] [word-break:normal] ${
              inline === "right" ? "text-right" : "text-left"
            }`
          : "line-clamp-2 min-h-[2.5em] w-full text-center font-display text-base font-semibold leading-tight text-ink [hyphens:none] [overflow-wrap:normal] [word-break:normal] sm:text-lg"
      }
    >
      {name}
    </span>
  );
}

// Sitzt rechts in der Vereins-Zeile, etwas flacher als die Zeile; in
// voller Breite ist Platz für drei Ziffern (NBA) (Rene, 15.10.2026, Variante B).
// Deutlich größer und im Gold-Look: ca. 48×44 px am Handy, 52×46 px am PC,
// Zahl 20–22 px fett (Rene, 15.10.2026).
const scoreInputCompactClass =
  "h-11 w-12 shrink-0 rounded-lg border border-gold/35 bg-surface text-center font-display text-[20px] font-bold leading-none text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60 sm:h-[46px] sm:w-[52px] sm:text-[22px]";

// Topspiel: gleich großes Zahlenfeld, Rand etwas kräftiger in Gold (Rene, 15.10.2026).
const scoreInputStageClass =
  "h-11 w-12 shrink-0 rounded-lg border border-gold/50 bg-surface text-center font-display text-[20px] font-bold leading-none text-ink outline-none transition-colors placeholder:text-muted/50 focus:border-gold focus:ring-2 focus:ring-gold/30 disabled:opacity-60 sm:h-[46px] sm:w-[52px] sm:text-[22px]";


// Joker auf dem eigenen Tipp (supabase/joker-shop.sql): gesetzten Joker
// zeigen und bis Tippschluss abnehmen, sonst die Joker aus dem Vorrat zum
// Antippen. Wer keine Joker hat, sieht hier nichts.
function JokerRow({
  matchId,
  joker,
  canChange,
  isOneXTwo,
}: {
  matchId: string;
  joker: TipJoker | null;
  canChange: boolean;
  isOneXTwo: boolean;
}) {
  const { ready, stock, setTipJoker } = useJokers();
  const { showToast } = useFeedback();
  const [saving, setSaving] = useState(false);

  async function choose(next: TipJoker | null) {
    if (saving) return;
    setSaving(true);
    const failed = await setTipJoker(matchId, next);
    setSaving(false);
    if (failed) showToast(`✗ ${failed}`, "info");
    else showToast(next ? `✓ ${TIP_JOKER_LABEL[next]} gesetzt.` : "✓ Joker abgenommen, er liegt wieder in deinem Vorrat.");
  }

  if (joker) {
    return (
      <div className="rounded-lg border border-gold/40 bg-gold/[0.07] px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold text-ink">{JOKER_ICON[joker]} {TIP_JOKER_LABEL[joker]}</span>
          {canChange && (
            <button
              onClick={() => choose(null)}
              disabled={saving}
              className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-gold hover:text-ink disabled:cursor-wait"
            >
              Abnehmen
            </button>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">{TIP_JOKER_EFFECT[joker]}</p>
      </div>
    );
  }

  if (!ready || !canChange) return null;
  const options = (["schutz", "doppel", "toleranz"] as TipJoker[]).filter(
    (j) => stock[j] > 0 && !(j === "toleranz" && isOneXTwo)
  );
  if (options.length === 0) return null;

  return (
    <div className="rounded-lg border border-edge bg-pitch/60 px-4 py-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted">Joker setzen</p>
      <div className={`mt-1.5 grid gap-1.5 ${["grid-cols-1", "grid-cols-2", "grid-cols-3"][options.length - 1]}`}>
        {options.map((j) => (
          <button
            key={j}
            onClick={() => choose(j)}
            disabled={saving}
            className="flex flex-col items-center rounded-xl border border-gold/40 bg-gold/[0.07] px-1 py-1.5 text-xs font-semibold text-gold transition-colors hover:border-gold disabled:cursor-wait"
          >
            {/* Emoji oben: in einer Zeile wäre es am Handy (360 px) zu breit. */}
            <span className="text-base leading-tight" aria-hidden>
              {JOKER_ICON[j]}
            </span>
            <span className="whitespace-nowrap">
              {TIP_JOKER_LABEL[j].replace("-Joker", "")}
              <span className="ml-0.5 text-muted">×{stock[j]}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Trend- und Experten-Joker: wie haben die anderen bisher getippt? Nur
// sichtbar, wenn man den Joker hat oder ihn für dieses Spiel schon eingesetzt
// hat. Der Experten-Joker zeigt zusätzlich das häufigste Ergebnis der Top 30 %
// der Sportart (supabase/experten-joker.sql) – mit ihm braucht es den
// einfachen Trend nicht mehr.
function TrendRow({
  matchId,
  homeName,
  awayName,
  awayFirst,
  className = "",
}: {
  matchId: string;
  homeName: string;
  awayName: string;
  awayFirst: boolean;
  className?: string;
}) {
  const { ready, stock, trendMatches, expertMatches, revealTrend, revealExpert } = useJokers();
  const { showToast } = useFeedback();
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [expert, setExpert] = useState<ExpertResult | null>(null);
  const [loading, setLoading] = useState<"trend" | "experte" | null>(null);
  const usedTrend = trendMatches.includes(matchId);
  const usedExpert = expertMatches.includes(matchId);

  // Schon bezahlt: beim Anzeigen kostenlos neu laden.
  useEffect(() => {
    let cancelled = false;
    if (usedExpert && !expert) {
      revealExpert(matchId).then((result) => {
        if (!cancelled && typeof result !== "string") setExpert(result);
      });
    } else if (usedTrend && !trend && !usedExpert) {
      revealTrend(matchId).then((result) => {
        if (!cancelled && typeof result !== "string") setTrend(result);
      });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usedTrend, usedExpert, matchId]);

  async function reveal(kind: "trend" | "experte") {
    if (loading) return;
    setLoading(kind);
    if (kind === "experte") {
      const result = await revealExpert(matchId);
      setLoading(null);
      if (typeof result === "string") showToast(`✗ ${result}`, "info");
      else setExpert(result);
    } else {
      const result = await revealTrend(matchId);
      setLoading(null);
      if (typeof result === "string") showToast(`✗ ${result}`, "info");
      else setTrend(result);
    }
  }

  if (!ready) return null;
  const showTrendButton = !expert && !trend && !usedExpert && (usedTrend || stock.trend > 0);
  const showExpertButton = !expert && (usedExpert || stock.experte > 0);
  const shownResult: TrendResult | null = expert ?? trend;
  if (!shownResult && !showTrendButton && !showExpertButton) return null;

  const pct = (n: number) => (shownResult && shownResult.tipps > 0 ? Math.round((n * 100) / shownResult.tipps) : 0);
  const parts: { label: string; value: number }[] = shownResult
    ? [
        { label: homeName, value: shownResult.heim },
        { label: "Remis", value: shownResult.remis },
        { label: awayName, value: shownResult.gast },
      ]
    : [];
  if (awayFirst) parts.reverse();
  const shown = parts.filter((p) => p.label !== "Remis" || p.value > 0);

  // Häufigstes Ergebnis der Top-Tipper, in derselben Reihenfolge wie die Teams.
  let topText: string | null = null;
  if (expert?.top) {
    if (expert.eins_x_zwei) {
      topText = expert.top.heim > 0 ? `Sieg ${homeName}` : expert.top.heim < 0 ? `Sieg ${awayName}` : "Remis";
    } else {
      topText = awayFirst ? `${expert.top.gast}:${expert.top.heim}` : `${expert.top.heim}:${expert.top.gast}`;
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {shownResult && (
        <div className={`rounded-lg border bg-pitch/60 px-4 py-2.5 ${expert ? "border-gold/40" : "border-edge"}`}>
          <p className="text-[11px] uppercase tracking-wide text-muted">
            {expert ? "🎓 Experten-Trend" : "📊 Trend der anderen"} ({shownResult.tipps}{" "}
            {shownResult.tipps === 1 ? "Tipp" : "Tipps"})
          </p>
          {shownResult.tipps === 0 ? (
            <p className="mt-1 text-xs text-muted">Noch hat niemand sonst getippt.</p>
          ) : (
            <div className={`mt-1 grid gap-1.5 text-center ${shown.length === 2 ? "grid-cols-2" : "grid-cols-3"}`}>
              {shown.map((p) => (
                <div key={p.label} className="min-w-0 rounded-md bg-surface/60 px-1 py-1">
                  <p className="font-display text-sm font-bold text-ink">{pct(p.value)}%</p>
                  <p className="text-[11px] leading-tight text-muted [overflow-wrap:anywhere]">{p.label}</p>
                </div>
              ))}
            </div>
          )}
          {expert && (
            <div className="mt-2 border-t border-edge pt-2">
              {expert.top && topText ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink">Die Top 30 % dieser Sportart tippen am öftesten</p>
                    <p className="text-[11px] text-muted">
                      {expert.top.anzahl} von {expert.top_tipper} Top-Tippern
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-display font-bold text-gold ${
                      expert.eins_x_zwei ? "max-w-[45%] text-right text-sm leading-tight" : "text-2xl"
                    }`}
                  >
                    {topText}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted">
                  Noch zu wenige Top-Tipper bei diesem Spiel ({expert.top_tipper} von mind. 3). Schau später nochmal, das
                  kostet nichts extra.{" "}
                  <button
                    type="button"
                    onClick={() => reveal("experte")}
                    disabled={!!loading}
                    className="font-semibold text-gold hover:underline"
                  >
                    Neu laden
                  </button>
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {showTrendButton && (
        <button
          onClick={() => reveal("trend")}
          disabled={!!loading || usedTrend}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-edge bg-pitch/60 px-4 py-2.5 text-left transition-colors hover:border-gold/40 disabled:cursor-wait"
        >
          <span className="whitespace-nowrap text-sm font-semibold text-ink">📊 Trend ansehen</span>
          <span className="min-w-0 text-right text-xs text-muted">
            {usedTrend || loading === "trend" ? "Wird geladen…" : `Trend-Joker ×${stock.trend}`}
          </span>
        </button>
      )}
      {showExpertButton && (
        <button
          onClick={() => reveal("experte")}
          disabled={!!loading || usedExpert}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-gold/40 bg-pitch/60 px-4 py-2.5 text-left transition-colors hover:border-gold/70 disabled:cursor-wait"
        >
          <span className="min-w-0 text-sm font-semibold text-ink">🎓 Experten-Trend ansehen</span>
          <span className="shrink-0 text-right text-xs text-muted">
            {usedExpert || loading === "experte" ? "Wird geladen…" : `Experten-Joker ×${stock.experte}`}
          </span>
        </button>
      )}
    </div>
  );
}

// Community-Tendenz ab Tippschluss (für alle, kostenlos): ein Balken, wie
// alle getippt haben – Heim / Remis / Gast in Anzeige-Reihenfolge. Nach dem
// Spiel leuchtet die richtige Tendenz grün, und bei Überraschungen (höchstens
// ein Viertel lag richtig) gibt es einen Hinweis. Vor Tippschluss bleibt die
// Verteilung geheim (dafür gibt es den Trend-Joker). Feste Farben, damit es
// auch im Herbst-Design (Knöpfe orange) klar grün/gold bleibt.
const TREND_GREEN = "#3FA66B";
const TREND_GOLD = "#E8B34C";
const TREND_GREY = "#55625B";

export function CommunityTrend({
  tendency,
  sport,
  order,
  homeName,
  awayName,
  finalScore,
  myTip,
}: {
  tendency: { home: number; draw: number; away: number };
  sport: string;
  order: TeamOrder;
  homeName: string;
  awayName: string;
  finalScore: { home: number; away: number } | null;
  myTip: { home: number; away: number } | null;
}) {
  const withDraw = sportAllowsDraw(sport);
  type Side = "home" | "draw" | "away";
  const counts: Record<Side, number> = { home: tendency.home, draw: withDraw ? tendency.draw : 0, away: tendency.away };
  const total = counts.home + counts.draw + counts.away;
  // Ab 2 Tipps, sonst stünde da nur "100 %".
  if (total < 2) return null;

  const sideOf = (h: number, a: number): Side => (h > a ? "home" : h < a ? "away" : "draw");
  const winner = finalScore ? sideOf(finalScore.home, finalScore.away) : null;
  const myCorrect = !!winner && !!myTip && sideOf(myTip.home, myTip.away) === winner;

  const [leftSide, rightSide] = displayOrder<Side>(order, "home", "away");
  const [leftName, rightName] = displayOrder(order, homeName, awayName);
  const parts: { side: Side; label: string; base: string }[] = [
    { side: leftSide, label: leftName, base: TREND_GREEN },
    ...(withDraw ? [{ side: "draw" as Side, label: "Remis", base: TREND_GREY }] : []),
    { side: rightSide, label: rightName, base: TREND_GOLD },
  ];
  const pct = (n: number) => Math.round((n * 100) / total);
  const color = (p: (typeof parts)[number]) => (winner ? (p.side === winner ? TREND_GREEN : TREND_GREY) : p.base);

  const correctCount = winner ? counts[winner] : 0;
  const surprise = !!winner && correctCount * 4 <= total;

  return (
    <div className="px-1">
      <p className="mb-1.5 text-xs font-semibold text-muted">
        So hat die Community getippt ({total.toLocaleString("de-DE")} Tipps)
      </p>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-pitch">
        {parts
          .filter((p) => counts[p.side] > 0)
          .map((p) => (
            <div key={p.side} style={{ width: `${(counts[p.side] * 100) / total}%`, backgroundColor: color(p) }} />
          ))}
      </div>
      <div className="mt-1.5 flex justify-between gap-2 text-xs text-muted">
        {parts.map((p, i) => (
          <span
            key={p.side}
            className={`min-w-0 ${i === 0 ? "text-left" : i === parts.length - 1 ? "text-right" : "text-center"}`}
          >
            <b className="text-ink">{pct(counts[p.side])} %</b> {p.label}
            {winner === p.side ? " ✓" : ""}
          </span>
        ))}
      </div>
      {winner && (
        <p className={`mt-1.5 text-center text-xs font-semibold ${surprise ? "text-gold" : "text-muted"}`}>
          {correctCount === 0
            ? "😲 Überraschung! Niemand lag richtig."
            : `${surprise ? "😲 Überraschung! Nur " : ""}${correctCount.toLocaleString("de-DE")} von ${total.toLocaleString("de-DE")} lagen richtig${myCorrect ? " – du auch." : "."}`}
        </p>
      )}
    </div>
  );
}

// Hauptfarbe des Trikots, das das Team in diesem Spiel trägt.
function wornColor(match: Match, team: Team): string {
  const j = jerseyFor(team, team.id === match.homeTeamId ? match.homeJersey : match.awayJersey);
  return j.variant === "auswaerts" ? team.awayPrimaryColor ?? team.secondaryColor : team.primaryColor;
}

// "#DC052D" / "#fff" -> "rgba(220, 5, 45, 0.3)". Unbekanntes Format: durchsichtig.
function hexAlpha(hex: string, alpha: number): string {
  let h = (hex ?? "").trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "transparent";
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// Bühne: wer schon getippt hat (Freunde und Mitspieler mit Bild), live über
// die Tipp-Zahl, die sich auf allen Geräten mitzählt.
function StageTippers({
  tippers,
  tipCount,
  myId,
  friendIds,
}: {
  tippers: MatchTipper[] | null;
  tipCount: number;
  myId: string | null;
  friendIds: string[];
}) {
  // Freunde zuerst, dann alle anderen (beides nach Namen).
  const others = (tippers ?? [])
    .filter((t) => t.userId !== myId)
    .sort((a, b) => Number(friendIds.includes(b.userId)) - Number(friendIds.includes(a.userId)));
  const meToo = !!tippers?.some((t) => t.userId === myId);
  if (tipCount === 0) {
    return <p className="mb-1 mt-3 text-center text-xs text-muted">Noch hat niemand getippt. Sei die oder der Erste!</p>;
  }
  if (!tippers) return <p className="mb-1 h-6" aria-hidden />;
  const names = others.slice(0, 2).map((t) => t.name);
  const rest = others.length - names.length;
  let text: string;
  if (others.length === 0) text = "Bisher hast nur du getippt.";
  else if (rest > 0) text = `${names.join(", ")} und ${rest} ${rest === 1 ? "anderer" : "andere"} haben schon getippt`;
  else if (names.length === 2) text = `${names[0]} und ${names[1]} haben schon getippt`;
  else text = `${names[0]} hat schon getippt`;
  if (meToo && others.length > 0) text += ", du auch";
  return (
    <div className="mb-1 mt-3 flex items-center justify-center gap-2 text-center text-xs text-muted">
      {others.length > 0 && (
        <span className="flex shrink-0">
          {others.slice(0, 4).map((t, i) => (
            <PlayerAvatar
              key={t.userId}
              id={t.userId}
              name={t.name}
              size={22}
              className={`border-2 border-surface ${i > 0 ? "-ml-2" : ""}`}
            />
          ))}
        </span>
      )}
      <span>{text}</span>
    </div>
  );
}
