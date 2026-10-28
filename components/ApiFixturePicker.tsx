"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { competitionCountry } from "@/lib/competitionFlag";
import { competitionsForSport, type Competition } from "@/lib/competitions";
import { flagEmoji } from "@/lib/flags";
import type { LiveGame } from "@/lib/live/types";
import { findLiveLeague, LIVE_SPORTS, liveGameCountry, liveGameLeague, sameLeague } from "@/lib/liveConfig";
import { findLiveGame, viennaDate } from "@/lib/liveScores";
import { appTeamForApiName } from "@/lib/teamApiNames";
import { displayOrder } from "@/lib/teamOrder";
import { SPORT_ICONS, sportLabel, type Sport, type Team } from "@/lib/types";
import { useLiveDays } from "@/lib/useLiveScores";
import Emoji from "@/components/Emoji";

// Admin -> Spiele (Rene, 28.10.2026: "im Adminbereich die Matches anzeigen,
// damit ich nicht so lange zum Spiel erstellen brauche, so dass ich sie
// noch anpassen kann"). Zeigt die kommenden Spiele eines Tages aus den
// Live-Daten (API-Sports über den eigenen Server, gleiche Route und gleicher
// Speicher wie das Matchcenter): heute und die nächsten 2 Tage, alle
// Sportarten mit Live-Daten ("aber nicht nur Fußball"). "Übernehmen" füllt nur das Formular
// darunter aus (Wettbewerb, Teams, Anpfiff, Spieltag) – angelegt wird erst
// mit "Spiel anlegen", wie bisher als Entwurf.
//
// Abfragen: eine je Sportart und Tag (also höchstens 4 × 3), erst wenn der
// Bereich offen ist; die Route hält kommende Tage stundenlang im Cache
// (Gratis-Plan der anderen Sportarten: 100 pro Tag).

export interface ApiFixturePick {
  sport: Sport;
  competition: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoff: string; // ISO
  matchday?: number;
  // Namen von der API: fehlt ein eigenes Team, merkt sich der Admin beim
  // Anlegen das unten gewählte Team dazu (Vereinsnamen).
  homeApiName: string;
  awayApiName: string;
}

const DAYS = 3;
const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date: string, index: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  const text = `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}.`;
  if (index === 0) return `Heute, ${text}`;
  if (index === 1) return `Morgen, ${text}`;
  return text;
}

function viennaClock(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-AT", { timeZone: "Europe/Vienna", hour: "2-digit", minute: "2-digit" });
}

// Spieltag aus der Runde: "Regular Season - 11" → 11. Pokalrunden ohne Zahl
// am Ende ("Round of 16") bleiben leer.
function matchdayFromRound(round: string | undefined): number | undefined {
  const m = /-\s*(\d+)\s*$/.exec(round ?? "");
  return m ? Number(m[1]) : undefined;
}

// Eigener Wettbewerb zu einer API-Liga: alle Wettbewerbe dieser Sportart, die
// auf dieselbe Live-Liga zeigen. Gleicher Name gewinnt, sonst die reguläre
// Saison (NHL Regular Season statt Playoffs), sonst der erste.
function competitionForGame(sport: Sport, game: LiveGame, competitions: Competition[]): Competition | undefined {
  const league = liveGameLeague(sport, game.league);
  if (!league) return undefined;
  const candidates = competitionsForSport(competitions, sport).filter(
    (c) => findLiveLeague(sport, c.name, competitionCountry(sport, c.name, competitions)) === league,
  );
  const apiName = game.league.split(" · ")[0] ?? "";
  return (
    candidates.find((c) => sameLeague(c.name, apiName)) ??
    candidates.find((c) => /regular|saison/i.test(c.name)) ??
    candidates[0]
  );
}

