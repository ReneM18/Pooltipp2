"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";

export default function DashboardPage() {
  const { freeStars, spendStars, recordTipSubmitted } = useUser();
  const { matches, getTeam, tipCounts, registerTip } = useAppData();
  const [tab, setTab] = useState<"aktuell" | "abgelaufen">("aktuell");

  const now = Date.now();
  const aktuelleMatches = matches.filter((m) => new Date(m.kickoff).getTime() >= now);
  const abgelaufeneMatches = matches.filter((m) => new Date(m.kickoff).getTime() < now);
  const visibleMatches = tab === "aktuell" ? aktuelleMatches : abgelaufeneMatches;

  function handleSubmitTip(matchId: string, stake: number) {
    spendStars(stake);
    recordTipSubmitted();
    registerTip(matchId);
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
        <TabButton label="Aktuell" count={aktuelleMatches.length} active={tab === "aktuell"} onClick={() => setTab("aktuell")} />
        <TabButton label="Abgelaufen" count={abgelaufeneMatches.length} active={tab === "abgelaufen"} onClick={() => setTab("abgelaufen")} />
      </div>

      <div className="flex flex-col gap-4">
        {visibleMatches.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {tab === "aktuell" ? "Keine aktuellen Spiele." : "Noch keine abgelaufenen Spiele."}
          </p>
        )}
        {visibleMatches.map((match) => {
          const homeTeam = getTeam(match.homeTeamId);
          const awayTeam = getTeam(match.awayTeamId);
          if (!homeTeam || !awayTeam) return null;

          return (
            <MatchCard
              key={match.id}
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              tipCount={tipCounts[match.id] ?? 0}
              onSubmitTip={() => handleSubmitTip(match.id, match.fixedStake)}
            />
          );
        })}
      </div>
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
