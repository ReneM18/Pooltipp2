"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { COUNTRIES, countryName, flagEmoji } from "@/lib/flags";
import { normalizeTeamName } from "@/lib/teamName";
import { teamMatchScore } from "@/lib/liveScores";
import { appTeamForApiName, findApiNameLink, type ApiNameLink } from "@/lib/teamApiNames";
import { autoTeamGroup, groupTeams, isFixedGroup, NATIONAL_GROUP, teamGroup } from "@/lib/teamGroups";
import { IMPORT_LEAGUES, type ImportLeague } from "@/lib/leagueImport";
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
// Dazu die ICE Hockey League (Rene, 30.10.2026: "es spielen auch Teams wie
// Bolzano aus Italien"): Untergruppe = Liga, jedes Team mit seinem Land von
// der API (Bozen Italien, Fehérvár Ungarn …). Vorhandene Teams werden
// erkannt, auch wenn sie noch unter ihrem Land stehen.

const NEW = "__neu__";
const SPORT_LABEL: Record<string, string> = { "Fußball": "Fußball", NHL: "Eishockey" };
const LEAGUE_SPORTS = IMPORT_LEAGUES.map((l) => l.sport).filter((s, i, all) => all.indexOf(s) === i);
// Gleiche Grundfarben wie beim Anlegen von Hand (Admin -> Teams).
const NEW_TEAM_COLORS = { primaryColor: "#3FA66B", secondaryColor: "#FFFFFF" };

function leagueText(l: ImportLeague): string {
  return l.anyCountry ? l.label : `${l.label} ${countryName(l.country)}`;
}

// Untergruppe für eine Liga: eine vorhandene, deren Name mit dem Liganamen
// beginnt und das Land enthält ("2. Liga Österreich") bzw. die wie die Liga
// heißt ("ICE Hockey League"), sonst league.group bzw. das Land.
function defaultGroup(league: ImportLeague, labels: string[]): string {
  const name = normalizeTeamName(league.label);
  const country = normalizeTeamName(countryName(league.country));
  const names = (league.groupNames ?? []).map(normalizeTeamName).filter(Boolean);
  return (
    labels.find((g) => normalizeTeamName(g).startsWith(name) && normalizeTeamName(g).includes(country)) ??
    labels.find((g) => names.some((n) => normalizeTeamName(g).includes(n))) ??
    league.group ??
    countryName(league.country)
  );
}

