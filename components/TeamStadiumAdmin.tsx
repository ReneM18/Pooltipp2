"use client";

import { useState } from "react";
import type { Sport, Team, TeamStadium } from "@/lib/types";
import { sportLabel } from "@/lib/types";
import type { ApiNameLink } from "@/lib/teamApiNames";
import { canLookupStadium, type StadiumLookup } from "@/lib/teamStadium";
import type { SaveResult } from "@/lib/AppDataContext";
import Emoji from "@/components/Emoji";

// Stadion je Verein im Admin unter Teams (Rene, 29.10.2026: "bau mir bei jedem
// verein einen reiter wo ich das stadion ändern kann aber füll alles mit den
// namen von der api aus"). Jede Team-Karte bekommt eine Stadion-Zeile zum
// Aufklappen; oben ein Knopf, der alle Vereine einer Sportart von der API
// füllt. Von Hand geänderte Stadien (manual) überschreibt die API nicht.

type SaveTeam = (id: string, changes: Omit<Team, "id">) => Promise<SaveResult>;

// Eigener Name plus die unter "Vereinsnamen" verknüpften API-Namen.
function searchNames(team: Team, links: ApiNameLink[]): string[] {
  const linked = links.filter((l) => l.sport === team.sport && l.teamId === team.id).map((l) => l.apiName);
  return [team.name, ...linked];
}

async function lookupStadium(team: Team, links: ApiNameLink[]): Promise<StadiumLookup> {
  const q = new URLSearchParams({ sport: team.sport, country: team.countryCode ?? "" });
  for (const n of searchNames(team, links)) q.append("name", n);
  if (team.isNationalTeam) q.set("national", "1");
  try {
    const res = await fetch(`/api/team-stadium?${q.toString()}`);
    const data = (await res.json()) as StadiumLookup;
    return data && "found" in data ? data : { found: null, error: "Ungültige Antwort" };
  } catch {
    return { found: null, error: "API nicht erreichbar" };
  }
}

function withStadium(team: Team, stadium: TeamStadium | undefined): Omit<Team, "id"> {
  const { id: _id, stadium: _old, ...rest } = team;
  return stadium ? { ...rest, stadium } : rest;
}

function apiStadium(found: NonNullable<StadiumLookup["found"]>): TeamStadium {
  return {
    name: found.name,
    ...(found.capacity !== null ? { capacity: found.capacity } : {}),
    apiName: found.name,
    ...(found.venueId !== null ? { apiVenueId: found.venueId } : {}),
  };
}

function sameStadium(a: TeamStadium | undefined, b: TeamStadium): boolean {
  return (
    !!a &&
    a.name === b.name &&
    a.capacity === b.capacity &&
    a.apiName === b.apiName &&
    a.apiVenueId === b.apiVenueId &&
    !a.manual === !b.manual
  );
}

function capacityText(capacity: number | undefined): string {
  return capacity ? ` · ${capacity.toLocaleString("de-DE")} Plätze` : "";
}

// Knopf über der Team-Liste: alle Vereine der Sportart von der API füllen.
export function StadiumFillAll({
  sport,
  teams,
  links,
  updateTeam,
}: {
  sport: Sport;
  teams: Team[];
  links: ApiNameLink[];
  updateTeam: SaveTeam;
}) {
  const [run, setRun] = useState<
    | { state: "idle" }
    | { state: "running"; done: number; total: number }
    | { state: "done"; filled: number; same: number; missing: string[]; manual: number; error: string | null }
  >({ state: "idle" });
  const clubs = teams.filter((t) => t.sport === sport && !t.isNationalTeam);
  const todo = clubs.filter((t) => !t.stadium?.manual);
  const withName = clubs.filter((t) => t.stadium?.name.trim()).length;

  if (!canLookupStadium(sport)) {
    return (
      <p className="mb-4 rounded-card border border-edge bg-surface px-4 py-3 text-sm text-muted">
        <Emoji e="🏟️" /> Für {sportLabel(sport)} kennt die API keine Hallen. Trag sie bei den Vereinen unten unter „Stadion“ von Hand ein.
      </p>
    );
  }

  async function fillAll() {
    if (run.state === "running" || todo.length === 0) return;
    if (!confirm(`Stadien für ${todo.length} ${sportLabel(sport)}-Vereine von der API holen? Von Hand geänderte bleiben, wie sie sind.`)) return;
    let filled = 0;
    let same = 0;
    let error: string | null = null;
    const missing: string[] = [];
    setRun({ state: "running", done: 0, total: todo.length });
    for (let i = 0; i < todo.length; i++) {
      const team = todo[i];
      const res = await lookupStadium(team, links);
      if (res.found) {
        const next = apiStadium(res.found);
        if (sameStadium(team.stadium, next)) same++;
        else {
          const saved = await updateTeam(team.id, withStadium(team, next));
          if (saved.ok) filled++;
          else error = saved.error;
        }
      } else {
        missing.push(team.name);
        if (res.error) error = res.error;
      }
      setRun({ state: "running", done: i + 1, total: todo.length });
    }
    setRun({ state: "done", filled, same, missing, manual: clubs.length - todo.length, error });
  }

  return (
    <div className="mb-4 rounded-card border border-edge bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-muted">
          <Emoji e="🏟️" /> <span className="font-semibold text-ink">Stadien</span> · {withName} von {clubs.length} Vereinen eingetragen
        </p>
        <button
          type="button"
          onClick={() => void fillAll()}
          disabled={run.state === "running" || todo.length === 0}
          className="min-h-[44px] rounded-full border border-gold/60 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {run.state === "running" ? `Hole Stadien… ${run.done}/${run.total}` : "Von der API füllen"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">Von Hand geänderte Stadien überschreibt die API nicht.</p>
      {run.state === "done" && (
        <div role="status" className="mt-2 text-sm text-ink">
          <p className="font-semibold">
            ✓ {run.filled} eingetragen{run.same ? `, ${run.same} schon aktuell` : ""}
            {run.manual ? `, ${run.manual} von Hand (nicht geändert)` : ""}
          </p>
          {run.missing.length > 0 && (
            <p className="mt-1 text-muted">
              Nicht gefunden ({run.missing.length}): {run.missing.join(", ")} – bitte unten von Hand eintragen.
            </p>
          )}
          {run.error && <p className="mt-1 text-red-400">Fehler: {run.error}</p>}
        </div>
      )}
    </div>
  );
}

