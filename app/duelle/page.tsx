"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import { createPortal } from "react-dom";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useDuels, DuelInvitee } from "@/lib/DuelsContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { xpForLevel } from "@/lib/seasonPass";
import { Duel, DuelPlayer } from "@/lib/duelTypes";
import { Match, SPORT_ICONS, Sport } from "@/lib/types";
import { CoinIcon } from "@/components/CoinIcon";
import { matchTitle, scoreText } from "@/lib/teamOrder";

const STAKE_PRESETS = [10, 20, 30, 50];

function timeLabel(ms: number | string) {
  return new Date(ms).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// "Doris", "Doris und Max", "Doris, Max und Lea"
function joinNames(names: string[]) {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}

// Coins-Betrag immer mit Münze und dem Wort "Coins".
function Coins({ amount, className = "" }: { amount: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold text-gold ${className}`}>
      <CoinIcon className="h-[1.1em] w-[1.1em]" />
      {amount} Coins
    </span>
  );
}

export default function DuellePage() {
  const { authUserId } = useUser();
  const { duels, invitesForMe } = useDuels();
  const [prefill, setPrefill] = useState<{ invitees: DuelInvitee[]; matchIds: string[]; stake: number; key: number } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  if (!authUserId) {
    return (
      <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
        <h1 className="mb-4 font-display text-xl font-bold text-ink sm:text-2xl">Duelle</h1>
        <p className="rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
          Melde dich an, um andere Spieler zu einem Duell einzuladen.
        </p>
      </main>
    );
  }

  const inviteIds = new Set(invitesForMe.map((d) => d.id));
  const myDuels = duels.filter((d) => !inviteIds.has(d.id));

  function editAfterWithdraw(duel: Duel) {
    setPrefill({
      invitees: duel.players.filter((p) => !p.isCreator).map((p) => ({ id: p.userId, name: p.name })),
      matchIds: duel.matchIds,
      stake: duel.stake,
      key: Date.now(),
    });
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  }

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <h1 className="mb-1 font-display text-xl font-bold text-ink sm:text-2xl">Duelle</h1>
      <p className="mb-2 text-sm text-muted">
        Lade bis zu 4 Mitspieler ein und wählt gemeinsam Spiele aus. Jeder setzt gleich viele Coins, wer über alle
        Spiele die meisten Punkte hat, gewinnt.
      </p>
      <RulesInfo />

      {invitesForMe.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold text-ink">Einladungen an dich ({invitesForMe.length})</h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5">
            {invitesForMe.map((duel) => (
              <DuelCard key={duel.id} duel={duel} highlight />
            ))}
          </div>
        </section>
      )}

      <div ref={formRef} className="scroll-mt-24">
        <CreateDuelForm key={prefill?.key ?? 0} prefill={prefill} />
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Deine Duelle</h2>
      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5">
        {myDuels.length === 0 && (
          <p className="py-4 text-center text-sm text-muted lg:col-span-2">Noch keine Duelle.</p>
        )}
        {myDuels.map((duel) => (
          <DuelCard key={duel.id} duel={duel} onWithdrawn={editAfterWithdraw} />
        ))}
      </div>
    </main>
  );
}

function RulesInfo() {
  const { rules } = useDuels();
  return (
    <details className="mb-6 rounded-card border border-edge bg-surface px-4 py-2.5 text-sm text-muted">
      <summary className="cursor-pointer font-semibold text-ink">ⓘ So funktionieren Duelle</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>Punkte pro Spiel: exakt 10, Tordifferenz 7, Tendenz 5, falsch oder kein Tipp −3.</li>
        <li>2 Spieler: Der Sieger bekommt beide Einsätze. Ab 3 Spielern bekommt Platz 2 seinen Einsatz zurück, Platz 1 den Rest.</li>
        <li>Gleichstand: Liegen alle gleich, bekommt jeder seinen Einsatz zurück. Geteilte Plätze teilen sich die Coins.</li>
        <li>Annehmen geht bis zum Tippschluss des ersten Spiels. Danach spielen alle, die angenommen haben.</li>
        <li>Ändern: Duell zurückziehen (bis zum ersten Tippschluss, alle bekommen ihren Einsatz zurück) und neu verschicken.</li>
        <li>Abgesagte Spiele zählen nicht. Sind alle abgesagt, bekommt jeder seinen Einsatz zurück.</li>
        <li>
          Fair Play: höchstens {rules.maxStake} Coins Einsatz, höchstens +{rules.dayWinCap} Coins Gewinn pro Tag und +
          {rules.weekWinCap} pro Woche, mit derselben Person höchstens {rules.pairPerWeek} Duelle pro Woche. Duelle gibt es ab{" "}
          {rules.minTips} Tipps und {rules.minAccountDays} Tagen nach der Anmeldung.
        </li>
      </ul>
    </details>
  );
}

function GameLine({ match, children }: { match?: Match; children?: ReactNode }) {
  const { getTeam } = useAppData();
  if (!match) return <li className="text-xs text-muted">Spiel nicht mehr vorhanden</li>;
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  return (
    <li className="flex items-start gap-2 text-xs">
      <span aria-hidden className="mt-px">{SPORT_ICONS[match.sport as Sport] ?? "🏟️"}</span>
      <span className="min-w-0 flex-1">
        <span className="text-ink">{matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}</span>
        <span className="text-muted">{" · "}</span>
        <span className="whitespace-nowrap text-muted">
          {match.status === "cancelled"
            ? "abgesagt"
            : match.status === "finished"
            ? `Endstand ${scoreText(match.sport, match.liveHomeScore ?? 0, match.liveAwayScore ?? 0)}`
            : timeLabel(match.kickoff)}
        </span>
        {children}
      </span>
    </li>
  );
}

function CreateDuelForm({ prefill }: { prefill: { invitees: DuelInvitee[]; matchIds: string[]; stake: number } | null }) {
  const { freeStars, stakeBudgetRemainingToday, friendEntries } = useUser();
  const { matches } = useAppData();
  const { rules, findPlayer, createDuel } = useDuels();
  const { showToast, celebrate } = useFeedback();

  const openMatches = [...matches]
    .filter((m) => m.status !== "cancelled" && m.status !== "finished" && new Date(m.tipDeadline).getTime() > Date.now())
    .sort((a, b) => new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime());
  const openIds = new Set(openMatches.map((m) => m.id));

  const [invitees, setInvitees] = useState<DuelInvitee[]>(prefill?.invitees ?? []);
  const [nameInput, setNameInput] = useState("");
  const [selected, setSelected] = useState<string[]>(prefill?.matchIds ?? []);
  const [stake, setStake] = useState(String(prefill?.stake ?? 20));
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Vom Spielerprofil "Herausfordern": Name aus der Adresse übernehmen.
  useEffect(() => {
    const name = new URLSearchParams(window.location.search).get("gegner");
    if (!name) return;
    void findPlayer(name).then(({ player }) => {
      if (player) setInvitees((current) => (current.some((p) => p.id === player.id) ? current : [...current, player]));
    });
    // nur einmal beim Öffnen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chosenMatches = selected.filter((id) => openIds.has(id));
  const maxInvitees = rules.maxPlayers - 1;
  const friends = friendEntries.filter((f) => f.relation === "friend" && !invitees.some((p) => p.id === f.id));
  const stakeLimit = Math.max(0, Math.min(rules.maxStake, freeStars, stakeBudgetRemainingToday));

  function addInvitee(player: DuelInvitee) {
    setError(null);
    if (invitees.some((p) => p.id === player.id)) return;
    if (invitees.length >= maxInvitees) {
      setError(`Höchstens ${rules.maxPlayers} Spieler pro Duell (du und ${maxInvitees} weitere).`);
      return;
    }
    setInvitees((current) => [...current, player]);
  }

  async function addByName() {
    if (adding) return;
    setAdding(true);
    const { player, error: lookupError } = await findPlayer(nameInput);
    setAdding(false);
    if (!player) {
      setError(lookupError ?? "Spieler nicht gefunden.");
      return;
    }
    addInvitee(player);
    setNameInput("");
  }

  function toggleMatch(id: string) {
    setError(null);
    setSelected((current) => {
      const valid = current.filter((m) => openIds.has(m));
      if (valid.includes(id)) return valid.filter((m) => m !== id);
      if (valid.length >= rules.maxGames) return valid;
      return [...valid, id];
    });
  }

  function check(): string | null {
    if (invitees.length === 0) return "Lade mindestens einen Mitspieler ein.";
    if (chosenMatches.length === 0) return "Wähle mindestens ein Spiel aus.";
    const value = Number(stake);
    if (!Number.isInteger(value) || value < 1) return "Gib einen gültigen Einsatz in Coins ein.";
    if (value > rules.maxStake) return `Einsatz höchstens ${rules.maxStake} Coins pro Duell.`;
    if (value > freeStars) return `Du hast nur ${freeStars} Coins.`;
    if (value > stakeBudgetRemainingToday) return `Heute kannst du noch ${stakeBudgetRemainingToday} Coins für Duelle einsetzen.`;
    return null;
  }

  function openConfirm() {
    const problem = check();
    setError(problem);
    if (!problem) setConfirming(true);
  }

  async function send() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const ordered = openMatches.filter((m) => chosenMatches.includes(m.id)).map((m) => m.id);
    const result = await createDuel(invitees, ordered, Number(stake));
    setSubmitting(false);
    submittedRef.current = false;
    setConfirming(false);
    if (!result.ok) {
      setError(result.error ?? "Duell konnte nicht erstellt werden.");
      return;
    }
    celebrate();
    showToast(`⚔️ Einladung an ${joinNames(invitees.map((p) => p.name))} verschickt (Einsatz ${result.stake} Coins)`);
    setInvitees([]);
    setSelected([]);
    setStake("20");
    setError(null);
  }

  if (openMatches.length === 0) {
    return (
      <p className="mb-8 rounded-card border border-dashed border-edge bg-surface p-6 text-center text-sm text-muted">
        Aktuell ist kein Spiel offen, für das sich noch ein Duell starten lässt.
      </p>
    );
  }

  const stakeValue = Number(stake) || 0;
  const potPlayers = invitees.length + 1;

  return (
    <section className="mb-8 rounded-card border border-edge bg-surface p-4">
      <h2 className="mb-3 font-display text-lg font-semibold text-ink">Neues Duell</h2>

      {/* 1) Mitspieler */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold text-ink">
          Mitspieler <span className="font-normal text-muted">({invitees.length} von max. {maxInvitees})</span>
        </p>
        {invitees.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {invitees.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-gold/50 bg-gold/10 py-1 pl-3 pr-1 text-sm font-semibold text-ink"
              >
                {p.name}
                <button
                  type="button"
                  onClick={() => setInvitees((current) => current.filter((x) => x.id !== p.id))}
                  aria-label={`${p.name} entfernen`}
                  className="flex h-6 w-6 items-center justify-center rounded-full text-muted hover:bg-surface-hover hover:text-ink"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        {invitees.length < maxInvitees && (
          <>
            <div className="flex gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addByName();
                  }
                }}
                placeholder="Spielername"
                className="min-w-0 flex-1 rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-gold"
              />
              <button
                type="button"
                onClick={() => void addByName()}
                disabled={adding || !nameInput.trim()}
                className="shrink-0 rounded-full border border-gold/50 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 disabled:opacity-50"
              >
                Hinzufügen
              </button>
            </div>
            {friends.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted">Freunde:</span>
                {friends.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => addInvitee({ id: f.id, name: f.name })}
                    className="whitespace-nowrap rounded-full bg-surface-hover px-3 py-1 text-xs font-semibold text-ink transition-colors hover:text-gold"
                  >
                    + {f.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 2) Spiele */}
      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold text-ink">
          Spiele <span className="font-normal text-muted">({chosenMatches.length} von max. {rules.maxGames} gewählt)</span>
        </p>
        <ul className="max-h-72 overflow-y-auto rounded-lg border border-edge bg-pitch">
          {openMatches.map((m) => {
            const checked = chosenMatches.includes(m.id);
            const full = !checked && chosenMatches.length >= rules.maxGames;
            return (
              <li key={m.id} className="border-b border-edge last:border-b-0">
                <MatchOption match={m} checked={checked} disabled={full} onToggle={() => toggleMatch(m.id)} />
              </li>
            );
          })}
        </ul>
      </div>

      {/* 3) Einsatz */}
      <div className="mb-3">
        <label htmlFor="duel-stake" className="mb-1.5 block text-xs font-semibold text-ink">
          Einsatz in Coins pro Spieler <span className="font-normal text-muted">(max. {rules.maxStake})</span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="relative w-24">
            <CoinIcon className="pointer-events-none absolute left-2.5 top-1/2 h-5 w-5 -translate-y-1/2" />
            <input
              id="duel-stake"
              type="number"
              inputMode="numeric"
              min={1}
              max={rules.maxStake}
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              className="w-full rounded-lg border border-edge bg-pitch py-2 pl-9 pr-2 text-sm font-semibold text-ink outline-none focus:border-gold"
            />
          </div>
          {STAKE_PRESETS.filter((v) => v <= rules.maxStake).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setStake(String(v))}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                stakeValue === v ? "bg-gold text-pitch" : "bg-surface-hover text-ink hover:text-gold"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">
          Du hast {freeStars} Coins, heute noch {stakeBudgetRemainingToday} für Duelle.
          {stakeLimit < 1 && " Für heute ist kein Duell mehr möglich."}
        </p>
      </div>

      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}
      <button
        type="button"
        onClick={openConfirm}
        className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        Duell erstellen
      </button>

      {confirming && (
        <Modal onClose={() => !submitting && setConfirming(false)}>
          <p className="mb-1 text-3xl" aria-hidden>
            ⚔️
          </p>
          <h3 className="mb-2 font-display text-lg font-bold text-ink">Duell-Einladung</h3>
          <p className="mb-3 text-sm text-ink">
            Möchtest du <strong>{joinNames(invitees.map((p) => p.name))}</strong> wirklich zu einem Duell einladen?
          </p>
          <ul className="mb-3 flex flex-col gap-1.5 rounded-lg border border-edge bg-pitch px-3 py-2.5 text-left">
            {openMatches
              .filter((m) => chosenMatches.includes(m.id))
              .map((m) => (
                <GameLine key={m.id} match={m} />
              ))}
          </ul>
          <p className="mb-1 text-sm text-ink">
            Einsatz: <Coins amount={stakeValue} /> pro Spieler
          </p>
          <p className="mb-4 text-xs text-muted">
            Wird sofort abgebucht. Wenn alle annehmen, liegen <Coins amount={stakeValue * potPlayers} className="text-xs" /> im
            Topf.
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={submitting}
              className="rounded-full bg-surface-hover px-5 py-2 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void send()}
              disabled={submitting}
              className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
            >
              {submitting ? "Wird verschickt…" : "Ja, einladen"}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}

function MatchOption({
  match,
  checked,
  disabled,
  onToggle,
}: {
  match: Match;
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  const { getTeam } = useAppData();
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  return (
    <label
      className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${
        checked ? "bg-gold/10" : disabled ? "cursor-not-allowed opacity-50" : "hover:bg-surface-hover"
      }`}
    >
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 text-xs font-bold ${
          checked ? "border-gold bg-gold text-pitch" : "border-muted/70 bg-transparent"
        }`}
      >
        {checked ? "✓" : ""}
      </span>
      <span aria-hidden className="shrink-0">
        {SPORT_ICONS[match.sport as Sport] ?? "🏟️"}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${checked ? "font-semibold text-ink" : "text-ink"}`}>
          {matchTitle(match.sport, home?.name ?? "?", away?.name ?? "?")}
        </span>
        <span className="block text-xs text-muted">{timeLabel(match.kickoff)}</span>
      </span>
    </label>
  );
}

