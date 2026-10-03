import { Sport } from "@/lib/types";
import RankEmblem from "@/components/RankEmblem";
import { RANK_LADDER, RANK_COLORS, SPORT_EMOJI, getTierForPoints, getNextTier, tierLabel } from "@/lib/rankTiers";

const GOAT_TIER = RANK_LADDER[RANK_LADDER.length - 1];

export default function RankProgress({
  sport,
  points,
  unsterblich = false,
}: {
  sport: Sport;
  points: number;
  /** In allen Sportarten GOAT – schaltet das letzte Abzeichen "Unsterblich" frei. */
  unsterblich?: boolean;
}) {
  const current = getTierForPoints(points);
  const next = getNextTier(points);
  const progress = next ? Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100) : 100;

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-2 font-display text-sm font-semibold text-ink">
          <span>{SPORT_EMOJI[sport]}</span>
          {sport} · {tierLabel(current)}
        </span>
        <span className="text-xs text-muted">{points.toLocaleString("de-DE")} P</span>
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
          : `Höchste Stufe erreicht – ${tierLabel(GOAT_TIER)}.`}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {RANK_LADDER.map((tier, i) => {
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
          title={`Unsterblich: ${GOAT_TIER.rank} in allen 4 Sportarten`}
          className={`flex items-center justify-center rounded-lg p-0.5 ${unsterblich ? "ring-2 ring-gold" : "opacity-30 grayscale"}`}
        >
          <RankEmblem unsterblich colors={RANK_COLORS[GOAT_TIER.rank]} size={26} />
        </span>
      </div>
      {/* Ganz oben, noch gesperrt: kurz erklären, was GOAT und Unsterblich sind. */}
      {!unsterblich && (
        <p className="mt-3 text-[11px] text-muted">
          🔒{" "}
          {points < GOAT_TIER.minPoints
            ? `Ganz oben wartet der ${GOAT_TIER.rank}: ab ${GOAT_TIER.minPoints.toLocaleString("de-DE")} Punkten in einer Sportart. `
            : ""}
          Unsterblich wird, wer in allen 4 Sportarten {GOAT_TIER.rank} ist.
        </p>
      )}
    </div>
  );
}
