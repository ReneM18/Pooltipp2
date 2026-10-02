"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useDuels } from "@/lib/DuelsContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { xpForLevel } from "@/lib/seasonPass";
import { Duel } from "@/lib/duelTypes";
import { Team } from "@/lib/types";
import { StarIcon } from "@/components/Icons";

export default function DuellePage() {
  const { freeStars, authUserId } = useUser();
  const { matches, getTeam } = useAppData();
  const { duels, pendingForMe, createDuel } = useDuels();
  const { showToast, celebrate } = useFeedback();

  const openMatches = [...matches]
    .filter((m) => m.status !== "cancelled" && new Date(m.tipDeadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());

  const [opponent, setOpponent] = useState("");
  const [matchId, setMatchId] = useState(openMatches[0]?.id ?? "");
  // Beim ersten Anzeigen stehen evtl. noch die eingebauten Demo-Spiele im
  // State; sobald die echten Spiele aus Supabase da sind, muss die Auswahl
  // nachziehen – sonst zeigt die Liste ein echtes Spiel an, verschickt aber
  // die ID eines Demo-Spiels ("Spiel nicht gefunden").
  const openMatchIds = openMatches.map((m) => m.id).join(",");
  useEffect(() => {
    const ids = openMatchIds ? openMatchIds.split(",") : [];
    if (!ids.includes(matchId)) setMatchId(ids[0] ?? "");
  }, [openMatchIds, matchId]);
  const [stake, setStake] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Schutz gegen Doppel-Klick, gleiches Muster wie bei den übrigen Formularen.
  const submittedRef = useRef(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    setError(null);

    if (!matchId) {
      setError("Wähle ein Spiel aus.");
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }
    const stakeValue = Number(stake);
    if (!stakeValue || stakeValue < 1) {
      setError("Gib einen gültigen Einsatz ein.");
      submittedRef.current = false;
      setSubmitting(false);
      return;
    }

    const result = await createDuel(opponent, matchId, stakeValue);
    if (!result.ok) {
      setError(result.error ?? "Duell konnte nicht erstellt werden.");
    } else {
      celebrate();
      showToast(`⚔️ ${opponent.trim()} herausgefordert – Anfrage verschickt!`);
      setOpponent("");
      setStake("20");
    }
    submittedRef.current = false;
    setSubmitting(false);
  }

  if (!authUserId) {
    return (
      <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
        <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Kopf-an-Kopf-Duelle</h1>
        <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
          Melde dich an, um andere User herauszufordern.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <h1 className="mb-1 font-display text-xl font-bold text-ink sm:text-2xl">Kopf-an-Kopf-Duelle</h1>
      <p className="mb-6 text-xs text-muted">
        Fordere einen registrierten Mitspieler direkt mit Sterne-Einsatz heraus – wer beim Spiel besser
        tippt, gewinnt beide Einsätze. Dein Gegner muss annehmen, bevor der Einsatz auf beiden Seiten
        fällig wird; lehnt er ab (oder reagiert nicht), bekommst du deinen Einsatz zurück.
      </p>

      {pendingForMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">
            Herausforderungen an dich ({pendingForMe.length})
          </h2>
          <div className="flex flex-col gap-3">
            {pendingForMe.map((duel) => {
              const match = matches.find((m) => m.id === duel.matchId);
              const home = match ? getTeam(match.homeTeamId) : undefined;
              const away = match ? getTeam(match.awayTeamId) : undefined;
              return <InviteRow key={duel.id} duel={duel} home={home} away={away} />;
            })}
          </div>
        </section>
      )}

      {openMatches.length === 0 ? (
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
              <label className="mb-1 block text-xs text-muted">Anzeigename des Gegners</label>
              <input
                value={opponent}
                onChange={(e) => setOpponent(e.target.value)}
                placeholder="Name deines Gegners"
                className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
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
            disabled={submitting}
            className="self-start rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
          >
            {submitting ? "Wird verschickt…" : "Herausfordern"}
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
          return <DuelRow key={duel.id} duel={duel} home={home} away={away} />;
        })}
      </div>
    </main>
  );
}

