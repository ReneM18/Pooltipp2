"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Sport, Team } from "@/lib/types";
import { normalizeForSearch } from "@/lib/flags";
import { normalizeTeamName } from "@/lib/teamName";
import TeamBadge, { teamColorProps } from "@/components/TeamBadge";
import TeamGroupChips from "@/components/TeamGroupChips";
import { groupTeams, hasTeamGroups, teamGroup, withSelectedGroup } from "@/lib/teamGroups";

interface TeamPickerProps {
  teams: Team[];
  value: string;
  onChange: (teamId: string) => void;
  // Team der anderen Seite: wird angezeigt, ist aber nicht wählbar
  // (ein Team kann nicht gegen sich selbst spielen).
  otherTeamId?: string;
  otherLabel?: string;
  compact?: boolean;
  // Für Spieler statt Admin (Start-Erlebnis): eigener Text im leeren Feld
  // und ohne den Hinweis auf den Admin-Tab "Teams".
  placeholder?: string;
  notFoundText?: string;
  // Admin: Sportart der Liste und ob die Standard-Untergruppen (z. B.
  // "Nationalteams") auch ohne Teams als Knopf erscheinen.
  sport?: Sport;
  showEmptyGroups?: boolean;
}

// Passt der Suchtext zum Teamnamen? 0 = Treffer am Namens- oder Wortanfang,
// 1 = irgendwo im Namen, -1 = kein Treffer. Umlaute zählen in beiden
// Schreibweisen ("munchen" und "muenchen" finden München), Leerzeichen
// und Bindestriche sind egal ("bayernmun" findet Bayern München).
function matchRank(name: string, query: string): number {
  const q = normalizeForSearch(query.trim());
  if (!q) return 0;
  const plain = normalizeForSearch(name);
  const words = plain.split(/[^a-z0-9]+/).filter(Boolean);
  if (plain.startsWith(q) || words.some((w) => w.startsWith(q))) return 0;
  if (plain.includes(q)) return 1;
  const qKey = normalizeTeamName(query);
  if (!qKey) return -1;
  const loose = plain.replace(/[^a-z0-9]/g, "");
  const key = normalizeTeamName(name);
  if (loose.startsWith(qKey) || key.startsWith(qKey)) return 0;
  if (loose.includes(qKey) || key.includes(qKey)) return 1;
  return -1;
}

