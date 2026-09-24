"use client";

import { useEffect, useState } from "react";
import {
  fetchRecentResults,
  fetchStandings,
  LEAGUE_IDS,
  ResultRow,
  StandingRow,
} from "@/lib/sportsApi";

const LEAGUES = Object.keys(LEAGUE_IDS);
const CURRENT_SEASON = "2025-2026";

export default function MatchcenterPage() {
  const [league, setLeague] = useState(LEAGUES[0]);
  const [view, setView] = useState<"ergebnisse" | "tabelle">("tabelle");
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const leagueId = LEAGUE_IDS[league];
    setLoading(true);
    setError(null);

    const request =
      view === "tabelle"
        ? fetchStandings(leagueId, CURRENT_SEASON).then(setStandings)
        : fetchRecentResults(leagueId).then(setResults);

    request.catch(() => setError("Daten konnten gerade nicht geladen werden. Später erneut versuchen."))
      .finally(() => setLoading(false));
  }, [league, view]);

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold text-ink">Matchcenter</h1>
        <p className="mt-1 text-sm text-muted">
          Echte Ergebnisse und Tabellen – Daten von TheSportsDB.
        </p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {LEAGUES.map((l) => (
          <button
            key={l}
            onClick={() => setLeague(l)}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
              league === l
                ? "border-gold bg-gold/10 text-gold"
                : "border-edge text-muted hover:text-ink"
            }`}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        <SubTab label="Tabelle" active={view === "tabelle"} onClick={() => setView("tabelle")} />
        <SubTab label="Ergebnisse" active={view === "ergebnisse"} onClick={() => setView("ergebnisse")} />
      </div>

      {loading && <p className="py-8 text-center text-sm text-muted">Lädt…</p>}
      {error && <p className="py-8 text-center text-sm text-muted">{error}</p>}

      {!loading && !error && view === "tabelle" && (
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          <div className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3rem] gap-2 border-b border-edge px-4 py-2 text-xs text-muted">
            <span>#</span>
            <span>Team</span>
            <span className="text-center">Sp</span>
            <span className="text-center">S</span>
            <span className="text-center">U</span>
            <span className="text-center">N</span>
            <span className="text-right">Pkt</span>
          </div>
          {(standings ?? []).length === 0 && (
            <p className="p-4 text-sm text-muted">Keine Tabellendaten verfügbar.</p>
          )}
          {(standings ?? []).map((row) => (
            <div
              key={row.rank}
              className="grid grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3rem] gap-2 border-b border-edge px-4 py-2.5 text-sm last:border-0"
            >
              <span className="text-muted">{row.rank}</span>
              <span className="text-ink">{row.teamName}</span>
              <span className="text-center text-muted">{row.played}</span>
              <span className="text-center text-muted">{row.win}</span>
              <span className="text-center text-muted">{row.draw}</span>
              <span className="text-center text-muted">{row.loss}</span>
              <span className="text-right font-semibold text-ink">{row.points}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && view === "ergebnisse" && (
        <div className="flex flex-col gap-2">
          {(results ?? []).length === 0 && (
            <p className="py-8 text-center text-sm text-muted">Keine Ergebnisse verfügbar.</p>
          )}
          {(results ?? []).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between rounded-card border border-edge bg-surface px-4 py-3"
            >
              <span className="text-sm text-ink">
                {r.homeTeam} vs {r.awayTeam}
              </span>
              <span className="font-display font-semibold text-ink">
                {r.homeScore} : {r.awayScore}
              </span>
              <span className="text-xs text-muted">{r.date}</span>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-xs text-muted">
        Daten von{" "}
        <a href="https://www.thesportsdb.com/" className="underline" target="_blank" rel="noreferrer">
          TheSportsDB
        </a>
      </p>
    </main>
  );
}

function SubTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`relative py-2.5 font-display text-sm font-semibold transition-colors ${
        active ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-gold" />}
    </button>
  );
}
