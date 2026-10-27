"use client";

import { useEffect, useState, CSSProperties, ReactNode } from "react";
import { useUser } from "@/lib/UserContext";
import { PASS_LEVELS, PREMIUM_PASS_PRICE } from "@/lib/passLevels";
import { getActiveFrame, xpForLevel } from "@/lib/seasonPass";
import Link from "next/link";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { CURRENT_SEASON, seasonCountdownText, seasonPeriodText } from "@/lib/seasons";
import { EmoteSticker } from "@/components/Emotes";
import { SeasonHeroLeaves } from "@/components/SeasonDeco";
import { useFeedback } from "@/lib/FeedbackContext";
import HalloweenEvent, { useHalloweenPhase } from "@/components/HalloweenEvent";

// Rahmen, den das jeweilige Gratis-Level bringt (lib/seasonPass.ts).
const FRAME_OF_LEVEL: Record<number, string> = { 3: "bronze", 5: "silber", 7: "gold", 9: "diamant", 10: "meister" };

// Seite Fortschritt: der Saison-Pass. Während eines Events steht darunter ein
// Abschnitt "Halloween-Extras" (components/HalloweenEvent.tsx), kein eigener
// Reiter mehr (Rene, 27.10.2026: ein Fortschritt statt zwei). Jeder Kürbis
// gibt auch Pass-XP (supabase/halloween-kuerbis-xp.sql). Vor dem Start sieht
// den Abschnitt nur der Admin (Vorschau), nach dem Ende noch ein paar Tage alle.
export default function FortschrittPage() {
  const { isAdmin } = useUser();
  const phase = useHalloweenPhase();
  const showEvent = phase === "laeuft" || phase === "beendet" || (phase === "vorher" && isAdmin);
  // Alte Links auf /fortschritt#halloween springen zum Abschnitt.
  useEffect(() => {
    if (!showEvent || window.location.hash !== "#halloween") return;
    document.getElementById("halloween")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showEvent]);
  return <SeasonPassView event={showEvent && phase ? <HalloweenEvent phase={phase} /> : null} />;
}

