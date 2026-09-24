"use client";

import { useState, FormEvent } from "react";
import { useParams } from "next/navigation";
import { useTeams } from "@/lib/TeamsContext";
import { useUser } from "@/lib/UserContext";
import { LeagueMatch } from "@/lib/teamsTypes";
import ShareLeagueButton from "@/components/ShareLeagueButton";
import ShareResultCard from "@/components/ShareResultCard";

function pointsFor(
  scoringMode: "ergebnis" | "dreiweg",
  predictedHome: number,
  predictedAway: number,
  finalHome: number,
  finalAway: number
): number {
  const tendency = (h: number, a: number) => (h > a ? "H" : h < a ? "A" : "D");
  const correctTendency = tendency(predictedHome, predictedAway) === tendency(finalHome, finalAway);

  if (scoringMode === "dreiweg") {
    return correctTendency ? 3 : 0;
  }

  if (predictedHome === finalHome && predictedAway === finalAway) return 5;
  if (predictedHome - predictedAway === finalHome - finalAway) return 3;
  if (correctTendency) return 1;
  return 0;
}

export default function LeagueDetailPage() {
  const params = useParams<{ leagueId: string }>();
  const { leagues, matches, tips, addMatch, setFinalScore, submitTip } = useTeams();
  const { displayName } = useUser();

  const league = leagues.find((l) => l.id === params.leagueId);
  const leagueMatches = matches.filter((m) => m.leagueId === params.leagueId);
  const isCreator = league?.creator === displayName;

  const [tab, setTab] = useState<"spiele" | "rangliste" | "mitglieder">("spiele");

  if (!league) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16 text-center">
        <p className="text-sm text-muted">Tipprunde nicht gefunden.</p>
      </main>
    );
  }

  // Rangliste berechnen
  const scores: Record<string, number> = {};
  for (const member of league.members) scores[member] = 0;
  for (const match of leagueMatches) {
    if (match.status !== "finished" || match.finalHomeScore === null || match.finalAwayScore === null)
      continue;
    for (const tip of tips.filter((t) => t.matchId === match.id)) {
      scores[tip.author] =
        (scores[tip.author] ?? 0) +
        pointsFor(
          league.scoringMode,
          tip.predictedHomeScore,
          tip.predictedAwayScore,
          match.finalHomeScore,
          match.finalAwayScore
        );
    }
  }
  const leaderboard = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">{league.name}</h1>
        {league.description && <p className="mt-1 text-sm text-muted">{league.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {league.scoringMode === "ergebnis" ? "Ergebnis-Modus" : "3-Wege-Modus"} ·{" "}
            {league.members.length} Mitglieder
          </span>
          <span className="rounded-full border border-edge px-2 py-0.5 font-mono">
            Code: {league.code}
          </span>
        </div>
        <div className="mt-3">
          <ShareLeagueButton leagueName={league.name} code={league.code} />
        </div>
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        {(["spiele", "rangliste", "mitglieder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-2.5 font-display text-sm font-semibold capitalize transition-colors ${
              tab === t ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-400" />}
          </button>
        ))}
      </div>

      {tab === "spiele" && (
        <div className="flex flex-col gap-4">
          {isCreator && <AddMatchForm leagueId={league.id} onAdd={addMatch} />}
          {leagueMatches.length === 0 && (
            <p className="text-sm text-muted">Noch keine Spiele in dieser Tipprunde.</p>
          )}
          {leagueMatches.map((match) => (
            <LeagueMatchCard
              key={match.id}
              match={match}
              isCreator={isCreator}
              myTip={tips.find((t) => t.matchId === match.id && t.author === displayName)}
              onSubmitTip={(h, a) => submitTip(league.id, match.id, h, a)}
              onSetFinal={(h, a) => setFinalScore(match.id, h, a)}
            />
          ))}
        </div>
      )}

      {tab === "rangliste" && (
        <div className="flex flex-col gap-4">
          {leaderboard.length > 0 && (
            <ShareResultCard leagueName={league.name} leaderboard={leaderboard} currentUser={displayName} />
          )}
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          {leaderboard.map(([name, pts], i) => (
            <div
              key={name}
              className={`flex items-center justify-between px-5 py-3 ${
                i !== leaderboard.length - 1 ? "border-b border-edge" : ""
              } ${name === displayName ? "bg-surface-hover" : ""}`}
            >
              <span className="text-sm text-ink">
                {i + 1}. {name} {name === displayName && <span className="text-muted">(Du)</span>}
              </span>
              <span className="font-display font-semibold text-blue-400">{pts} Pkt</span>
            </div>
          ))}
        </div>
        </div>
      )}

      {tab === "mitglieder" && (
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          {league.members.map((member, i) => (
            <div
              key={member}
              className={`flex items-center justify-between px-5 py-3 ${
                i !== league.members.length - 1 ? "border-b border-edge" : ""
              }`}
            >
              <span className="text-sm text-ink">{member}</span>
              {member === league.creator && (
                <span className="text-xs text-blue-400">Gründer</span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function AddMatchForm({
  leagueId,
  onAdd,
}: {
  leagueId: string;
  onAdd: (leagueId: string, title: string, kickoff: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [kickoff, setKickoff] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !kickoff) return;
    onAdd(leagueId, title.trim(), new Date(kickoff).toISOString());
    setTitle("");
    setKickoff("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-card border border-blue-400/20 bg-surface p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs text-muted">Spiel (z. B. Team A vs Team B)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Anpfiff</label>
        <input
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <button
        type="submit"
        className="rounded-full bg-blue-500 px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
      >
        Spiel anlegen
      </button>
    </form>
  );
}

function LeagueMatchCard({
  match,
  isCreator,
  myTip,
  onSubmitTip,
  onSetFinal,
}: {
  match: LeagueMatch;
  isCreator: boolean;
  myTip?: { predictedHomeScore: number; predictedAwayScore: number };
  onSubmitTip: (home: number, away: number) => void;
  onSetFinal: (home: number, away: number) => void;
}) {
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [finalHome, setFinalHome] = useState(match.finalHomeScore ?? 0);
  const [finalAway, setFinalAway] = useState(match.finalAwayScore ?? 0);

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-sm font-semibold text-ink">{match.title}</span>
        <span className="text-xs text-muted">
          {new Date(match.kickoff).toLocaleString("de-DE")}
        </span>
      </div>

      {match.status === "finished" ? (
        <p className="text-sm text-ink">
          Endstand: <span className="font-semibold">{match.finalHomeScore} : {match.finalAwayScore}</span>
          {myTip && (
            <span className="ml-3 text-muted">
              Dein Tipp: {myTip.predictedHomeScore}:{myTip.predictedAwayScore}
            </span>
          )}
        </p>
      ) : myTip ? (
        <p className="text-sm text-muted">
          Dein Tipp: <span className="font-semibold text-ink">{myTip.predictedHomeScore}:{myTip.predictedAwayScore}</span>
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            value={home}
            onChange={(e) => setHome(Number(e.target.value))}
            className="h-9 w-12 rounded-lg border border-edge bg-pitch text-center text-sm text-ink outline-none focus:border-blue-400"
          />
          <span className="text-muted">:</span>
          <input
            type="number"
            min={0}
            value={away}
            onChange={(e) => setAway(Number(e.target.value))}
            className="h-9 w-12 rounded-lg border border-edge bg-pitch text-center text-sm text-ink outline-none focus:border-blue-400"
          />
          <button
            onClick={() => onSubmitTip(home, away)}
            className="rounded-full bg-blue-500 px-4 py-1.5 text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Tippen
          </button>
        </div>
      )}

      {isCreator && match.status !== "finished" && (
        <div className="mt-3 flex items-center gap-2 border-t border-edge pt-3">
          <span className="text-xs text-muted">Endstand eintragen:</span>
          <input
            type="number"
            min={0}
            value={finalHome}
            onChange={(e) => setFinalHome(Number(e.target.value))}
            className="h-8 w-11 rounded-lg border border-edge bg-pitch text-center text-xs text-ink outline-none focus:border-blue-400"
          />
          <span className="text-xs text-muted">:</span>
          <input
            type="number"
            min={0}
            value={finalAway}
            onChange={(e) => setFinalAway(Number(e.target.value))}
            className="h-8 w-11 rounded-lg border border-edge bg-pitch text-center text-xs text-ink outline-none focus:border-blue-400"
          />
          <button
            onClick={() => onSetFinal(finalHome, finalAway)}
            className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Übernehmen
          </button>
        </div>
      )}
    </div>
  );
}