export function ApiFixturePicker({ onPick }: { onPick: (pick: ApiFixturePick) => void }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Sport | "alle">("alle");
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (open) setNow(Date.now());
  }, [open]);
  const dates = useMemo(() => {
    if (!now) return [];
    const today = viennaDate(now);
    return Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  }, [now]);
  const shown = LIVE_SPORTS.filter((s) => filter === "alle" || s === filter);

  return (
    <div className="mb-6 rounded-card border border-edge bg-surface p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-base font-semibold text-ink">Spiele aus der API übernehmen</h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-muted/50 px-4 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-ink"
        >
          {open ? "Ausblenden" : "Spiele zeigen"}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">
        Heute und die nächsten 2 Tage. „Übernehmen“ füllt das Formular unten aus, dort kannst du alles noch ändern.
      </p>

      {open && dates.length > 0 && (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["alle", ...LIVE_SPORTS] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  s === filter ? "bg-gold text-pitch" : "bg-surface-hover text-ink hover:text-gold"
                }`}
              >
                {s === "alle" ? "Alle" : <><Emoji e={SPORT_ICONS[s]} /> {sportLabel(s)}</>}
              </button>
            ))}
          </div>
          {shown.map((s) => (
            <SportFixtures key={s} sport={s} dates={dates} now={now} onPick={onPick} />
          ))}
        </>
      )}
    </div>
  );
}

// Kommende Spiele einer Sportart, nach Tag und Liga gruppiert.
function SportFixtures({
  sport,
  dates,
  now,
  onPick,
}: {
  sport: Sport;
  dates: string[];
  now: number;
  onPick: (pick: ApiFixturePick) => void;
}) {
  const { teams, apiNameLinks, competitions, allMatches: matches, getTeam, orderFor } = useAppData();
  const days = useLiveDays(sport, dates);
  const loading = days.some((d) => d.games === null && (d.loading || !d.error));
  const errors = Array.from(new Set(days.map((d) => d.error).filter((e): e is string => !!e)));

  const rows = useMemo(
    () =>
      days.flatMap((day, i) => {
        if (!day.games) return [];
        const date = dates[i];
        const sameDay = matches.filter((m) => m.sport === sport && viennaDate(m.kickoff) === date);
        return day.games
          .filter((g) => g.status === "NS" && new Date(g.kickoff).getTime() > now)
          .map((g) => {
            const home = appTeamForApiName(teams, apiNameLinks, sport, g.home);
            const away = appTeamForApiName(teams, apiNameLinks, sport, g.away);
            const competition = competitionForGame(sport, g, competitions);
            // Schon angelegt? Gleiches Spiel (Anpfiff ±20 Min., beide Teams).
            const existing = sameDay.find((m) => {
              const h = getTeam(m.homeTeamId)?.name;
              const a = getTeam(m.awayTeamId)?.name;
              return !!h && !!a && findLiveGame([g], m.kickoff, h, a) !== null;
            });
            const leagueLabel = liveGameLeague(sport, g.league)?.label ?? g.league.split(" · ")[0] ?? "";
            const country = liveGameCountry(g.league);
            return { g, dayIndex: i, home, away, competition, existing, leagueLabel, flag: country ? flagEmoji(country) : null };
          });
      }),
    // apiNameLinks/teams: eigene Vereinsnamen zählen bei der Zuordnung mit.
    [days, dates, now, matches, sport, teams, apiNameLinks, competitions, getTeam],
  );

  // Je Tag nach Liga gruppiert, Liga in der Reihenfolge des ersten Anpfiffs.
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    const sorted = [...rows].sort(
      (a, b) => a.dayIndex - b.dayIndex || new Date(a.g.kickoff).getTime() - new Date(b.g.kickoff).getTime(),
    );
    for (const r of sorted) {
      const key = `${r.dayIndex}|${r.flag ?? ""}|${r.leagueLabel}`;
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return Array.from(map.entries());
  }, [rows]);

  function teamName(team: Team | undefined, apiName: string) {
    return team ? (
      <span>{team.name}</span>
    ) : (
      <span className="text-gold" title="Kein eigenes Team zu diesem Namen">
        {apiName}
      </span>
    );
  }

  function pick(r: (typeof rows)[number]) {
    onPick({
      sport,
      competition: r.competition?.name ?? "",
      homeTeamId: r.home?.id ?? "",
      awayTeamId: r.away?.id ?? "",
      kickoff: r.g.kickoff,
      matchday: matchdayFromRound(r.g.round),
      homeApiName: r.g.home,
      awayApiName: r.g.away,
    });
  }

  let lastDay = -1;
  return (
    <div className="mt-4">
      <p className="mb-2 font-display text-sm font-semibold text-ink">
        <Emoji e={SPORT_ICONS[sport]} /> {sportLabel(sport)}
      </p>
      {loading && <p className="text-sm text-muted">Lädt …</p>}
      {!loading && errors.map((e) => <p key={e} className="text-sm text-red-300">Live-Daten: {e}</p>)}
      {!loading && rows.length === 0 && errors.length === 0 && (
        <p className="text-sm text-muted">Keine kommenden Spiele in diesen Tagen.</p>
      )}
      {groups.map(([key, list]) => {
        const dayIndex = list[0].dayIndex;
        const newDay = dayIndex !== lastDay;
        lastDay = dayIndex;
        return (
          <div key={key} className="mb-3 last:mb-0">
            {newDay && <p className="mb-1.5 mt-2 text-sm font-semibold text-gold">{dayLabel(dates[dayIndex], dayIndex)}</p>}
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              {list[0].flag && <Emoji e={list[0].flag} />} {list[0].leagueLabel}
            </p>
            <ul className="flex flex-col gap-1.5">
              {list.map((r) => {
                // US-Ligen: Gast links, Heim rechts (wie im Formular).
                const order = orderFor({ sport, competition: r.competition?.name ?? null });
                const [left, right] = displayOrder(order, teamName(r.home, r.g.home), teamName(r.away, r.g.away));
                const missing = !r.home || !r.away;
                return (
                  <li key={r.g.id} className="flex items-center gap-3 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm">
                    <span className="w-11 shrink-0 tabular-nums text-muted">{viennaClock(r.g.kickoff)}</span>
                    <span className="min-w-0 flex-1 text-ink">
                      {left} <span className="text-muted">{order.awayFirst ? "@" : "–"}</span> {right}
                      {missing && !r.existing && (
                        <span className="block text-xs text-muted">
                          Gelber Name: kein eigenes Team gefunden. Unten auswählen, wird dann gemerkt.
                        </span>
                      )}
                      {!r.competition && !r.existing && (
                        <span className="block text-xs text-muted">Wettbewerb unten auswählen.</span>
                      )}
                    </span>
                    {r.existing ? (
                      <span className="shrink-0 text-xs font-semibold text-muted">
                        {r.existing.draft ? "Schon als Entwurf da" : "Schon angelegt"}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => pick(r)}
                        className="shrink-0 rounded-full bg-action px-3 py-1.5 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
                      >
                        Übernehmen
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
