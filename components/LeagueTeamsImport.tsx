"use client";

import { useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { countryName, flagEmoji } from "@/lib/flags";
import { normalizeTeamName } from "@/lib/teamName";
import { teamMatchScore } from "@/lib/liveScores";
import { appTeamForApiName, findApiNameLink, type ApiNameLink } from "@/lib/teamApiNames";
import { groupTeams, teamGroup } from "@/lib/teamGroups";
import { TABLE_LEAGUES, type TableLeague } from "@/lib/standings";
import type { LeagueTeam } from "@/lib/live/providers/apiSports";
import type { LeagueTeamsResponse } from "@/app/api/league-teams/route";
import type { Team, TeamStadium } from "@/lib/types";
import Emoji from "@/components/Emoji";

// Admin -> Teams: alle Vereine einer Liga von der API holen (Rene,
// 30.10.2026: "die Mannschaften der 2. Liga gleich im Admin unter 2. Liga
// Österreich einfügen, dort sind schon 2 drin, die gleich richtig
// zuordnen"). Pro API-Verein wählt der Admin "Neu anlegen" oder ein
// bestehendes Team. Vorschlag: zuerst die Verknüpfung unter "Vereinsnamen"
// bzw. gleicher Name, sonst ein ähnlicher Name aus der Ziel-Untergruppe.
// Beim Übernehmen kommen alle in die Untergruppe, neue Vereine mit Stadion
// von der API, und jeder API-Name wird mit seinem Team verknüpft (so bleibt
// die Zuordnung, auch wenn der Admin den Namen später ändert).

const SPORT = "Fußball" as const;
const NEW = "__neu__";
const LEAGUES = TABLE_LEAGUES.filter((l): l is TableLeague & { country: string } => l.country !== null);
// Gleiche Grundfarben wie beim Anlegen von Hand (Admin -> Teams).
const NEW_TEAM_COLORS = { primaryColor: "#3FA66B", secondaryColor: "#FFFFFF" };

function leagueText(l: TableLeague & { country: string }): string {
  return `${l.label} ${countryName(l.country)}`;
}

// Untergruppe für eine Liga: eine vorhandene, deren Name mit dem Liganamen
// beginnt und das Land enthält ("2. Liga Österreich"), sonst das Land.
function defaultGroup(league: TableLeague & { country: string }, labels: string[]): string {
  const name = normalizeTeamName(league.label);
  const country = normalizeTeamName(countryName(league.country));
  return labels.find((g) => normalizeTeamName(g).startsWith(name) && normalizeTeamName(g).includes(country)) ?? countryName(league.country);
}

function apiStadium(t: LeagueTeam): TeamStadium | undefined {
  if (!t.stadium) return undefined;
  return {
    name: t.stadium.name,
    ...(t.stadium.capacity !== null ? { capacity: t.stadium.capacity } : {}),
    apiName: t.stadium.name,
    ...(t.stadium.venueId !== null ? { apiVenueId: t.stadium.venueId } : {}),
  };
}

// Vorschläge: je API-Verein ein Team oder NEW, kein Team doppelt.
function suggest(apiTeams: LeagueTeam[], teams: Team[], links: ApiNameLink[], groupKey: string): Record<string, string> {
  const clubs = teams.filter((t) => t.sport === SPORT && !t.isNationalTeam);
  const inGroup = clubs.filter((t) => teamGroup(t, clubs).key === groupKey);
  const candidates = apiTeams.map((a) => {
    const sure = appTeamForApiName(clubs, links, SPORT, a.apiName);
    if (sure) return { a, team: sure, score: 10 };
    let best: Team | undefined;
    let bestScore = 0;
    for (const t of inGroup) {
      const s = teamMatchScore(t.name, a.apiName);
      if (s > bestScore) {
        best = t;
        bestScore = s;
      }
    }
    return { a, team: bestScore >= 0.5 ? best : undefined, score: bestScore };
  });
  const used = new Set<string>();
  const result: Record<string, string> = {};
  [...candidates]
    .sort((x, y) => y.score - x.score)
    .forEach(({ a, team }) => {
      if (team && !used.has(team.id)) {
        used.add(team.id);
        result[a.apiName] = team.id;
      } else result[a.apiName] = NEW;
    });
  return result;
}

export default function LeagueTeamsImport() {
  const { teams, teamGroupDefs, saveTeamGroupDefs, apiNameLinks, saveApiNameLinks, addTeam, updateTeam } = useAppData();
  const { showToast } = useFeedback();
  const [open, setOpen] = useState(false);
  const [leagueId, setLeagueId] = useState(LEAGUES.find((l) => l.label === "2. Liga")?.id ?? LEAGUES[0].id);
  const league = LEAGUES.find((l) => l.id === leagueId) ?? LEAGUES[0];
  const clubs = useMemo(() => teams.filter((t) => t.sport === SPORT && !t.isNationalTeam), [teams]);
  const groupLabels = useMemo(() => groupTeams(clubs, SPORT).map((g) => g.label), [clubs]);
  const [group, setGroup] = useState("");
  const [load, setLoad] = useState<{ state: "idle" | "loading" } | { state: "error"; error: string } | { state: "ready"; teams: LeagueTeam[] }>({
    state: "idle",
  });
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const groupName = group.trim();
  const groupKey = normalizeTeamName(groupName);

  async function fetchTeams(id: number, targetGroup: string) {
    setLoad({ state: "loading" });
    setDone(null);
    try {
      const res = await fetch(`/api/league-teams?league=${id}`);
      const body = (await res.json()) as LeagueTeamsResponse;
      if (body.error) return setLoad({ state: "error", error: body.error });
      if (body.teams.length === 0) return setLoad({ state: "error", error: "Die API kennt für diese Saison keine Vereine." });
      setChoice(suggest(body.teams, teams, apiNameLinks, normalizeTeamName(targetGroup)));
      setLoad({ state: "ready", teams: body.teams });
    } catch {
      setLoad({ state: "error", error: "API nicht erreichbar" });
    }
  }

  function start(l: TableLeague & { country: string }) {
    const g = defaultGroup(l, groupLabels);
    setLeagueId(l.id);
    setGroup(g);
    void fetchTeams(l.id, g);
  }

  const apiTeams = load.state === "ready" ? load.teams : [];
  const chosenIds = new Set(Object.values(choice).filter((v) => v !== NEW));
  const newCount = apiTeams.filter((a) => choice[a.apiName] === NEW).length;
  const linkCount = apiTeams.length - newCount;
  // Teams der Untergruppe, die keinem API-Verein zugeordnet sind (z. B.
  // abgestiegen oder anders geschrieben) – nur zum Hinweis.
  const leftOver = clubs.filter((t) => groupKey && teamGroup(t, clubs).key === groupKey && !chosenIds.has(t.id));
  const pickable = [...clubs].sort((a, b) => {
    const ga = teamGroup(a, clubs).key === groupKey ? 0 : 1;
    const gb = teamGroup(b, clubs).key === groupKey ? 0 : 1;
    return ga - gb || a.name.localeCompare(b.name, "de");
  });

  async function apply() {
    if (saving || !groupName || apiTeams.length === 0) return;
    if (!confirm(`${newCount} Vereine neu anlegen und ${linkCount} bestehende zuordnen – alle in „${groupName}“?`)) return;
    setSaving(true);
    let links = apiNameLinks;
    let created = 0;
    let updated = 0;
    let error: string | null = null;
    const stamp = Date.now();
    for (let i = 0; i < apiTeams.length; i++) {
      const a = apiTeams[i];
      const pick = choice[a.apiName];
      const stadium = apiStadium(a);
      let teamId: string;
      if (pick === NEW || !pick) {
        teamId = `team-${stamp}-${i}`;
        const res = await addTeam(
          { name: a.apiName, sport: SPORT, countryCode: league.country, ...NEW_TEAM_COLORS, group: groupName, ...(stadium ? { stadium } : {}) },
          teamId,
        );
        if (!res.ok) {
          error = res.error;
          continue;
        }
        created++;
      } else {
        const team = teams.find((t) => t.id === pick);
        if (!team) continue;
        teamId = team.id;
        const { id: _id, ...rest } = team;
        const needsGroup = teamGroup(team, clubs).key !== groupKey;
        const needsStadium = !team.stadium?.name.trim() && !!stadium;
        if (needsGroup || needsStadium) {
          const res = await updateTeam(team.id, {
            ...rest,
            ...(needsGroup ? { group: groupName } : {}),
            ...(needsStadium ? { stadium } : {}),
          });
          if (!res.ok) {
            error = res.error;
            continue;
          }
        }
        updated++;
      }
      const old = findApiNameLink(links, SPORT, a.apiName);
      if (old?.teamId !== teamId) links = [...links.filter((l) => l !== old), { sport: SPORT, apiName: a.apiName, teamId }];
    }
    if (links !== apiNameLinks) saveApiNameLinks(links);
    // Untergruppe mit Flagge anlegen, falls es sie noch nicht gibt.
    if (!teamGroupDefs.some((d) => d.sport === SPORT && normalizeTeamName(d.label) === groupKey)) {
      saveTeamGroupDefs([...teamGroupDefs, { sport: SPORT, label: groupName, countryCode: league.country }]);
    }
    setSaving(false);
    const text = `✓ ${created} angelegt, ${updated} zugeordnet${error ? ` – Fehler: ${error}` : ""}`;
    setDone(text);
    setLoad({ state: "idle" });
    showToast(text, error ? "info" : "success");
  }

  return (
    <div className="mb-6 rounded-card border border-edge bg-surface px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted">
          <span className="font-semibold text-ink">Vereine einer Liga von der API holen</span> · legt fehlende an, ordnet vorhandene zu
        </p>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="min-h-[44px] rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10"
        >
          {open ? "Schließen" : "Liga wählen"}
        </button>
      </div>
      {done && !open && (
        <p role="status" className="mt-2 text-sm font-semibold text-ink">
          {done}
        </p>
      )}
      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            {LEAGUES.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => start(l)}
                disabled={load.state === "loading" || saving}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  leagueId === l.id && load.state !== "idle" ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
                }`}
              >
                <Emoji e={flagEmoji(l.country)} /> {l.label}
              </button>
            ))}
          </div>
          {load.state === "idle" && <p className="text-sm text-muted">Liga antippen – dann siehst du alle Vereine und was mit ihnen passiert, bevor etwas gespeichert wird.</p>}
          {load.state === "loading" && <p className="text-sm text-muted">Lädt…</p>}
          {load.state === "error" && (
            <p className="text-sm text-muted">
              Vereine gerade nicht abrufbar ({load.error}).{" "}
              <button type="button" onClick={() => void fetchTeams(leagueId, group)} className="font-semibold text-ink underline">
                Nochmal
              </button>
            </p>
          )}
          {load.state === "ready" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">Untergruppe für {leagueText(league)}</span>
                <input
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  list="league-import-groups"
                  className="min-h-[44px] rounded-lg border border-edge bg-pitch px-3 text-base text-ink outline-none focus:border-gold"
                />
                <datalist id="league-import-groups">
                  {groupLabels.map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </label>
              <ul className="flex flex-col divide-y divide-edge rounded-lg border border-edge">
                {apiTeams.map((a) => {
                  const pick = choice[a.apiName] ?? NEW;
                  return (
                    <li key={a.apiName} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{a.apiName}</p>
                        {a.stadium && <p className="text-xs text-muted">{a.stadium.name}</p>}
                      </div>
                      <select
                        value={pick}
                        aria-label={`Team für ${a.apiName}`}
                        onChange={(e) => setChoice((c) => ({ ...c, [a.apiName]: e.target.value }))}
                        className={`min-h-[44px] w-full rounded-lg border bg-pitch px-2 text-base outline-none focus:border-gold sm:w-72 ${
                          pick === NEW ? "border-edge text-muted" : "border-gold/60 text-ink"
                        }`}
                      >
                        <option value={NEW}>➕ Neu anlegen</option>
                        {pickable.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.id !== pick && chosenIds.has(t.id)}>
                            = {t.name}
                            {teamGroup(t, clubs).key === groupKey ? "" : ` (${teamGroup(t, clubs).label})`}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
              {leftOver.length > 0 && (
                <p className="text-sm text-muted">
                  Schon in „{groupName}“, aber keinem API-Verein zugeordnet: {leftOver.map((t) => t.name).join(", ")}. Bleiben, wie sie sind.
                </p>
              )}
              <button
                type="button"
                onClick={() => void apply()}
                disabled={saving || !groupName}
                className="min-h-[44px] rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
              >
                {saving ? "Speichert…" : `${newCount} neu anlegen, ${linkCount} zuordnen`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
