"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/lib/UserContext";
import { daysLabel, StreakState } from "@/lib/streak";
import { SPORTS, sportLabel } from "@/lib/types";
import { getNextTier, getTierForPoints, RANK_COLORS, tierLabel } from "@/lib/rankTiers";
import RankEmblem from "./RankEmblem";
import { useBeginnerShieldLeft } from "./BeginnerShieldHint";
import { useAppData } from "@/lib/AppDataContext";
import { BEGINNER_SHIELD_TIPS } from "@/lib/poolScore";

// Begrüßung oben auf der Tipps-Seite: Name und drei
// Kurzinfos (Serie, Rang, Tagesbonus). Alles kommt aus dem Konto (UserContext,
// live über Realtime), damit es auf jedem Gerät gleich dasteht.

function greetingFor(date: Date): string {
  // Nur die Stunde herausnehmen: format() liefert "13 Uhr", daraus wurde
  // NaN und damit immer "Guten Abend" (Rene, 12.10.2026).
  const hourPart = new Intl.DateTimeFormat("de-AT", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Vienna" })
    .formatToParts(date)
    .find((p) => p.type === "hour")?.value;
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return "Hallo";
  if (hour < 5) return "Hallo";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

export default function HomeGreeting({ streak }: { streak: StreakState }) {
  const { displayName, isRegistered, sessionChecked, profileLoaded, rangPunkte, prestige, canClaimDailyBonus, authUserId } = useUser();
  const { myTipsLoaded } = useAppData();
  const shieldLeft = useBeginnerShieldLeft();
  // Tageszeit erst im Browser (Server und Browser haben nicht dieselbe Uhr).
  const [hello, setHello] = useState("Hallo");
  // Jede Minute neu, damit die Begrüßung auch bei lange offener App stimmt.
  useEffect(() => {
    const update = () => setHello(greetingFor(new Date()));
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, []);

  const name = isRegistered && displayName.trim() ? displayName.trim() : null;
  // "X Spiele warten auf deinen Tipp" steht jetzt in der Hinweis-Leiste
  // darunter (components/HomeTipBar.tsx, Rene, 18.10.2026: Tippen/Live/Beendet).

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
      {sessionChecked && (
        <div className="mt-2 flex flex-wrap gap-2">
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
          {/* Anfänger-Schutz als kleiner Knopf statt eigener Zeile darunter
              (Rene, 27.10.2026: Spiele sollen weiter oben anfangen). */}
          {authUserId && myTipsLoaded && shieldLeft > 0 && (
            <span
              title={`Anfänger-Schutz: noch ${shieldLeft} von ${BEGINNER_SHIELD_TIPS} Tipps ohne Punktabzug`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-edge bg-surface/80 px-3 py-1.5 font-display text-xs font-semibold text-muted"
            >
              <span aria-hidden>🐣</span> Noch {shieldLeft} Tipps ohne Minus
            </span>
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