function SeasonPassView({ event }: { event: ReactNode }) {
  const {
    passXP,
    hasPremiumPass,
    buyPremiumPass,
    canClaimDailyBonus,
    claimDailyBonus,
    customFrameColors,
    setCustomFrameColors,
    shownPassHonors,
    passDisplay,
    passClaims,
    isRegistered,
  } = useUser();
  // Welche Pass-Belohnung man gerade trägt (Profil -> Einstellungen).
  const wornFrame = getActiveFrame(passXP, hasPremiumPass, customFrameColors, passDisplay.frame, passClaims);
  const isWorn = (lvl: (typeof PASS_LEVELS)[number]): boolean | null => {
    if (lvl.kind === "frame") return wornFrame?.variant === FRAME_OF_LEVEL[lvl.level];
    if (lvl.kind === "title") return shownPassHonors.title?.label === lvl.label;
    if (lvl.kind === "badge") return shownPassHonors.badges.some((b) => b.label === lvl.label);
    return null;
  };
  const { showToast, celebrate } = useFeedback();
  const [purchasing, setPurchasing] = useState(false);
  // Erst im Browser ausrechnen (heutiges Datum), nicht schon beim Bauen der Seite.
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    setCountdown(seasonCountdownText(CURRENT_SEASON, new Date()));
  }, []);

  async function handleClaimDailyBonus() {
    const { claimed, error, starsAdded = 8 } = await claimDailyBonus();
    if (error) {
      showToast(error, "info");
      return;
    }
    if (!claimed) {
      showToast("Den Bonus hast du heute schon abgeholt – morgen gibt's den nächsten.", "info");
      return;
    }
    celebrate();
    showToast(
      starsAdded > 0
        ? `🎁 Täglicher Bonus abgeholt: +${starsAdded} Coins, +100 Pass-XP!`
        : "🎁 Täglicher Bonus abgeholt: +100 Pass-XP! (Ab 500 Coins gibt es nur noch XP.)",
      "gold"
    );
  }

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

  const currentLevel = [...PASS_LEVELS].reverse().find((l) => passXP >= l.xpRequired) ?? PASS_LEVELS[0];
  const nextLevel = PASS_LEVELS.find((l) => l.xpRequired > passXP);
  const progressToNext = nextLevel
    ? Math.round(((passXP - currentLevel.xpRequired) / (nextLevel.xpRequired - currentLevel.xpRequired)) * 100)
    : 100;

  // Premium-Pass-Stufen (siehe lib/passLevels.ts): true, sobald die Premium-Spur
  // gekauft UND das jeweilige Level per Pass-XP erreicht ist.
  const hasLevelPremium = (level: number) => hasPremiumPass && passXP >= xpForLevel(level);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      {/* Mit Saison-Design wird dieser Kopfbereich zur warmen Karte mit
          Deko (CSS .season-hero in app/globals.css). */}
      <div className="season-hero mb-6">
        <SeasonHeroLeaves />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: SEASON_THEME.colorFrom }}>
            {SEASON_THEME.icon} Saison {SEASON_THEME.name}
          </p>
          <p className="text-xs text-muted">
            <span className="whitespace-nowrap">{seasonPeriodText(CURRENT_SEASON)}</span>
            {countdown && (
              <>
                {" · "}
                <span className="whitespace-nowrap font-semibold text-ink">{countdown}</span>
              </>
            )}
          </p>
        </div>
        <h1 className="font-display text-3xl font-bold text-ink">Saison-Pass</h1>
        <p className="mt-1 text-sm text-muted">
          Hol dir jeden Tag deinen Bonus, sammle Pass-XP und schalte Level für Level neue Belohnungen frei.
        </p>
      </div>

      {/* Season-Pass Fortschrittsbalken. Level 1 Premium: "Start-Glow im
          Saison-Design" – Leuchten in der Saison-Farbe aus SEASON_THEME. */}
      <section
        className={`mb-8 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-5 ${
          hasLevelPremium(1) ? "animate-glow-pulse" : ""
        }`}
        style={
          hasLevelPremium(1)
            ? ({ "--glow-color": `${SEASON_THEME.colorFrom}66` } as CSSProperties)
            : undefined
        }
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <span className="whitespace-nowrap font-display text-lg font-bold text-ink">
            Level {currentLevel.level} <span className="text-gold">{currentLevel.icon}</span>
          </span>
          <span className="text-sm text-muted">
            {passXP.toLocaleString("de-DE")} XP
            {nextLevel && ` · noch ${(nextLevel.xpRequired - passXP).toLocaleString("de-DE")} bis Level ${nextLevel.level}`}
          </span>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-pitch">
          <div
            className="h-full rounded-full bg-gradient-to-r from-gold to-action transition-all"
            style={{ width: `${Math.max(4, progressToNext)}%` }}
          />
        </div>
      </section>

      {/* Täglicher Bonus. Tipp-Ergebnisse wirken sich nur auf Rangliste-Punkte
          und Sterne aus, nicht auf den Pass. */}
      <section className="mb-8">
        <div className="flex flex-col items-start gap-3 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <span className="text-lg">🎁</span> Täglicher Bonus
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Einmal pro Tag: +8 Coins (bis 500 auf dem Konto) und +100 Pass-XP. Tipp-Ergebnisse
              zählen nicht für den Pass.
            </p>
          </div>
          <button
            onClick={handleClaimDailyBonus}
            disabled={!canClaimDailyBonus}
            className="shrink-0 rounded-full bg-gold px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canClaimDailyBonus ? "Bonus abholen" : "Heute schon abgeholt ✓"}
          </button>
        </div>
      </section>

      {event}

      {/* Feste Rollen der drei Zähler – damit Tester gleich verstehen, was wofür ist. */}
      <section className="mb-8 rounded-card border border-edge bg-surface p-4">
        <p className="mb-2 font-display text-sm font-semibold text-ink">So funktioniert der Pass</p>
        <ul className="flex flex-col gap-1.5 text-xs text-muted">
          <li>
            <span className="font-semibold text-ink">Pass-XP</span> zeigen, wie aktiv du bist, und füllen nur
            diesen Pass.
          </li>
          <li>
            <span className="font-semibold text-ink">Punkte</span> zeigen, wie gut du tippst (Rangliste) und
            haben mit dem Pass nichts zu tun.
          </li>
          <li>
            <span className="font-semibold text-ink">Coins</span> setzt du bei den Booster-Spielen ein und
            tauschst sie im Shop gegen Joker. Normale Tipps sind gratis. Der Pass gibt nur auf Level 10 ein
            paar dazu.
          </li>
          <li>Abzeichen, Titel und Sticker, die du freischaltest, behältst du auch nach der Saison.</li>
        </ul>
      </section>

      {/* Premium-Pass Kaufkarte – Bezahlen ist noch nicht eingebaut, daher
          ehrlich als kostenloser Test gekennzeichnet. */}
      <section className="mb-8">
        {hasPremiumPass ? (
          <div className="flex items-center gap-3 rounded-card border border-gold bg-gold/10 p-4">
            <span className="text-2xl">👑</span>
            <div className="flex-1">
              <p className="font-display text-sm font-semibold text-gold">Premium-Test aktiv</p>
              <p className="text-xs text-muted">
                Du siehst zusätzlich zu jeder Stufe die Premium-Belohnung daneben. Der Test gilt nur bis
                zum Neuladen der Seite.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
                <span className="text-lg">👑</span> Premium-Pass (Vorschau)
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Geplant für einmalig {PREMIUM_PASS_PRICE}: auf jeder Stufe eine zusätzliche Belohnung
                (Rahmen, Animationen, Statistik, Titel). Bezahlen ist noch nicht eingebaut – zum Testen
                kannst du Premium hier kostenlos ansehen, bis du die Seite neu lädst.
              </p>
            </div>
            <button
              onClick={handleBuyPremium}
              disabled={purchasing}
              className="shrink-0 rounded-full bg-gold px-5 py-2.5 font-display text-sm font-semibold text-pitch transition-colors hover:bg-gold/90 disabled:opacity-60"
            >
              {purchasing ? "Wird freigeschaltet…" : "Kostenlos testen"}
            </button>
          </div>
        )}
      </section>

      {/* Level 5 Premium: eigener Farbwähler für den Profil-Rahmen */}
      {hasLevelPremium(5) && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Eigener Rahmen-Farbwähler</h2>
          <div className="flex flex-col gap-3 rounded-card border border-edge bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Mische deine eigene Rahmenfarbe</p>
              <p className="text-xs text-muted">
                Ersetzt den Neon-Pulse-Rahmen überall in der App durch deine eigene Farbkombination.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="flex flex-col items-center gap-1 text-xs text-muted">
                Von
                <input
                  type="color"
                  value={customFrameColors?.from ?? SEASON_THEME.colorFrom}
                  onChange={(e) =>
                    setCustomFrameColors(e.target.value, customFrameColors?.to ?? SEASON_THEME.colorTo)
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-edge bg-transparent"
                />
              </label>
              <label className="flex flex-col items-center gap-1 text-xs text-muted">
                Nach
                <input
                  type="color"
                  value={customFrameColors?.to ?? SEASON_THEME.colorTo}
                  onChange={(e) =>
                    setCustomFrameColors(customFrameColors?.from ?? SEASON_THEME.colorFrom, e.target.value)
                  }
                  className="h-9 w-12 cursor-pointer rounded border border-edge bg-transparent"
                />
              </label>
            </div>
          </div>
        </section>
      )}

      {/* Pass-Track */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Saison-Pass</h2>
          <span className="text-xs text-muted">Exklusiv – nicht im Shop kaufbar</span>
        </div>
        <div className="flex flex-col gap-3">
          {PASS_LEVELS.map((lvl) => {
            const unlocked = passXP >= lvl.xpRequired;
            const isCurrent = lvl.level === currentLevel.level;
            const isPayout = lvl.kind === "badge";
            return (
              <div
                key={lvl.level}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-card border p-4 transition-colors sm:flex-nowrap ${
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
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2">
                    <span className="whitespace-nowrap font-display text-sm font-semibold text-ink">
                      Level {lvl.level}
                    </span>
                    {unlocked && <span className="text-xs font-semibold text-action">✓ Freigeschaltet</span>}
                  </div>
                  <p className={`text-sm ${unlocked ? "text-ink" : "text-muted"}`}>{lvl.reward}</p>
                  <p className="text-xs text-muted">
                    <span className="text-gold">Wo:</span> {lvl.rewardWhere}
                  </p>
                  {/* Selbst anlegen oder ablegen (Profil -> Einstellungen). */}
                  {unlocked && isRegistered && isWorn(lvl) !== null && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                      <span className={isWorn(lvl) ? "font-semibold text-action" : "text-muted"}>
                        {isWorn(lvl) ? "✓ Angelegt" : "Abgelegt"}
                      </span>
                      <Link href="/profil#pass-belohnungen" className="font-semibold text-gold hover:opacity-80">
                        {isWorn(lvl) ? "Ablegen oder tauschen →" : "Anlegen →"}
                      </Link>
                    </p>
                  )}
                  {lvl.kind === "emotes" && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {CURRENT_SEASON.emotes.map((emote) => (
                        <EmoteSticker key={emote.id} emote={emote} size={28} />
                      ))}
                    </div>
                  )}
                </div>

                {lvl.premiumReward && (
                  <div
                    className={`order-last flex w-full items-center gap-2 rounded-lg border px-3 py-2 sm:order-none sm:w-56 sm:shrink-0 ${
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
                      <p className="text-xs text-muted">{lvl.premiumReward}</p>
                      {lvl.premiumNote && <p className="text-[10px] italic text-muted">{lvl.premiumNote}</p>}
                    </div>
                  </div>
                )}

                <span className="shrink-0 whitespace-nowrap text-right text-xs text-muted sm:w-14">
                  {lvl.xpRequired.toLocaleString("de-DE")} P
                </span>
              </div>
            );
          })}
        </div>
      </section>

    </main>
  );
}
