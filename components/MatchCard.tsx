"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { Match, Team } from "@/lib/types";
import { TipResultTier, compareWithOthers } from "@/lib/poolScore";
import { MatchTipper, useMatchTips } from "@/lib/matchTips";
import { flagEmoji } from "@/lib/flags";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { xpForLevel } from "@/lib/seasonPass";
import TeamBadge from "./TeamBadge";
import PassHonorTags, { useOtherPlayersHonors } from "./PassHonors";
import { EmotePicker, MessageBody, stickerFromText, stickerText } from "./Emotes";
import Countdown from "./Countdown";
import ScoreInput from "./ScoreInput";
import { StarIcon, TvIcon, PlayIcon, PeopleIcon, ChatIcon, ThumbUpIcon, TrashIcon } from "./Icons";
import { SeasonCardWatermark } from "./SeasonDeco";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

// Ergebnis-Tipp: Höchstwert und Beschriftung je Sportart (vorher überall
// "Tor-Ergebnis" bis 20 – bei Basketball wurde aus 112 einfach 20).
const scoreLimit: Record<string, { max: number; unit: string }> = {
  "Fußball": { max: 20, unit: "Tore" },
  NHL: { max: 20, unit: "Tore" },
  NFL: { max: 99, unit: "Punkte" },
  NBA: { max: 199, unit: "Punkte" },
};

interface MyTip {
  predictedHomeScore: number;
  predictedAwayScore: number;
  // PoolScore-Auswertung – siehe lib/poolScore.ts. Erst gesetzt, sobald das
  // Spiel beendet und der Tipp ausgewertet wurde.
  evaluated?: boolean;
  resultTier?: TipResultTier;
  rangDelta?: number;
  starsDelta?: number;
  narration?: string;
  stake?: number;
  // Spiel abgesagt, Einsatz kam zurück (keine Wertung).
  refunded?: boolean;
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
  // Abgegebenen Tipp bis Tippschluss korrigieren. Ohne diese Funktion
  // (z. B. auf Seiten ohne Speicher-Logik) gibt es keinen "Ändern"-Knopf.
  onChangeTip?: (homeScore: number, awayScore: number) => void;
}

// NFL wird nur per 1X2 (Heimsieg / Unentschieden / Auswärtssieg) getippt,
// nicht per genauem Ergebnis. Codierung als Score-Paar, damit der bestehende
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

const ONE_X_TWO_LABEL: Record<OneXTwo, string> = {
  "1": "Heimsieg (1)",
  X: "Unentschieden (X)",
  "2": "Auswärtssieg (2)",
};

