"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTeams } from "@/lib/TeamsContext";
import { useUser } from "@/lib/UserContext";
import { ScoringMode } from "@/lib/teamsTypes";
import { readPendingInvite, savePendingInvite, clearPendingInvite } from "@/lib/leagueInvite";

export default function TeamsHubPage() {
  const router = useRouter();
  const { authUserId, adminChecked } = useUser();
  const { leagues, leaguesLoaded, loadError, createLeague, joinLeague } = useTeams();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scoringMode, setScoringMode] = useState<ScoringMode>("ergebnis");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  // Kam man über einen Einladungslink (/teams?code=ABC123)? Dann wird das
  // Beitreten-Feld vorausgefüllt und hervorgehoben.
  const [invited, setInvited] = useState(false);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  // Schutz gegen versehentliches Doppel-Absenden (z. B. Doppel-Tap am Handy) –
  // gleiches Muster wie in MatchCard.tsx / freunde/page.tsx.
  const createSubmittedRef = useRef(false);
  const joinSubmittedRef = useRef(false);

  // Code aus dem Einladungslink übernehmen. Bewusst über window.location statt
  // useSearchParams, damit die Seite beim Build statisch bleiben kann.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("code");
    const code = (fromUrl ?? readPendingInvite() ?? "").trim().toUpperCase();
    if (code) {
      setJoinCode(code);
      setInvited(true);
      // Merken, falls man sich erst noch einloggen/registrieren muss.
      if (fromUrl) savePendingInvite(code);
    }
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || createSubmittedRef.current) return;
    createSubmittedRef.current = true;
    setCreating(true);
    setCreateError(null);
    const result = await createLeague(name.trim(), description.trim(), scoringMode);
    setCreating(false);
    createSubmittedRef.current = false;
    if (!result.ok || !result.leagueId) {
      setCreateError(result.error ?? "Das hat nicht geklappt.");
      return;
    }
    setName("");
    setDescription("");
    router.push(`/teams/${result.leagueId}`);
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    if (joinSubmittedRef.current) return;
    joinSubmittedRef.current = true;
    setJoining(true);
    const result = await joinLeague(joinCode);
    setJoining(false);
    joinSubmittedRef.current = false;
    if (!result.ok || !result.leagueId) {
      setJoinError(result.error ?? "Keine Tipprunde mit diesem Code gefunden.");
      return;
    }
    setJoinError(null);
    setJoinCode("");
    clearPendingInvite();
    router.push(`/teams/${result.leagueId}`);
  }

  const loggedOut = adminChecked && !authUserId;

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <div className="mb-6">
        <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Private Tipp-Runden</h1>
        <p className="mt-0.5 text-xs text-muted">
          Eigene Tipprunde für Freunde, Verein oder Kollegen – getrennt von der globalen Rangliste.
        </p>
      </div>

      {loggedOut ? (
        <div className="rounded-card border border-blue-400/20 bg-surface px-6 py-10 text-center">
          <p className="mb-2 text-3xl" aria-hidden>
            👥
          </p>
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">
            {invited ? "Du wurdest zu einer Tipprunde eingeladen" : "Tipprunden brauchen ein Konto"}
          </h2>
          <p className="mx-auto mb-5 max-w-sm text-sm text-muted">
            {invited
              ? `Logge dich ein oder registriere dich. Danach kommst du hierher zurück und trittst mit dem Code ${joinCode} bei.`
              : "Logge dich ein oder registriere dich, um eine Tipprunde zu gründen oder mit einem Code beizutreten."}
          </p>
          <Link
            href="/registrieren"
            className="inline-block rounded-full bg-blue-500 px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400"
          >
            Einloggen / Registrieren
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <form
              onSubmit={handleCreate}
              className={`flex flex-col gap-3 rounded-card border border-blue-400/20 bg-surface p-4 ${
                invited ? "order-2" : ""
              }`}
            >
              <h2 className="font-display text-sm font-semibold text-ink">Neue Tipprunde gründen</h2>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={60}
                placeholder="Name der Tipprunde"
                className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
              />
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={200}
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
              {createError && <p className="text-xs text-red-400">{createError}</p>}
              <button
                type="submit"
                disabled={creating}
                className="rounded-full bg-blue-500 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400 disabled:opacity-60"
              >
                {creating ? "…" : "Gründen"}
              </button>
            </form>

            <form
              onSubmit={handleJoin}
              className={`flex flex-col gap-3 rounded-card border bg-surface p-4 ${
                invited ? "order-1 border-blue-400/60" : "border-blue-400/20"
              }`}
            >
              <h2 className="font-display text-sm font-semibold text-ink">
                {invited ? "Du wurdest eingeladen" : "Mit Code beitreten"}
              </h2>
              <input
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setJoinError(null);
                }}
                maxLength={12}
                placeholder="z. B. K7QM2X"
                className="rounded-lg border border-edge bg-pitch px-3 py-2 text-sm uppercase tracking-widest text-ink outline-none focus:border-blue-400"
              />
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              <button
                type="submit"
                disabled={joining}
                className="mt-auto rounded-full bg-blue-500 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-blue-400 disabled:opacity-60"
              >
                {joining ? "…" : "Beitreten"}
              </button>
            </form>
          </div>

          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Tipprunden</h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5">
            {loadError && <p className="text-sm text-red-400 lg:col-span-2">{loadError}</p>}
            {!leaguesLoaded && !loadError && (
              <p className="text-sm text-muted lg:col-span-2">Tipprunden werden geladen …</p>
            )}
            {leaguesLoaded && !loadError && leagues.length === 0 && (
              <p className="text-sm text-muted lg:col-span-2">Du bist noch in keiner Tipprunde.</p>
            )}
            {leagues.map((league) => (
              <Link
                key={league.id}
                href={`/teams/${league.id}`}
                className="flex items-center justify-between rounded-card border border-edge bg-surface px-5 py-4 transition-colors hover:border-blue-400/40"
              >
                <div>
                  <p className="font-display text-base font-semibold text-ink">{league.name}</p>
                  <p className="text-sm text-muted">
                    {league.memberCount} {league.memberCount === 1 ? "Mitglied" : "Mitglieder"} ·{" "}
                    {league.scoringMode === "ergebnis" ? "Ergebnis-Modus" : "3-Wege-Modus"}
                  </p>
                </div>
                <span className="rounded-full border border-edge px-2 py-1 font-mono text-xs text-muted">
                  {league.code}
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
