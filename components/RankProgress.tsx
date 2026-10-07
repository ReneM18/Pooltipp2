"use client";

import { useState } from "react";
import { Sport, SPORTS, sportLabel } from "@/lib/types";
import RankEmblem from "@/components/RankEmblem";
import {
  RANK_COLORS,
  SPORT_EMOJI,
  getTierForPoints,
  getNextTier,
  goatMinPoints,
  PRESTIGE_MAX_STARS,
  prestigeMark,
  rankLadder,
  tierLabel,
} from "@/lib/rankTiers";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";

export default function RankProgress({
  sport,
  points,
  prestige = 0,
  unsterblich = false,
}: {
  sport: Sport;
  points: number;
  /** Prestige-Stufe in dieser Sportart (0 = noch keins). */
  prestige?: number;
  /** In allen Sportarten GOAT – schaltet das letzte Abzeichen "Unsterblich" frei. */
  unsterblich?: boolean;
}) {
  // Football hat eigene, kleinere Grenzen (weniger Spiele im Jahr).
  const ladder = rankLadder(sport);
  const goatTier = ladder[ladder.length - 1];
  const current = getTierForPoints(points, sport);
  const next = getNextTier(points, sport);
  const progress = next ? Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100) : 100;

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 font-display text-sm font-semibold text-ink">
          <span>{SPORT_EMOJI[sport]}</span>
          {sportLabel(sport)} · {tierLabel(current)}
          {prestige > 0 && (
            <span className="whitespace-nowrap text-xs font-bold text-gold" title={`Prestige ${prestige}`}>
              {prestige > PRESTIGE_MAX_STARS ? "👑" : prestigeMark(prestige)} Prestige {prestige}
            </span>
          )}
        </span>
        <span className="shrink-0 text-xs text-muted">{points.toLocaleString("de-DE")} P</span>
      </div>

      <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-pitch">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.max(4, progress)}%`,
            background: `linear-gradient(90deg, ${RANK_COLORS[current.rank].from}, ${RANK_COLORS[current.rank].to})`,
          }}
        />
      </div>
      <p className="mb-4 text-xs text-muted">
        {next
          ? `Noch ${(next.minPoints - points).toLocaleString("de-DE")} Punkte bis ${tierLabel(next)}.`
          : `Höchste Stufe erreicht – ${tierLabel(goatTier)}.`}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {ladder.map((tier, i) => {
          const unlocked = points >= tier.minPoints;
          const isCurrent = tier === current;
          return (
            <span
              key={i}
              title={`${tierLabel(tier)} ab ${tier.minPoints.toLocaleString("de-DE")} P`}
              className={`flex items-center justify-center rounded-lg p-0.5 ${isCurrent ? "ring-2 ring-gold" : ""} ${
                unlocked ? "" : "opacity-30 grayscale"
              }`}
            >
              <RankEmblem
                rank={tier.rank}
                sub={tier.sub}
                sport={tier.rank === "GOAT" ? sport : undefined}
                colors={RANK_COLORS[tier.rank]}
                size={26}
              />
            </span>
          );
        })}
        {/* Ganz zum Schluss, über allen Sportarten: Unsterblich. */}
        <span
          title={`Unsterblich: ${goatTier.rank} in allen ${SPORTS.length} Sportarten`}
          className={`flex items-center justify-center rounded-lg p-0.5 ${unsterblich ? "ring-2 ring-gold" : "opacity-30 grayscale"}`}
        >
          <RankEmblem unsterblich colors={RANK_COLORS[goatTier.rank]} size={26} />
        </span>
      </div>
      {/* Ganz oben, noch gesperrt: kurz erklären, was GOAT und Unsterblich sind. */}
      {!unsterblich && (
        <p className="mt-3 text-[11px] text-muted">
          🔒{" "}
          {points < goatTier.minPoints
            ? `Ganz oben wartet der ${goatTier.rank}: ab ${goatTier.minPoints.toLocaleString("de-DE")} Punkten in ${sportLabel(sport)}. `
            : ""}
          Unsterblich wird, wer in allen {SPORTS.length} Sportarten {goatTier.rank} ist.
        </p>
      )}

      {points >= goatMinPoints(sport) && <PrestigeBox sport={sport} points={points} prestige={prestige} />}
    </div>
  );
}

// Als GOAT freiwillig "Prestige gehen": Rückfrage, dann rechnet der Server
// (supabase/prestige.sql). Das Ergebnis kommt per Sofort-Abgleich auf jedes
// Gerät des Spielers.
function PrestigeBox({ sport, points, prestige }: { sport: Sport; points: number; prestige: number }) {
  const { goPrestige } = useUser();
  const { showToast, celebrate } = useFeedback();
  const [step, setStep] = useState<"idle" | "confirm" | "busy">("idle");
  const [error, setError] = useState<string | null>(null);
  const nextLevel = prestige + 1;

  async function confirm() {
    setStep("busy");
    setError(null);
    const result = await goPrestige(sport);
    if (!result.ok) {
      setError(result.error);
      setStep("confirm");
      return;
    }
    setStep("idle");
    celebrate(true);
    showToast(`⭐ Prestige ${result.level} in ${sportLabel(sport)}! Viel Spaß beim neuen Aufstieg.`, "gold");
  }

  return (
    <div className="mt-4 rounded-card border border-gold/50 bg-gold/10 p-3">
      <p className="font-display text-sm font-semibold text-gold">⭐ Prestige gehen</p>
      <p className="mt-1 text-xs text-ink">
        Du bist GOAT in {sportLabel(sport)}. Willst du nochmal von vorne? Deine {sportLabel(sport)}-Punkte starten
        wieder bei 0 (Bronze I), dafür bekommst du Prestige {nextLevel} ({prestigeMark(nextLevel)}) für immer an
        deinem Abzeichen.
      </p>
      <p className="mt-1 text-[11px] text-muted">
        Tipps, Coins, Saison-Pass und deine anderen Sportarten bleiben, wie sie sind. Deine{" "}
        {points.toLocaleString("de-DE")} Punkte werden gesichert, alle sehen deine Sterne in der Rangliste.
      </p>
      {step === "idle" ? (
        <button
          onClick={() => setStep("confirm")}
          className="mt-3 rounded-full bg-gold px-4 py-2 text-sm font-bold text-pitch transition-opacity hover:opacity-90"
        >
          Prestige gehen
        </button>
      ) : (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink">
            Wirklich? Das kann man nicht rückgängig machen.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              onClick={confirm}
              disabled={step === "busy"}
              className="rounded-full bg-gold px-4 py-2 text-sm font-bold text-pitch transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {step === "busy" ? "Einen Moment…" : `Ja, Prestige ${nextLevel}`}
            </button>
            <button
              onClick={() => {
                setStep("idle");
                setError(null);
              }}
              disabled={step === "busy"}
              className="rounded-full border border-edge bg-surface px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </div>
  );
}
