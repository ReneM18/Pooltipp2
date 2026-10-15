"use client";

import { useMemo } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { BEGINNER_SHIELD_TIPS } from "@/lib/poolScore";
import { SPORTS, SPORT_ICONS, Sport, sportLabel } from "@/lib/types";

// Anfänger-Schutz sichtbar machen: je Sportart, wie viele der ersten 10
// gewerteten Tipps noch ohne Punktabzug sind (Rene, 15.10.2026).
// Gezählt wird wie in supabase/anfaenger-schutz.sql: alle gewerteten Tipps
// der Sportart (mit Ergebnis, nicht abgesagt) – der 1. bis 10. davon hat
// beginner_slot = true. Wer noch nichts gewertet hat, hat volle 10.
// Gezeigt werden nur Sportarten, in denen der Spieler schon getippt hat.
export function useBeginnerShieldLeft(): { sport: Sport; left: number }[] {
  const { matches, myTips } = useAppData();
  return useMemo(() => {
    const sportById = new Map(matches.map((m) => [m.id, m.sport] as const));
    const tipped = new Set<Sport>();
    const scored: Partial<Record<Sport, number>> = {};
    for (const tip of myTips) {
      const sport = sportById.get(tip.matchId);
      if (!sport) continue;
      tipped.add(sport);
      if (tip.evaluated && tip.resultTier && !tip.refunded) scored[sport] = (scored[sport] ?? 0) + 1;
    }
    return SPORTS.filter((s) => tipped.has(s))
      .map((sport) => ({ sport, left: Math.max(0, BEGINNER_SHIELD_TIPS - (scored[sport] ?? 0)) }))
      .filter((s) => s.left > 0);
  }, [matches, myTips]);
}

// Kleiner Hinweis, verschwindet je Sportart nach dem 10. gewerteten Tipp
// (Rene, 15.10.2026).
export default function BeginnerShieldHint({ className = "" }: { className?: string }) {
  const left = useBeginnerShieldLeft();
  if (left.length === 0) return null;
  return (
    <div className={`text-xs text-muted ${className}`}>
      {left.map(({ sport, left: n }) => (
        <p key={sport}>
          🐣 Anfänger-Schutz aktiv ({SPORT_ICONS[sport]} {sportLabel(sport)}): noch{" "}
          <span className="font-semibold text-ink">{n}</span> von {BEGINNER_SHIELD_TIPS} Tipps ohne Punktabzug
        </p>
      ))}
    </div>
  );
}
