"use client";

import { useAppData } from "@/lib/AppDataContext";
import { SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";
import Emoji from "@/components/Emoji";
import { hasExakt, type SportCardStat } from "@/lib/sportBio";

// Trefferquote pro Sportart im Profil (Rene, 27.10.2026: früher Premium-
// Belohnung im Saison-Pass, jetzt für alle). Anteil exakter Tipps an den
// ausgewerteten Ergebnis-Tipps (1X2-Tipps können nie exakt sein). NFL, NBA
// und NHL haben kein Exakt: dort zählt "Sieger richtig" (Rene, 29.10.2026).
// Zahlen aus der dauerhaften Tipp-Statistik (tip_stats über sport_card_stats), damit gelöschte Spiele nicht fehlen
// (Rene, 27.10.2026: "alles ohne Statistik"). Nur ohne die Zahlen aus der
// Datenbank (Gast, lädt noch) wird aus den Tipps im Speicher gerechnet.
export default function HitRateBySport({ stats }: { stats: SportCardStat[] | null }) {
  const { countingTips, matches } = useAppData();
  const bySport: Partial<Record<string, { exakt: number; total: number }>> = {};
  if (stats) {
    for (const st of stats) {
      const entry = hasExakt(st.sport)
        ? { exakt: st.exakt ?? 0, total: st.evaluatedScore ?? 0 }
        : { exakt: st.richtig ?? 0, total: st.evaluated ?? 0 };
      if (entry.total > 0) bySport[st.sport] = entry;
    }
  } else {
    for (const tip of countingTips) {
      if (!tip.evaluated || tip.refunded) continue;
      const match = matches.find((m) => m.id === tip.matchId);
      const sport = match?.sport;
      if (!sport) continue;
      const us = !hasExakt(sport);
      if (!us && match?.tipMode === "1x2") continue;
      const entry = bySport[sport] ?? { exakt: 0, total: 0 };
      entry.total += 1;
      if (us ? tip.resultTier && tip.resultTier !== "falsch" : tip.resultTier === "exakt") entry.exakt += 1;
      bySport[sport] = entry;
    }
  }
  const sports = SPORTS.filter((s) => (bySport[s]?.total ?? 0) > 0);

  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <p className="text-sm font-semibold text-ink">Trefferquote pro Sportart</p>
      <p className="mb-3 text-xs text-muted">Wie oft dein Tipp genau gestimmt hat (exakt), bei NFL, NBA und NHL der Sieger.</p>
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
                    {hasExakt(sport) ? "" : " Sieger"}
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
