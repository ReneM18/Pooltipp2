"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useTeams } from "@/lib/TeamsContext";
import { useUser } from "@/lib/UserContext";
import { ScoringMode } from "@/lib/teamsTypes";

export default function TeamsHubPage() {
  const { displayName } = useUser();
  const { leagues, createLeague, joinLeague } = useTeams();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("ergebnis");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState(false);

  const myLeagues = leagues.filter((l) => l.members.includes(displayName));

  function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    createLeague(name.trim(), description.trim(), scoringMode);
    setName("");
    setDescription("");
  }

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const league = joinLeague(joinCode);
    if (!league) {
      setJoinError(true);
      return;
    }
    setJoinError(false);
    setJoinCode("");
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-8">
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink">Private Tipp-Runden</h1>
        <p className="mt-1 text-sm text-muted">
          Eigene, abgeschottete Ligen für Firma, Verein oder Freunde – mit eigenem Punktesystem,
          getrennt von den globalen PoolCoins.
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-card border border-blue-400/20 bg-surface p-4"
        >
          <h2 className="font-display text-sm font-semibold text-ink">Neue Tipprunde gründen</h2>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name der Tipprunde"
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beschreibung (optional)"
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
          />
          <select
            value={scoringMode}
            onChange={(e) => setScoringMode(e.target.value as ScoringMode)}
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
          >
            <option value="ergebnis">Ergebnis (Exakt/Tordifferenz/Tendenz)</option>
            <option value="dreiweg">3-Wege-Tipp (nur Sieg/Unentschieden/Niederlage)</option>
          </select>
          <button
            type="submit"
            className="rounded-full bg-blue-500 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Gründen
          </button>
        </form>

        <form
          onSubmit={handleJoin}
          className="flex flex-col gap-3 rounded-card border border-blue-400/20 bg-surface p-4"
        >
          <h2 className="font-display text-sm font-semibold text-ink">Mit Code beitreten</h2>
          <input
            value={joinCode}
            onChange={(e) => {
              setJoinCode(e.target.value);
              setJoinError(false);
            }}
            placeholder="z. B. BUERO1"
            className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm uppercase tracking-widest text-ink outline-none focus:border-blue-400"
          />
          {joinError && <p className="text-xs text-red-400">Kein Team mit diesem Code gefunden.</p>}
          <button
            type="submit"
            className="mt-auto rounded-full bg-blue-500 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Beitreten
          </button>
        </form>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Tipprunden</h2>
      <div className="flex flex-col gap-3">
        {myLeagues.length === 0 && (
          <p className="text-sm text-muted">Du bist noch in keiner Tipprunde.</p>
        )}
        {myLeagues.map((league) => (
          <Link
            key={league.id}
            href={`/teams/${league.id}`}
            className="flex items-center justify-between rounded-card border border-edge bg-surface px-5 py-4 transition-colors hover:border-blue-400/40"
          >
            <div>
              <p className="font-display text-base font-semibold text-ink">{league.name}</p>
              <p className="text-sm text-muted">
                {league.members.length} Mitglieder ·{" "}
                {league.scoringMode === "ergebnis" ? "Ergebnis-Modus" : "3-Wege-Modus"}
              </p>
            </div>
            <span className="rounded-full border border-edge px-2 py-1 font-mono text-xs text-muted">
              {league.code}
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
