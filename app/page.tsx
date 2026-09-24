"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";

// Punkte, die es fürs Abgeben eines Tipps sofort gibt (Teilnahme-Bonus).
// Die "richtige" Punktevergabe nach Ergebnis kommt erst mit dem echten Backend.
const POINTS_PER_TIP = 10;

export default function DashboardPage() {
  const { spendStars, recordTipSubmitted, addPoints } = useUser();
  const { matches, getTeam, tipCounts, submitTip, myTips } = useAppData();
  const { showToast, celebrate } = useFeedback();
  const [tab, setTab] = useState<"offen" | "geschlossen">("offen");

  function findTipForMatch(matchId: string) {
    return [...myTips].reverse().find((t) => t.matchId === matchId);
  }

  function handleSubmitTip(matchId: string, stake: number, homeScore: number, awayScore: number) {
    spendStars(stake);
    recordTipSubmitted();
    submitTip(matchId, homeScore, awayScore, stake);
    addPoints(POINTS_PER_TIP);
    celebrate();
    showToast("✓ Tipp gespeichert – viel Glück!");
  }

  // Das Spiel mit dem nächsten Anpfiff steht immer ganz oben.
  const byKickoffAsc = (a: (typeof matches)[number], b: (typeof matches)[number]) =>
    new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();

  const offeneMatches = matches.filter((m) => m.status !== "finished").sort(byKickoffAsc);
  const geschlosseneMatches = matches.filter((m) => m.status === "finished").sort(byKickoffAsc);
  const visibleMatches = tab === "offen" ? offeneMatches : geschlosseneMatches;

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
          count={offeneMatches.length}
          active={tab === "offen"}
          onClick={() => setTab("offen")}
        />
        <TabButton
          label="Geschlossene Tipps"
          count={geschlosseneMatches.length}
          active={tab === "geschlossen"}
          onClick={() => setTab("geschlossen")}
        />
      </div>

      <div className="flex flex-col gap-4">
        {visibleMatches.length === 0 && (
          <p className="py-8 text-center text-sm text-muted">
            {tab === "offen" ? "Aktuell keine offenen Spiele." : "Noch keine beendeten Spiele."}
          </p>
        )}
        {visibleMatches.map((match) => {
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
