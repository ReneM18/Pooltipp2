"use client";

import { FormEvent, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { COUNTRIES, flagEmoji } from "@/lib/flags";
import { normalizeTeamName } from "@/lib/teamName";
import { GROUPED_SPORTS, groupTeams, isFixedGroup, TeamGroupDef, TeamGroupWithTeams } from "@/lib/teamGroups";
import { Sport, SPORTS, SPORT_ICONS, sportLabel } from "@/lib/types";

// Admin -> Teams -> "Untergruppen" (Rene, 20.10.2026): Gruppen für die
// Team-Auswahl vorher anlegen (z. B. "2. Liga Österreich"), Reihenfolge
// festlegen, umbenennen, leere löschen. Länder, Nationalteams und NBA/NHL
// sind automatische Gruppen: nur verschiebbar. Gespeichert über
// saveTeamGroupDefs (eine Zeile in "teams", kein SQL).
export default function TeamGroupsEditor() {
  const { teams, teamGroupDefs, saveTeamGroupDefs, updateTeam } = useAppData();
  const { showToast } = useFeedback();
  const sports = GROUPED_SPORTS.filter((s) => SPORTS.includes(s));
  const [sport, setSport] = useState<Sport>(sports[0] ?? "Fußball");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");

  const sportTeams = teams.filter((t) => t.sport === sport);
  const groups = groupTeams(sportTeams, sport);

  // Neue Liste für diese Sportart in der angezeigten Reihenfolge, die der
  // anderen Sportarten bleibt unverändert.
  function save(ordered: TeamGroupWithTeams[], patch?: (d: TeamGroupDef) => TeamGroupDef) {
    const old = teamGroupDefs.filter((d) => d.sport === sport);
    const mine: TeamGroupDef[] = ordered.map((g) => {
      const existing = old.find((d) => normalizeTeamName(d.label) === g.key);
      const auto = COUNTRIES.find((c) => normalizeTeamName(c.name) === g.key);
      const def: TeamGroupDef = { sport, label: g.label };
      const code = existing?.countryCode ?? auto?.code;
      if (code) def.countryCode = code;
      return patch ? patch(def) : def;
    });
    saveTeamGroupDefs([...teamGroupDefs.filter((d) => d.sport !== sport), ...mine]);
  }

  function move(i: number, dir: -1 | 1) {
    const next = [...groups];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    save(next);
  }

  function add(e: FormEvent) {
    e.preventDefault();
    const label = name.trim();
    if (!label) return;
    const key = normalizeTeamName(label);
    if (groups.some((g) => g.key === key)) {
      showToast("Diese Untergruppe gibt es schon.", "info");
      return;
    }
    const created: TeamGroupWithTeams = { key, label, icon: country ? flagEmoji(country) : "🏆", teams: [] };
    save([...groups, created], (d) => (normalizeTeamName(d.label) === key && country ? { ...d, countryCode: country } : d));
    setName("");
    setCountry("");
    showToast(`✓ Untergruppe „${label}“ angelegt.`, "success");
  }

  async function rename(g: TeamGroupWithTeams) {
    const label = renameText.trim();
    const key = normalizeTeamName(label);
    if (!label || key === g.key) {
      setRenaming(null);
      return;
    }
    if (groups.some((x) => x.key === key)) {
      showToast("Diese Untergruppe gibt es schon.", "info");
      return;
    }
    // Vereine der Gruppe ziehen mit.
    for (const t of g.teams) {
      const { id, ...rest } = t;
      await updateTeam(id, { ...rest, group: label });
    }
    save(
      groups.map((x) => (x.key === g.key ? { ...x, key, label } : x)),
      undefined
    );
    setRenaming(null);
    showToast(`✓ Umbenannt in „${label}“.`, "success");
  }

  function remove(g: TeamGroupWithTeams) {
    if (g.teams.length > 0) return;
    if (!confirm(`Untergruppe „${g.label}“ löschen?`)) return;
    save(groups.filter((x) => x.key !== g.key));
  }

  return (
    <section className="mb-6 rounded-card border border-edge bg-surface p-5 sm:p-6">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-3 text-left">
        <span>
          <span className="block font-display text-base font-semibold text-ink">Untergruppen</span>
          <span className="block text-xs text-muted">
            Gruppen für die Team-Auswahl, z. B. „2. Liga Österreich“. Vorher anlegen, dann beim Team auswählen.
          </span>
        </span>
        <span className="shrink-0 text-sm text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="mt-4 flex flex-col gap-4">
          {sports.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {sports.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSport(s)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    sport === s ? "border-gold bg-gold/15 text-gold" : "border-edge bg-pitch text-muted hover:text-ink"
                  }`}
                >
                  {SPORT_ICONS[s]} {sportLabel(s)}
                </button>
              ))}
            </div>
          )}

          <ul className="flex flex-col gap-2">
            {groups.map((g, i) => {
              const fixed = isFixedGroup(g.key);
              return (
                <li key={g.key} className="flex items-center gap-3 rounded-lg border border-edge bg-pitch px-3 py-2">
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      aria-label="Nach oben"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      className="h-7 w-7 rounded-full border border-edge text-sm text-muted hover:border-gold hover:text-gold disabled:opacity-25"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Nach unten"
                      disabled={i === groups.length - 1}
                      onClick={() => move(i, 1)}
                      className="h-7 w-7 rounded-full border border-edge text-sm text-muted hover:border-gold hover:text-gold disabled:opacity-25"
                    >
                      ↓
                    </button>
                  </span>
                  {renaming === g.key ? (
                    <span className="flex min-w-0 flex-1 gap-2">
                      <input
                        value={renameText}
                        onChange={(e) => setRenameText(e.target.value)}
                        maxLength={40}
                        className="min-w-0 flex-1 rounded-lg border border-edge bg-surface px-3 py-1.5 text-sm text-ink"
                      />
                      <button type="button" onClick={() => rename(g)} className="rounded-full bg-action px-3 text-xs font-semibold text-pitch">
                        OK
                      </button>
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm text-ink">
                      {g.icon} {g.label}
                      <span className="ml-2 text-xs text-muted">
                        {g.teams.length} {g.teams.length === 1 ? "Verein" : "Vereine"}
                        {fixed ? " · automatisch" : ""}
                      </span>
                    </span>
                  )}
                  {!fixed && renaming !== g.key && (
                    <span className="flex shrink-0 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRenaming(g.key);
                          setRenameText(g.label);
                        }}
                        className="text-xs text-muted hover:text-gold"
                      >
                        Umbenennen
                      </button>
                      {g.teams.length === 0 && (
                        <button type="button" onClick={() => remove(g)} className="text-xs text-muted hover:text-ink">
                          Löschen
                        </button>
                      )}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <form onSubmit={add} className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder="Neue Untergruppe, z. B. 2. Liga Österreich"
              className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-4 py-2.5 text-sm text-ink outline-none focus:border-gold"
            />
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              aria-label="Flagge"
              className="rounded-lg border border-edge bg-pitch px-3 py-2.5 text-sm text-ink"
            >
              <option value="">🏆 ohne Flagge</option>
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {flagEmoji(c.code)} {c.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-pitch hover:bg-action-hover">
              Anlegen
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
