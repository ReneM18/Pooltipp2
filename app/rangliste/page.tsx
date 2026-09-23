"use client";

import { useState } from "react";
import { mockLeaderboard, mockLeaderboardBySport, LeaderboardEntry } from "@/lib/mockLeaderboard";
import { SPORTS, Sport } from "@/lib/types";

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
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