function playerStatusIcon(player: DuelPlayer) {
  if (player.status === "angenommen") return "✓";
  if (player.status === "eingeladen") return "⏳";
  if (player.status === "abgelehnt") return "✗";
  return "–";
}

function DuelCard({ duel, highlight = false, onWithdrawn }: { duel: Duel; highlight?: boolean; onWithdrawn?: (duel: Duel) => void }) {
  const { authUserId, hasPremiumPass, passXP } = useUser();
  const { matches } = useAppData();
  const { acceptUntil, acceptDuel, declineDuel, withdrawDuel } = useDuels();
  const { showToast, celebrate } = useFeedback();
  const [busy, setBusy] = useState(false);
  const [askWithdraw, setAskWithdraw] = useState(false);

  const me = duel.players.find((p) => p.userId === authUserId);
  const others = duel.players.filter((p) => p.userId !== authUserId);
  const iAmCreator = duel.creatorId === authUserId;
  // Bekommen beim Zurückziehen eine Nachricht (wer abgelehnt hat, nicht).
  const notified = others.filter((p) => p.status === "eingeladen" || p.status === "angenommen");
  const until = acceptUntil(duel);
  const beforeDeadline = until === null || until > Date.now();
  const playing = duel.players.filter((p) => p.status === "angenommen");
  const duelMatches = duel.matchIds.map((id) => matches.find((m) => m.id === id));
  const doneGames = duelMatches.filter((m) => m && (m.status === "finished" || m.status === "cancelled")).length;
  const evaluated = duel.status === "ausgewertet";
  const myPayout = me?.payout ?? 0;
  const won = evaluated && !!me && me.place === 1 && myPayout > duel.stake;

  // Level 4 Premium: "Sieges-Animation bei gewonnenen Duellen" – einmal pro
  // Anzeige (gleiches celebratedRef-Muster wie in components/MatchCard.tsx).
  const celebratedRef = useRef(false);
  useEffect(() => {
    if (won && !celebratedRef.current && hasPremiumPass && passXP >= xpForLevel(4)) {
      celebratedRef.current = true;
      celebrate();
    }
  }, [won, hasPremiumPass, passXP, celebrate]);

  const title =
    others.length === 0
      ? "Duell"
      : iAmCreator || !me
      ? `Du vs. ${joinNames(others.map((p) => p.name))}`
      : duel.status === "pending" && me.status === "eingeladen"
      ? `${duel.creatorName} lädt dich ein`
      : `Duell von ${duel.creatorName}`;

  function statusText(): string {
    switch (duel.status) {
      case "pending":
        if (me?.status === "eingeladen") return until ? `Annehmen bis ${timeLabel(until)}` : "Wartet auf deine Antwort";
        return until ? `Wartet auf Antworten · annehmen bis ${timeLabel(until)}` : "Wartet auf Antworten";
      case "offen":
        if (me && me.status !== "angenommen") return me.status === "abgelehnt" ? "Du hast abgelehnt" : "Einladung abgelaufen";
        return `Läuft · ${doneGames} von ${duel.matchIds.length} ${duel.matchIds.length === 1 ? "Spiel" : "Spielen"} vorbei`;
      case "abgelehnt":
        return iAmCreator ? "Alle haben abgelehnt – Einsatz zurück" : "Abgelehnt";
      case "verfallen":
        return iAmCreator ? "Niemand hat rechtzeitig angenommen – Einsatz zurück" : "Einladung abgelaufen";
      case "abgesagt":
        return "Spiele abgesagt – Einsatz zurück";
      case "zurueckgezogen":
        if (iAmCreator) return "Zurückgezogen – Einsatz zurück";
        return me?.status === "angenommen"
          ? `Von ${duel.creatorName} zurückgezogen – Einsatz zurück`
          : `Von ${duel.creatorName} zurückgezogen`;
      default:
        return "";
    }
  }

  function resultText(): { text: string; tone: string } | null {
    if (!evaluated || !me) return null;
    if (me.status !== "angenommen") return { text: me.status === "abgelehnt" ? "Du hast abgelehnt" : "Einladung abgelaufen", tone: "text-muted" };
    const everyoneTied = playing.every((p) => p.place === 1);
    if (everyoneTied) return { text: "🤝 Gleichstand – Einsatz zurück", tone: "text-action" };
    if (myPayout > duel.stake) {
      const capped = me.capped ? ` (${me.capped} über dem Gewinn-Deckel verfallen)` : "";
      return { text: `🏆 Platz ${me.place} – +${myPayout - duel.stake} Coins${capped}`, tone: "text-gold" };
    }
    if (myPayout > 0) return { text: `Platz ${me.place} – ${myPayout} Coins zurück`, tone: "text-action" };
    return { text: `Platz ${me.place} – ${duel.stake} Coins verloren`, tone: "text-red-400" };
  }

  async function handleAccept() {
    setBusy(true);
    const result = await acceptDuel(duel.id);
    setBusy(false);
    if (!result.ok) showToast(result.error ?? "Annahme fehlgeschlagen.", "info");
    else showToast("✓ Duell angenommen – viel Glück!", "gold");
  }

  async function handleDecline() {
    setBusy(true);
    const result = await declineDuel(duel.id);
    setBusy(false);
    if (!result.ok) showToast(result.error ?? "Ablehnen fehlgeschlagen.", "info");
  }

  async function handleWithdraw() {
    setBusy(true);
    const result = await withdrawDuel(duel.id);
    setBusy(false);
    setAskWithdraw(false);
    if (!result.ok) {
      showToast(result.error ?? "Zurückziehen fehlgeschlagen.", "info");
      return;
    }
    showToast(`↩️ Zurückgezogen – deine ${duel.stake} Coins sind zurück. Unten kannst du es geändert neu verschicken.`, "info");
    onWithdrawn?.(duel);
  }

  const result = resultText();
  const canWithdraw = iAmCreator && (duel.status === "pending" || duel.status === "offen") && beforeDeadline;
  const canAnswer = duel.status === "pending" && me?.status === "eingeladen" && beforeDeadline;

  return (
    <div
      className={`rounded-card border px-4 py-3.5 ${
        highlight
          ? "border-gold/50 bg-gold/5"
          : !evaluated
          ? "border-edge bg-surface"
          : won
          ? "border-gold bg-gold/10"
          : "border-edge bg-pitch"
      }`}
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <span className="min-w-0 font-display text-sm font-semibold text-ink">{title}</span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="text-[10px] uppercase tracking-wide text-muted">Einsatz</span>
          <Coins amount={duel.stake} className="text-sm" />
        </span>
      </div>

      {/* Spieler mit Stand */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {duel.players.map((p) => (
          <span
            key={p.userId}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs ${
              p.status === "angenommen" ? "bg-surface-hover text-ink" : "bg-surface-hover/50 text-muted"
            } ${evaluated && p.place === 1 && p.status === "angenommen" ? "ring-1 ring-gold" : ""}`}
            title={p.status}
          >
            {evaluated && p.place ? `${p.place}.` : playerStatusIcon(p)}{" "}
            {p.userId === authUserId ? "Du" : p.name}
            {evaluated && p.points !== undefined && <span className="text-muted">· {p.points} P</span>}
          </span>
        ))}
      </div>

      {/* Spiele, nach der Auswertung mit deinem Tipp und deinen Punkten */}
      <ul className="flex flex-col gap-1">
        {duel.matchIds.map((id, i) => {
          const match = duelMatches[i];
          const game = me?.games.find((g) => g.matchId === id);
          return (
            <GameLine key={id} match={match}>
              {game && !game.cancelled && match && (
                <span className="whitespace-nowrap text-muted">
                  {" · "}Dein Tipp {game.tip ? scoreText(match.sport, ...(game.tip.split(":").map(Number) as [number, number])) : "–"}
                  {" "}
                  <span className={game.points !== undefined && game.points > 0 ? "font-semibold text-gold" : "text-red-400"}>
                    {game.points !== undefined && game.points > 0 ? "+" : ""}
                    {game.points}
                  </span>
                </span>
              )}
            </GameLine>
          );
        })}
      </ul>

      {result ? (
        <p className={`mt-2 text-xs font-semibold ${result.tone}`}>{result.text}</p>
      ) : (
        <p className="mt-2 text-xs text-muted">{statusText()}</p>
      )}

      {(canAnswer || canWithdraw) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {canAnswer && (
            <>
              <button
                onClick={handleAccept}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-full bg-action px-4 py-2 font-display text-xs font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
              >
                Annehmen ·
                <span className="inline-flex items-center gap-1">
                  <CoinIcon className="h-3.5 w-3.5" />
                  {duel.stake} Coins
                </span>
              </button>
              <button
                onClick={handleDecline}
                disabled={busy}
                className="rounded-full bg-surface-hover px-4 py-2 font-display text-xs font-semibold text-muted transition-colors hover:text-ink disabled:opacity-60"
              >
                Ablehnen
              </button>
            </>
          )}
          {canWithdraw && (
            <button
              onClick={() => setAskWithdraw(true)}
              disabled={busy}
              className="rounded-full border border-edge px-4 py-2 font-display text-xs font-semibold text-muted transition-colors hover:border-gold/40 hover:text-ink disabled:opacity-60"
            >
              Zurückziehen
            </button>
          )}
        </div>
      )}

      {askWithdraw && (
        <Modal onClose={() => !busy && setAskWithdraw(false)}>
          <p className="mb-1 text-3xl" aria-hidden>
            ↩️
          </p>
          <h3 className="mb-2 font-display text-lg font-bold text-ink">Duell zurückziehen?</h3>
          <p className="mb-2 text-sm text-ink">
            Alle bekommen ihren Einsatz zurück, du deine <Coins amount={duel.stake} />.{" "}
            {joinNames(notified.map((p) => p.name))} {notified.length === 1 ? "bekommt" : "bekommen"} eine Nachricht.
          </p>
          <p className="mb-4 text-xs text-muted">Danach kannst du das Duell geändert neu verschicken.</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => setAskWithdraw(false)}
              disabled={busy}
              className="rounded-full bg-surface-hover px-5 py-2 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
            <button
              type="button"
              onClick={() => void handleWithdraw()}
              disabled={busy}
              className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
            >
              {busy ? "Wird zurückgezogen…" : "Ja, zurückziehen"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Seite dahinter nicht mitscrollen.
  useEffect(() => {
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = before;
    };
  }, []);
  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-pitch/85 px-4 py-6 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative max-h-full w-full max-w-sm overflow-y-auto rounded-card border border-gold/40 bg-surface px-5 py-6 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
