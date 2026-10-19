"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { SPORT_ICONS, sportLabel, Sport } from "@/lib/types";
import { SavedHint } from "@/components/SaveButton";
import {
  BIO_SPORTS,
  BioData,
  BioRole,
  BioVisibility,
  CLUB_MAX,
  COACH_LEVELS,
  COUNTRIES,
  hasLevel,
  hasPlace,
  hasStatus,
  PLAY_LEVELS,
  PLAYER_LEVELS,
  RoleKey,
  roleLabel,
  ROLES,
  saveSportBio,
  SportBio,
} from "@/lib/sportBio";

const YEARS: string[] = [];
for (let y = new Date().getFullYear(); y >= 1950; y--) YEARS.push(String(y));

// Profil -> Einstellungen -> "Sport-Steckbrief": jede Auswahl speichert sofort,
// der Vereinsname beim Verlassen des Feldes. Anzeige: components/SportBioCard.tsx.
export default function SportBioEditor({
  userId,
  bio,
  unavailable,
  onSaved,
}: {
  userId: string;
  bio: SportBio | null;
  unavailable: boolean;
  onSaved: () => void;
}) {
  const { teams } = useAppData();
  const [data, setData] = useState<BioData>(bio?.data ?? {});
  const [visibility, setVisibility] = useState<BioVisibility>(bio?.visibility ?? "friends");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const touched = useRef(false);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Geladener Steckbrief kommt nach: übernehmen, solange man nichts geändert hat.
  // Danach nur noch den Prüf-Stand der Vereine übernehmen (kommt vom Server).
  useEffect(() => {
    if (!bio) return;
    if (!touched.current) {
      setData(bio.data);
      setVisibility(bio.visibility);
      return;
    }
    setData((cur) => {
      const roles = { ...(cur.roles ?? {}) };
      for (const [k, r] of Object.entries(roles) as [RoleKey, BioRole][]) {
        const server = bio.data.roles?.[k];
        if (server && server.club === r.club) roles[k] = { ...r, clubApproved: server.clubApproved };
      }
      return { ...cur, roles };
    });
  }, [bio]);

  const clubNames = useMemo(() => Array.from(new Set(teams.map((t) => t.name))).sort((a, b) => a.localeCompare(b, "de")), [teams]);

  async function commit(nextData: BioData, nextVis: BioVisibility = visibility) {
    touched.current = true;
    setData(nextData);
    setVisibility(nextVis);
    setSaved(false);
    const err = await saveSportBio(userId, nextData, nextVis);
    setError(err);
    if (err) return;
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 2500);
    onSaved();
  }

  function setRole(k: RoleKey, r: BioRole | null) {
    const roles = { ...(data.roles ?? {}) };
    if (r) roles[k] = r;
    else delete roles[k];
    commit({ ...data, roles });
  }

  function toggleSport(s: Sport) {
    const list = data.sports ?? [];
    commit({ ...data, sports: list.includes(s) ? list.filter((x) => x !== s) : [...list, s] });
  }

  const roles = data.roles ?? {};

  if (unavailable) {
    return (
      <section id="steckbrief" className="mb-8 scroll-mt-48">
        <h2 className="font-display text-lg font-semibold text-ink">Sport-Steckbrief</h2>
        <p className="mt-1 text-xs text-muted">⚠️ Kommt gleich – es fehlt noch ein Datenbank-Update.</p>
      </section>
    );
  }

  return (
    <section id="steckbrief" className="mb-8 scroll-mt-48">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">🏟️ Sport-Steckbrief</h2>
        <SavedHint saved={saved} />
      </div>
      <p className="mt-1 text-xs text-muted">
        Was hast du selbst mit Sport zu tun? Steht als „eigene Angabe“ in deinem Profil und bringt keine Punkte. „✓ bestätigt“
        kann nur der Admin setzen.
      </p>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

      <Card title="Was machst du – oder hast du gemacht?" text="Mehrere möglich.">
        <Choices label="Rollen">
          {ROLES.map((r) => (
            <Chip
              key={r.key}
              active={!!roles[r.key]}
              onClick={() =>
                setRole(r.key, roles[r.key] ? null : { st: "aktiv", ...(hasLevel(r.key) ? { niv: "verein" } : {}) })
              }
            >
              <span aria-hidden>{r.icon}</span>
              {r.label}
            </Chip>
          ))}
        </Choices>

        {ROLES.filter((r) => roles[r.key]).map((r) => {
          const role = roles[r.key]!;
          const [icon, label] = roleLabel(r.key, role);
          const states = role.land ? COUNTRIES[role.land] ?? [] : [];
          return (
            <div key={r.key} className="mt-4 rounded-card border border-gold/30 bg-pitch/60 p-3">
              <p className="font-display text-base font-bold text-ink">
                <span aria-hidden>{icon}</span> {label}
              </p>
              {hasStatus(r.key) && (
                <Choices label={`${r.label}: aktiv oder ehemalig`}>
                  <Chip small active={role.st === "aktiv"} onClick={() => setRole(r.key, { ...role, st: "aktiv" })}>
                    Aktiv
                  </Chip>
                  <Chip small active={role.st === "ex"} onClick={() => setRole(r.key, { ...role, st: "ex" })}>
                    Ehemalig
                  </Chip>
                </Choices>
              )}
              {hasLevel(r.key) && (
                <Choices label={`${r.label}: Niveau`}>
                  {(r.key === "spieler" ? PLAYER_LEVELS : COACH_LEVELS).map(([v, l]) => (
                    <Chip key={v} small active={role.niv === v} onClick={() => setRole(r.key, { ...role, niv: v })}>
                      {l}
                    </Chip>
                  ))}
                </Choices>
              )}
              {hasPlace(r.key) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <select
                    aria-label={`${r.label}: Land`}
                    value={role.land ?? ""}
                    onChange={(e) => setRole(r.key, { ...role, land: e.target.value || undefined, bl: undefined })}
                    className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink"
                  >
                    <option value="">Land …</option>
                    {Object.keys(COUNTRIES).map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`${r.label}: Bundesland`}
                    value={role.bl ?? ""}
                    disabled={states.length === 0}
                    onChange={(e) => setRole(r.key, { ...role, bl: e.target.value || undefined })}
                    className="rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink disabled:opacity-50"
                  >
                    <option value="">Bundesland / Region …</option>
                    {states.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <ClubInput
                    label={r.label}
                    value={role.club ?? ""}
                    approved={role.clubApproved === true}
                    known={clubNames}
                    onCommit={(club) => {
                      if ((club || undefined) === role.club) return;
                      setRole(r.key, { ...role, club: club || undefined, clubApproved: undefined });
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
        <datalist id="sport-bio-clubs">
          {clubNames.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>
      </Card>

      <Card title="Deine Sportarten" text="Was du selbst spielst oder am liebsten schaust.">
        <Choices label="Sportarten">
          {BIO_SPORTS.map((s) => (
            <Chip key={s} active={(data.sports ?? []).includes(s)} onClick={() => toggleSport(s)}>
              <span aria-hidden>{SPORT_ICONS[s]}</span>
              {sportLabel(s)}
            </Chip>
          ))}
        </Choices>
      </Card>

      <Card title="Höchste Spielklasse" text="In der du selbst gespielt hast.">
        <Choices label="Höchste Spielklasse">
          {PLAY_LEVELS.map((l) => (
            <Chip key={l} active={data.level === l} onClick={() => commit({ ...data, level: data.level === l ? undefined : l })}>
              {l}
            </Chip>
          ))}
        </Choices>
      </Card>

      <Card title="Fan seit" text="Seit wann dich Sport packt.">
        <select
          aria-label="Fan seit"
          value={data.since ?? ""}
          onChange={(e) => commit({ ...data, since: e.target.value || undefined })}
          className="mt-3 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink"
        >
          <option value="">– keine Angabe –</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </Card>

      <Card title="Wer sieht deinen Steckbrief?" text="Du siehst ihn immer.">
        <Choices label="Sichtbarkeit">
          {(
            [
              ["public", "👁️ Alle"],
              ["friends", "👥 Nur Freunde"],
              ["private", "🔒 Niemand"],
            ] as [BioVisibility, string][]
          ).map(([v, l]) => (
            <Chip key={v} active={visibility === v} onClick={() => commit(data, v)}>
              {l}
            </Chip>
          ))}
        </Choices>
      </Card>
    </section>
  );
}

function ClubInput({
  label,
  value,
  approved,
  known,
  onCommit,
}: {
  label: string;
  value: string;
  approved: boolean;
  known: string[];
  onCommit: (club: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const isKnown = known.some((n) => n.toLowerCase() === text.trim().toLowerCase());
  return (
    <div className="min-w-0">
      <input
        aria-label={`${label}: Verein`}
        list="sport-bio-clubs"
        value={text}
        maxLength={CLUB_MAX}
        placeholder="Verein …"
        onChange={(e) => setText(e.target.value)}
        onBlur={() => onCommit(text.trim())}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="w-full rounded-lg border border-edge bg-surface px-3 py-2 text-sm text-ink placeholder:text-muted"
      />
      {text.trim() && !isKnown && !(approved && text.trim() === value) && (
        <p className="mt-1 text-[11px] text-gold">⏳ Wird vom Admin geprüft, bis dahin sehen andere den Verein nicht.</p>
      )}
    </div>
  );
}

function Card({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-card border border-edge bg-surface p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted">{text}</p>
      {children}
    </div>
  );
}

function Choices({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="group" aria-label={label} className="mt-3 flex flex-wrap gap-2">
      {children}
    </div>
  );
}

function Chip({
  active,
  small = false,
  onClick,
  children,
}: {
  active: boolean;
  small?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex min-w-0 items-center gap-1.5 whitespace-nowrap rounded-full border font-display font-semibold transition-colors ${
        small ? "px-3 py-1 text-xs" : "px-3 py-1.5 text-sm"
      } ${active ? "border-action bg-action text-pitch" : "border-edge bg-pitch text-muted hover:border-gold/60 hover:text-ink"}`}
    >
      {children}
    </button>
  );
}
