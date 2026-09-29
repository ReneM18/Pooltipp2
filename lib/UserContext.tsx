"use client";

import { createContext, useContext, useState, ReactNode, useMemo, useEffect } from "react";
import { mockUser } from "@/lib/mockData";
import { getAvailableRankIcons, getBestRankIcon, RankIconOption } from "@/lib/rankTiers";
import { PhotoVisibility } from "@/lib/mockUsers";
import { useAppData } from "@/lib/AppDataContext";
import { Sport, SPORTS } from "@/lib/types";
import { mockLeaderboardBySport } from "@/lib/mockLeaderboard";
import {
  evaluatePoolScore,
  TIER_ORDER,
  daysBetween,
  applyInactivityDecay,
  INACTIVITY_GRACE_DAYS,
  DAILY_BONUS_STARS,
  DAILY_BONUS_XP,
  DAILY_STAKE_BUDGET,
  RESCUE_BONUS_STARS,
  LOW_STARS_THRESHOLD,
  STREAK_MILESTONES,
} from "@/lib/poolScore";

const SPORT_ICON: Record<Sport, string> = { "Fußball": "⚽", NFL: "🏈", NBA: "🏀", NHL: "🏒" };

// Preis des fiktiven Werbefrei-Abos (kein echtes Zahlungssystem, siehe
// buyAdFreeSubscription unten) – analog zu PREMIUM_PASS_PRICE in passLevels.ts.
export const AD_FREE_PRICE = "2,99 € / Monat";

function initialRangPunkte(): Record<Sport, number> {
  const initial = {} as Record<Sport, number>;
  for (const sport of SPORTS) {
    initial[sport] = mockLeaderboardBySport[sport].find((e) => e.isCurrentUser)?.points ?? 0;
  }
  return initial;
}

function isSameDay(aIso: string, bIso: string): boolean {
  return new Date(aIso).toDateString() === new Date(bIso).toDateString();
}

// Stabile, sitzungsweite Kennung des aktuellen Users – bleibt gleich, auch
// wenn der Anzeigename geändert wird (anders als displayName, das sich
// jederzeit ändern kann). Wird z. B. gebraucht, damit man die
// Ersteller-Rechte einer eigenen Tipprunde nicht durch Umbenennen verliert.
function generateUserId(): string {
  return `u_${Math.random().toString(36).slice(2, 10)}`;
}

