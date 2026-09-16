"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
};

export default function DashboardPage() {
  const { spendStars, recordTipSubmitted } = useUser();
  const { matches, getTeam, tipCounts, submitTip, myTips } = useAppData();
  const [tab, setTab] = useState<"offen" | "historie">("offen");

  function findTipForMatch(matchId: string) {
    // letzten Tipp für dieses Spiel finden (falls mehrfach möglich in Zukunft)
    return [...myTips].reverse().find((t) => t.matchId === matchId);
  }

  function handleSubmitTip(matchId: string, stake: number, homeScore: number, awayScore: number) {
    spendStars(stake);
    recordTipSubmitted();
    submitTip(matchId, homeScore, awayScore, stake);
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">
          Deine Tipps für den Spieltag
        </h1>
        <p className="mt-1 text-sm text-muted">
          Setze deine Gratis-Sterne auf die kommenden Spiele.
        </p>
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        <TabButton
          label="Offene Tipps"
          count={matches.length}
          active={tab === "offen"}
          onClick={() => setTab("offen")}
        />
        <TabButton
          label="Meine Tipp-Historie"
          count={myTips.length}
          active={tab === "historie"}
          onClick={() => setTab("historie")}
        />
      </div>

      {tab === "offen" && (
        <div className="flex flex-col gap-4">
          {matches.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Aktuell keine Spiele angelegt.</p>
          )}
          {matches.map((match) => {
            const homeTeam = getTeam(match.homeTeamId);
            const awayTeam = getTeam(match.awayTeamId);
            if (!homeTeam || !awayTeam) return null;
            const tip = findTipForMatch(match.id);

            return (
              <MatchCard
                key={match.id}
                match={match}
                homeTeam={homeTeam}
                awayTeam={awayTeam}
                tipCount={tipCounts[match.id] ?? 0}
                myTip={
                  tip
                    ? { predictedHomeScore: tip.predictedHomeScore, predictedAwayScore: tip.predictedAwayScore }
                    : undefined
                }
                onSubmitTip={(homeScore, awayScore) =>
                  handleSubmitTip(match.id, match.fixedStake, homeScore, awayScore)
                }
              />
            );
          })}
        </div>
      )}

      {tab === "historie" && (
        <div className="flex flex-col gap-3">
          {myTips.length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Noch keine Tipps abgegeben.</p>
          )}
          {[...myTips].reverse().map((tip) => {
            const match = matches.find((m) => m.id === tip.matchId);
            if (!match) return null;
            const homeTeam = getTeam(match.homeTeamId);
            const awayTeam = getTeam(match.awayTeamId);
            if (!homeTeam || !awayTeam) return null;

            return (
              <div
                key={tip.id}
                className="flex items-center justify-between rounded-card border border-edge bg-surface px-5 py-4"
              >
                <div>
                  <p className="text-xs text-muted">
                    {sportIcon[match.sport]} {match.competition}
                    {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
                  </p>
                  <p className="font-display text-sm font-semibold text-ink">
                    {homeTeam.name} vs {awayTeam.name}
                  </p>
                  <p className="text-xs text-muted">
                    Getippt: {tip.predictedHomeScore}:{tip.predictedAwayScore} ·{" "}
                    {new Date(tip.submittedAt).toLocaleString("de-DE")}
                  </p>
                </div>
                <span className="font-display font-semibold text-gold">⭐ {tip.stake}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2 px-1 pb-2.5 font-display text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 py-0.5 text-xs ${
          active ? "bg-gold text-pitch" : "bg-surface-hover text-muted"
        }`}
      >
        {count}
      </span>
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
    </button>
  );
}
