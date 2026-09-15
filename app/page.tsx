"use client";

import MatchCard from "@/components/MatchCard";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";

export default function DashboardPage() {
  const { freeStars, spendStars, recordTipSubmitted } = useUser();
  const { matches, getTeam } = useAppData();

  function handleSubmitTip(stake: number) {
    spendStars(stake);
    recordTipSubmitted();
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

      <div className="flex flex-col gap-4">
        {matches.map((match) => {
          const homeTeam = getTeam(match.homeTeamId);
          const awayTeam = getTeam(match.awayTeamId);
          if (!homeTeam || !awayTeam) return null;

          return (
            <MatchCard
              key={match.id}
              match={match}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              maxStake={Math.min(100, freeStars)}
              onSubmitTip={handleSubmitTip}
            />
          );
        })}
      </div>
    </main>
  );
}