interface UserContextValue {
  // Stabile Sitzungs-ID, unabhängig vom (änderbaren) Anzeigenamen.
  userId: string;
  displayName: string;
  setDisplayName: (name: string) => void;
  freeStars: number;
  // Saison-Pass-XP – steigt AUSSCHLIESSLICH über den täglichen Bonus
  // (claimDailyBonus), niemals durch Tipp-Ergebnisse. Siehe PoolScore-Konzept:
  // der Pass darf nie wieder sinken bzw. ein Level "entsperren".
  passXP: number;
  // Rangliste-Punkte je Sportart – Elo-artig, kann durch PoolScore steigen
  // UND fallen (inkl. Inaktivitäts-Abklingen). Komplett von passXP entkoppelt.
  rangPunkte: Record<Sport, number>;
  canClaimDailyBonus: boolean;
  claimDailyBonus: () => void;
  // Gibt zurück, wie viele Sterne tatsächlich abgezogen wurden (Sicherheitsnetz:
  // nie mehr als das vorhandene Guthaben – ein User mit 0 Sternen kann so
  // trotzdem mit Einsatz 0 weiter mittippen, statt komplett ausgeschlossen zu sein).
  spendStars: (amount: number) => number;
  // Gegenstück zu spendStars – schreibt Sterne gut (z. B. Duell-Gewinn).
  // Bewusst öffentlich statt nur intern, damit auch DuelsContext Gewinne
  // gutschreiben kann, ohne den internen starsState-Setter zu kennen.
  creditStars: (amount: number) => void;
  // Sterne, die heute schon eingesetzt wurden bzw. noch bis zum Tages-Limit
  // eingesetzt werden können – unabhängig davon, wie viele Spiele heute
  // angeboten werden (siehe DAILY_STAKE_BUDGET).
  stakeBudgetRemainingToday: number;
  // Zeigt Warnfarben etc., wenn das Sterne-Guthaben knapp wird.
  isLowOnStars: boolean;
  evaluateMatchForCurrentUser: (
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) => void;
  // Für den Admin-Bereich: korrigiert die Auswertung eines Spiels, das schon
  // einmal ausgewertet wurde (z. B. weil der Endstand falsch eingetragen
  // war). Macht die alte Rangpunkte-/Sterne-Gutschrift rückgängig, bevor die
  // neue angewendet wird – sonst würden sich Korrekturen aufsummieren.
  correctMatchEvaluationForCurrentUser: (
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) => void;
  // Wertet die eigene (noch offene) Bonusfrage-Antwort zu diesem Spiel aus,
  // sobald der Admin die richtige Antwort gesetzt hat – tut nichts, wenn es
  // keine offene Antwort gibt oder noch keine richtige Antwort feststeht.
  evaluateBonusAnswerForCurrentUser: (matchId: string) => void;
  tipsSubmitted: number;
  recordTipSubmitted: () => void;
  // Anzahl aufeinanderfolgender Tage mit mindestens einem abgegebenen Tipp
  // (siehe STREAK_MILESTONES in lib/poolScore.ts für die Sterne-Boni).
  streakCount: number;
  friends: string[];
  addFriend: (name: string) => void;
  removeFriend: (name: string) => void;
  pendingRequests: string[];
  // Gibt false zurück, wenn der Name die (leichte) Validierung nicht besteht
  // (zu kurz/lang oder der eigene Name) – die aufrufende Seite kann das dann
  // als Fehlermeldung anzeigen.
  sendFriendRequest: (name: string) => boolean;
  // Eigene hochgeladene Fotos, global verfügbar (z. B. auch auf der
  // öffentlichen Spieler-Profilseite sichtbar, nicht nur im eigenen Profil).
  photos: (string | null)[];
  setPhoto: (index: number, dataUrl: string) => void;
  removePhoto: (index: number) => void;
  photoVisibility: PhotoVisibility;
  setPhotoVisibility: (visibility: PhotoVisibility) => void;
  rankIconOptions: RankIconOption[];
  selectedRankIconId: string | null;
  setSelectedRankIconId: (id: string) => void;
  activeRankIcon: RankIconOption | null;
  hasPremiumPass: boolean;
  buyPremiumPass: () => void;
  // Fiktives Werbefrei-Abo – kein echtes Zahlungssystem, blendet nur lokal
  // die Demo-Werbebanner (siehe components/AdBanner.tsx) aus.
  hasAdFreeSubscription: boolean;
  buyAdFreeSubscription: () => void;
  cancelAdFreeSubscription: () => void;
  // Platzhalter fürs echte Login-System: sobald es steht, ersetzt der echte
  // Auth-Status das hier. Steuert nur, ob der "Registrieren"-Button in der
  // Navbar angezeigt wird.
  isRegistered: boolean;
  register: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { addActivity, myTips, markTipEvaluated, matches, myBonusAnswers, markBonusAnswerEvaluated } =
    useAppData();
  const [userId] = useState(generateUserId);
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  // Erstes Foto ist zu Demo-Zwecken mit einem Platzhalter-Avatar vorbefüllt,
  // damit man gleich sieht, wie ein echtes Foto im Profil aussieht – einfach
  // über "Foto ändern" im Profil durch ein eigenes Foto ersetzen.
  const [photos, setPhotos] = useState<(string | null)[]>(["/demo-avatar.svg", null, null]);

  // Sterne-Guthaben UND alles, was direkt beim Einsetzen davon abhängt
  // (Tages-Limit, Rettungs-Bonus), leben bewusst in EINEM einzigen State-
  // Objekt statt in vier separaten useState-Aufrufen. Grund: Nur so sieht
  // spendStars() bei jedem Aufruf garantiert einen vollständig konsistenten,
  // aktuellen Stand – mit getrennten useStates könnte ein sehr schneller
  // zweiter Aufruf (bevor React neu gerendert hat) noch mit veralteten
  // Werten rechnen und das Tages-Limit falsch fortschreiben.
  const [starsState, setStarsState] = useState({
    freeStars: mockUser.freeStars,
    // Tages-Einsatz-Limit: unabhängig von der Anzahl heutiger Spiele, damit
    // ein Tag mit vielen Spielen das Guthaben nicht schneller leert als ein
    // Tag mit wenigen. stakedToday/stakeBudgetDay setzen sich beim ersten
    // Einsatz eines neuen Tages automatisch zurück.
    stakedToday: 0,
    stakeBudgetDay: null as string | null,
    rescueBonusUsed: false,
  });
  const { freeStars, stakedToday, stakeBudgetDay } = starsState;

