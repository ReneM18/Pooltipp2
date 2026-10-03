"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTournaments } from "@/lib/TournamentContext";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { Tournament, TournamentStatus } from "@/lib/tournamentTypes";
import { getTournamentStatus, useTournamentStandings } from "@/lib/tournamentLeaderboard";
import { Sport } from "@/lib/types";
import { matchTitle, scoreText } from "@/lib/teamOrder";

const sportIcon: Record<Sport, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
  NHL: "🏒",
};

const statusLabel: Record<TournamentStatus, string> = {
  aktiv: "Aktiv",
  kommend: "Kommend",
  beendet: "Beendet",
};

const statusClass: Record<TournamentStatus, string> = {
  aktiv: "border-gold bg-gold/15 text-gold",
  kommend: "border-blue-400/60 bg-blue-400/10 text-blue-300",
  beendet: "border-edge bg-surface-hover text-muted",
};

export default function TurnierPage() {
  const { tournaments } = useTournaments();
  const { matches, getTeam } = useAppData();
  const { displayName } = useUser();

  const withStatus = tournaments
    .map((t) => ({ tournament: t, status: getTournamentStatus(t) }))
    .sort((a, b) => new Date(a.tournament.startDate).getTime() - new Date(b.tournament.startDate).getTime());

  const active = withStatus.filter((t) => t.status === "aktiv");
  const upcoming = withStatus.filter((t) => t.status === "kommend");
  const finished = withStatus.filter((t) => t.status === "beendet");

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <h1 className="mb-1 font-display text-xl font-bold text-ink sm:text-2xl">Turniere</h1>
      <p className="mb-6 text-xs text-muted">
        Zeitlich begrenzte Sonder-Turniere (z. B. große Meisterschaften) mit eigener, öffentlicher
        Mini-Rangliste – zählt nur, wer bei den zugehörigen Spielen mittippt.
      </p>

      {tournaments.length === 0 && (
        <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
          Aktuell ist kein Turnier angelegt.
        </p>
      )}

      {active.length > 0 && (
        <TournamentSection
          title="Aktive Turniere"
          entries={active}
          matches={matches}
          getTeam={getTeam}
          displayName={displayName}
        />
      )}
      {upcoming.length > 0 && (
        <TournamentSection
          title="Kommende Turniere"
          entries={upcoming}
          matches={matches}
          getTeam={getTeam}
          displayName={displayName}
        />
      )}
      {finished.length > 0 && (
        <TournamentSection
          title="Beendete Turniere"
          entries={finished}
          matches={matches}
          getTeam={getTeam}
          displayName={displayName}
        />
      )}
    </main>
  );
}

function TournamentSection({
  title,
  entries,
  matches,
  getTeam,
  displayName,
}: {
  title: string;
  entries: { tournament: Tournament; status: TournamentStatus }[];
  matches: ReturnType<typeof useAppData>["matches"];
  getTeam: ReturnType<typeof useAppData>["getTeam"];
  displayName: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">{title}</h2>
      <div className="flex flex-col gap-4">
        {entries.map(({ tournament, status }) => (
          <TournamentCard
            key={tournament.id}
            tournament={tournament}
            status={status}
            matches={matches}
            getTeam={getTeam}
            displayName={displayName}
          />
        ))}
      </div>
    </section>
  );
}

function TournamentCard({
  tournament,
  status,
  matches,
  getTeam,
  displayName,
}: {
  tournament: Tournament;
  status: TournamentStatus;
  matches: ReturnType<typeof useAppData>["matches"];
  getTeam: ReturnType<typeof useAppData>["getTeam"];
  displayName: string;
}) {
  const tournamentMatches = matches.filter((m) => tournament.matchIds.includes(m.id));

  // Echte Turnier-Rangliste aus den tatsächlichen, ausgewerteten Tipps ALLER
  // registrierten User zu den Spielen dieses Turniers (nicht mehr simuliert).
  const { entries: standings } = useTournamentStandings(tournament.matchIds);
  const leaderboard = [...standings]
    .sort((a, b) => b.points - a.points)
    .map((entry, index) => ({ rank: index + 1, ...entry, isCurrentUser: entry.name === displayName }));

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{tournament.icon}</span>
          <div>
            <h3 className="font-display text-base font-semibold text-ink">{tournament.name}</h3>
            {tournament.description && <p className="text-xs text-muted">{tournament.description}</p>}
          </div>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass[status]}`}>
          {statusLabel[status]}
        </span>
      </div>

      <p className="mb-3 text-xs text-muted">
        {status === "aktiv" && (
          <>
            Läuft noch bis {new Date(tournament.endDate).toLocaleDateString("de-DE")} ·{" "}
            <TournamentCountdown target={new Date(tournament.endDate).getTime()} prefix="endet in" />
          </>
        )}
        {status === "kommend" && (
          <>
            Startet am {new Date(tournament.startDate).toLocaleDateString("de-DE")} ·{" "}
            <TournamentCountdown target={new Date(tournament.startDate).getTime()} prefix="startet in" />
          </>
        )}
        {status === "beendet" && <>Endete am {new Date(tournament.endDate).toLocaleDateString("de-DE")}.</>}
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">
            Spiele im Turnier ({tournamentMatches.length})
          </p>
          {tournamentMatches.length === 0 ? (
            <p className="text-xs text-muted">Noch keine Spiele zugeordnet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {tournamentMatches.map((match) => {
                const home = getTeam(match.homeTeamId);
                const away = getTeam(match.awayTeamId);
                return (
                  <p key={match.id} className="text-xs leading-snug text-ink">
                    {sportIcon[match.sport]} {matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}
                    {match.status === "finished" && (
                      <span className="text-muted">
                        {" "}
                        ({scoreText(match.sport, match.liveHomeScore, match.liveAwayScore)})
                      </span>
                    )}
                  </p>
                );
              })}
              <Link href="/matchcenter" className="mt-1 text-xs text-gold hover:opacity-80">
                Zum Matchcenter →
              </Link>
            </div>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Turnier-Rangliste</p>
          <div className="flex flex-col gap-1">
            {leaderboard.length === 0 && (
              <p className="text-xs text-muted">Noch keine ausgewerteten Tipps zu diesem Turnier.</p>
            )}
            {leaderboard.slice(0, 5).map((entry) => (
              <div
                key={entry.name}
                className={`flex items-center justify-between rounded-lg px-2 py-1 text-xs ${
                  entry.isCurrentUser ? "bg-gold/10 text-gold" : "text-ink"
                }`}
              >
                <span className="min-w-0 pr-2 leading-snug">
                  {entry.rank}. {entry.name}
                  {entry.isCurrentUser && <span className="ml-1 text-muted">(Du)</span>}
                </span>
                <span className="shrink-0 font-semibold">{entry.points}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TournamentCountdown({ target, prefix }: { target: number; prefix: string }) {
  // null statt sofort Date.now() zu verrechnen – vermeidet Hydration-Fehler
  // (siehe components/Countdown.tsx).
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    setRemaining(target - Date.now());
    const interval = setInterval(() => setRemaining(target - Date.now()), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining === null) return <span className="opacity-0">&nbsp;</span>;
  if (remaining <= 0) return <span>gerade eben</span>;
  const totalMinutes = Math.floor(remaining / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return <span>{prefix} {days}T {hours}h</span>;
  if (hours > 0) return <span>{prefix} {hours}h {minutes}m</span>;
  return <span>{prefix} {minutes}m</span>;
}
