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
} from "@/lib/poolScore";

const SPORT_ICON: Record<Sport, string> = { "Fußball": "⚽", NFL: "🏈", NBA: "🏀", NHL: "🏒" };

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

interface UserContextValue {
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
  tipsSubmitted: number;
  recordTipSubmitted: () => void;
  friends: string[];
  addFriend: (name: string) => void;
  removeFriend: (name: string) => void;
  pendingRequests: string[];
  sendFriendRequest: (name: string) => void;
  photoVisibility: PhotoVisibility;
  setPhotoVisibility: (visibility: PhotoVisibility) => void;
  rankIconOptions: RankIconOption[];
  selectedRankIconId: string | null;
  setSelectedRankIconId: (id: string) => void;
  activeRankIcon: RankIconOption | null;
  hasPremiumPass: boolean;
  buyPremiumPass: () => void;
  // Platzhalter fürs echte Login-System: sobald es steht, ersetzt der echte
  // Auth-Status das hier. Steuert nur, ob der "Registrieren"-Button in der
  // Navbar angezeigt wird.
  isRegistered: boolean;
  register: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const { addActivity, myTips, markTipEvaluated } = useAppData();
  const [displayName, setDisplayName] = useState(mockUser.displayName);
  const [freeStars, setFreeStars] = useState(mockUser.freeStars);
  const [passXP, setPassXP] = useState(mockUser.passXP);
  const [rangPunkte, setRangPunkte] = useState<Record<Sport, number>>(initialRangPunkte);
  const [lastClaimedAt, setLastClaimedAt] = useState<string | null>(null);

  // Tages-Einsatz-Limit: unabhängig von der Anzahl heutiger Spiele, damit ein
  // Tag mit vielen Spielen das Guthaben nicht schneller leert als ein Tag mit
  // wenigen. stakedToday/stakeBudgetDay setzen sich beim ersten Einsatz eines
  // neuen Tages automatisch zurück.
  const [stakedToday, setStakedToday] = useState(0);
  const [stakeBudgetDay, setStakeBudgetDay] = useState<string | null>(null);
  const [rescueBonusUsed, setRescueBonusUsed] = useState(false);

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

    setFreeStars((current) => current + DAILY_BONUS_STARS);
    setPassXP((current) => current + DAILY_BONUS_XP);
    setLastClaimedAt(now);
    addActivity(
      "🎁",
      `Täglicher Bonus abgeholt: +${DAILY_BONUS_STARS} Sterne, +${DAILY_BONUS_XP} Pass-XP.`
    );
  }

  const [tipsSubmitted, setTipsSubmitted] = useState(0);
  const [friends, setFriends] = useState<string[]>(["Sabine K.", "Marco T."]);
  const [pendingRequests, setPendingRequests] = useState<string[]>([]);
  const [photoVisibility, setPhotoVisibility] = useState<PhotoVisibility>("friends");
  const [hasPremiumPass, setHasPremiumPass] = useState(false);

  // Platzhalter für die echte Zahlungsanbindung (z. B. Stripe/RevenueCat) –
  // schaltet die Premium-Spur des Saison-Passes lokal frei.
  function buyPremiumPass() {
    setHasPremiumPass(true);
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
    const now = new Date().toISOString();
    const isNewBudgetDay = stakeBudgetDay === null || !isSameDay(stakeBudgetDay, now);
    const alreadyStakedToday = isNewBudgetDay ? 0 : stakedToday;
    const remainingBudget = Math.max(0, DAILY_STAKE_BUDGET - alreadyStakedToday);

    const actual = Math.max(0, Math.min(amount, freeStars, remainingBudget));

    setFreeStars((current) => Math.max(0, current - actual));
    setStakedToday(alreadyStakedToday + actual);
    if (isNewBudgetDay) setStakeBudgetDay(now);

    // Rettungs-Bonus: fällt das Guthaben nach diesem Einsatz auf 0, bekommt
    // der User einmalig einen kleinen Polster, damit sich niemand komplett
    // ausgeschlossen fühlt. Danach nicht mehr (kein Dauer-Selbstläufer).
    if (!rescueBonusUsed && freeStars - actual <= 0 && actual > 0) {
      setFreeStars((current) => current + RESCUE_BONUS_STARS);
      setRescueBonusUsed(true);
      addActivity("🎁", `Deine Sterne waren aufgebraucht – hier ${RESCUE_BONUS_STARS} Sterne geschenkt, damit's weitergeht.`);
    }

    return actual;
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

    const result = evaluatePoolScore({
      matchId,
      sport,
      predictedHome: tip.predictedHomeScore,
      predictedAway: tip.predictedAwayScore,
      actualHome,
      actualAway,
      stake: tip.stake,
      myRangPunkte: rangPunkte[sport],
    });

    setRangPunkte((current) => ({
      ...current,
      [sport]: Math.max(0, current[sport] + result.rangDelta),
    }));
    setFreeStars((current) => current + result.starsCredit);

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

  function recordTipSubmitted() {
    setTipsSubmitted((current) => current + 1);
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
  function sendFriendRequest(name: string) {
    if (!name.trim() || friends.includes(name) || pendingRequests.includes(name)) return;
    setPendingRequests((current) => [...current, name]);
    setTimeout(() => {
      setFriends((current) => (current.includes(name) ? current : [...current, name]));
      setPendingRequests((current) => current.filter((n) => n !== name));
      addActivity("🤝", `Du bist jetzt mit ${name} befreundet.`);
    }, 2500);
  }

  return (
    <UserContext.Provider
      value={{
        displayName,
        setDisplayName,
        freeStars,
        passXP,
        rangPunkte,
        canClaimDailyBonus,
        claimDailyBonus,
        spendStars,
        stakeBudgetRemainingToday,
        isLowOnStars,
        evaluateMatchForCurrentUser,
        tipsSubmitted,
        recordTipSubmitted,
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