function InviteRow({ duel, home, away }: { duel: Duel; home?: Team; away?: Team }) {
  const { acceptDuel, declineDuel } = useDuels();
  const { showToast } = useFeedback();
  const [busy, setBusy] = useState(false);

  async function handleAccept() {
    setBusy(true);
    const result = await acceptDuel(duel.id);
    if (!result.ok) showToast(result.error ?? "Annahme fehlgeschlagen.", "info");
    else showToast("✓ Duell angenommen – viel Glück!", "gold");
    setBusy(false);
  }

  async function handleDecline() {
    setBusy(true);
    const result = await declineDuel(duel.id);
    if (!result.ok) showToast(result.error ?? "Ablehnen fehlgeschlagen.", "info");
    setBusy(false);
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-gold/40 bg-gold/5 px-4 py-3.5">
      <div>
        <p className="font-display text-sm font-semibold text-ink">{duel.challengerName} fordert dich heraus</p>
        <p className="text-xs text-muted">
          {home?.name ?? "?"} vs {away?.name ?? "?"} · Einsatz{" "}
          <span className="inline-flex items-center gap-1 text-gold">
            <StarIcon className="h-3 w-3" /> {duel.stake}
          </span>
        </p>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={busy}
          className="rounded-full bg-action px-4 py-2 font-display text-xs font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
        >
          Annehmen
        </button>
        <button
          onClick={handleDecline}
          disabled={busy}
          className="rounded-full bg-surface-hover px-4 py-2 font-display text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
        >
          Ablehnen
        </button>
      </div>
    </div>
  );
}

function DuelRow({ duel, home, away }: { duel: Duel; home?: Team; away?: Team }) {
  const { authUserId, hasPremiumPass, passXP } = useUser();
  const { celebrate } = useFeedback();
  const iAmChallenger = duel.challengerId === authUserId;
  const opponentLabel = iAmChallenger ? duel.opponentName : duel.challengerName;
  const won = duel.result === (iAmChallenger ? "challenger" : "opponent");
  const lost = duel.result && duel.result !== "unentschieden" && !won;

  // Level 4 Premium: "Sieges-Animation bei gewonnenen Duellen" – einmaliger
  // Sterne-Burst, sobald ein Duell erstmals als gewonnen erkannt wird
  // (gleiches celebratedRef-Muster wie in components/MatchCard.tsx).
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (won && !celebratedRef.current && hasPremiumPass && passXP >= xpForLevel(4)) {
      celebratedRef.current = true;
      celebrate();
    }
  }, [won, hasPremiumPass, passXP, celebrate]);

  const statusLabel: Record<Duel["status"], string> = {
    pending: "Wartet auf Annahme…",
    offen: "Wartet auf Spielende…",
    abgelehnt: "Abgelehnt",
    verfallen: "Verfallen (keine Antwort)",
    ausgewertet: "",
    abgesagt: "Spiel abgesagt – Einsatz zurück",
  };

  return (
    <div
      className={`rounded-card border px-4 py-3.5 ${
        duel.status !== "ausgewertet"
          ? "border-edge bg-surface"
          : won
          ? "border-gold bg-gold/10"
          : lost
          ? "border-edge bg-pitch"
          : "border-action/40 bg-action/5"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-display text-sm font-semibold text-ink">Du vs. {opponentLabel}</span>
        <span className="flex items-center gap-1 font-display text-sm font-semibold text-gold">
          <StarIcon className="h-3.5 w-3.5" /> {duel.stake}
        </span>
      </div>
      <p className="text-xs text-muted">
        {home?.name ?? "?"} vs {away?.name ?? "?"}
      </p>
      {duel.status !== "ausgewertet" ? (
        <p className="mt-1.5 text-xs text-muted">{statusLabel[duel.status]}</p>
      ) : (
        <p
          className={`mt-1.5 text-xs font-semibold ${
            won ? "text-gold" : lost ? "text-red-400" : "text-action"
          }`}
        >
          {won && `🏆 Gewonnen – +${(duel.starsCredited ?? 0) - duel.stake} Sterne`}
          {lost && `Verloren – ${duel.stake} Sterne weg`}
          {duel.result === "unentschieden" && "Unentschieden – Einsatz zurück"}
        </p>
      )}
    </div>
  );
}
