"use client";

import { FormEvent, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import CountryPicker from "@/components/CountryPicker";
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
  const [flagging, setFlagging] = useState<string | null>(null);

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

  // Flagge einer Untergruppe setzen oder entfernen (Rene, 28.10.2026: "2.
  // Bundesliga" bekam immer den Pokal, die Flagge ließ sich nachher nicht
  // mehr ändern). "" = ohne Flagge -> Pokal.
  function setFlag(key: string, code: string) {
    save(groups, (d) => {
      if (normalizeTeamName(d.label) !== key) return d;
      const { countryCode: _old, ...rest } = d;
      return code ? { ...rest, countryCode: code } : rest;
    });
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
    const existing = groups.find((g) => g.key === key);
    if (existing) {
      // Gibt es schon (z. B. weil Vereine sie beim Anlegen bekommen haben):
      // mit gewählter Flagge nur die Flagge setzen.
      if (country && !isFixedGroup(key)) {
        setFlag(key, country);
        setName("");
        setCountry("");
        showToast(`✓ Flagge für „${existing.label}“ gesetzt.`, "success");
      } else {
        showToast("Diese Untergruppe gibt es schon.", "info");
      }
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
    // Flagge zieht mit (sonst stand nach dem Umbenennen wieder der Pokal da).
    const code = teamGroupDefs.find((d) => d.sport === sport && normalizeTeamName(d.label) === g.key)?.countryCode;
    save(
      groups.map((x) => (x.key === g.key ? { ...x, key, label } : x)),
      (d) => (code && normalizeTeamName(d.label) === key ? { ...d, countryCode: code } : d)
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
                <li key={g.key} className="flex flex-wrap items-center gap-3 rounded-lg border border-edge bg-pitch px-3 py-2">
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
                        onClick={() => setFlagging(flagging === g.key ? null : g.key)}
                        className="text-xs text-muted hover:text-gold"
                      >
                        Flagge
                      </button>
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
                  {flagging === g.key && (
                    <div className="basis-full">
                      <CountryPicker
                        value={teamGroupDefs.find((d) => d.sport === sport && normalizeTeamName(d.label) === g.key)?.countryCode ?? ""}
                        onChange={(code) => {
                          setFlag(g.key, code);
                          setFlagging(null);
                          showToast(code ? `✓ Flagge für „${g.label}“ gesetzt.` : `✓ Flagge bei „${g.label}“ entfernt.`, "success");
                        }}
                        emptyLabel="Ohne Flagge (Pokal)"
                      />
                    </div>
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
            {/* Mit Suchfeld (Rene, 20.10.2026: im Auswahlfeld konnte man nicht nach Buchstaben suchen). */}
            <div className="sm:w-64">
              <CountryPicker value={country} onChange={setCountry} emptyLabel="Ohne Flagge" />
            </div>
            <button type="submit" className="rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-pitch hover:bg-action-hover">
              Anlegen
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
