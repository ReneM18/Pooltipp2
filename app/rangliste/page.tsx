"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { mockLeaderboard, mockLeaderboardBySport, LeaderboardEntry } from "@/lib/mockLeaderboard";
import { SPORTS, Sport } from "@/lib/types";
import { getTierForPoints, RANK_COLORS, RANK_TITLES, SPORT_EMOJI, getIconForName } from "@/lib/rankTiers";
import RankBadge from "@/components/RankBadge";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { getCurrentWeekWindow, getSimulatedWeeklyEntries, sumWeeklyRangDelta } from "@/lib/weeklyLeaderboard";

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

type ViewTab = "Gesamt" | "Spieltag" | Sport;

const TABS: ViewTab[] = ["Gesamt", "Spieltag", ...SPORTS];

export default function RanglistePage() {
  const [tab, setTab] = useState<ViewTab>("Gesamt");
  const { rangPunkte, displayName } = useUser();
  const { myTips } = useAppData();

  // Die "Gesamt"-Ansicht bleibt eine separate Mock-Zahl (kein sinnvoller
  // Summenwert über Sportarten hinweg). In den Sport-Ansichten wird der
  // eigene Eintrag live mit den PoolScore-Rangliste-Punkten aktualisiert und
  // die Tabelle neu sortiert, damit man nach einer Auswertung sofort sieht,
  // wo man jetzt steht.
  const baseEntries: LeaderboardEntry[] =
    tab === "Gesamt" || tab === "Spieltag" ? mockLeaderboard : mockLeaderboardBySport[tab];

  // Spieltags-Rangliste: nur die Rangpunkte-Änderung aus dieser Kalenderwoche
  // zählt, mit Countdown bis zum Reset – siehe lib/weeklyLeaderboard.ts.
  const weekWindow = getCurrentWeekWindow();
  const weeklyEntries: LeaderboardEntry[] =
    tab === "Spieltag"
      ? [
          ...getSimulatedWeeklyEntries(weekWindow.start),
          { name: displayName, points: sumWeeklyRangDelta(myTips, weekWindow) },
        ]
          .sort((a, b) => b.points - a.points)
          .map((entry, index) => ({
            rank: index + 1,
            name: entry.name,
            points: entry.points,
            isCurrentUser: entry.name === displayName,
          }))
      : [];

  const entries: LeaderboardEntry[] =
    tab === "Gesamt"
      ? baseEntries.map((entry) => (entry.isCurrentUser ? { ...entry, name: displayName } : entry))
      : tab === "Spieltag"
      ? weeklyEntries
      : [...baseEntries]
          // Beim eigenen Eintrag IMMER auch den aktuellen Anzeigenamen
          // einsetzen (nicht nur die Punkte) – sonst zeigt die Rangliste nach
          // einer Namensänderung im Profil weiter den alten Mock-Namen an.
          .map((entry) =>
            entry.isCurrentUser ? { ...entry, name: displayName, points: rangPunkte[tab] } : entry
          )
          .sort((a, b) => b.points - a.points)
          .map((entry, index) => ({ ...entry, rank: index + 1 }));

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-4">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Rangliste</h1>
        {tab === "Spieltag" ? (
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            Zählt nur Punkte dieser Woche · <WeeklyCountdown target={weekWindow.end.getTime()} />
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">Wird jeden Monat zurückgesetzt.</p>
        )}
      </div>

      {/* Tab-Umschalter: Gesamt + Spieltag + je Sportart */}
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
            {t === "Spieltag" && <span aria-hidden>⏱️</span>}
            {t !== "Gesamt" && t !== "Spieltag" && <span>{sportIcon[t as Sport]}</span>}
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
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <RankNumber rank={entry.rank} />
              <NameAvatar name={entry.name} rank={entry.rank} />
              <RankBadge
                option={
                  tab === "Gesamt" || tab === "Spieltag"
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
                        title: RANK_TITLES[getTierForPoints(entry.points).rank],
                      }
                }
                size="sm"
              />
              {entry.isCurrentUser ? (
                <span className="min-w-0 truncate font-display text-base font-semibold text-gold">
                  {entry.name}
                  <span className="ml-2 text-xs font-medium text-muted">(Du)</span>
                </span>
              ) : (
                <Link
                  href={`/spieler/${encodeURIComponent(entry.name)}`}
                  className="min-w-0 truncate font-display text-base font-semibold text-ink transition-colors hover:text-gold"
                >
                  {entry.name}
                </Link>
              )}
            </div>
            <span className="ml-2 shrink-0 font-display text-base font-semibold text-ink">
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

// Countdown bis zum wöchentlichen Reset der Spieltags-Rangliste (Montag
// 00:00). Eigene, kleine Komponente statt components/Countdown.tsx, weil
// deren Text ("schließt in…", "Tippannahme geschlossen") auf Tipp-Fristen
// zugeschnitten ist, nicht auf einen Ranglisten-Reset.
function WeeklyCountdown({ target }: { target: number }) {
  const [remaining, setRemaining] = useState(() => target - Date.now());

  useEffect(() => {
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining <= 0) return <span>wird gerade zurückgesetzt…</span>;
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return <span>endet in {days}T {hours}h</span>;
  if (hours > 0) return <span>endet in {hours}h {minutes}m</span>;
  return <span>endet in {minutes}m</span>;
}

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
