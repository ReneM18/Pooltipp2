"use client";

import { useAppData } from "@/lib/AppDataContext";
import { SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";
import Emoji from "@/components/Emoji";

// Trefferquote pro Sportart im Profil (Rene, 27.10.2026: früher Premium-
// Belohnung im Saison-Pass, jetzt für alle). Anteil exakter Tipps an den
// ausgewerteten Tipps, aus den eigenen echten Tipps.
export default function HitRateBySport() {
  const { countingTips, matches } = useAppData();
  const bySport: Partial<Record<string, { exakt: number; total: number }>> = {};
  for (const tip of countingTips) {
    if (!tip.evaluated || tip.refunded) continue;
    const sport = matches.find((m) => m.id === tip.matchId)?.sport;
    if (!sport) continue;
    const entry = bySport[sport] ?? { exakt: 0, total: 0 };
    entry.total += 1;
    if (tip.resultTier === "exakt") entry.exakt += 1;
    bySport[sport] = entry;
  }
  const sports = SPORTS.filter((s) => (bySport[s]?.total ?? 0) > 0);

  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Trefferquote pro Sportart</p>
      <p className="mb-3 text-xs text-muted">Wie oft dein Tipp genau gestimmt hat (exakt).</p>
      {sports.length === 0 ? (
        <p className="text-xs text-muted">Noch keine ausgewerteten Tipps.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {sports.map((sport) => {
            const stat = bySport[sport]!;
            const rate = Math.round((stat.exakt / stat.total) * 100);
            return (
              <div key={sport}>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                  <span className="flex items-center gap-1.5 font-semibold text-ink">
                    <Emoji e={SPORT_ICONS[sport]} /> {sportLabel(sport)}
                  </span>
                  <span className="text-muted">
                    <span className="font-semibold text-gold">{rate}%</span> · {stat.exakt} von {stat.total}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-pitch">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${rate}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
