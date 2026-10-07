"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Match, Sport, Team, SPORT_ICONS, sportLabel } from "@/lib/types";
import { TipResultTier, compareWithOthers, BOOSTER_STAKE, RANKING_BONUS_CAP, RANKING_POINTS, boosterPayouts, gutscheinPayouts } from "@/lib/poolScore";
import { MatchTipper, useMatchTips } from "@/lib/matchTips";
import { flagEmoji } from "@/lib/flags";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { TIP_JOKER_EFFECT, TIP_JOKER_LABEL, TipJoker, TrendResult, useJokers } from "@/lib/JokerContext";
import { useTaschen } from "@/lib/TaschenContext";
import { xpForLevel } from "@/lib/seasonPass";
import type { SeasonEmote } from "@/lib/seasons";
import { allowsDraw as sportAllowsDraw, displayOrder, isAwayFirst, oneXTwoText, pickNumber } from "@/lib/teamOrder";
import TeamBadge, { matchJerseyProps } from "./TeamBadge";
import PassHonorTags, { useOtherPlayersHonors } from "./PassHonors";
import { EmotePicker, MessageBody, StickerDraft, stickerFromText, stickerText } from "./Emotes";
import Countdown from "./Countdown";
import ScoreInput from "./ScoreInput";
import { CoinIcon } from "./CoinIcon";
import { TvIcon, PlayIcon, PeopleIcon, ChatIcon, ThumbUpIcon, TrashIcon } from "./Icons";
import { SeasonCardWatermark } from "./SeasonDeco";

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
  tipCount: number;
  myTip?: MyTip;
  // Darf ein Promise zurückgeben (Speichern in der Datenbank): Danach wird
  // der Knopf wieder frei, falls der Tipp nicht angenommen wurde.
  onSubmitTip: (homeScore: number, awayScore: number) => void | Promise<unknown>;
  // "Ändern": nimmt den Tipp bis Tippschluss zurück (auf allen Geräten),
  // danach ist die Karte wieder leer. true = zurückgenommen. Ohne diese
  // Funktion (z. B. auf Seiten ohne Speicher-Logik) gibt es keinen Knopf.
  onWithdrawTip?: () => Promise<boolean>;
  // Vom Start-Erlebnis vorgeschlagenes Spiel: kurz golden umrandet.
  highlight?: boolean;
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
  tipCount,
  myTip,
  onSubmitTip,
  onWithdrawTip,
  highlight = false,
}: MatchCardProps) {
  const isOneXTwo = match.tipMode === "1x2";
  // US-Sport: Gast links, Heim rechts ("Gast @ Heim"). NBA und NHL kennen
  // kein Unentschieden (Verlängerung bzw. Penaltyschießen bis zur
  // Entscheidung), NFL nur ganz selten.
  const isUsSport = isAwayFirst(match.sport);
  const [leftTeam, rightTeam] = displayOrder(match.sport, homeTeam, awayTeam);
  const allowsDraw = sportAllowsDraw(match.sport);
  const isCancelled = match.status === "cancelled";
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
  const [bonusPick, setBonusPick] = useState<number | null>(null);
  const myBonusAnswer = myBonusAnswers.find((a) => a.matchId === match.id);
  const { displayName, hasPremiumPass, passXP, passHonors, authUserId, freeStars, sessionChecked } = useUser();
  // Ohne Login wird nichts gespeichert: statt Tipp-Knopf und Kommentarfeld
  // gibt es den Weg zum Einloggen (erst wenn die Sitzung geprüft ist, sonst
  // blitzt der Knopf beim Laden auch bei eingeloggten Spielern kurz auf).
  const isGuest = sessionChecked && !authUserId;
  const { showToast, celebrate } = useFeedback();
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

  // Der PoolScore-"Reveal"-Moment: sobald der eigene Tipp ausgewertet wurde,
  // einmalig Konfetti + die narrierte Meldung als Toast zeigen (nicht bei
  // jedem Re-Render erneut).
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (myTip?.evaluated && !myTip.refunded && !celebratedRef.current) {
      celebratedRef.current = true;
      // Level 6 Premium: "Große goldene Sternenexplosion bei exaktem Tipp" –
      // ansonsten der normale (kleinere) Sterne-Burst.
      const bigBurst = myTip.resultTier === "exakt" && hasPremiumPass && passXP >= xpForLevel(6);
      celebrate(bigBurst);
      if (myTip.narration) {
        showToast(myTip.narration, myTip.resultTier === "falsch" ? "info" : "gold");
      }
    }
  }, [myTip?.evaluated, myTip?.refunded, myTip?.narration, myTip?.resultTier, hasPremiumPass, passXP, celebrate, showToast]);

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
  // Booster-Gutschein aus einer Trainingstasche: Die Datenbank löst ihn beim
  // nächsten Booster-Tipp von selbst ein, der Tipp kostet dann nichts.
  const { gutscheine } = useTaschen();
  const withGutschein = isBooster && !isGuest && gutscheine > 0;
  const notEnoughStars = isBooster && !withGutschein && freeStars < BOOSTER_STAKE;
  const notReady = missingPick || missingScore || notEnoughStars;
  const limit = scoreLimit[match.sport] ?? scoreLimit["Fußball"];
  // Echte Tipps aller Spieler: für die Liste und für den Vergleich nach der
  // Auswertung. Fremde Tipps (die Zahlen) erst nach Tippschluss zeigen.
  const { tippers, failed: tippersFailed } = useMatchTips(
    match.id,
    tippersOpen || !!myTip?.evaluated,
    // Auch der eigene Tipp zählt: nimmt man ihn zurück und tippt auf einem
    // anderen Gerät gleich neu, bleibt die Zahl gleich, die Liste nicht.
    `${tipCount}:${myTip ? `${myTip.predictedHomeScore}-${myTip.predictedAwayScore}` : "-"}`
  );
  const finalScore =
    match.status === "finished" && match.liveHomeScore !== null && match.liveAwayScore !== null
      ? { home: match.liveHomeScore, away: match.liveAwayScore }
      : null;
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

  // 1X2 mit Teamnamen statt "Heimsieg (1)": eindeutig, egal auf welcher
  // Seite das Heimteam steht. Gespeichert wird weiter 1:0 / 0:0 / 0:1.
  // Gleiche Reihenfolge wie die Teams darüber (bei US-Sport Gast-Sieg links).
  const [leftPick, rightPick] = displayOrder<OneXTwo>(match.sport, "1", "2");
  const oneXTwoOptions: OneXTwo[] =
    allowsDraw || nflPick === "X" ? [leftPick, "X", rightPick] : [leftPick, rightPick];

  // Intern "1" = Heimsieg, "2" = Auswärtssieg. Auf dem Knopf steht die
  // Nummer nach Position (links 1, rechts 2) mit dem Teamnamen darunter.
  function pickLabel(pick: OneXTwo) {
    const [h, a] = oneXTwoToScore(pick);
    return oneXTwoText(match.sport, h, a, homeTeam.name, awayTeam.name);
  }

  // Ohne Unentschieden (NBA, NHL) steht "Sieg" statt 1/2 – der Knopf sitzt
  // direkt unter dem Team, das gemeint ist.
  function pickButtonNumber(pick: OneXTwo) {
    if (pick === "X") return "X";
    if (!allowsDraw) return "Sieg";
    return pickNumber(match.sport, pick === "1" ? "home" : "away");
  }

  const needsWideMiddle = !showResultView && isOneXTwo && oneXTwoOptions.includes("X");

  // Zeile der Tipp-Kästen im Team-Raster (unter dem "Gleich geschlossen"-Hinweis).
  const tipRow = closingSoon ? "row-start-3" : "row-start-2";

  // Gleich großer Kasten wie die Ergebnis-Felder, sitzt im Team-Raster.
  function pickButton(option: OneXTwo) {
    return (
      <button
        key={option}
        // Nochmal antippen wählt wieder ab (vor dem Abgeben, löscht keinen Tipp).
        onClick={() => setNflPick((current) => (current === option ? null : option))}
        aria-label={pickLabel(option)}
        aria-pressed={nflPick === option}
        className={`flex h-12 w-[4.5rem] max-w-full items-center justify-center rounded-lg border text-center transition-colors ${
          nflPick === option
            ? "border-gold bg-gold/15 text-gold"
            : `border-edge bg-pitch hover:border-muted ${allowsDraw ? "text-ink" : "text-muted/70 hover:text-muted"}`
        }`}
      >
        {/* "Sieg" ruhiger als 1/X/2: kleiner, normale Stärke, gedämpft (gewählt: gold). */}
        <span
          className={
            allowsDraw
              ? "font-display text-xl font-bold leading-tight"
              : "text-base font-medium leading-tight"
          }
        >
          {pickButtonNumber(option)}
        </span>
      </button>
    );
  }

  // Ergebnis in Anzeige-Reihenfolge (bei US-Sport Gast : Heim).
  function formatScore(home: number, away: number) {
    const [left, right] = displayOrder(match.sport, home, away);
    return `${left} : ${right}`;
  }

  function formatTip(home: number, away: number) {
    return isOneXTwo ? pickLabel(scoreToOneXTwo(home, away)) : formatScore(home, away);
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

    Promise.resolve(onSubmitTip(h, a)).finally(() => {
      submittedRef.current = false;
      setSubmitting(false);
      // Nicht gespeichert: Karte bleibt offen, nichts zu verschieben.
      if (!hasTippedRef.current) keepInViewRef.current = false;
    });
  }

  const homeScoreInput = (
    <ScoreInput
      value={homeScore}
      onChange={setHomeScore}
      onClear={() => setHomeScore(null)}
      max={limit.max}
      label={`${limit.unit} ${homeTeam.name}`}
      className={scoreInputClass}
    />
  );
  const awayScoreInput = (
    <ScoreInput
      value={awayScore}
      onChange={setAwayScore}
      onClear={() => setAwayScore(null)}
      max={limit.max}
      label={`${limit.unit} ${awayTeam.name}`}
      className={scoreInputClass}
    />
  );

  return (
    <div
      ref={cardRef}
      id={`spiel-${match.id}`}
      className={`relative isolate flex h-full flex-col overflow-hidden match-card-rand rounded-card border bg-surface ${
        highlight ? "outline outline-2 outline-offset-2 outline-gold" : ""
      }`}
    >
      {/* Saison-Design: verblasstes Blatt hinter dem Karteninhalt. */}
      <SeasonCardWatermark variant={match.id.length + match.id.charCodeAt(match.id.length - 1)} />
      {/* Booster-Spiel: eigene goldene Leiste ganz oben, damit man es auch
          zwischen normalen Spielen (z. B. bei den geschlossenen) sofort sieht. */}
      {isBooster && (
        <div className="border-b border-gold/30 bg-gold/15 px-4 py-1 text-center font-display text-xs font-bold uppercase tracking-wider text-gold sm:px-5">
          ⚡ Booster-Spiel
        </div>
      )}
      {/* Sport-Banner (Spieltag steht unten bei der Anstoßzeit). Lange
          Wettbewerbsnamen wie "NHL Regular Season" brechen an Leerzeichen in
          eine zweite Zeile um statt abgeschnitten zu werden; der Countdown
          bleibt rechts daneben. */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-surface-hover to-surface px-4 py-2.5 sm:gap-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <span className="shrink-0 text-lg">{sportIcon[match.sport] ?? ""}</span>
          {!homeTeam.isNationalTeam && <span className="shrink-0">{flagEmoji(homeTeam.countryCode)}</span>}
          <span className="min-w-0 leading-tight">{match.competition}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs font-medium">
          {isCancelled ? (
            <span className="rounded-full border border-red-400/60 bg-red-400/10 px-2 py-0.5 font-semibold text-red-300">
              Abgesagt
            </span>
          ) : (
            <Countdown kickoff={match.tipDeadline} remind={!hasTipped} />
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex min-h-[1.75rem] flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[15px] text-muted">
          {match.matchday ? <span className="font-semibold text-ink/80">Spieltag {match.matchday}</span> : null}
          {match.matchday ? <span aria-hidden>·</span> : null}
          <span>{kickoffLabel}</span>
          {match.tvChannel && (
            <span className="flex items-center gap-1 rounded-full border border-edge bg-pitch px-2 py-0.5 text-[13px] font-semibold text-ink">
              <TvIcon className="h-3.5 w-3.5 text-muted" />
              {match.tvChannel}
            </span>
          )}
        </div>

        {/* Teams: Wappen über dem Namen, Namen dürfen umbrechen statt
            abgeschnitten zu werden. Zwei gleich breite Spalten + feste Mitte,
            damit die Namen auf allen Karten gleich viel Platz haben.
            Die 1/X/2-Kästen sitzen im selben Raster: links/rechts genau unter
            dem Team, X in der Kartenmitte (darf über die schmale Mitte
            hinausragen, braucht dafür eine feste Mitte). Ergebnis-Felder stehen
            als enges Paar mittig. Ohne X-Kasten ist die Mitte nur so breit wie
            "vs" bzw. der Endstand, dann haben die Namen mehr Platz. */}
        <div
          className={`mb-5 grid items-start gap-x-2 gap-y-4 sm:gap-x-3 ${
            needsWideMiddle ? "grid-cols-[1fr_1rem_1fr] sm:grid-cols-[1fr_1.5rem_1fr]" : "grid-cols-[1fr_auto_1fr]"
          }`}
        >
          <TeamColumn match={match} team={leftTeam} tag={isUsSport ? "Gast" : "Heim"} />
          {finalScore ? (
            // Beendet: oben zwischen den Teams steht direkt der Endstand
            // (unten in der Karte steht er nicht mehr extra).
            <div className="flex flex-col items-center pt-1">
              <span className="whitespace-nowrap font-display text-2xl font-bold leading-tight text-ink">
                {formatScore(finalScore.home, finalScore.away)}
              </span>
              <span className="text-[10px] uppercase tracking-wide text-muted">Endstand</span>
            </div>
          ) : (
            <span className="justify-self-center pt-3 font-display text-xs text-muted sm:text-sm">vs</span>
          )}
          <TeamColumn match={match} team={rightTeam} tag={isUsSport ? "Heim" : "Gast"} flip />

          {!showResultView && closingSoon && (
            <p className="col-span-3 row-start-2 -mb-1 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#FF9B5C]">
              <span aria-hidden>⏰</span> Gleich geschlossen – jetzt noch schnell tippen!
            </p>
          )}

          {!showResultView && (
            <>
              {isOneXTwo ? (
                <>
                  <div className={`col-start-1 flex justify-center ${tipRow}`}>{pickButton(leftPick)}</div>
                  {/* Die X-Zeile spannt über alle drei Spalten und liegt über den
                      Nachbarn. pointer-events-none, sonst fängt sie die Klicks
                      auf den linken Kasten ab (nur der X-Kasten selbst ist klickbar). */}
                  <div className={`pointer-events-none col-span-3 col-start-1 flex h-12 items-center justify-center ${tipRow}`}>
                    {oneXTwoOptions.includes("X") && <div className="pointer-events-auto">{pickButton("X")}</div>}
                  </div>
                  <div className={`col-start-3 flex justify-center ${tipRow}`}>{pickButton(rightPick)}</div>
                </>
              ) : (
                // Ergebnis-Tipp: beide Felder als enges Paar in der Kartenmitte.
                <div className={`col-span-3 col-start-1 flex items-center justify-center gap-3 ${tipRow}`}>
                  {isUsSport ? awayScoreInput : homeScoreInput}
                  <span className="font-display text-xl text-muted">:</span>
                  {isUsSport ? homeScoreInput : awayScoreInput}
                </div>
              )}
            </>
          )}
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

            {isBooster && (
              <div className="mb-3 rounded-lg border border-gold/40 bg-gold/[0.07] px-4 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">Dieser Tipp kostet</span>
                  {withGutschein ? (
                    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap font-display font-semibold text-gold">
                      <span className="flex items-center gap-1 text-sm text-muted line-through decoration-1">
                        <CoinIcon className="h-4 w-4" />
                        {BOOSTER_STAKE}
                      </span>
                      0 Coins
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 whitespace-nowrap font-display font-semibold text-gold">
                      <CoinIcon className="h-[18px] w-[18px]" />
                      {BOOSTER_STAKE} Coins
                    </span>
                  )}
                </div>
                {withGutschein && (
                  <p className="mt-1 text-xs text-muted">
                    🎟️ Dein Booster-Gutschein wird eingelöst
                    {gutscheine > 1 ? ` (du hast ${gutscheine})` : ""}. Daneben kostet der Tipp nichts.
                  </p>
                )}
                <p className="mt-2 text-[11px] uppercase tracking-wide text-muted">
                  {withGutschein ? "Coins: dein Gewinn" : "Coins: dein Gewinn oder Verlust"}
                </p>
                <PointsGrid items={withGutschein ? gutscheinPayouts(isOneXTwo) : boosterPayouts(isOneXTwo)} />
              </div>
            )}
            {/* Statt der Punkte-Tabelle nur ein kleiner Hinweis, die
                Punkteverteilung öffnet sich beim Antippen in einem Fenster.
                Nur der Booster (was der Tipp an Coins kostet, Gewinn oder
                Verlust) bleibt als goldene Box auf der Karte, der Hinweis
                steht immer direkt über dem Knopf. */}
            <div className="mb-4 flex justify-center">
              <PointsInfoButton isOneXTwo={isOneXTwo} allowsDraw={allowsDraw} isBooster={isBooster} />
            </div>

            {/* Knopf-Zustände klar unterscheidbar: tippbereit = kräftiges
                Grün mit Leuchten, noch nicht tippbereit = grau (vorher nur
                halb durchsichtig, sah aus wie "kaputt"). */}
            {isGuest ? (
              <Link
                href="/registrieren"
                className="block w-full rounded-full bg-action-hover py-2.5 text-center font-display text-base font-semibold tracking-wide text-pitch shadow-[0_0_22px_rgb(var(--c-action-hover)/0.45)] transition-all hover:brightness-110"
              >
                Zum Tippen einloggen
              </Link>
            ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting || notReady}
              className={`w-full rounded-full py-2.5 font-display font-semibold tracking-wide text-base transition-all ${
                notReady
                  ? "cursor-not-allowed border border-edge bg-edge text-muted"
                  : "bg-action-hover text-pitch shadow-[0_0_22px_rgb(var(--c-action-hover)/0.45)] enabled:hover:brightness-110 enabled:hover:shadow-[0_0_30px_rgb(var(--c-action-hover)/0.6)] disabled:cursor-wait"
              }`}
            >
              {submitting ? "Wird gespeichert…" : "Tipp abgeben"}
            </button>
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
            {hasTipped && (
              <div
                className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-pitch px-4 py-2.5"
              >
                <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm text-muted">
                  <span aria-hidden className="font-bold text-action-hover">✓</span>
                  Dein Tipp
                </span>
                <span className="flex min-w-0 items-center gap-3">
                  {isOneXTwo ? (
                    // Nummer groß, Teamname klein daneben – so bricht nur der
                    // Name um, nicht "1 (Boston" / "Bruins)". "Sieg" ist breiter
                    // als 1/2: dort steht der Name darunter, damit er Platz hat.
                    <span
                      className={`flex min-w-0 text-right ${
                        allowsDraw ? "items-center gap-2" : "flex-col items-end gap-0.5"
                      }`}
                    >
                      <span
                        className={
                          allowsDraw
                            ? "font-display text-lg font-bold leading-tight text-ink"
                            : "text-xs leading-tight text-muted/70"
                        }
                      >
                        {pickButtonNumber(scoreToOneXTwo(myTip!.predictedHomeScore, myTip!.predictedAwayScore))}
                      </span>
                      <span className={allowsDraw ? "text-xs leading-tight text-muted" : "text-sm leading-tight text-ink/85"}>
                        {(() => {
                          const pick = scoreToOneXTwo(myTip!.predictedHomeScore, myTip!.predictedAwayScore);
                          return pick === "1" ? homeTeam.name : pick === "2" ? awayTeam.name : "Unentschieden";
                        })()}
                      </span>
                    </span>
                  ) : (
                    <span className="text-right font-display font-semibold leading-tight text-ink">
                      {formatTip(myTip!.predictedHomeScore, myTip!.predictedAwayScore)}
                    </span>
                  )}
                  {canChangeTip && (
                    <button
                      onClick={withdrawMyTip}
                      disabled={withdrawing}
                      className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs font-semibold text-gold transition-colors hover:border-gold disabled:cursor-wait disabled:opacity-60"
                    >
                      {withdrawing ? "…" : "Ändern"}
                    </button>
                  )}
                </span>
              </div>
            )}

            {/* Noch nicht ausgewertet: kurz zeigen, was der Tipp bringen kann.
                Jedes Paar bleibt zusammen ("Tendenz +5" nie getrennt). */}
            {hasTipped && !myTip?.evaluated && !isCancelled && (
              <div className="flex justify-center">
                <PointsInfoButton isOneXTwo={isOneXTwo} allowsDraw={allowsDraw} isBooster={isBooster} />
              </div>
            )}

            {hasTipped && !myTip?.evaluated && !isCancelled && (
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
              <PoolScoreResultBox myTip={myTip!} comparison={comparison} isOneXTwo={isOneXTwo} />
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
            ) : (
              <ResultBox match={match} kickedOff={kickedOff} />
            )}
          </div>
        )}

        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-muted">
          {tipCount > 0 ? (
            <button
              onClick={() => setTippersOpen((current) => !current)}
              aria-expanded={tippersOpen}
              className="flex items-center gap-1 font-semibold text-muted transition-colors hover:text-ink"
            >
              <PeopleIcon className="h-3.5 w-3.5" />
              {tipCount.toLocaleString("de-DE")} getippt
              <span aria-hidden className="text-[10px]">{tippersOpen ? "▲" : "▼"}</span>
            </button>
          ) : (
            <span className="flex items-center gap-1">
              <PeopleIcon className="h-3.5 w-3.5" />0 getippt
            </span>
          )}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCommentsOpen((current) => !current)}
              className="flex items-center gap-1.5 font-semibold text-muted transition-colors hover:text-ink"
            >
              <ChatIcon className="h-3.5 w-3.5" />
              {matchComments.length === 0
                ? "Kommentieren"
                : `${matchComments.length} ${matchComments.length === 1 ? "Kommentar" : "Kommentare"}`}
            </button>
            {hasTipped && <span className="whitespace-nowrap text-sm font-black text-action-hover">✓ Getippt</span>}
          </div>
        </div>

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
                  const ownHonors = comment.userId && comment.userId === authUserId ? passHonors : null;
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

const TIER_LABEL: Record<TipResultTier, string> = {
  exakt: "🎯 Exakt getroffen!",
  differenz: "👍 Tordifferenz richtig",
  tendenz: "👍 Tendenz richtig",
  falsch: "😬 Daneben getippt",
};

const TIER_BOX_CLASS: Record<TipResultTier, string> = {
  exakt: "border-gold bg-gold/10",
  differenz: "border-action bg-action/10",
  tendenz: "border-action bg-action/10",
  falsch: "border-edge bg-pitch",
};

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
function PointsGrid({ items }: { items: { label: string; net: number }[] }) {
  return (
    <div className={`mt-1 grid gap-1.5 text-center ${items.length === 2 ? "grid-cols-2" : "grid-cols-4"}`}>
      {items.map((p) => (
        <div key={p.label} className="rounded-md bg-pitch/60 px-1 py-1">
          <div
            className={`font-display text-sm font-bold ${
              p.net > 0 ? "text-action" : p.net < 0 ? "text-[#FF9B5C]" : "text-ink"
            }`}
          >
            {p.net > 0 ? `+${p.net}` : p.net < 0 ? `−${-p.net}` : "±0"}
          </div>
          <div className="text-[11px] text-muted">{p.label}</div>
        </div>
      ))}
    </div>
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
}: {
  isOneXTwo: boolean;
  allowsDraw: boolean;
  isBooster: boolean;
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
        className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-1 py-0.5 text-xs font-semibold text-muted transition-colors hover:text-ink"
      >
        <span
          aria-hidden
          className="flex h-4 w-4 items-center justify-center rounded-full border border-current font-display text-[10px] font-bold leading-none"
        >
          i
        </span>
        Punkteverteilung
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

                {isBooster && (
                  <div className="mt-4 rounded-lg border border-gold/40 bg-gold/[0.07] px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">Booster-Einsatz</span>
                      <span className="flex items-center gap-1 font-display font-semibold text-gold">
                        <CoinIcon className="h-[18px] w-[18px]" />
                        {BOOSTER_STAKE}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] uppercase tracking-wide text-muted">Coins: dein Gewinn oder Verlust</p>
                    <PointsGrid items={boosterPayouts(isOneXTwo)} />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-full shrink-0 bg-gold py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90"
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

function PoolScoreResultBox({
  myTip,
  comparison,
  isOneXTwo,
}: {
  myTip: MyTip;
  comparison: { beaten: number; tied: number; ahead: number; total: number } | null;
  isOneXTwo: boolean;
}) {
  const tier = myTip.resultTier ?? "falsch";
  const rangDelta = myTip.rangDelta ?? 0;
  const calculated = myTip.rangCalculated ?? rangDelta;
  // Mit Gutschein war nichts bezahlt: daneben kostet der Tipp nichts
  // (supabase/trainingstaschen.sql gleicht das auf dem Konto aus).
  const starsDelta = myTip.gutschein ? Math.max(0, myTip.starsDelta ?? 0) : myTip.starsDelta ?? 0;
  // Gratis-Tipp (kein Einsatz): keine Sterne-Zeile, nur Rangpunkte.
  const hasStake = (myTip.stake ?? 0) > 0;
  const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");
  // Aufschlüsselung "Treffer + Bonus": im Rankingsystem immer, bei Tipps aus
  // dem früheren Punkte-Modell (Duelle) mit dessen Zahlen. Ganz alte Tipps
  // zeigen weiter den einfachen Vergleich mit den Mitspielern.
  const oldDuelOpponents = (myTip.duelsWon ?? 0) + (myTip.duelsDrawn ?? 0) + (myTip.duelsLost ?? 0);
  const breakdown = myTip.rankingScored
    ? {
        fixed: myTip.basePoints ?? rangDelta,
        bonus: myTip.bonusPoints ?? 0,
        beaten: myTip.beaten ?? 0,
        opponents: myTip.opponents ?? 0,
      }
    : myTip.duelPoints !== undefined && !myTip.scoredWithoutDuels && oldDuelOpponents > 0
    ? { fixed: myTip.basePoints ?? rangDelta, bonus: myTip.duelPoints, beaten: myTip.duelsWon ?? 0, opponents: oldDuelOpponents }
    : null;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${TIER_BOX_CLASS[tier]}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="whitespace-nowrap font-display text-sm font-semibold text-ink">
          {isOneXTwo && tier === "tendenz" ? "👍 Richtig getippt" : TIER_LABEL[tier]}
        </span>
        {/* Minus bewusst sachlich in Grau statt Rot: ein einzelner Tipp
            ist nur ein Baustein, zählt wird die Woche und die Saison. */}
        <span
          className={`shrink-0 whitespace-nowrap font-display text-base font-bold ${
            myTip.rankingLegacy ? "text-muted line-through" : rangDelta >= 0 ? "text-action" : "text-muted"
          }`}
        >
          {signed(rangDelta)} <span className="text-xs font-semibold">Rangpunkte</span>
        </span>
      </div>
      {myTip.rankingLegacy && (
        <span className="text-xs text-muted">Vor dem Neustart der Rangpunkte gewertet, zählt nicht mehr.</span>
      )}
      {breakdown && (
        <div className="flex flex-col gap-0.5 text-xs text-muted">
          <span>
            Treffer {signed(breakdown.fixed)}
            {breakdown.opponents > 0 && <> · Bonus {signed(breakdown.bonus)}</>}
          </span>
          {breakdown.opponents > 0 ? (
            <span>
              Gegen {breakdown.beaten} von {breakdown.opponents}{" "}
              {breakdown.opponents === 1 ? "Mittipper" : "Mittippern"} durchgesetzt
            </span>
          ) : (
            <span>Außer dir hat niemand getippt, darum kein Bonus.</span>
          )}
          {myTip.joker && (
            <span>
              {JOKER_LABEL[myTip.joker]} eingesetzt
              {breakdown.fixed + breakdown.bonus < calculated ? ": kein Minus" : ""}
            </span>
          )}
          {calculated !== rangDelta && (
            <span>
              Gerechnet {signed(calculated)}. Rangpunkte fallen nie unter 0, darum{" "}
              {rangDelta === 0 ? "wurde nichts abgezogen" : `nur ${-rangDelta} abgezogen`}.
            </span>
          )}
        </div>
      )}
      {(hasStake || (!breakdown && comparison)) && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          {hasStake && (
            <span className={`flex items-center gap-1 font-semibold ${starsDelta >= 0 ? "text-gold" : "text-red-400"}`}>
              <CoinIcon className="h-4 w-4" />
              {starsDelta >= 0 ? "+" : ""}
              {starsDelta} Coins
              {myTip.gutschein && <span className="font-normal text-muted"> · mit Gutschein</span>}
            </span>
          )}
          {!breakdown &&
            comparison &&
            (comparison.total === 0 ? (
              <span>Außer dir hat niemand getippt.</span>
            ) : (
              <span>
                Besser als {comparison.beaten} von {comparison.total}{" "}
                {comparison.total === 1 ? "Mitspieler" : "Mitspielern"} (
                {Math.round((comparison.beaten / comparison.total) * 100)} %)
                {comparison.tied > 0 ? `, gleich gut wie ${comparison.tied}` : ""}.
              </span>
            ))}
        </div>
      )}
      {breakdown && breakdown.opponents > 0 && (
        <p className="border-t border-edge/60 pt-2 text-[11px] leading-snug text-muted">
          Bonus: Bessere zu schlagen bringt doppelt, gegen Schwächere zu verlieren kostet doppelt.
        </p>
      )}
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

function ResultBox({ match, kickedOff }: { match: Match; kickedOff: boolean }) {
  if (match.status === "live") {
    // Nur der echte Spielstand – es gibt keinen Ereignis-Feed. Früher
    // wurden hier Tore und Karten per Zufall erfunden.
    return (
      <div className="flex items-center justify-center gap-3 rounded-lg border border-action bg-action/10 px-4 py-3">
        <span className="flex h-2 w-2 animate-pulse rounded-full bg-action" />
        <span className="font-display text-sm font-semibold text-action">LIVE</span>
        <span className="font-display text-xl font-bold text-ink">
          {displayOrder(match.sport, match.liveHomeScore ?? 0, match.liveAwayScore ?? 0).join(" : ")}
        </span>
      </div>
    );
  }

  if (match.status === "finished") {
    // Der Endstand steht oben zwischen den Teams; hier bleibt nur noch der
    // Link zur Zusammenfassung (falls es einen gibt).
    if (!match.summaryVideoUrl) return null;
    return (
      <div className="flex flex-col items-center">
        <a
          href={match.summaryVideoUrl}
          target="_blank"
          rel="noreferrer"
          className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF0000]/15 px-4 py-2 font-display text-sm font-semibold text-[#FF4d4d] shadow-[0_0_16px_rgba(255,0,0,0.15)] transition-all hover:bg-[#FF0000]/25 hover:shadow-[0_0_22px_rgba(255,0,0,0.3)]"
        >
          <PlayIcon className="h-4 w-4" />
          Zusammenfassung ansehen
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center rounded-lg border border-edge bg-pitch px-4 py-3">
      <span className="text-sm text-muted">
        {kickedOff ? "Spiel läuft – Ergebnis folgt" : "Spiel hat noch nicht begonnen"}
      </span>
    </div>
  );
}

// Teamnamen brechen nur an Leerzeichen um, nie mitten im Wort (kein
// "Le-/verkusen"). Passt ein langes Einzelwort wie "Mönchengladbach" nicht in
// die Spalte, wird die Schrift schrittweise verkleinert, bis es passt.
function TeamColumn({ match, team, tag, flip = false }: { match: Match; team: Team; tag: string | null; flip?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1.5 self-stretch">
      <TeamBadge
        sport={match.sport}
        {...matchJerseyProps(match, team)}
        isNationalTeam={team.isNationalTeam}
        countryCode={team.countryCode}
        flip={flip}
        size={44}
      />
      {/* HEIM/GAST direkt unter dem Wappen: steht so bei beiden Teams auf
          gleicher Höhe, auch wenn ein Name zweizeilig ist. */}
      {tag && <SideTag>{tag}</SideTag>}
      <TeamLabel name={team.name} />
    </div>
  );
}

function SideTag({ children }: { children: string }) {
  return (
    <span className="rounded-full border border-edge px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-muted">
      {children}
    </span>
  );
}

function TeamLabel({ name }: { name: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth && size > 11) {
        size -= 0.5;
        el.style.fontSize = `${size}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(el.parentElement ?? el);
    return () => observer.disconnect();
  }, [name]);

  return (
    <span
      ref={ref}
      className="flex min-h-[2.5em] w-full items-start justify-center text-center font-display text-base font-semibold leading-tight text-ink [hyphens:manual] [overflow-wrap:normal] sm:text-lg"
    >
      {name}
    </span>
  );
}

const scoreInputClass =
  "h-12 w-[4.5rem] max-w-full rounded-lg border border-edge bg-pitch text-center font-display text-xl font-bold text-ink outline-none focus:border-gold disabled:opacity-60";

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
          <span className="text-sm font-semibold text-ink">🃏 {TIP_JOKER_LABEL[joker]}</span>
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
            className="whitespace-nowrap rounded-full border border-gold/40 bg-gold/[0.07] px-1 py-1 text-xs font-semibold text-gold transition-colors hover:border-gold disabled:cursor-wait"
          >
            {TIP_JOKER_LABEL[j].replace("-Joker", "")}
            <span className="ml-0.5 text-muted">×{stock[j]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Trend-Joker: wie haben die anderen bisher getippt? Nur sichtbar, wenn man
// einen Trend-Joker hat oder ihn für dieses Spiel schon eingesetzt hat.
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
  const { ready, stock, trendMatches, revealTrend } = useJokers();
  const { showToast } = useFeedback();
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [loading, setLoading] = useState(false);
  const used = trendMatches.includes(matchId);

  // Schon bezahlt: Verteilung beim Anzeigen kostenlos neu laden.
  useEffect(() => {
    if (!used || trend) return;
    let cancelled = false;
    revealTrend(matchId).then((result) => {
      if (!cancelled && typeof result !== "string") setTrend(result);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [used, matchId]);

  async function reveal() {
    if (loading) return;
    setLoading(true);
    const result = await revealTrend(matchId);
    setLoading(false);
    if (typeof result === "string") showToast(`✗ ${result}`, "info");
    else setTrend(result);
  }

  if (!ready || (!used && stock.trend === 0)) return null;

  if (!trend) {
    return (
      <button
        onClick={reveal}
        disabled={loading || used}
        className={`flex w-full items-center justify-between gap-3 rounded-lg border border-edge bg-pitch/60 px-4 py-2.5 text-left transition-colors hover:border-gold/40 disabled:cursor-wait ${className}`}
      >
        <span className="whitespace-nowrap text-sm font-semibold text-ink">📊 Trend ansehen</span>
        <span className="min-w-0 text-right text-xs text-muted">
          {used ? "Wird geladen…" : `Trend-Joker ×${stock.trend}`}
        </span>
      </button>
    );
  }

  const pct = (n: number) => (trend.tipps > 0 ? Math.round((n * 100) / trend.tipps) : 0);
  const parts = [
    { label: homeName, value: trend.heim },
    { label: "Remis", value: trend.remis },
    { label: awayName, value: trend.gast },
  ];
  if (awayFirst) parts.reverse();
  const shown = parts.filter((p) => p.label !== "Remis" || p.value > 0);

  return (
    <div className={`rounded-lg border border-edge bg-pitch/60 px-4 py-2.5 ${className}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted">
        📊 Trend der anderen ({trend.tipps} {trend.tipps === 1 ? "Tipp" : "Tipps"})
      </p>
      {trend.tipps === 0 ? (
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
    </div>
  );
}
