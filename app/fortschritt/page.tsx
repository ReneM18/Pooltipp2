"use client";

import { useState } from "react";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { PASS_LEVELS, PREMIUM_PASS_PRICE } from "@/lib/passLevels";
import { SPORTS } from "@/lib/types";
import { useFeedback } from "@/lib/FeedbackContext";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

export default function FortschrittPage() {
  const { points, hasPremiumPass, buyPremiumPass } = useUser();
  const { tipsBySport } = useAppData();
  const { showToast, celebrate } = useFeedback();
  const [purchasing, setPurchasing] = useState(false);

  function handleBuyPremium() {
    setPurchasing(true);
    // Platzhalter für den echten Bezahlvorgang (Stripe o. ä.) – simuliert hier
    // kurz eine Verarbeitung, damit sich der Kauf nicht "sofort magisch" anfühlt.
    setTimeout(() => {
      buyPremiumPass();
      setPurchasing(false);
      celebrate();
      showToast("👑 Premium-Pass freigeschaltet!", "gold");
    }, 600);
  }

  const currentLevel = [...PASS_LEVELS].reverse().find((l) => points >= l.xpRequired) ?? PASS_LEVELS[0];
  const nextLevel = PASS_LEVELS.find((l) => l.xpRequired > points);
  const progressToNext = nextLevel
    ? Math.round(((points - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)
    : 100;

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Saison-Pass</h1>
        <p className="mt-1 text-sm text-muted">
          Sammle Punkte durch Tippen und schalte nach und nach neue Belohnungen frei.
        </p>
      </div>

      {/* Season-Pass Fortschrittsbalken */}
      <section className="mb-8 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-5">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-lg font-bold text-ink">
            Level {currentLevel.level} <span className="text-gold">{currentLevel.icon}</span>
          </span>
          <span className="text-sm text-muted">
            {points.toLocaleString("de-DE")} Punkte
            {nextLevel && ` · noch ${(nextLevel.xpRequired - points).toLocaleString("de-DE")} bis Level ${nextLevel.level}`}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-pitch">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-action transition-all"
            style={{ width: `${Math.max(4, progressToNext)}%` }}
          />
        </div>
      </section>

      {/* Premium-Pass Kaufkarte */}
      <section className="mb-8">
        {hasPremiumPass ? (
          <div className="flex items-center gap-3 rounded-card border border-gold bg-gold/10 p-4">
            <span className="text-2xl">👑</span>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-gold">Premium-Pass aktiv</p>
              <p className="text-xs text-muted">
                Du erhältst zusätzlich zu jeder Stufe die Premium-Belohnung rechts daneben.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                <span className="text-lg">👑</span> Premium-Pass freischalten
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Einmalig {PREMIUM_PASS_PRICE} – schaltet auf jeder Stufe eine zusätzliche exklusive
                Belohnung frei (Rahmen, Titel, Sterne-Boni). Kein Zufall, keine Lose – du bekommst
                garantiert alle Premium-Inhalte, die du mit deinen Punkten erreichst.
              </p>
            </div>
            <button
              onClick={handleBuyPremium}
              disabled={purchasing}
              className="shrink-0 rounded-full bg-gold px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
            >
              {purchasing ? "Wird verarbeitet…" : `Freischalten – ${PREMIUM_PASS_PRICE}`}
            </button>
          </div>
        )}
      </section>

      {/* Pass-Track */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Saison-Pass</h2>
          <span className="text-xs text-muted">Exklusiv – nicht im Shop kaufbar</span>
        </div>
        <div className="flex flex-col gap-3">
          {PASS_LEVELS.map((lvl) => {
            const unlocked = points >= lvl.xpRequired;
            const isCurrent = lvl.level === currentLevel.level;
            const isPayout = !!lvl.starsReward;
            return (
              <div
                key={lvl.level}
                className={`flex items-center gap-4 rounded-card border p-4 transition-colors ${
                  isPayout && unlocked
                    ? "border-gold bg-gold/10"
                    : isCurrent
                    ? "border-gold bg-surface-hover"
                    : unlocked
                    ? "border-edge bg-surface"
                    : "border-edge bg-surface opacity-50"
                }`}
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl ${
                    unlocked ? "bg-gold/20" : "bg-pitch"
                  }`}
                >
                  {unlocked ? lvl.icon : "🔒"}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-semibold text-ink">
                      Level {lvl.level}
                    </span>
                    {unlocked && <span className="text-xs font-semibold text-action">✓ Freigeschaltet</span>}
                  </div>
                  <p className="text-sm text-muted">
                    {lvl.reward}
                    {isPayout && (
                      <span className="ml-1 text-gold">
                        · wandert direkt in dein Sterne-Guthaben für den Shop
                      </span>
                    )}
                  </p>
                </div>

                {lvl.premiumReward && (
                  <div
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
                      hasPremiumPass && unlocked
                        ? "border-gold/60 bg-gold/10"
                        : "border-edge bg-pitch opacity-60"
                    }`}
                  >
                    <span className="text-lg">{hasPremiumPass && unlocked ? lvl.premiumIcon : "🔒"}</span>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gold">
                        Premium
                      </p>
                      <p className="max-w-[9rem] text-xs text-muted">{lvl.premiumReward}</p>
                    </div>
                  </div>
                )}

                <span className="text-xs text-muted">{lvl.xpRequired.toLocaleString("de-DE")} P</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Sportarten-Aufschlüsselung */}
      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Tipps nach Sportart</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SPORTS.map((sport) => (
            <div key={sport} className="rounded-card border border-edge bg-surface p-4 text-center">
              <div className="mb-1 text-2xl">{sportIcon[sport]}</div>
              <p className="font-display text-xl font-bold text-ink">{tipsBySport[sport] ?? 0}</p>
              <p className="text-xs text-muted">{sport}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
