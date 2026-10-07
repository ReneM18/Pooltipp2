"use client";

import EmptyState from "@/components/EmptyState";
import { useEffect, useState } from "react";
import {
  fetchRecentResults,
  fetchStandings,
  LEAGUE_IDS,
  ResultRow,
  StandingRow,
} from "@/lib/sportsApi";
import AdBanner from "@/components/AdBanner";
import FitText from "@/components/FitText";

const LEAGUES = Object.keys(LEAGUE_IDS);

// Berechnet die aktuelle Saison automatisch aus dem heutigen Datum, statt sie
// fest zu codieren (europäische Fußball-Saisons laufen Sommer bis Sommer:
// ab Juli zählt das laufende Jahr als Start-Jahr der neuen Saison).
function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1–12
  const startYear = month >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}
const CURRENT_SEASON = getCurrentSeason();

export default function MatchcenterPage() {
  const [league, setLeague] = useState(LEAGUES[0]);
  const [view, setView] = useState<"ergebnisse" | "tabelle">("tabelle");
  const [standings, setStandings] = useState<StandingRow[] | null>(null);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const leagueId = LEAGUE_IDS[league];
    setLoading(true);
    setError(null);

    const request =
      view === "tabelle"
        ? fetchStandings(leagueId, CURRENT_SEASON).then(setStandings)
        : fetchRecentResults(leagueId).then(setResults);

    request.catch(() => setError("Daten konnten gerade nicht geladen werden."))
      .finally(() => setLoading(false));
    // retryCount hat keinen eigenen Effekt außer den useEffect erneut
    // auszulösen – genau das braucht der "Erneut versuchen"-Button unten.
  }, [league, view, retryCount]);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Matchcenter</h1>

      <AdBanner />

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
      {error && (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <button
            onClick={() => setRetryCount((c) => c + 1)}
            className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-ink transition-colors hover:border-gold hover:text-gold"
          >
            Erneut versuchen
          </button>
        </div>
      )}

      {!loading && !error && view === "tabelle" && (
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          <div className={`${TABLE_GRID} border-b border-edge py-2 text-xs text-muted`}>
            <span>#</span>
            <span>Team</span>
            <span className="text-center">Sp</span>
            <span className="text-center sm:hidden">S-U-N</span>
            <span className="hidden text-center sm:block">S</span>
            <span className="hidden text-center sm:block">U</span>
            <span className="hidden text-center sm:block">N</span>
            <span className="text-right">Pkt</span>
          </div>
          {(standings ?? []).length === 0 && (
            <EmptyState
              emoji="📊"
              title="Noch keine Tabelle"
              text="Für diese Liga gibt es gerade keine Tabellendaten. Schau später nochmal vorbei."
              className="m-3 border-none bg-transparent"
            />
          )}
          {(standings ?? []).map((row) => (
            <div
              key={row.rank}
              className={`${TABLE_GRID} items-center border-b border-edge py-2.5 text-sm last:border-0`}
            >
              <span className="text-muted">{row.rank}</span>
              <FitText text={row.teamName} className="leading-tight text-ink" />
              <span className="text-center text-muted">{row.played}</span>
              <span className="whitespace-nowrap text-center text-xs text-muted sm:hidden">
                {row.win}-{row.draw}-{row.loss}
              </span>
              <span className="hidden text-center text-muted sm:block">{row.win}</span>
              <span className="hidden text-center text-muted sm:block">{row.draw}</span>
              <span className="hidden text-center text-muted sm:block">{row.loss}</span>
              <span className="text-right font-semibold text-ink">{row.points}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && view === "ergebnisse" && (
        <div className="flex flex-col gap-2 lg:grid lg:grid-cols-2 lg:gap-3">
          {(results ?? []).length === 0 && (
            <EmptyState
              emoji="⚽"
              title="Noch keine Ergebnisse"
              text="Für diese Liga gibt es gerade keine Ergebnisse. Schau später nochmal vorbei."
              className="lg:col-span-2"
            />
          )}
          {(results ?? []).map((r) => (
            <div key={r.id} className="rounded-card border border-edge bg-surface px-4 py-3">
              <p className="mb-1.5 text-xs text-muted">{formatDate(r.date)}</p>
              <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm">
                <FitText text={r.homeTeam} className="leading-tight text-ink" />
                <span className="font-display font-semibold text-ink">{r.homeScore}</span>
                <FitText text={r.awayTeam} className="leading-tight text-ink" />
                <span className="font-display font-semibold text-ink">{r.awayScore}</span>
              </div>
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

// Am Handy werden Siege/Unentschieden/Niederlagen zu einer Spalte "S-U-N"
// zusammengefasst, damit für den Teamnamen genug Platz bleibt.
const TABLE_GRID =
  "grid grid-cols-[1.25rem_1fr_1.5rem_3.25rem_1.75rem] gap-2 px-3 sm:grid-cols-[2rem_1fr_2.5rem_2.5rem_2.5rem_2.5rem_3rem] sm:px-4";

// "2026-09-27" -> "27.09.2026"
function formatDate(iso: string): string {
  const [y, m, d] = (iso ?? "").split("-");
  return y && m && d ? `${d}.${m}.${y}` : iso;
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
