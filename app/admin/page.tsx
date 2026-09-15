"use client";

import { useState, FormEvent } from "react";
import { useAppData } from "@/lib/AppDataContext";
import { Sport, SPORTS, JerseyStyle, JERSEY_STYLES } from "@/lib/types";
import { COUNTRIES, flagEmoji } from "@/lib/flags";
import TeamBadge from "@/components/TeamBadge";

// Einfacher Zugriffsschutz fürs MVP – KEINE echte Sicherheit.
// Sobald der richtige Login (Firebase Auth) steht, ersetzt der diese PIN
// durch eine echte Rechteprüfung (z. B. "ist dieser User Admin?").
const ADMIN_PIN = "2468";

export default function AdminPage() {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 font-display text-3xl font-bold text-ink">Admin-Bereich</h1>
      <p className="mb-8 text-sm text-muted">
        Teams und Spiele anlegen. Änderungen gelten nur für diese Browser-Sitzung, solange
        Firestore noch nicht angebunden ist.
      </p>

      <div className="flex flex-col gap-10">
        <TeamManager />
        <MatchManager />
      </div>
    </main>
  );
}

function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (pin === ADMIN_PIN) {
      onUnlock();
    } else {
      setError(true);
    }
  }

  return (
    <main className="mx-auto flex max-w-sm flex-col items-center px-5 py-24 text-center">
      <h1 className="mb-2 font-display text-2xl font-bold text-ink">Admin-Zugang</h1>
      <p className="mb-6 text-sm text-muted">Bitte PIN eingeben.</p>
      <form onSubmit={handleSubmit} className="w-full">
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            setError(false);
          }}
          className="mb-3 w-full rounded-lg border border-edge bg-surface px-4 py-2.5 text-center font-display text-lg tracking-widest text-ink outline-none focus:border-gold"
          autoFocus
        />
        {error && <p className="mb-3 text-sm text-red-400">Falsche PIN.</p>}
        <button
          type="submit"
          className="w-full rounded-full bg-action py-2.5 font-display font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Entsperren
        </button>
      </form>
    </main>
  );
}

