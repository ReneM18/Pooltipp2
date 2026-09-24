import { Sport } from "@/lib/types";
import {
  RANK_LADDER,
  RANK_COLORS,
  SPORT_EMOJI,
  getTierForPoints,
  getNextTier,
  tierLabel,
} from "@/lib/rankTiers";

export default function RankProgress({ sport, points }: { sport: Sport; points: number }) {
  const current = getTierForPoints(points);
  const next = getNextTier(points);
  const progress = next
    ? Math.round(((points - current.minPoints) / (next.minPoints - current.minPoints)) * 100)
    : 100;

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
          : "Höchste Stufe erreicht – Diamant I."}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {RANK_LADDER.map((tier, i) => {
          const unlocked = points >= tier.minPoints;
          const isCurrent = tier === current;
          const colors = RANK_COLORS[tier.rank];
          return (
            <span
              key={i}
              title={`${tierLabel(tier)} ab ${tier.minPoints.toLocaleString("de-DE")} P`}
              className={`flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-[10px] font-bold ${
                isCurrent ? "ring-2 ring-gold" : ""
              }`}
              style={{
                background: unlocked
                  ? `linear-gradient(135deg, ${colors.from}, ${colors.to})`
                  : "rgba(255,255,255,0.06)",
                color: unlocked ? colors.text : "#5a6b60",
              }}
            >
              {tier.sub}
            </span>
          );
        })}
      </div>
    </div>
  );
}