// Teamauswahl mit Suchfeld: Bei vielen Teams ist ein normales Dropdown zu
// lang, darum tippt man einfach ein paar Buchstaben des Namens.
export default function TeamPicker({
  teams,
  value,
  onChange,
  otherTeamId,
  otherLabel,
  compact = false,
  placeholder = "Team suchen…",
  notFoundText,
  sport,
  showEmptyGroups = false,
}: TeamPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Gewählte Untergruppe ("" = alle). Beim Suchen wird immer in allen Teams gesucht.
  const [groupKey, setGroupKey] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = teams.find((t) => t.id === value);

  // Untergruppen (NHL, Nationalteams, Österreich …) nur bei Fußball,
  // Basketball und Eishockey und nur, wenn es mehr als eine gibt.
  const groups = useMemo(() => {
    const listSport = sport ?? teams[0]?.sport;
    if (!listSport || !hasTeamGroups(listSport) || !teams.every((t) => t.sport === listSport)) return [];
    const list = groupTeams(teams, showEmptyGroups ? listSport : undefined);
    if (list.length <= 1) return [];
    // Admin: auch ein über "Weitere Länder…" gewähltes Land ohne Teams zeigen.
    return showEmptyGroups ? withSelectedGroup(list, groupKey) : list;
  }, [teams, sport, showEmptyGroups, groupKey]);
  const searching = !!query.trim();
  // Bei "Alle" nur Gruppen mit Teams; eine leere Gruppe zeigt ihren Hinweis,
  // wenn man sie direkt antippt.
  const visibleGroups = searching
    ? []
    : groupKey
    ? groups.filter((g) => g.key === groupKey)
    : groups.filter((g) => g.teams.length > 0);

  const matches = useMemo(() => {
    const sorted = [...teams].sort((a, b) => a.name.localeCompare(b.name, "de"));
    if (!query.trim()) return sorted;
    const first: Team[] = [];
    const rest: Team[] = [];
    for (const t of sorted) {
      const rank = matchRank(t.name, query);
      if (rank === 0) first.push(t);
      else if (rank === 1) rest.push(t);
    }
    return [...first, ...rest];
  }, [teams, query]);

  // Klick außerhalb schließt die Liste.
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("touchstart", handleClick);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("touchstart", handleClick);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    // Liste startet in der Gruppe des gewählten Teams, sonst bei "Alle".
    const current = teams.find((t) => t.id === value);
    setGroupKey(current && hasTeamGroups(current.sport) ? teamGroup(current, teams).key : "");
    searchRef.current?.focus({ preventScroll: true });
    // Am Handy schiebt sich die Tastatur über die untere Bildschirmhälfte:
    // Feld nach oben rollen (knapp unter die feste Kopfleiste, siehe
    // scroll-mt), damit die Trefferliste sichtbar bleibt.
    if (window.innerWidth >= 640) return;
    const timer = setTimeout(() => {
      rootRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    }, 250);
    return () => clearTimeout(timer);
  }, [open]);

  function choose(id: string) {
    onChange(id);
    setOpen(false);
    setQuery("");
  }

  function renderTeam(t: Team, showGroup: boolean) {
    const isOther = t.id === otherTeamId;
    const group = showGroup ? teamGroup(t, teams) : null;
    return (
      <li key={t.id} role="option" aria-selected={t.id === value} aria-disabled={isOther}>
        <button
          type="button"
          disabled={isOther}
          onClick={() => choose(t.id)}
          className={`flex min-h-[44px] w-full items-center gap-3 px-4 py-2 text-left text-base ${
            isOther
              ? "cursor-not-allowed opacity-40"
              : t.id === value
              ? "text-gold hover:bg-surface-hover"
              : "text-ink hover:bg-surface-hover"
          }`}
        >
          <span className="shrink-0">
            <TeamBadge
              sport={t.sport}
              {...teamColorProps(t)}
              jerseyStyle={t.jerseyStyle}
              isNationalTeam={t.isNationalTeam}
              countryCode={t.countryCode}
              size={28}
            />
          </span>
          <span className="min-w-0 flex-1 break-normal leading-snug">
            {t.name}
            {group && (
              <span className="block text-xs text-muted">
                {group.icon} {group.label}
              </span>
            )}
            {isOther && otherLabel && (
              <span className="block text-xs text-muted">{otherLabel}</span>
            )}
          </span>
        </button>
      </li>
    );
  }

  const firstChoosable = matches.find((t) => t.id !== otherTeamId);
  const badgeSize = compact ? 24 : 28;

  return (
    <div ref={rootRef} className="relative scroll-mt-44">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-2 rounded-lg border border-edge text-left text-ink outline-none focus:border-gold ${
          compact ? "bg-surface px-3 py-2 text-sm" : "bg-pitch px-4 py-3 text-base"
        }`}
      >
        {selected ? (
          <>
            <span className="shrink-0">
              <TeamBadge
                sport={selected.sport}
                {...teamColorProps(selected)}
                jerseyStyle={selected.jerseyStyle}
                isNationalTeam={selected.isNationalTeam}
                countryCode={selected.countryCode}
                size={badgeSize}
              />
            </span>
            <span className="min-w-0 flex-1 break-normal leading-snug">{selected.name}</span>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-muted">{placeholder}</span>
        )}
        <span className="shrink-0 text-xs text-muted">▼</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1 rounded-lg border border-edge bg-surface shadow-xl">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                // Enter übernimmt den ersten Treffer, statt das Formular abzuschicken.
                e.preventDefault();
                if (firstChoosable) choose(firstChoosable.id);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            type="search"
            enterKeyHint="done"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder="Name eintippen, z. B. Bayern"
            className="w-full rounded-t-lg border-b border-edge bg-pitch px-4 py-3 text-base text-ink outline-none"
          />
          {groups.length > 0 && (
            <div className={`border-b border-edge py-2 pl-3 ${searching ? "opacity-50" : ""}`}>
              <TeamGroupChips
                groups={groups}
                value={searching ? "" : groupKey}
                onChange={(key) => {
                  setQuery("");
                  setGroupKey(key);
                }}
                total={teams.length}
                size="sm"
                countryPicker={showEmptyGroups}
              />
            </div>
          )}
          <ul role="listbox" className="max-h-72 overflow-y-auto overscroll-contain py-1">
            {matches.length === 0 && (searching || !groupKey) && (
              <li className="px-4 py-3 text-sm text-muted">
                {teams.length === 0
                  ? "Für diese Sportart gibt es noch keine Teams."
                  : notFoundText ?? `Kein Team gefunden für "${query.trim()}". Neue Teams legst du im Tab "Teams" an.`}
              </li>
            )}
            {visibleGroups.length > 0
              ? visibleGroups.map((g) => (
                  <li key={g.key} role="presentation">
                    <p className="sticky top-0 z-10 bg-surface px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      <span aria-hidden>{g.icon}</span> {g.label}
                    </p>
                    <ul role="group" aria-label={g.label}>
                      {g.teams.length === 0 && (
                        <li className="px-4 py-3 text-sm text-muted">
                          Noch keine Teams in dieser Gruppe. Neue Teams legst du im Tab „Teams“ an.
                        </li>
                      )}
                      {g.teams.map((t) => renderTeam(t, false))}
                    </ul>
                  </li>
                ))
              : matches.map((t) => renderTeam(t, groups.length > 0))}
          </ul>
        </div>
      )}
    </div>
  );
}