// Stadion-Zeile in einer Team-Karte, zum Aufklappen und Ändern.
export function TeamStadiumRow({
  team,
  links,
  updateTeam,
  onSaved,
}: {
  team: Team;
  links: ApiNameLink[];
  updateTeam: SaveTeam;
  onSaved: (text: string) => void;
}) {
  const stadium = team.stadium;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("");
  // Zuletzt von der API geholt: speichert man das unverändert, gilt es nicht
  // als "von Hand".
  const [fromApi, setFromApi] = useState<TeamStadium | null>(null);
  const [busy, setBusy] = useState<"api" | "save" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const canApi = canLookupStadium(team.sport) && !team.isNationalTeam;

  function start() {
    setName(stadium?.name ?? "");
    setCapacity(stadium?.capacity ? String(stadium.capacity) : "");
    setFromApi(null);
    setNote(null);
    setOpen(true);
  }

  async function fetchApi() {
    setBusy("api");
    setNote(null);
    const res = await lookupStadium(team, links);
    setBusy(null);
    if (!res.found) {
      setNote(res.error ?? "Die API kennt für diesen Verein kein Stadion.");
      return;
    }
    const next = apiStadium(res.found);
    setFromApi(next);
    setName(next.name);
    setCapacity(next.capacity ? String(next.capacity) : "");
    setNote("Von der API übernommen – jetzt speichern.");
  }

  async function save() {
    const cleanName = name.replace(/\s+/g, " ").trim().slice(0, 80);
    const digits = capacity.replace(/\D/g, "");
    const cap = digits ? Math.min(Number(digits), 500000) : undefined;
    const base = fromApi ?? (stadium && !stadium.manual ? stadium : undefined);
    const asApi = !!base && base.name === cleanName && base.capacity === cap;
    // Leerer Name = kein Stadion anzeigen; bleibt als "von Hand", damit die
    // API es beim Füllen nicht wieder einträgt.
    const next: TeamStadium = {
      name: cleanName,
      ...(cap ? { capacity: cap } : {}),
      ...((fromApi ?? stadium)?.apiName ? { apiName: (fromApi ?? stadium)!.apiName } : {}),
      ...((fromApi ?? stadium)?.apiVenueId !== undefined ? { apiVenueId: (fromApi ?? stadium)!.apiVenueId } : {}),
      ...(asApi ? {} : { manual: true }),
    };
    setBusy("save");
    const result = await updateTeam(team.id, withStadium(team, next));
    setBusy(null);
    if (!result.ok) {
      setNote(`Nicht gespeichert: ${result.error}`);
      return;
    }
    setOpen(false);
    onSaved(cleanName ? `✓ Stadion von „${team.name}“: ${cleanName}` : `✓ Kein Stadion mehr bei „${team.name}“`);
  }

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-edge pt-2">
        <span className="min-w-0 break-words text-xs text-muted">
          <Emoji e="🏟️" />{" "}
          {stadium?.name.trim() ? (
            <>
              <span className="text-ink">{stadium.name}</span>
              {capacityText(stadium.capacity)}
              {stadium.manual && <span className="ml-1.5 whitespace-nowrap rounded-full border border-edge px-1.5 py-px text-[11px]">von Hand</span>}
            </>
          ) : stadium?.manual ? (
            "ausgeblendet"
          ) : (
            "kein Stadion"
          )}
        </span>
        <button
          type="button"
          onClick={start}
          className="min-h-[40px] shrink-0 rounded-lg px-2 text-xs font-semibold text-gold transition-colors hover:text-ink"
        >
          Stadion ändern
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t border-edge pt-3">
      <label className="text-xs text-muted" htmlFor={`stadion-${team.id}`}>
        Stadion von {team.name}
      </label>
      <input
        id={`stadion-${team.id}`}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        placeholder="z. B. SUN MINIMEAL Arena"
        className="w-full rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
      />
      <div className="flex items-center gap-2">
        <input
          value={capacity}
          onChange={(e) => setCapacity(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="numeric"
          placeholder="Plätze"
          aria-label="Plätze"
          className="w-28 rounded-lg border border-edge bg-pitch px-3 py-2.5 text-base text-ink outline-none focus:border-gold"
        />
        <span className="text-xs text-muted">Plätze (optional)</span>
      </div>
      {note && <p className="text-xs text-muted">{note}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy !== null}
          className="min-h-[40px] rounded-full bg-action px-4 text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-40"
        >
          {busy === "save" ? "Speichert…" : "Speichern"}
        </button>
        {canApi && (
          <button
            type="button"
            onClick={() => void fetchApi()}
            disabled={busy !== null}
            className="min-h-[40px] rounded-full border border-gold/60 px-4 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-40"
          >
            {busy === "api" ? "Hole…" : "Von der API"}
          </button>
        )}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-[40px] rounded-full border border-muted/50 px-4 text-sm font-semibold text-ink transition-colors hover:border-ink"
        >
          Abbrechen
        </button>
      </div>
      <p className="text-[11px] text-muted">Name leer lassen = auf den Tippkarten kein Stadion zeigen.</p>
    </div>
  );
}
