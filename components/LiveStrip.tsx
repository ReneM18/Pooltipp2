"use client";

import { Match, Team } from "@/lib/types";
import { displayOrder } from "@/lib/teamOrder";
import TeamBadge, { matchJerseyProps } from "./TeamBadge";
import FitText from "./FitText";

// Schmaler Streifen oben auf der Tipps-Seite für jedes Spiel, das gerade
// läuft: Spielstand (live aus der Datenbank) und der eigene Tipp. Ein Klick
// rollt zur Karte.

interface LiveItem {
  match: Match;
  home: Team;
  away: Team;
  // Schon in Anzeige-Reihenfolge, z. B. "2 : 1" oder bei 1X2 "✓".
  myTip: string | null;
}

export default function LiveStrip({ items }: { items: LiveItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 flex flex-col gap-2">
      {items.map(({ match, home, away, myTip }) => {
        const [left, right] = displayOrder(match.sport, home, away);
        const [ls, rs] = displayOrder(match.sport, match.liveHomeScore, match.liveAwayScore);
        const score = ls !== null && rs !== null ? `${ls} : ${rs}` : "– : –";
        return (
          <button
            key={match.id}
            type="button"
            onClick={() => document.getElementById(`spiel-${match.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}
            className="w-full rounded-card border border-red-500/45 bg-gradient-to-r from-red-500/15 via-surface to-surface px-3 py-2 text-left transition-colors hover:border-red-500/70"
          >
            <span className="mb-1 flex items-center justify-between gap-2 text-[11px]">
              <span className="flex items-center gap-1.5 font-display font-bold text-red-400">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden />
                LIVE · {match.competition}
              </span>
              <span className="whitespace-nowrap text-muted">
                {myTip ? (
                  <>
                    Dein Tipp <b className="font-display text-ink">{myTip}</b>
                  </>
                ) : (
                  "Kein Tipp"
                )}
              </span>
            </span>
            <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="flex min-w-0 items-center justify-end gap-1.5">
                <FitText text={left.name} className="text-right font-display text-sm font-semibold leading-tight text-ink" />
                <TeamBadge sport={match.sport} {...matchJerseyProps(match, left)} isNationalTeam={left.isNationalTeam} countryCode={left.countryCode} size={24} />
              </span>
              <span className="whitespace-nowrap font-display text-xl font-bold tabular-nums text-ink">{score}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <TeamBadge sport={match.sport} {...matchJerseyProps(match, right)} isNationalTeam={right.isNationalTeam} countryCode={right.countryCode} flip size={24} />
                <FitText text={right.name} className="font-display text-sm font-semibold leading-tight text-ink" />
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
