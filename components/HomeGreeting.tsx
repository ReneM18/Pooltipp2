"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/UserContext";
import { daysLabel, StreakState } from "@/lib/streak";
import { SPORTS, sportLabel } from "@/lib/types";
import { getNextTier, getTierForPoints, RANK_COLORS, tierLabel } from "@/lib/rankTiers";
import RankEmblem from "./RankEmblem";

// Begrüßung oben auf der Tipps-Seite: Name, was heute ansteht und drei
// Kurzinfos (Serie, Rang, Tagesbonus). Alles kommt aus dem Konto (UserContext,
// live über Realtime), damit es auf jedem Gerät gleich dasteht.

function greetingFor(date: Date): string {
  const hour = Number(
    new Intl.DateTimeFormat("de-AT", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Vienna" }).format(date)
  );
  if (hour < 5) return "Hallo";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

export default function HomeGreeting({ streak, toTip, openCount }: { streak: StreakState; toTip: number; openCount: number }) {
  const { displayName, isRegistered, sessionChecked, profileLoaded, rangPunkte, prestige, canClaimDailyBonus } = useUser();
  // Tageszeit erst im Browser (Server und Browser haben nicht dieselbe Uhr).
  const [hello, setHello] = useState("Hallo");
  useEffect(() => setHello(greetingFor(new Date())), []);

  const name = isRegistered && displayName.trim() ? displayName.trim() : null;
  const sub =
    openCount === 0
      ? "Gerade keine offenen Spiele."
      : toTip === 0
        ? `Alle ${openCount} offenen Spiele getippt ✓`
        : `${toTip} ${toTip === 1 ? "Spiel wartet" : "Spiele warten"} auf deinen Tipp`;

  // Rang in der Sportart mit den meisten Punkten.
  const bestSport = SPORTS.reduce((best, s) => ((rangPunkte[s] ?? 0) > (rangPunkte[best] ?? 0) ? s : best), SPORTS[0]);
  const points = rangPunkte[bestSport] ?? 0;
  const tier = getTierForPoints(points, bestSport);
  const next = getNextTier(points, bestSport);
  const progress = next ? Math.min(1, Math.max(0, (points - tier.minPoints) / (next.minPoints - tier.minPoints))) : 1;

  return (
    <div className="min-w-0">
      <h1 className="font-display text-xl font-bold leading-tight text-ink sm:text-2xl">
        {hello}
        {name ? `, ${name}` : ""} <span aria-hidden>👋</span>
      </h1>
      <p className="mt-0.5 text-sm text-muted">{sub}</p>
      {sessionChecked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <span
            title="Aufeinanderfolgende Tage mit mindestens einem Tipp"
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 font-display text-xs font-semibold ${
              streak.count > 0 ? "border-[#FF9B5C]/50 bg-surface/80 text-ink" : "border-edge bg-surface/80 text-muted"
            }`}
          >
            <span aria-hidden>🔥</span>
            {streak.count > 0 ? (
              <>
                <b className="text-[#FF9B5C]">{daysLabel(streak.count)}</b> in Folge
                {streak.status === "today" && <span aria-label="heute getippt">✓</span>}
              </>
            ) : (
              "Serie starten"
            )}
          </span>
          {isRegistered && profileLoaded && (
            <Link
              href="/rangliste"
              title={`Dein Rang in ${sportLabel(bestSport)}${next ? `, noch ${next.minPoints - points} Punkte bis ${tierLabel(next)}` : ""}`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-surface/80 px-3 py-1.5 font-display text-xs font-semibold text-ink transition-colors hover:border-ink/40"
            >
              <RankEmblem rank={tier.rank} sub={tier.sub} sport={bestSport} colors={RANK_COLORS[tier.rank]} size={18} prestige={prestige[bestSport] ?? 0} />
              {tierLabel(tier)} · {points.toLocaleString("de-DE")}
              <span className="h-1.5 w-10 overflow-hidden rounded-full bg-edge" aria-hidden>
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.round(progress * 100)}%`,
                    background: `linear-gradient(90deg, ${RANK_COLORS[tier.rank].from}, ${RANK_COLORS[tier.rank].to})`,
                  }}
                />
              </span>
            </Link>
          )}
          {isRegistered && profileLoaded && canClaimDailyBonus && (
            <Link
              href="/fortschritt"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gold/70 bg-gold/15 px-3 py-1.5 font-display text-xs font-semibold text-gold transition-colors hover:bg-gold/25"
            >
              <span aria-hidden>🎁</span> Bonus abholen
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