  const [passXP, setPassXP] = useState(mockUser.passXP);
  const [rangPunkte, setRangPunkte] = useState<Record<Sport, number>>(initialRangPunkte);
  const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);

  const canClaimDailyBonus = lastClaimedAt === null || !isSameDay(lastClaimedAt, new Date().toISOString());

  function claimDailyBonus() {
    const now = new Date().toISOString();
    if (lastClaimedAt && isSameDay(lastClaimedAt, now)) return;

    // Inaktivitäts-Abklingen: gilt für ALLE Ränge, aber langsam (14 Tage
    // Schonfrist, danach nur -5 Punkte/Woche) – so fällt niemand schnell ab.
    if (lastClaimedAt) {
      const inactiveDays = daysBetween(lastClaimedAt, now);
      if (inactiveDays > INACTIVITY_GRACE_DAYS) {
        setRangPunkte((current) => {
          const next = { ...current };
          for (const sport of SPORTS) {
            next[sport] = applyInactivityDecay(current[sport], inactiveDays);
          }
          return next;
        });
      }
    }

    setStarsState((current) => ({ ...current, freeStars: current.freeStars + DAILY_BONUS_STARS }));
    setPassXP((current) => current + DAILY_BONUS_XP);
    setLastClaimedAt(now);
    addActivity(
      "🎁",
      `Täglicher Bonus abgeholt: +${DAILY_BONUS_STARS} Sterne, +${DAILY_BONUS_XP} Pass-XP.`
    );
  }

  const [tipsSubmitted, setTipsSubmitted] = useState(0);
  // Ein Objekt statt getrennter useStates (gleiches Muster wie starsState),
  // damit recordTipSubmitted bei schnell aufeinanderfolgenden Tipps immer
  // mit einem konsistenten Stand rechnet.
  const [streakState, setStreakState] = useState({
    count: 0,
    lastTipDate: null as string | null,
    claimedMilestones: [] as number[],
  });
  const [friends, setFriends] = useState<string[]>(["Sabine K.", "Marco T."]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [photoVisibility, setPhotoVisibility] = useState<PhotoVisibility>("friends");
  const [hasPremiumPass, setHasPremiumPass] = useState(false);

  // Platzhalter für die echte Zahlungsanbindung (z. B. Stripe/RevenueCat) –
  // schaltet die Premium-Spur des Saison-Passes lokal frei.
  function buyPremiumPass() {
    setHasPremiumPass(true);
  }

  const [hasAdFreeSubscription, setHasAdFreeSubscription] = useState(false);

  // Ebenfalls nur ein Platzhalter, kein echtes Zahlungssystem – schaltet
  // lokal die Demo-Werbebanner ab. cancelAdFreeSubscription gibt es nur,
  // damit sich der Unterschied mit/ohne Werbung hier in der Vorschau auch
  // wieder rückgängig machen lässt (ein echtes Abo würde man nicht per Klick
  // sofort kündigen, sondern zum Ende der Laufzeit).
  function buyAdFreeSubscription() {
    setHasAdFreeSubscription(true);
  }
  function cancelAdFreeSubscription() {
    setHasAdFreeSubscription(false);
  }

  const [isRegistered, setIsRegistered] = useState(false);
  function register() {
    setIsRegistered(true);
  }

  const rankIconOptions = useMemo(() => getAvailableRankIcons(rangPunkte), [rangPunkte]);
  const [selectedRankIconId, setSelectedRankIconId] = useState<string | null>(null);

  // Standardmäßig das beste verfügbare Icon (Elite, sonst höchster Sport-Rang) anzeigen.
  useEffect(() => {
    if (selectedRankIconId === null && rankIconOptions.length > 0) {
      const best = getBestRankIcon(rankIconOptions);
      if (best) setSelectedRankIconId(best.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rankIconOptions]);

  const activeRankIcon =
    rankIconOptions.find((o) => o.id === selectedRankIconId) ?? getBestRankIcon(rankIconOptions);

  function spendStars(amount: number): number {
    // Ein einziger setStarsState-Aufruf mit funktionalem Update: der
    // Updater sieht IMMER den zuletzt tatsächlich übernommenen Stand, auch
    // wenn spendStars zweimal sehr schnell hintereinander aufgerufen wird
    // (React reiht solche Updates auf und wendet sie garantiert nacheinander
    // auf den jeweils aktuellsten Stand an – anders als bei separaten
    // useStates, wo jeder Aufruf mit einem eigenen, ggf. veralteten
    // Zwischenstand rechnen würde).
    let actual = 0;
    let rescueBonusGranted = false;

    setStarsState((current) => {
      const now = new Date().toISOString();
      const isNewBudgetDay = current.stakeBudgetDay === null || !isSameDay(current.stakeBudgetDay, now);
      const alreadyStakedToday = isNewBudgetDay ? 0 : current.stakedToday;
      const remainingBudget = Math.max(0, DAILY_STAKE_BUDGET - alreadyStakedToday);

      actual = Math.max(0, Math.min(amount, current.freeStars, remainingBudget));
      let nextFreeStars = Math.max(0, current.freeStars - actual);
      let nextRescueUsed = current.rescueBonusUsed;

      // Rettungs-Bonus: fällt das Guthaben nach diesem Einsatz auf 0, bekommt
      // der User einmalig einen kleinen Polster, damit sich niemand komplett
      // ausgeschlossen fühlt. Danach nicht mehr (kein Dauer-Selbstläufer).
      if (!current.rescueBonusUsed && nextFreeStars <= 0 && actual > 0) {
        nextFreeStars += RESCUE_BONUS_STARS;
        nextRescueUsed = true;
        rescueBonusGranted = true;
      }

      return {
        freeStars: nextFreeStars,
        stakedToday: alreadyStakedToday + actual,
        stakeBudgetDay: isNewBudgetDay ? now : current.stakeBudgetDay,
        rescueBonusUsed: nextRescueUsed,
      };
    });

    if (rescueBonusGranted) {
      addActivity("🎁", `Deine Sterne waren aufgebraucht – hier ${RESCUE_BONUS_STARS} Sterne geschenkt, damit's weitergeht.`);
    }

    return actual;
  }

  function creditStars(amount: number) {
    if (amount <= 0) return;
    setStarsState((current) => ({ ...current, freeStars: current.freeStars + amount }));
  }

  const stakeBudgetRemainingToday =
    stakeBudgetDay === null || !isSameDay(stakeBudgetDay, new Date().toISOString())
      ? DAILY_STAKE_BUDGET
      : Math.max(0, DAILY_STAKE_BUDGET - stakedToday);

  const isLowOnStars = freeStars <= LOW_STARS_THRESHOLD;

  // Kern der PoolScore-Auswertung: sucht den (noch nicht ausgewerteten) Tipp
  // des aktuellen Users zu diesem Spiel, berechnet Rangliste-Punkte- und
  // Sterne-Änderung sowie den Prozent-Vergleich gegen die simulierten
  // Mitspieler, schreibt alles fort und hinterlässt eine narrierte
  // Feed-Meldung für den "Reveal"-Moment in MatchCard.
  function evaluateMatchForCurrentUser(
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) {
    const tip = [...myTips].reverse().find((t) => t.matchId === matchId && !t.evaluated);
    if (!tip) return;

    const match = matches.find((m) => m.id === matchId);

    const result = evaluatePoolScore({
      matchId,
      sport,
      predictedHome: tip.predictedHomeScore,
      predictedAway: tip.predictedAwayScore,
      actualHome,
      actualAway,
      stake: tip.stake,
      myRangPunkte: rangPunkte[sport],
      isOneXTwo: match?.tipMode === "1x2",
    });

    setRangPunkte((current) => ({
      ...current,
      [sport]: Math.max(0, current[sport] + result.rangDelta),
    }));
    setStarsState((current) => ({
      ...current,
      freeStars: Math.max(0, current.freeStars + result.starsCredit),
    }));

    const namedBeaten = result.opponents.filter(
      (o) => !o.name.startsWith("Mitspieler #") && TIER_ORDER[o.tier] < TIER_ORDER[result.tier]
    );
    const namedBetter = result.opponents.filter(
      (o) => !o.name.startsWith("Mitspieler #") && TIER_ORDER[o.tier] > TIER_ORDER[result.tier]
    );
    const deltaLabel = result.rangDelta >= 0 ? `+${result.rangDelta}` : `${result.rangDelta}`;

    let narration: string;
    if (result.tier === "exakt") {
      const victim = namedBeaten[0];
      narration = victim
        ? `🎯 Exakt getroffen! Du hast ${victim.name} ausgestochen – ${deltaLabel} Rangpunkte.`
        : `🎯 Exakt getroffen! ${deltaLabel} Rangpunkte.`;
    } else if (result.tier === "tendenz") {
      narration = `👍 Tendenz richtig erkannt – ${deltaLabel} Rangpunkte.`;
    } else {
      const winner = namedBetter[0];
      narration = winner
        ? `😬 Daneben getippt – ${winner.name} hat sich gegen dich durchgesetzt (${deltaLabel} Rangpunkte).`
        : `😬 Daneben getippt (${deltaLabel} Rangpunkte).`;
    }

    markTipEvaluated(tip.id, {
      tier: result.tier,
      rangDelta: result.rangDelta,
      starsDelta: result.starsNet,
      beatPercent: result.beatPercent,
      narration,
    });

    addActivity(SPORT_ICON[sport], narration);
  }

  // Gegenstück zu evaluateMatchForCurrentUser, aber für einen bereits
  // ausgewerteten Tipp: sucht bewusst einen Tipp MIT evaluated:true (nicht
  // ohne), macht dessen alte Gutschrift rückgängig und wendet die neu
  // berechnete an. So bleibt eine spätere Endstand-Korrektur im Admin-Bereich
  // fair, statt die alte (falsche) Gutschrift einfach stehen zu lassen oder
  // eine zweite obendrauf zu addieren.
  function correctMatchEvaluationForCurrentUser(
    matchId: string,
    sport: Sport,
    actualHome: number,
    actualAway: number
  ) {
    const tip = [...myTips].reverse().find((t) => t.matchId === matchId && t.evaluated);
    if (!tip) return;

    const match = matches.find((m) => m.id === matchId);
    const oldRangDelta = tip.rangDelta ?? 0;
    const oldStarsDelta = tip.starsDelta ?? 0;

    const result = evaluatePoolScore({
      matchId,
      sport,
      predictedHome: tip.predictedHomeScore,
      predictedAway: tip.predictedAwayScore,
      actualHome,
      actualAway,
      stake: tip.stake,
      // Rangpunkte-Stand VOR der ursprünglichen (jetzt zu korrigierenden)
      // Auswertung, als Basis für den Außenseiter-Bonus/-Malus.
      myRangPunkte: rangPunkte[sport] - oldRangDelta,
      isOneXTwo: match?.tipMode === "1x2",
    });

    setRangPunkte((current) => ({
      ...current,
      [sport]: Math.max(0, current[sport] - oldRangDelta + result.rangDelta),
    }));
    setStarsState((current) => ({
      ...current,
      freeStars: Math.max(0, current.freeStars - oldStarsDelta + result.starsCredit),
    }));

    const deltaLabel = result.rangDelta >= 0 ? `+${result.rangDelta}` : `${result.rangDelta}`;
    const tierText =
      result.tier === "exakt"
        ? "jetzt exakt getroffen"
        : result.tier === "tendenz"
        ? "jetzt Tendenz richtig"
        : "jetzt daneben";
    const narration = `🔧 Ein Admin hat den Endstand korrigiert – dein Tipp gilt ${tierText} (${deltaLabel} Rangpunkte).`;

    markTipEvaluated(tip.id, {
      tier: result.tier,
      rangDelta: result.rangDelta,
      starsDelta: result.starsNet,
      beatPercent: result.beatPercent,
      narration,
    });

    addActivity(SPORT_ICON[sport], narration);
  }

  function evaluateBonusAnswerForCurrentUser(matchId: string) {
    const answer = [...myBonusAnswers].reverse().find((a) => a.matchId === matchId && !a.evaluated);
    if (!answer) return;

    const match = matches.find((m) => m.id === matchId);
    if (!match?.bonusQuestion || match.bonusQuestion.correctOptionIndex === null) return;

    const correct = answer.optionIndex === match.bonusQuestion.correctOptionIndex;
    const starsDelta = correct ? match.bonusQuestion.bonusStars : 0;

    if (starsDelta > 0) {
      setStarsState((current) => ({ ...current, freeStars: current.freeStars + starsDelta }));
    }

    markBonusAnswerEvaluated(answer.id, { correct, starsDelta });

    addActivity(
      correct ? "🎁" : "🤔",
      correct
        ? `🎁 Bonusfrage richtig beantwortet – +${starsDelta} Sterne!`
        : "Bonusfrage leider daneben – kein Sterne-Bonus diesmal."
    );
  }

  function recordTipSubmitted() {
    setTipsSubmitted((current) => current + 1);

    // Tipp-Streak fortschreiben: derselbe Kalendertag zählt nur einmal, der
    // Folgetag verlängert die Serie, ein übersprungener Tag setzt sie zurück
    // auf 1. Meilenstein-Bonus wird außerhalb des Updaters vergeben (addActivity
    // ist kein State-Setter und gehört da nicht rein – gleiches Muster wie der
    // Rettungs-Bonus in spendStars).
    const now = new Date().toISOString();
    let milestoneBonus = 0;
    let milestoneDays = 0;

    setStreakState((current) => {
      if (current.lastTipDate && isSameDay(current.lastTipDate, now)) {
        return { ...current, lastTipDate: now };
      }
      const isNextDay = current.lastTipDate !== null && daysBetween(current.lastTipDate, now) === 1;
      const nextCount = isNextDay ? current.count + 1 : 1;

      const milestone = STREAK_MILESTONES.find(
        (m) => m.days === nextCount && !current.claimedMilestones.includes(m.days)
      );
      if (milestone) {
        milestoneBonus = milestone.bonusStars;
        milestoneDays = milestone.days;
      }

      return {
        count: nextCount,
        lastTipDate: now,
        claimedMilestones: milestone
          ? [...current.claimedMilestones, milestone.days]
          : current.claimedMilestones,
      };
    });

    if (milestoneBonus > 0) {
      setStarsState((current) => ({ ...current, freeStars: current.freeStars + milestoneBonus }));
      addActivity(
        "🔥",
        `${milestoneDays} Spieltage in Folge getippt – +${milestoneBonus} Sterne Bonus!`
      );
    }
  }

  function addFriend(name: string) {
    setFriends((current) => (current.includes(name) ? current : [...current, name]));
  }

  function removeFriend(name: string) {
    setFriends((current) => current.filter((f) => f !== name));
    setPendingRequests((current) => current.filter((n) => n !== name));
  }

  // Da es (noch) keine echten Gegenüber-Accounts gibt, simuliert das die
  // Annahme der Freundschaftsanfrage nach kurzer Zeit – erst danach werden
  // z. B. private Fotos des anderen Users sichtbar.
  // Leichte Validierung (ohne echte Nutzerliste ist mehr nicht sinnvoll
  // möglich): Name muss eine plausible Länge haben und darf nicht der
  // eigene Name sein. Gibt zurück, ob die Anfrage angenommen wurde, damit
  // die aufrufende Seite bei Ablehnung eine Fehlermeldung zeigen kann.
  function sendFriendRequest(name: string): boolean {
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 30) return false;
    if (trimmed.toLowerCase() === displayName.toLowerCase()) return false;
    if (friends.includes(trimmed) || pendingRequests.includes(trimmed)) return false;

    setPendingRequests((current) => [...current, trimmed]);
    setTimeout(() => {
      setFriends((current) => (current.includes(trimmed) ? current : [...current, trimmed]));
      setPendingRequests((current) => current.filter((n) => n !== trimmed));
      addActivity("🤝", `Du bist jetzt mit ${trimmed} befreundet.`);
    }, 2500);
    return true;
  }

  // Eigene hochgeladene Fotos – global im UserContext statt nur lokal auf
  // der Profilseite, damit sie z. B. auch auf der eigenen öffentlichen
  // Spieler-Profilseite sichtbar sind.
  function setPhoto(index: number, dataUrl: string) {
    setPhotos((current) => {
      const next = [...current];
      next[index] = dataUrl;
      return next;
    });
  }

  function removePhoto(index: number) {
    setPhotos((current) => {
      const next = [...current];
      next[index] = null;
      return next;
    });
  }

  return (
    <UserContext.Provider
      value={{
        userId,
        displayName,
        setDisplayName,
        photos,
        setPhoto,
        removePhoto,
        freeStars,
        passXP,
        rangPunkte,
        canClaimDailyBonus,
        claimDailyBonus,
        spendStars,
        creditStars,
        stakeBudgetRemainingToday,
        isLowOnStars,
        evaluateMatchForCurrentUser,
        correctMatchEvaluationForCurrentUser,
        evaluateBonusAnswerForCurrentUser,
        tipsSubmitted,
        recordTipSubmitted,
        streakCount: streakState.count,
        friends,
        addFriend,
        removeFriend,
        pendingRequests,
        sendFriendRequest,
        photoVisibility,
        setPhotoVisibility,
        rankIconOptions,
        selectedRankIconId,
        setSelectedRankIconId,
        activeRankIcon,
        hasPremiumPass,
        buyPremiumPass,
        hasAdFreeSubscription,
        buyAdFreeSubscription,
        cancelAdFreeSubscription,
        isRegistered,
        register,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser muss innerhalb von <UserProvider> verwendet werden");
  }
  return context;
}
