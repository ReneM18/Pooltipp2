"use client";

import { useState } from "react";
import Link from "next/link";
import { mockLeaderboard, mockLeaderboardBySport, LeaderboardEntry } from "@/lib/mockLeaderboard";
import { SPORTS, Sport } from "@/lib/types";
import { getTierForPoints, RANK_COLORS, SPORT_EMOJI, getIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

type ViewTab = "Gesamt" | Sport;

const TABS: ViewTab[] = ["Gesamt", ...SPORTS];

export default function RanglistePage() {
  const [tab, setTab] = useState<ViewTab>("Gesamt");

  const entries: LeaderboardEntry[] = tab === "Gesamt" ? mockLeaderboard : mockLeaderboardBySport[tab];

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Rangliste</h1>
        <p className="mt-1 text-sm text-muted">
          Wird jeden Monat zurückgesetzt – jeder hat wieder die gleiche Chance ganz oben zu landen.
        </p>
      </div>

      {/* Tab-Umschalter: Gesamt + je Sportart */}
      <div className="mb-5 flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t
                ? "border-gold bg-gold/15 text-gold"
                : "border-edge bg-surface text-muted hover:text-ink"
            }`}
          >
            {t !== "Gesamt" && <span>{sportIcon[t as Sport]}</span>}
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {entries.map((entry, index) => (
          <div
            key={entry.rank}
            className={`flex items-center justify-between px-5 py-4 ${
              index !== entries.length - 1 ? "border-b border-edge" : ""
            } ${entry.isCurrentUser ? "bg-surface-hover" : podiumRowClass(entry.rank)}`}
          >
            <div className="flex items-center gap-3">
              <RankNumber rank={entry.rank} />
              <NameAvatar name={entry.name} rank={entry.rank} />
              <RankBadge
                option={
                  tab === "Gesamt"
                    ? getIconForName(entry.name)
                    : {
                        id: `${tab}-${entry.rank}`,
                        kind: "sport",
                        sport: tab as Sport,
                        label: `${tab} ${getTierForPoints(entry.points).rank} ${getTierForPoints(entry.points).sub}`,
                        icon: SPORT_EMOJI[tab as Sport],
                        points: entry.points,
                        colorFrom: RANK_COLORS[getTierForPoints(entry.points).rank].from,
                        colorTo: RANK_COLORS[getTierForPoints(entry.points).rank].to,
                        colorText: RANK_COLORS[getTierForPoints(entry.points).rank].text,
                      }
                }
                size="sm"
              />
              {entry.isCurrentUser ? (
                <span className="font-display text-base font-semibold text-gold">
                  {entry.name}
                  <span className="ml-2 text-xs font-medium text-muted">(Du)</span>
                </span>
              ) : (
                <Link
                  href={`/spieler/${encodeURIComponent(entry.name)}`}
                  className="font-display text-base font-semibold text-ink transition-colors hover:text-gold"
                >
                  {entry.name}
                </Link>
              )}
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

function RankNumber({ rank }: { rank: number }) {
  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center font-display text-sm text-muted">
      {medal ?? rank}
    </span>
  );
}

// Dezente Podium-Färbung für die ersten drei Plätze, damit sie auf einen
// Blick auffallen, statt sich nur durch die Medaille zu unterscheiden.
function podiumRowClass(rank: number): string {
  if (rank === 1) return "bg-gold/[0.06]";
  if (rank === 2) return "bg-ink/[0.03]";
  if (rank === 3) return "bg-[#CD7F32]/[0.06]";
  return "";
}

const PODIUM_RING: Record<number, string> = {
  1: "ring-2 ring-gold",
  2: "ring-2 ring-muted/60",
  3: "ring-2 ring-[#CD7F32]/70",
};

function NameAvatar({ name, rank }: { name: string; rank: number }) {
  const ring = PODIUM_RING[rank] ?? "";
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-hover font-display text-xs font-semibold text-muted ${ring}`}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}
