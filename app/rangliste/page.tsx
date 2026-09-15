import { mockLeaderboard } from "@/lib/mockLeaderboard";

export default function RanglistePage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Rangliste</h1>
        <p className="mt-1 text-sm text-muted">
          Wird jeden Monat zurückgesetzt – jeder hat wieder die gleiche Chance ganz oben zu landen.
        </p>
      </div>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {mockLeaderboard.map((entry, index) => (
          <div
            key={entry.rank}
            className={`flex items-center justify-between px-5 py-4 ${
              index !== mockLeaderboard.length - 1 ? "border-b border-edge" : ""
            } ${entry.isCurrentUser ? "bg-surface-hover" : ""}`}
          >
            <div className="flex items-center gap-4">
              <RankBadge rank={entry.rank} />
              <span
                className={`font-display text-base font-semibold ${
                  entry.isCurrentUser ? "text-gold" : "text-ink"
                }`}
              >
                {entry.name}
                {entry.isCurrentUser && (
                  <span className="ml-2 text-xs font-medium text-muted">(Du)</span>
                )}
              </span>
            </div>
            <span className="font-display text-base font-semibold text-ink">
              {entry.points.toLocaleString("de-DE")}
            </span>
          </div>
        ))}
      </div>
    </main>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="flex h-7 w-7 items-center justify-center font-display text-sm text-muted">
      {medal ?? rank}
    </span>
  );
}
