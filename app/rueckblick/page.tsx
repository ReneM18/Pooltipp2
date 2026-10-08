"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";
import { getCurrentWeekWindow, weeklyTipPoints } from "@/lib/weeklyLeaderboard";
import { computeWeeklyReview, getPreviousWeekWindow, useWeeklyPlace, weekKey, weekRangeText } from "@/lib/weeklyReview";
import { useMyWeeklyWin } from "@/lib/weeklyWinner";
import { daysLabel, useStreak } from "@/lib/streak";
import { TIER_BADGE } from "@/components/tierBadges";
import { matchTitle, oneXTwoText, scoreText } from "@/lib/teamOrder";

// Wochenrückblick: jederzeit aufrufbar (Profil, Karte auf der Spieltag-Seite,
// Admin-Bereich). Die Seite selbst ändert nichts: kein "gesehen", keine
// Coins, keine Daten. Weggeklickt wird nur die Karte auf der Spieltag-Seite.
export default function RueckblickPage() {
  const { isRegistered, authUserId, sessionChecked, displayName } = useUser();
  const { myTips, myTipsLoaded, matches, getTeam } = useAppData();
  const { showToast } = useFeedback();
  const streak = useStreak();
  const [which, setWhich] = useState<"letzte" | "diese">("letzte");

  const weekWin = useMemo(
    () => (which === "letzte" ? getPreviousWeekWindow() : getCurrentWeekWindow()),
    [which]
  );
  const review = useMemo(() => computeWeeklyReview(myTips, matches, weekWin), [myTips, matches, weekWin]);
  const { place, players, loading: placeLoading } = useWeeklyPlace(
    weekWin,
    authUserId,
    review.points,
    review.tips > 0
  );

  const weeklyWin = useMyWeeklyWin(authUserId, weekKey(weekWin));

  if (!sessionChecked) return <Shell><p className="py-8 text-center text-sm text-muted">Wird geladen …</p></Shell>;
  if (!isRegistered) {
    return (
      <Shell>
        <div className="rounded-card border border-edge bg-surface p-5 text-sm text-muted">
          <Link href="/registrieren" className="font-semibold text-gold hover:underline">
            Melde dich an
          </Link>
          , dann siehst du hier jede Woche, wie deine Tipps gelaufen sind.
        </div>
      </Shell>
    );
  }

  const range = weekRangeText(weekWin);
  const pointsText = `${review.points > 0 ? "+" : review.points < 0 ? "−" : ""}${Math.abs(review.points).toLocaleString("de-DE")}`;

  async function handleShare() {
    const lines = [
      `📊 Meine PoolTipp-Woche (${range})`,
      `${review.tips} ${review.tips === 1 ? "Tipp" : "Tipps"} · ${review.exakt} exakt · ${pointsText} Punkte`,
      place ? `Platz ${place} von ${players} in der Wochen-Rangliste` : null,
      weeklyWin ? "🥇 Erster der Woche" : null,
      streak.count > 0 ? `🔥 ${daysLabel(streak.count)} in Folge` : null,
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast("📋 Wochenrückblick in die Zwischenablage kopiert.", "gold");
    } catch (error) {
      // Teilen abgebrochen: nichts tun. Sonst Hinweis.
      if ((error as Error)?.name !== "AbortError") showToast("Teilen nicht möglich.", "info");
    }
  }

  const tierChips = [
    { key: "exakt", count: review.exakt, ...TIER_BADGE.exakt },
    { key: "differenz", count: review.differenz, ...TIER_BADGE.differenz },
    { key: "tendenz", count: review.tendenz, ...TIER_BADGE.tendenz },
    { key: "richtig1x2", count: review.richtig1x2, text: "Sieger richtig", className: TIER_BADGE.exakt.className },
    { key: "falsch", count: review.falsch, ...TIER_BADGE.falsch },
  ].filter((c) => c.count > 0);

  const best = review.best;
  const bestHome = best ? getTeam(best.match.homeTeamId) : undefined;
  const bestAway = best ? getTeam(best.match.awayTeamId) : undefined;

  return (
    <Shell>
      <div className="mb-4 flex gap-2">
        <WeekButton active={which === "letzte"} onClick={() => setWhich("letzte")} label="Letzte Woche" />
        <WeekButton active={which === "diese"} onClick={() => setWhich("diese")} label="Diese Woche" />
      </div>

      {!myTipsLoaded ? (
        <p className="py-8 text-center text-sm text-muted">Deine Tipps werden geladen …</p>
      ) : review.tips === 0 ? (
        <div className="rounded-card border border-edge bg-surface p-5 text-center">
          <p className="text-3xl">📭</p>
          <p className="mt-2 font-display text-base font-semibold text-ink">
            {which === "letzte" ? "Letzte Woche hast du nicht getippt." : "Diese Woche hast du noch nicht getippt."}
          </p>
          <p className="mt-1 text-sm text-muted">Sobald du tippst, steht hier deine Woche ({range}).</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Zu den Spielen
          </Link>
        </div>
      ) : (
        <div className="rounded-card border border-gold/40 bg-gradient-to-br from-surface to-surface-hover p-5">
          <p className="text-xs font-semibold text-gold">
            {which === "letzte" ? "Deine Woche" : "Deine Woche bisher"} · {range}
          </p>
          <p className="mt-0.5 font-display text-xl font-bold text-ink [overflow-wrap:anywhere]">{displayName}</p>

          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <Stat value={review.tips.toLocaleString("de-DE")} label={review.tips === 1 ? "Tipp" : "Tipps"} />
            <Stat
              value={pointsText}
              label="Punkte"
              className={review.points > 0 ? "text-action" : "text-ink"}
            />
            <Stat
              value={place ? `${place}.` : placeLoading ? "…" : "–"}
              label={place ? `Platz von ${players}` : "Platz"}
            />
          </div>

          {weeklyWin && (
            <p className="mt-4 rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 font-display text-sm font-semibold text-gold">
              🥇 Erster der Woche · +{weeklyWin.xp} Pass-XP
            </p>
          )}

          {(tierChips.length > 0 || review.open > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {tierChips.map((c) => (
                <span
                  key={c.key}
                  className={`whitespace-nowrap rounded-full border px-2.5 py-0.5 font-display text-xs font-bold ${c.className}`}
                >
                  {c.count}× {c.text}
                </span>
              ))}
              {review.open > 0 && (
                <span className="whitespace-nowrap rounded-full border border-edge px-2.5 py-0.5 font-display text-xs font-bold text-muted">
                  {review.open}× noch offen
                </span>
              )}
            </div>
          )}

          {best && bestHome && bestAway && (
            <div className="mt-4 rounded-lg border border-edge bg-pitch/60 p-3">
              <p className="text-xs font-semibold text-muted">⭐ Bester Tipp</p>
              <p className="mt-0.5 font-display text-sm font-semibold text-ink">
                {SPORT_ICONS[best.match.sport]} {matchTitle(best.match.sport, bestHome.name, bestAway.name)}
              </p>
              <p className="text-xs text-muted">
                Getippt:{" "}
                {best.match.tipMode === "1x2"
                  ? oneXTwoText(best.match.sport, best.tip.predictedHomeScore, best.tip.predictedAwayScore, bestHome.name, bestAway.name)
                  : scoreText(best.match.sport, best.tip.predictedHomeScore, best.tip.predictedAwayScore)}
                {best.match.status === "finished" &&
                  ` · Endstand: ${scoreText(best.match.sport, best.match.liveHomeScore, best.match.liveAwayScore)}`}{" "}
                · <span className="font-semibold text-action">+{weeklyTipPoints(best.tip)} Punkte</span>
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {SPORTS.filter((s) => review.bySport[s]).map((s) => (
              <span key={s} className="whitespace-nowrap">
                {SPORT_ICONS[s]} {sportLabel(s)}: <span className="font-semibold text-ink">{review.bySport[s]}</span>
              </span>
            ))}
          </div>

          <p className="mt-3 text-xs text-muted">
            {streak.count > 0 ? (
              <>
                🔥 Tipp-Serie: <span className="font-semibold text-gold">{daysLabel(streak.count)}</span>
              </>
            ) : (
              "🔥 Gerade keine Tipp-Serie."
            )}
            {streak.shieldFree !== null &&
              ` · 🛡️ Serien-Schutz diese Woche: ${streak.shieldFree ? "bereit" : "schon genutzt"}`}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={handleShare}
              className="flex-1 rounded-full bg-action py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
            >
              Teilen
            </button>
            <Link
              href="/rangliste"
              className="flex-1 rounded-full border border-edge py-2.5 text-center font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Zur Rangliste
            </Link>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-muted">
        Gezählt werden die Tipps, die du in der Woche (Montag 0:00 bis Sonntag, Wiener Zeit) abgegeben hast, mit ihren
        Tipp-Punkten ohne Platz-Bonus. Punkte kommen dazu, sobald ein Spiel ausgewertet ist, genau wie in der
        Wochen-Rangliste.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-xl px-5 py-5 sm:py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">📊 Wochenrückblick</h1>
      {children}
    </main>
  );
}

function WeekButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-1.5 font-display text-sm font-semibold transition-colors ${
        active ? "border-gold bg-gold text-pitch" : "border-edge text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function Stat({ value, label, className = "text-ink" }: { value: string; label: string; className?: string }) {
  return (
    <div className="rounded-lg border border-edge bg-pitch/60 px-1 py-3">
      <p className={`font-display text-2xl font-bold ${className}`}>{value}</p>
      <p className="text-[11px] text-muted">{label}</p>
    </div>
  );
}
