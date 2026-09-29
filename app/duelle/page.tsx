"use client";

import { useRef, useState, FormEvent } from "react";
import Link from "next/link";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useDuels } from "@/lib/DuelsContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { StarIcon } from "@/components/Icons";

export default function DuellePage() {
  const { friends, freeStars } = useUser();
  const { matches, getTeam } = useAppData();
  const { duels, createDuel } = useDuels();
  const { showToast, celebrate } = useFeedback();

  const openMatches = [...matches]
    .filter((m) => new Date(m.tipDeadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const [opponent, setOpponent] = useState(friends[0] ?? "");
  const [matchId, setMatchId] = useState(openMatches[0]?.id ?? "");
  const [stake, setStake] = useState("20");
  const [error, setError] = useState<string | null>(null);
  // Schutz gegen Doppel-Klick, gleiches Muster wie bei den übrigen Formularen.
  const submittedRef = useRef(false);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError(null);

    if (!opponent) {
      setError("Wähle einen Freund aus.");
      submittedRef.current = false;
      return;
    }
    if (!matchId) {
      setError("Wähle ein Spiel aus.");
      submittedRef.current = false;
      return;
    }
    const stakeValue = Number(stake);
    if (!stakeValue || stakeValue < 1) {
      setError("Gib einen gültigen Einsatz ein.");
      submittedRef.current = false;
      return;
    }

    const actual = createDuel(opponent, matchId, stakeValue);
    if (actual <= 0) {
      setError(
        "Duell konnte nicht erstellt werden – zu wenig Sterne, Tippschluss für dieses Spiel schon erreicht, oder ungültige Auswahl."
      );
    } else {
      celebrate();
      showToast(`⚔️ ${opponent} herausgefordert – ${actual} Sterne Einsatz!`);
      setStake("20");
    }
    submittedRef.current = false;
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-5xl px-5 py-8">
      <h1 className="mb-1 font-display text-xl font-bold text-ink sm:text-2xl">Kopf-an-Kopf-Duelle</h1>
      <p className="mb-6 text-xs text-muted">
        Fordere einen Freund direkt mit Sterne-Einsatz heraus – wer beim Spiel besser tippt, gewinnt
        beide Einsätze. <b className="text-ink">Wichtig:</b> Es gibt noch kein echtes Backend, dein
        Freund tippt hier also nicht wirklich mit. Sein Tipp wird simuliert und dir sofort angezeigt,
        damit von Anfang an klar ist, woran du bist.
      </p>

      {friends.length === 0 ? (
        <p className="mb-8 rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
          Du brauchst zuerst mindestens einen Freund, um jemanden herauszufordern.{" "}
          <Link href="/freunde" className="text-gold hover:opacity-80">
            Freunde hinzufügen →
          </Link>
        </p>
      ) : openMatches.length === 0 ? (
        <p className="mb-8 rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
          Aktuell ist kein Spiel offen, für das sich noch ein Duell starten lässt.
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mb-8 flex flex-col gap-3 rounded-card border border-edge bg-surface p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-muted">Freund</label>
              <select
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {friends.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Spiel</label>
              <select
                value={matchId}
                onChange={(e) => setMatchId(e.target.value)}
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              >
                {openMatches.map((m) => {
                  const home = getTeam(m.homeTeamId);
                  const away = getTeam(m.awayTeamId);
                  return (
                    <option key={m.id} value={m.id}>
                      {home?.name ?? "?"} vs {away?.name ?? "?"}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted">Einsatz (max. {freeStars})</label>
              <input
                type="number"
                min={1}
                max={freeStars}
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Herausfordern
          </button>
        </form>
      )}

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Duelle</h2>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5">
        {duels.length === 0 && (
          <p className="py-4 text-center text-sm text-muted lg:col-span-2">Noch keine Duelle gestartet.</p>
        )}
        {duels.map((duel) => {
          const match = matches.find((m) => m.id === duel.matchId);
          const home = match ? getTeam(match.homeTeamId) : undefined;
          const away = match ? getTeam(match.awayTeamId) : undefined;
          return (
            <div
              key={duel.id}
              className={`rounded-card border px-4 py-3.5 ${
                duel.status === "offen"
                  ? "border-edge bg-surface"
                  : duel.result === "gewonnen"
                  ? "border-gold bg-gold/10"
                  : duel.result === "verloren"
                  ? "border-edge bg-pitch"
                  : "border-action/40 bg-action/5"
              }`}
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="font-display text-sm font-semibold text-ink">Du vs. {duel.opponentName}</span>
                <span className="flex items-center gap-1 font-display text-sm font-semibold text-gold">
                  <StarIcon className="h-3.5 w-3.5" /> {duel.stake}
                </span>
              </div>
              <p className="text-xs text-muted">
                {home?.name ?? "?"} vs {away?.name ?? "?"} · {duel.opponentName} tippt (simuliert):{" "}
                <span className="text-ink">{duel.opponentPickLabel}</span>
              </p>
              {duel.status === "offen" ? (
                <p className="mt-1.5 text-xs text-muted">Wartet auf Spielende…</p>
              ) : (
                <p
                  className={`mt-1.5 text-xs font-semibold ${
                    duel.result === "gewonnen"
                      ? "text-gold"
                      : duel.result === "verloren"
                      ? "text-red-400"
                      : "text-action"
                  }`}
                >
                  {duel.result === "gewonnen" && `🏆 Gewonnen – +${(duel.starsCredited ?? 0) - duel.stake} Sterne`}
                  {duel.result === "verloren" && `Verloren – ${duel.stake} Sterne weg`}
                  {duel.result === "unentschieden" && "Unentschieden – Einsatz zurück"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