// Land von der API nur, wenn die App es kennt.
function apiCountry(t: LeagueTeam): string | null {
  return t.country && COUNTRIES.some((c) => c.code === t.country) ? t.country : null;
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

// Zweite Mannschaft ("Rapid Wien II", "Sturm Graz 2", "Juniors") ist nie
// dasselbe Team wie die erste.
const RESERVE = /\b(ii|2|b|u\d\d|juniors?|amateure|young)\b/i;
function sameSquad(a: string, b: string): boolean {
  return RESERVE.test(a) === RESERVE.test(b);
}

// Vorschläge: je API-Verein ein Team oder NEW, kein Team doppelt. Ähnliche
// Namen aus der Ziel-Untergruppe und aus der Landesgruppe der Liga (dort
// stehen z. B. 2.-Bundesliga-Vereine, die noch keine eigene Untergruppe
// haben), bei der ICE Hockey League aus allen Ländern außer NHL.
// Teams in einer anderen eigenen Untergruppe (z. B. "Bundesliga") nie.
function suggest(
  league: ImportLeague,
  apiTeams: LeagueTeam[],
  clubs: Team[],
  groupOf: Map<string, string>,
  links: ApiNameLink[],
  groupKey: string,
): Record<string, string> {
  const nhlKey = normalizeTeamName("NHL");
  const nationalKey = normalizeTeamName(NATIONAL_GROUP);
  const pool = clubs.filter((t) => {
    const key = groupOf.get(t.id);
    if (key === groupKey) return true;
    if (key !== autoTeamGroup(t).key || key === nhlKey || key === nationalKey) return false;
    return league.anyCountry || t.countryCode === league.country;
  });
  const candidates = apiTeams.map((a) => {
    const sure = appTeamForApiName(clubs, links, league.sport, a.apiName);
    if (sure) return { a, team: sure, score: 10 };
    let best: Team | undefined;
    let bestScore = 0;
    for (const t of pool) {
      const s = sameSquad(t.name, a.apiName) ? teamMatchScore(t.name, a.apiName) : 0;
      if (s > bestScore) {
        best = t;
        bestScore = s;
      }
    }
    return { a, team: bestScore >= 1 ? best : undefined, score: bestScore };
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
  const [leagueId, setLeagueId] = useState(IMPORT_LEAGUES[0].key);
  const league = IMPORT_LEAGUES.find((l) => l.key === leagueId) ?? IMPORT_LEAGUES[0];
  const sport = league.sport;
  const clubs = useMemo(() => teams.filter((t) => t.sport === sport && !t.isNationalTeam), [teams, sport]);
  const groupLabels = useMemo(() => groupTeams(clubs, sport).map((g) => g.label), [clubs, sport]);
  // Untergruppe je Team einmal ausrechnen (teamGroup ist nicht billig).
  const groupOf = useMemo(() => new Map(clubs.map((t) => [t.id, teamGroup(t, clubs).key])), [clubs]);
  const [group, setGroup] = useState("");
  const [load, setLoad] = useState<
    { state: "idle" | "loading" } | { state: "error"; error: string } | { state: "ready"; teams: LeagueTeam[]; season: number; fromApp: boolean }
  >({
    state: "idle",
  });
  const [choice, setChoice] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const groupName = group.trim();
  const groupKey = normalizeTeamName(groupName);

  async function fetchTeams(id: string) {
    setLoad({ state: "loading" });
    setDone(null);
    try {
      const res = await fetch(`/api/league-teams?league=${encodeURIComponent(id)}`);
      const body = (await res.json()) as LeagueTeamsResponse;
      if (body.error) return setLoad({ state: "error", error: body.error });
      if (body.teams.length === 0)
        return setLoad({
          state: "error",
          error: "Die API kennt für diese Saison keine Vereine.",
        });
      setLoad({ state: "ready", teams: body.teams, season: body.season, fromApp: body.source === "app" });
    } catch {
      setLoad({ state: "error", error: "API nicht erreichbar" });
    }
  }

  function start(l: ImportLeague) {
    // Untergruppen der Sportart dieser Liga (Fußball oder Eishockey).
    const labels = groupTeams(
      teams.filter((t) => t.sport === l.sport && !t.isNationalTeam),
      l.sport,
    ).map((g) => g.label);
    setLeagueId(l.key);
    setGroup(defaultGroup(l, labels));
    void fetchTeams(l.key);
  }

  const apiTeams = useMemo(() => (load.state === "ready" ? load.teams : []), [load]);
  // Vorschläge neu, sobald die Vereine da sind oder die Untergruppe wechselt.
  useEffect(() => {
    if (saving) return;
    setChoice(suggest(league, apiTeams, clubs, groupOf, apiNameLinks, groupKey));
    // Nur bei neuer Liste bzw. Untergruppe, nicht nach jedem Speichern.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiTeams, groupKey]);
  const chosenIds = new Set(Object.values(choice).filter((v) => v !== NEW));
  const newCount = apiTeams.filter((a) => choice[a.apiName] === NEW).length;
  const linkCount = apiTeams.length - newCount;
  // Teams der Untergruppe, die keinem API-Verein zugeordnet sind (z. B.
  // abgestiegen oder anders geschrieben) – nur zum Hinweis.
  const leftOver = clubs.filter((t) => groupKey && groupOf.get(t.id) === groupKey && !chosenIds.has(t.id));
  const pickable = [...clubs].sort((a, b) => {
    const ga = groupOf.get(a.id) === groupKey ? 0 : 1;
    const gb = groupOf.get(b.id) === groupKey ? 0 : 1;
    return ga - gb || a.name.localeCompare(b.name, "de");
  });

  async function apply() {
    if (saving || !groupName || apiTeams.length === 0) return;
    if (!confirm(`${newCount} Vereine neu anlegen und ${linkCount} bestehende zuordnen – alle in „${groupName}“?`)) return;
    setSaving(true);
    let links = apiNameLinks;
    let created = 0;
    let updated = 0;
    const failed: string[] = [];
    let error: string | null = null;
    const stamp = Date.now();
    try {
      for (let i = 0; i < apiTeams.length; i++) {
        const a = apiTeams[i];
        const pick = choice[a.apiName];
        const stadium = apiStadium(a);
        let teamId: string;
        if (pick === NEW || !pick) {
          teamId = `team-${stamp}-${i}`;
          const res = await addTeam(
            {
              name: a.apiName,
              sport,
              countryCode: apiCountry(a) ?? league.country,
              ...NEW_TEAM_COLORS,
              group: groupName,
              ...(stadium ? { stadium } : {}),
            },
            teamId,
          );
          if (!res.ok) {
            error = res.error;
            failed.push(a.apiName);
            continue;
          }
          created++;
        } else {
          const team = teams.find((t) => t.id === pick);
          if (!team) {
            failed.push(a.apiName);
            continue;
          }
          teamId = team.id;
          const { id: _id, ...rest } = team;
          const needsGroup = teamGroup(team, clubs).key !== groupKey;
          const needsStadium = !team.stadium?.name.trim() && !!stadium;
          // Land von der API (z. B. Bozen als Italien statt Österreich).
          const country = apiCountry(a);
          const needsCountry = !!country && country !== team.countryCode;
          if (needsGroup || needsStadium || needsCountry) {
            const res = await updateTeam(team.id, {
              ...rest,
              ...(needsGroup ? { group: groupName } : {}),
              ...(needsStadium ? { stadium } : {}),
              ...(needsCountry && country ? { countryCode: country } : {}),
            });
            if (!res.ok) {
              error = res.error;
              failed.push(a.apiName);
              continue;
            }
          }
          updated++;
        }
        const old = findApiNameLink(links, sport, a.apiName);
        if (old?.teamId !== teamId) links = [...links.filter((l) => l !== old), { sport, apiName: a.apiName, teamId }];
      }
      if (links !== apiNameLinks) saveApiNameLinks(links);
      // Eigene Untergruppe mit Flagge anlegen, falls es sie noch nicht gibt
      // (Landesgruppen wie "Österreich" gibt es automatisch).
      if (
        (created > 0 || updated > 0) &&
        !isFixedGroup(groupKey) &&
        !teamGroupDefs.some((d) => d.sport === sport && normalizeTeamName(d.label) === groupKey)
      ) {
        saveTeamGroupDefs([...teamGroupDefs, { sport, label: groupName, countryCode: league.country }]);
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Unbekannter Fehler";
    } finally {
      setSaving(false);
    }
    const problem = failed.length > 0 ? ` – nicht gespeichert: ${failed.join(", ")}` : "";
    const text = `✓ ${created} angelegt, ${updated} zugeordnet${problem}${error ? ` (${error})` : ""}`;
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
          {LEAGUE_SPORTS.map((s) => (
            <div key={s} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{SPORT_LABEL[s] ?? s}</p>
              <div className="flex flex-wrap gap-2">
                {IMPORT_LEAGUES.filter((l) => l.sport === s).map((l) => (
                  <button
                    key={l.key}
                    type="button"
                    onClick={() => start(l)}
                    disabled={load.state === "loading" || saving}
                    className={`flex min-h-[44px] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                      leagueId === l.key && load.state !== "idle" ? "border-gold bg-gold/10 text-gold" : "border-edge text-muted hover:text-ink"
                    }`}
                  >
                    <Emoji e={flagEmoji(l.country)} /> {l.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {load.state === "idle" && (
            <p className="text-sm text-muted">
              Liga antippen – dann siehst du alle Vereine und was mit ihnen passiert, bevor etwas gespeichert wird.
            </p>
          )}
          {load.state === "loading" && <p className="text-sm text-muted">Lädt…</p>}
          {load.state === "error" && (
            <p className="text-sm text-muted">
              Vereine gerade nicht abrufbar ({load.error}).{" "}
              <button type="button" onClick={() => void fetchTeams(leagueId)} className="font-semibold text-ink underline">
                Nochmal
              </button>
            </p>
          )}
          {load.state === "ready" && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">
                  Untergruppe für {leagueText(league)} ·{" "}
                  {load.fromApp
                    ? "Vereinsliste aus der App (die API gibt sie im Gratis-Plan nicht her)"
                    : `Vereine der Saison ${load.season}/${String((load.season + 1) % 100).padStart(2, "0")}`}
                </span>
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
                  const country = apiCountry(a);
                  const picked = pick === NEW ? undefined : clubs.find((t) => t.id === pick);
                  // Land ändert sich beim Zuordnen (z. B. Bozen: Österreich → Italien).
                  const countryChange = picked && country && picked.countryCode !== country ? picked.countryCode : null;
                  const info = [country && league.anyCountry ? `${flagEmoji(country)} ${countryName(country)}` : null, a.stadium?.name]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <li key={a.apiName} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{a.apiName}</p>
                        {info && <p className="text-xs text-muted">{info}</p>}
                        {countryChange && country && (
                          <p className="text-xs font-semibold text-gold">
                            Land wird {countryName(country)} (bisher {countryName(countryChange)})
                          </p>
                        )}
                      </div>
                      <select
                        value={pick}
                        aria-label={`Team für ${a.apiName}`}
                        onChange={(e) =>
                          setChoice((c) => ({
                            ...c,
                            [a.apiName]: e.target.value,
                          }))
                        }
                        className={`min-h-[44px] w-full rounded-lg border bg-pitch px-2 text-base outline-none focus:border-gold sm:w-72 ${
                          pick === NEW ? "border-edge text-muted" : "border-gold/60 text-ink"
                        }`}
                      >
                        <option value={NEW}>➕ Neu anlegen</option>
                        {pickable.map((t) => (
                          <option key={t.id} value={t.id} disabled={t.id !== pick && chosenIds.has(t.id)}>
                            = {t.name}
                            {groupOf.get(t.id) === groupKey ? "" : ` (${teamGroup(t, clubs).label})`}
                          </option>
                        ))}
                      </select>
                    </li>
                  );
                })}
              </ul>
              {leftOver.length > 0 && (
                <p className="text-sm text-muted">
                  Schon in „{groupName}“, aber keinem API-Verein zugeordnet: {leftOver.map((t) => t.name).join(", ")}. Bleiben, wie sie
                  sind.
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