function TeamManager() {
  const { teams, addTeam, removeTeam } = useAppData();
  const [name, setName] = useState("");
  const [sport, setSport] = useState<Sport>("Fußball");
  const [countryCode, setCountryCode] = useState(COUNTRIES[0].code);
  const [primaryColor, setPrimaryColor] = useState("#3FA66B");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [jerseyStyle, setJerseyStyle] = useState<JerseyStyle>("solid");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    addTeam({ name: name.trim(), sport, countryCode, primaryColor, secondaryColor, jerseyStyle });
    setName("");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Teams</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-muted">Teamname</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Kansas City Chiefs"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Land</label>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {flagEmoji(c.code)} {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="mb-1 block text-xs text-muted">
              {sport === "NFL" ? "Helmfarbe" : "Trikotfarbe"}
            </label>
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">
              {sport === "NFL" ? "Streifen-/Gitterfarbe" : "Kragen-/Saumfarbe"}
            </label>
            <input
              type="color"
              value={secondaryColor}
              onChange={(e) => setSecondaryColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded-lg border border-edge bg-pitch p-1"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-edge bg-pitch px-3 py-2">
            <TeamBadge
              sport={sport}
              primaryColor={primaryColor}
              secondaryColor={secondaryColor}
              jerseyStyle={jerseyStyle}
              size={32}
            />
            <span className="text-xs text-muted">Vorschau</span>
          </div>

          {sport !== "NFL" && (
            <div>
              <label className="mb-1 block text-xs text-muted">Trikot-Stil</label>
              <select
                value={jerseyStyle}
                onChange={(e) => setJerseyStyle(e.target.value as JerseyStyle)}
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {JERSEY_STYLES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            className="ml-auto rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Team anlegen
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {teams.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Teams angelegt.</p>
        )}
        {teams.map((team, index) => (
          <div
            key={team.id}
            className={`flex items-center justify-between px-4 py-3 ${
              index !== teams.length - 1 ? "border-b border-edge" : ""
            }`}
          >
            <span className="flex items-center gap-3 text-sm text-ink">
              <TeamBadge
                sport={team.sport}
                primaryColor={team.primaryColor}
                secondaryColor={team.secondaryColor}
                jerseyStyle={team.jerseyStyle}
                size={28}
              />
              <span>{flagEmoji(team.countryCode)}</span>
              <span className="font-medium">{team.name}</span>
              <span className="text-xs text-muted">· {team.sport}</span>
            </span>
            <button
              onClick={() => removeTeam(team.id)}
              className="text-xs text-muted hover:text-ink"
            >
              Entfernen
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function MatchManager() {
  const { teams, matches, addMatch, removeMatch, getTeam } = useAppData();
  const [sport, setSport] = useState<Sport>("Fußball");
  const [competition, setCompetition] = useState("");
  const [matchday, setMatchday] = useState("");
  const [kickoff, setKickoff] = useState("");
  const [homeTeamId, setHomeTeamId] = useState("");
  const [awayTeamId, setAwayTeamId] = useState("");

  const teamsForSport = teams.filter((t) => t.sport === sport);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!competition.trim() || !kickoff || !homeTeamId || !awayTeamId) return;
    if (homeTeamId === awayTeamId) return;

    addMatch({
      sport,
      competition: competition.trim(),
      matchday: matchday ? Number(matchday) : undefined,
      kickoff: new Date(kickoff).toISOString(),
      homeTeamId,
      awayTeamId,
    });

    setCompetition("");
    setMatchday("");
    setKickoff("");
    setHomeTeamId("");
    setAwayTeamId("");
  }

  return (
    <section>
      <h2 className="mb-3 font-display text-xl font-semibold text-ink">Spiele</h2>

      <form
        onSubmit={handleSubmit}
        className="mb-4 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Sportart</label>
            <select
              value={sport}
              onChange={(e) => {
                setSport(e.target.value as Sport);
                setHomeTeamId("");
                setAwayTeamId("");
              }}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              {SPORTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Wettbewerb</label>
            <input
              value={competition}
              onChange={(e) => setCompetition(e.target.value)}
              placeholder="z. B. Bundesliga"
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Spieltag (optional)</label>
            <input
              type="number"
              value={matchday}
              onChange={(e) => setMatchday(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-muted">Heimteam</label>
            <select
              value={homeTeamId}
              onChange={(e) => setHomeTeamId(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Auswählen…</option>
              {teamsForSport.map((t) => (
                <option key={t.id} value={t.id}>
                  {flagEmoji(t.countryCode)} {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Auswärtsteam</label>
            <select
              value={awayTeamId}
              onChange={(e) => setAwayTeamId(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            >
              <option value="">Auswählen…</option>
              {teamsForSport.map((t) => (
                <option key={t.id} value={t.id}>
                  {flagEmoji(t.countryCode)} {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted">Anstoß</label>
            <input
              type="datetime-local"
              value={kickoff}
              onChange={(e) => setKickoff(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
            />
          </div>
        </div>

        {teamsForSport.length < 2 && (
          <p className="text-xs text-muted">
            Für {sport} brauchst du zuerst mindestens zwei Teams (siehe oben).
          </p>
        )}

        <button
          type="submit"
          disabled={teamsForSport.length < 2}
          className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
        >
          Spiel anlegen
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-edge bg-surface">
        {matches.length === 0 && (
          <p className="p-4 text-sm text-muted">Noch keine Spiele angelegt.</p>
        )}
        {matches.map((match, index) => {
          const home = getTeam(match.homeTeamId);
          const away = getTeam(match.awayTeamId);
          return (
            <div
              key={match.id}
              className={`flex items-center justify-between px-4 py-3 ${
                index !== matches.length - 1 ? "border-b border-edge" : ""
              }`}
            >
              <span className="text-sm text-ink">
                {match.competition}: {home?.name ?? "?"} vs {away?.name ?? "?"}{" "}
                <span className="text-xs text-muted">
                  ({new Date(match.kickoff).toLocaleString("de-DE")})
                </span>
              </span>
              <button
                onClick={() => removeMatch(match.id)}
                className="text-xs text-muted hover:text-ink"
              >
                Entfernen
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