export default function MatchCard({
  match,
  homeTeam,
  awayTeam,
  tipCount,
  myTip,
  onSubmitTip,
  onChangeTip,
}: MatchCardProps) {
  const isOneXTwo = match.tipMode === "1x2";
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
  // Tipp wird gerade korrigiert: Formular wieder offen, mit dem alten Tipp
  // vorausgefüllt. Der Einsatz ist schon bezahlt und wird nicht nochmal
  // abgezogen.
  const [changingTip, setChangingTip] = useState(false);
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
  const { displayName, hasPremiumPass, passXP, passHonors, authUserId, freeStars, stakeBudgetRemainingToday } = useUser();
  const { showToast, celebrate } = useFeedback();
  const [commentsOpen, setCommentsOpen] = useState(false);
  // Liste "Wer hat getippt?" unter der Karte (Klick auf "X getippt").
  const [tippersOpen, setTippersOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
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
    if (!commentDraft.trim() || commentSubmittedRef.current) return;
    // Sticker-Code von Hand eingetippt, ohne den Sticker zu besitzen: nicht senden.
    const typedSticker = stickerFromText(commentDraft);
    if (typedSticker && !passHonors.emotes.some((em) => em.id === typedSticker.id)) return;
    commentSubmittedRef.current = true;
    addComment(match.id, displayName, commentDraft);
    setCommentDraft("");
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
  const canChangeTip = hasTipped && !tippingClosed && !isCancelled && !myTip?.evaluated && !!onChangeTip;
  const isChanging = changingTip && canChangeTip;
  const showResultView = (hasTipped && !isChanging) || tippingClosed || isCancelled;
  // 1X2-Spiel ohne Auswahl: Knopf ist noch gesperrt.
  const missingPick = isOneXTwo && !nflPick;
  // Ergebnis-Tipp mit leerem Feld: Knopf ebenfalls gesperrt.
  const missingScore = !isOneXTwo && (homeScore === null || awayScore === null);
  const notReady = missingPick || missingScore;
  const limit = scoreLimit[match.sport] ?? scoreLimit["Fußball"];
  // Was beim Abgeben wirklich abgezogen würde (gleiche Rechnung wie
  // spendStars): weniger als der Einsatz, wenn Guthaben oder Tageslimit
  // nicht reichen. Vorher erfuhr man das erst im Toast nach dem Abgeben.
  const possibleStake = Math.max(0, Math.min(match.fixedStake, freeStars, stakeBudgetRemainingToday));
  const stakeReduced = possibleStake < match.fixedStake;
  // Echte Tipps aller Spieler: für die Liste und für den Vergleich nach der
  // Auswertung. Fremde Tipps (die Zahlen) erst nach Tippschluss zeigen.
  const { tippers, failed: tippersFailed } = useMatchTips(
    match.id,
    tippersOpen || !!myTip?.evaluated,
    tipCount
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
            .map((t) => ({ predictedHome: t.predictedHome, predictedAway: t.predictedAway })),
          finalScore.home,
          finalScore.away,
          isOneXTwo
        )
      : null;

  function formatTip(home: number, away: number) {
    return isOneXTwo ? ONE_X_TWO_LABEL[scoreToOneXTwo(home, away)] : `${home} : ${away}`;
  }

  function startChangingTip() {
    if (!myTip) return;
    setHomeScore(myTip.predictedHomeScore);
    setAwayScore(myTip.predictedAwayScore);
    setNflPick(scoreToOneXTwo(myTip.predictedHomeScore, myTip.predictedAwayScore));
    submittedRef.current = false;
    setSubmitting(false);
    setChangingTip(true);
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

    if (isChanging) {
      onChangeTip?.(h, a);
      setChangingTip(false);
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }
    Promise.resolve(onSubmitTip(h, a)).finally(() => {
      submittedRef.current = false;
      setSubmitting(false);
    });
  }

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden match-card-rand rounded-card border bg-surface">
      {/* Saison-Design: verblasstes Blatt hinter dem Karteninhalt. */}
      <SeasonCardWatermark variant={match.id.length + match.id.charCodeAt(match.id.length - 1)} />
      {/* Sport-Banner – immer genau eine Zeile (Spieltag steht unten bei der
          Anstoßzeit), damit alle Karten gleich hohe Köpfe haben. */}
      <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-surface-hover to-surface px-4 py-2.5 sm:gap-3 sm:px-5">
        <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-ink">
          <span className="shrink-0 text-lg">{sportIcon[match.sport] ?? ""}</span>
          {!homeTeam.isNationalTeam && <span className="shrink-0">{flagEmoji(homeTeam.countryCode)}</span>}
          <span className="truncate">{match.competition}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-xs font-medium">
          {isCancelled ? (
            <span className="rounded-full border border-red-400/60 bg-red-400/10 px-2 py-0.5 font-semibold text-red-300">
              Abgesagt
            </span>
          ) : (
            <Countdown kickoff={match.tipDeadline} />
          )}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-muted">
          {match.matchday ? <span className="font-semibold text-ink/80">Spieltag {match.matchday}</span> : null}
          {match.matchday ? <span aria-hidden>·</span> : null}
          <span>{kickoffLabel}</span>
          {match.tvChannel && (
            <span className="flex items-center gap-1 rounded-full border border-edge bg-pitch px-2 py-0.5 text-[11px] font-semibold text-ink">
              <TvIcon className="h-3 w-3 text-muted" />
              {match.tvChannel}
            </span>
          )}
        </div>

        {/* Teams: Wappen über dem Namen, Namen dürfen umbrechen statt
            abgeschnitten zu werden. Zwei gleich breite Spalten + "vs" in der
            Mitte, Platz für zwei Zeilen reserviert -> alle Karten gleich hoch. */}
        <div className="mb-5 grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-3">
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <TeamBadge
              sport={match.sport}
              primaryColor={homeTeam.primaryColor}
              secondaryColor={homeTeam.secondaryColor}
              jerseyStyle={homeTeam.jerseyStyle}
              isNationalTeam={homeTeam.isNationalTeam}
              countryCode={homeTeam.countryCode}
              size={34}
            />
            <TeamLabel name={homeTeam.name} />
          </div>
          <span className="pt-2 font-display text-xs text-muted sm:text-sm">vs</span>
          <div className="flex min-w-0 flex-col items-center gap-1.5">
            <TeamBadge
              sport={match.sport}
              primaryColor={awayTeam.primaryColor}
              secondaryColor={awayTeam.secondaryColor}
              jerseyStyle={awayTeam.jerseyStyle}
              isNationalTeam={awayTeam.isNationalTeam}
              countryCode={awayTeam.countryCode}
              flip
              size={34}
            />
            <TeamLabel name={awayTeam.name} />
          </div>
        </div>

        {!showResultView && (
          <>
            {closingSoon && (
              <p className="mb-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-[#FF9B5C]">
                <span aria-hidden>⏰</span> Gleich geschlossen – jetzt noch schnell tippen!
              </p>
            )}
            {isOneXTwo && (
              <p className="mb-2 text-center text-xs text-muted">Wer gewinnt? Heimsieg (1), Unentschieden (X) oder Auswärtssieg (2)</p>
            )}
            {isOneXTwo ? (
              <div className="mb-5 flex items-center justify-center gap-2">
                {(["1", "X", "2"] as OneXTwo[]).map((option) => (
                  <button
                    key={option}
                    onClick={() => setNflPick(option)}
                    aria-label={ONE_X_TWO_LABEL[option]}
                    className={`flex h-12 w-16 flex-col items-center justify-center rounded-lg border font-display text-lg font-bold transition-colors ${
                      nflPick === option
                        ? "border-gold bg-gold/15 text-gold"
                        : "border-edge bg-pitch text-ink hover:border-muted"
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mb-5 flex items-center justify-center gap-3">
                <ScoreInput
                  value={homeScore}
                  onChange={setHomeScore}
                  onClear={() => setHomeScore(null)}
                  max={limit.max}
                  label={`${limit.unit} ${homeTeam.name}`}
                  className={scoreInputClass}
                />
                <span className="font-display text-xl text-muted">:</span>
                <ScoreInput
                  value={awayScore}
                  onChange={setAwayScore}
                  onClear={() => setAwayScore(null)}
                  max={limit.max}
                  label={`${limit.unit} ${awayTeam.name}`}
                  className={scoreInputClass}
                />
              </div>
            )}

            {match.bonusQuestion && (
              <div className="mb-5 rounded-lg border border-gold/30 bg-gold/5 px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <span aria-hidden>🎁</span> {match.bonusQuestion.question}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-gold">
                    +{match.bonusQuestion.bonusStars} Sterne
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

            {isChanging ? (
              <p className="mb-5 rounded-lg border border-edge bg-pitch px-4 py-2.5 text-center text-sm text-muted">
                Einsatz schon bezahlt – beim Ändern werden keine Sterne abgezogen.
              </p>
            ) : (
              <div className="mb-5 rounded-lg border border-edge bg-pitch px-4 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">Einsatz für dieses Spiel</span>
                  <span className="flex items-center gap-1 font-display font-semibold text-gold">
                    <StarIcon className="h-4 w-4" />
                    {stakeReduced && (
                      <span className="mr-1 text-sm font-normal text-muted line-through">
                        {match.fixedStake.toLocaleString("de-DE")}
                      </span>
                    )}
                    {possibleStake.toLocaleString("de-DE")}
                  </span>
                </div>
                {stakeReduced && (
                  <p className="mt-1 text-xs text-[#FF9B5C]">
                    {freeStars < match.fixedStake ? "Nicht genug Sterne" : "Tageslimit für Einsätze erreicht"}
                    {possibleStake === 0 ? " – du tippst ohne Einsatz." : " – du tippst mit weniger Einsatz."}
                  </p>
                )}
              </div>
            )}

            {/* Knopf-Zustände klar unterscheidbar: tippbereit = kräftiges
                Grün mit Leuchten, noch nicht tippbereit = grau mit Grund
                darunter (vorher nur halb durchsichtig, sah aus wie "kaputt"). */}
            <button
              onClick={handleSubmit}
              disabled={submitting || notReady}
              className={`w-full rounded-full py-2.5 font-display font-semibold tracking-wide text-base transition-all ${
                notReady
                  ? "cursor-not-allowed border border-edge bg-edge text-muted"
                  : "bg-action-hover text-pitch shadow-[0_0_22px_rgb(var(--c-action-hover)/0.45)] enabled:hover:brightness-110 enabled:hover:shadow-[0_0_30px_rgb(var(--c-action-hover)/0.6)] disabled:cursor-wait"
              }`}
            >
              {submitting ? "Wird gespeichert…" : isChanging ? "Änderung speichern" : "Tipp abgeben"}
            </button>
            {missingPick && (
              <p className="mt-2 text-center text-xs text-muted">Erst oben 1, X oder 2 antippen</p>
            )}
            {missingScore && (
              <p className="mt-2 text-center text-xs text-muted">Erst oben beide Ergebnisse eintragen</p>
            )}
            {isChanging && (
              <button
                onClick={() => setChangingTip(false)}
                className="mt-2 w-full rounded-full py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Abbrechen
              </button>
            )}
          </>
        )}

        {showResultView && (
          <div className="flex flex-col gap-3">
            {hasTipped && (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-edge bg-pitch px-4 py-2.5">
                <span className="flex items-center gap-1.5 text-sm text-muted">
                  <span aria-hidden className="font-bold text-action-hover">✓</span>
                  Dein Tipp
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display font-semibold text-ink">
                    {isOneXTwo
                      ? ONE_X_TWO_LABEL[
                          scoreToOneXTwo(myTip!.predictedHomeScore, myTip!.predictedAwayScore)
                        ]
                      : `${myTip!.predictedHomeScore} : ${myTip!.predictedAwayScore}`}
                  </span>
                  {canChangeTip && (
                    <button
                      onClick={startChangingTip}
                      className="shrink-0 rounded-full border border-edge px-3 py-1 text-xs font-semibold text-gold transition-colors hover:border-gold"
                    >
                      Ändern
                    </button>
                  )}
                </span>
              </div>
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
              <CancelledBox stake={hasTipped ? myTip!.stake ?? 0 : null} />
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
            {hasTipped && <span className="font-semibold text-action">✓ Getippt</span>}
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
                          className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
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
            <form onSubmit={handleCommentSubmit} className="flex gap-2">
              <EmotePicker
                onInsertEmoji={(emoji) => setCommentDraft((d) => d + emoji)}
                onSendSticker={(emote) => addComment(match.id, displayName, stickerText(emote))}
              />
              <input
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Kommentar schreiben…"
                className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
              <button
                type="submit"
                aria-label="Kommentar senden"
                className="rounded-lg bg-action px-3 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
              >
                ➤
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

const TIER_LABEL: Record<TipResultTier, string> = {
  exakt: "🎯 Exakt getroffen!",
  tendenz: "👍 Tendenz richtig",
  falsch: "😬 Daneben getippt",
};

const TIER_BOX_CLASS: Record<TipResultTier, string> = {
  exakt: "border-gold bg-gold/10",
  tendenz: "border-action bg-action/10",
  falsch: "border-edge bg-pitch",
};

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
                {showTips && (
                  <span className="shrink-0 font-display text-sm font-semibold text-ink">
                    {formatTip(t.predictedHome, t.predictedAway)}
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
  const starsDelta = myTip.starsDelta ?? 0;

  return (
    <div className={`flex flex-col gap-2 rounded-lg border px-4 py-3 ${TIER_BOX_CLASS[tier]}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink">
          {isOneXTwo && tier === "tendenz" ? "👍 Richtig getippt" : TIER_LABEL[tier]}
        </span>
        <span
          className={`font-display text-sm font-bold ${rangDelta >= 0 ? "text-action" : "text-red-400"}`}
        >
          {rangDelta >= 0 ? "+" : ""}
          {rangDelta} Rangpunkte
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className={`flex items-center gap-1 font-semibold ${starsDelta >= 0 ? "text-gold" : "text-red-400"}`}>
          <StarIcon className="h-3.5 w-3.5" />
          {starsDelta >= 0 ? "+" : ""}
          {starsDelta} Sterne
        </span>
        {comparison &&
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
    </div>
  );
}

function CancelledBox({ stake }: { stake: number | null }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-red-400/50 bg-red-400/10 px-4 py-3 text-center">
      <span className="font-display text-sm font-semibold text-red-300">🚫 Spiel abgesagt</span>
      <span className="text-xs text-muted">
        {stake === null
          ? "Dieses Spiel wird nicht gewertet."
          : stake > 0
          ? `Dein Einsatz von ${stake.toLocaleString("de-DE")} Sternen ist zurück auf deinem Konto.`
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
          {match.liveHomeScore ?? 0} : {match.liveAwayScore ?? 0}
        </span>
      </div>
    );
  }

  if (match.status === "finished") {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-edge bg-pitch px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted">Endstand</span>
          <span className="font-display text-xl font-bold text-ink">
            {match.liveHomeScore ?? 0} : {match.liveAwayScore ?? 0}
          </span>
        </div>
        {match.summaryVideoUrl && (
          <a
            href={match.summaryVideoUrl}
            target="_blank"
            rel="noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-[#FF0000]/15 px-4 py-2 font-display text-sm font-semibold text-[#FF4d4d] shadow-[0_0_16px_rgba(255,0,0,0.15)] transition-all hover:bg-[#FF0000]/25 hover:shadow-[0_0_22px_rgba(255,0,0,0.3)]"
          >
            <PlayIcon className="h-4 w-4" />
            Zusammenfassung ansehen
          </a>
        )}
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
  "h-12 w-14 rounded-lg border border-edge bg-pitch text-center font-display text-xl font-semibold text-ink outline-none focus:border-gold disabled:opacity-60";
