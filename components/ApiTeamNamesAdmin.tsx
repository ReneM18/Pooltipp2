"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { LIVE_SPORTS } from "@/lib/liveConfig";
import { viennaDate } from "@/lib/liveScores";
import { peekLiveDays, refreshLiveDays } from "@/lib/useLiveScores";
import { fetchStandings, LEAGUE_IDS, LEAGUE_SPORTS } from "@/lib/sportsApi";
import { autoTeamForApiName, findApiNameLink, type ApiNameLink } from "@/lib/teamApiNames";
import { groupTeams } from "@/lib/teamGroups";
import { normalizeTeamName } from "@/lib/teamName";
import { ALL_SPORTS, sportLabel, type Sport } from "@/lib/types";

// Admin -> "Vereinsnamen" (Rene, 27.10.2026): Namen von der API (Live-Spiele
// und Tabellen im Matchcenter) mit den eigenen Teams verknüpfen, damit überall
// der eigene Name steht ("Rapid Vienna" -> "Rapid Wien"). Gleicher Name wird
// automatisch erkannt; hier nur die Abweichungen festlegen.

const KEEP = "__keep__";

// Saison wie im Matchcenter (Juli bis Juni).
function currentSeason(): string {
  const now = new Date();
  const start = now.getMonth() + 1 >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

interface ApiName {
  sport: Sport;
  apiName: string;
}

function nameKey(sport: Sport, apiName: string): string {
  return `${sport}|${normalizeTeamName(apiName)}`;
}

export function ApiTeamNamesAdmin() {
  const { teams, apiNameLinks, saveApiNameLinks } = useAppData();
  const [seen, setSeen] = useState<ApiName[]>([]);
  const [loading, setLoading] = useState(true);
  const [sportFilter, setSportFilter] = useState<Sport | "alle">("alle");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [newName, setNewName] = useState("");
  const [newSport, setNewSport] = useState<Sport>("Fußball");

  // API-Namen sammeln: Live-Spiele von gestern und heute (gleicher Speicher und
  // Cache wie das Matchcenter, keine Extra-Abfragen) und die Tabellen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const now = Date.now();
      const dates = [viennaDate(now - 24 * 60 * 60 * 1000), viennaDate(now)];
      const live = refreshLiveDays(LIVE_SPORTS.flatMap((sport) => dates.map((date) => ({ sport, date }))));
      const tables = Promise.all(
        Object.entries(LEAGUE_IDS).map(([league, id]) =>
          fetchStandings(id, currentSeason())
            .then((rows) => rows.map((r) => ({ sport: LEAGUE_SPORTS[league], apiName: r.teamName })))
            .catch(() => [] as ApiName[]),
        ),
      );
      const [, tableNames] = await Promise.all([live, tables]);
      if (cancelled) return;
      const liveNames = peekLiveDays()
        .filter((d) => dates.includes(d.date))
        .flatMap((d) => d.games.flatMap((g) => [g.home, g.away].map((apiName) => ({ sport: d.sport, apiName }))));
      setSeen([...liveNames, ...tableNames.flat()].filter((n) => n.sport && n.apiName));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Alle Namen einmal: gesehene + schon verknüpfte.
  const names = useMemo(() => {
    const map = new Map<string, ApiName>();
    for (const l of apiNameLinks) map.set(nameKey(l.sport, l.apiName), { sport: l.sport, apiName: l.apiName });
    for (const n of seen) if (!map.has(nameKey(n.sport, n.apiName))) map.set(nameKey(n.sport, n.apiName), n);
    return Array.from(map.values()).sort(
      (a, b) => ALL_SPORTS.indexOf(a.sport) - ALL_SPORTS.indexOf(b.sport) || a.apiName.localeCompare(b.apiName, "de"),
    );
  }, [seen, apiNameLinks]);

  const rows = names.map((n) => {
    const link = findApiNameLink(apiNameLinks, n.sport, n.apiName);
    const auto = autoTeamForApiName(teams, n.sport, n.apiName);
    const linkedTeam = link?.teamId ? teams.find((t) => t.id === link.teamId) : undefined;
    // Offen = es steht noch der API-Name (weder verknüpft noch automatisch).
    const open = !link && !auto;
    return { ...n, link, auto, linkedTeam, open };
  });
  const sports = ALL_SPORTS.filter((s) => names.some((n) => n.sport === s));
  const visible = rows.filter((r) => (sportFilter === "alle" || r.sport === sportFilter) && (!onlyOpen || r.open));
  const openCount = rows.filter((r) => r.open).length;

  function setLink(sport: Sport, apiName: string, value: string) {
    const rest = apiNameLinks.filter((l) => !(l.sport === sport && normalizeTeamName(l.apiName) === normalizeTeamName(apiName)));
    const next: ApiNameLink[] =
      value === "" ? rest : [...rest, { sport, apiName, teamId: value === KEEP ? null : value }];
    saveApiNameLinks(next);
  }

  function addName() {
    const clean = newName.trim();
    if (!clean) return;
    setSeen((list) => [...list, { sport: newSport, apiName: clean }]);
    setSportFilter(newSport);
    setOnlyOpen(false);
    setNewName("");
  }

  return (
    <div>
      <h2 className="mb-1 font-display text-2xl font-semibold text-ink">Vereinsnamen</h2>
      <p className="mb-4 text-sm text-muted">
        Namen von der API (Live-Spiele und Tabellen im Matchcenter) mit deinen Teams verknüpfen. Dann steht überall dein
        Name, z. B. „Rapid Wien“ statt „Rapid Vienna“. Gleiche Namen erkennt die App selbst. Fehlt ein Verein, leg ihn
        zuerst unter „Teams“ an.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {(["alle", ...sports] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSportFilter(s)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
              sportFilter === s ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
            }`}
          >
            {s === "alle" ? "Alle" : sportLabel(s)}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} />
          Nur offene ({openCount})
        </label>
      </div>

      {loading && names.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Lädt…</p>
      ) : visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          {onlyOpen ? "Alles erledigt: für alle Namen steht dein eigener Name." : "Keine Namen gefunden."}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-edge rounded-card border border-edge bg-surface">
          {visible.map((r) => {
            const value = r.link ? (r.link.teamId ?? KEEP) : "";
            const groups = groupTeams(teams.filter((t) => t.sport === r.sport));
            return (
              <li
                key={nameKey(r.sport, r.apiName)}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-ink">{r.apiName}</p>
                  <p className="text-xs text-muted">
                    {sportLabel(r.sport)} ·{" "}
                    {r.linkedTeam ? (
                      <span className="text-gold">zeigt „{r.linkedTeam.name}“</span>
                    ) : r.link ? (
                      "API-Name bleibt"
                    ) : r.auto ? (
                      <span className="text-gold">automatisch „{r.auto.name}“</span>
                    ) : (
                      <span className="text-yellow-400">offen, zeigt den API-Namen</span>
                    )}
                  </p>
                </div>
                <select
                  value={value}
                  onChange={(e) => setLink(r.sport, r.apiName, e.target.value)}
                  className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink sm:w-64"
                  aria-label={`Eigener Name für ${r.apiName}`}
                >
                  <option value="">{r.auto ? `Automatisch: ${r.auto.name}` : "– nicht verknüpft –"}</option>
                  <option value={KEEP}>API-Namen lassen</option>
                  {groups.map((g) => (
                    <optgroup key={g.key} label={g.label}>
                      {g.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 rounded-card border border-edge bg-surface px-4 py-3">
        <p className="mb-2 text-sm font-semibold text-ink">Namen fehlt in der Liste?</p>
        <p className="mb-2 text-xs text-muted">
          Hier stehen die Live-Spiele von gestern und heute und die Tabellen. Einen anderen API-Namen kannst du so
          eintragen, genau wie er in der App erscheint.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            value={newSport}
            onChange={(e) => setNewSport(e.target.value as Sport)}
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink"
          >
            {LIVE_SPORTS.map((s) => (
              <option key={s} value={s}>
                {sportLabel(s)}
              </option>
            ))}
          </select>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addName()}
            placeholder="z. B. Rapid Vienna"
            className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink"
          />
          <button
            onClick={addName}
            className="rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
