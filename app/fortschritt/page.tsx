"use client";

import { useEffect, useState, CSSProperties } from "react";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { PASS_LEVELS, PREMIUM_PASS_PRICE } from "@/lib/passLevels";
import { xpForLevel } from "@/lib/seasonPass";
import { SEASON_THEME } from "@/lib/seasonTheme";
import { SPORTS } from "@/lib/types";
import { CURRENT_SEASON, seasonCountdownText, seasonPeriodText } from "@/lib/seasons";
import { EmoteSticker } from "@/components/Emotes";
import { useFeedback } from "@/lib/FeedbackContext";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

// Deterministisch simulierter Community-Durchschnitt fürs Tiefen-Statistik-
// Feature (Level 7 Premium) – gleiches hashString+mulberry32-Muster wie in
// lib/communityTips.ts / lib/poolScore.ts, hier lokal gehalten, da nur eine
// einzelne Zahl pro Sportart gebraucht wird.
function hashString(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(h, 31) + input.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return function () {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function communityHitRateForSport(sport: string): number {
  const rand = mulberry32(hashString(`community-hitrate-${sport}`));
  return 28 + Math.round(rand() * 24); // 28–52 % – plausible Trefferquote für "exakt"
}

export default function FortschrittPage() {
  const {
    passXP,
    hasPremiumPass,
    buyPremiumPass,
    canClaimDailyBonus,
    claimDailyBonus,
    customFrameColors,
    setCustomFrameColors,
  } = useUser();
  const { tipsBySport, myTips, matches } = useAppData();
  const { showToast, celebrate } = useFeedback();
  const [purchasing, setPurchasing] = useState(false);
  // Erst im Browser ausrechnen (heutiges Datum), nicht schon beim Bauen der Seite.
  const [countdown, setCountdown] = useState<string | null>(null);
  useEffect(() => {
    setCountdown(seasonCountdownText(CURRENT_SEASON, new Date()));
  }, []);

  async function handleClaimDailyBonus() {
    const { claimed, error } = await claimDailyBonus();
    if (error) {
      showToast(error, "info");
      return;
    }
    if (!claimed) {
      showToast("Den Bonus hast du heute schon abgeholt – morgen gibt's den nächsten.", "info");
      return;
    }
    celebrate();
    showToast("🎁 Täglicher Bonus abgeholt: +8 Sterne, +100 Pass-XP!", "gold");
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

  // Level 7 Premium "Tiefen-Statistik": eigene Trefferquote (exakte Tipps) pro
  // Sportart, ermittelt aus echten myTips-Daten (nicht simuliert).
  const hitRateBySport: Partial<Record<string, { exakt: number; total: number }>> = {};
  for (const tip of myTips) {
    if (!tip.evaluated || tip.refunded) continue;
    const sport = matches.find((m) => m.id === tip.matchId)?.sport;
    if (!sport) continue;
    const entry = hitRateBySport[sport] ?? { exakt: 0, total: 0 };
    entry.total += 1;
    if (tip.resultTier === "exakt") entry.exakt += 1;
    hitRateBySport[sport] = entry;
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <div className="mb-6">
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
          Hol dir jeden Tag deinen Bonus, sammle Saison-XP und schalte Level für Level neue Belohnungen frei.
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

      {/* Täglicher Bonus – der EINZIGE Weg, wie der Saison-Pass steigt.
          Tipp-Ergebnisse wirken sich nur auf Rangliste-Punkte und Sterne aus. */}
      <section className="mb-8">
        <div className="flex flex-col items-start gap-3 rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
              <span className="text-lg">🎁</span> Täglicher Bonus
            </p>
            <p className="mt-0.5 text-xs text-muted">
              Einmal pro Tag: +8 Sterne und +100 Pass-XP. Der Saison-Pass klettert nur so –
              nicht durch Tipp-Ergebnisse.
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

      {/* Feste Rollen der drei Zähler – damit Tester gleich verstehen, was wofür ist. */}
      <section className="mb-8 rounded-card border border-edge bg-surface p-4">
        <p className="mb-2 font-display text-sm font-semibold text-ink">So funktioniert der Pass</p>
        <ul className="flex flex-col gap-1.5 text-xs text-muted">
          <li>
            <span className="font-semibold text-ink">Saison-XP</span> zeigen, wie aktiv du bist, und füllen nur
            diesen Pass.
          </li>
          <li>
            <span className="font-semibold text-ink">Rangpunkte</span> zeigen, wie gut du tippst (Rangliste) und
            haben mit dem Pass nichts zu tun.
          </li>
          <li>
            <span className="font-semibold text-ink">Sterne</span> brauchst du zum Tippen. Der Pass gibt nur auf
            Level 10 ein paar dazu.
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

      {/* Level 7 Premium: Tiefen-Statistik – eigene Trefferquote (echte
          myTips-Daten) vs. ein illustrativer Community-Durchschnitt. */}
      {hasLevelPremium(7) && (
        <section className="mb-8">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">Tiefen-Statistik</h2>
          <p className="mb-3 text-xs text-muted">
            Deine Trefferquote (exakte Tipps) pro Sportart im Vergleich zum Community-Durchschnitt.
            Hinweis: Der Community-Wert ist noch ein Beispielwert, deine eigene Quote ist echt.
          </p>
          <div className="flex flex-col gap-3">
            {SPORTS.map((sport) => {
              const stat = hitRateBySport[sport];
              const myRate = stat && stat.total > 0 ? Math.round((stat.exakt / stat.total) * 100) : null;
              const communityRate = communityHitRateForSport(sport);
              return (
                <div key={sport} className="rounded-card border border-edge bg-surface p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-display text-sm font-semibold text-ink">
                      {sportIcon[sport]} {sport}
                    </span>
                    <span className="text-xs text-muted">{stat?.total ?? 0} ausgewertete Tipps</span>
                  </div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-gold">Du</span>
                    <span className="text-gold">{myRate !== null ? `${myRate}%` : "–"}</span>
                  </div>
                  <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-pitch">
                    <div className="h-full rounded-full bg-gold" style={{ width: `${myRate ?? 0}%` }} />
                  </div>
                  <div className="mb-1 flex items-center justify-between text-[11px]">
                    <span className="text-muted">Community</span>
                    <span className="text-muted">{communityRate}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-pitch">
                    <div className="h-full rounded-full bg-muted/50" style={{ width: `${communityRate}%` }} />
                  </div>
                </div>
              );
            })}
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
            const isPayout = lvl.kind === "badge" || !!lvl.starsReward;
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
