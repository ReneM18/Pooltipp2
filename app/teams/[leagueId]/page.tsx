"use client";

import { useState, useRef, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import { useTeams, useLeagueDetail, TeamsResult } from "@/lib/TeamsContext";
import { useUser } from "@/lib/UserContext";
import { LeagueMatch, LeagueTip, ScoringMode } from "@/lib/teamsTypes";
import ShareLeagueButton from "@/components/ShareLeagueButton";
import ShareResultCard from "@/components/ShareResultCard";
import { TrashIcon } from "@/components/Icons";
import ScoreInput from "@/components/ScoreInput";

// Nur für die Anzeige der Punkte einzelner Tipps. Die Rangliste selbst
// rechnet die Datenbank (league_leaderboard, gleiche Regeln).
function pointsFor(
  scoringMode: ScoringMode,
  predictedHome: number,
  predictedAway: number,
  finalHome: number,
  finalAway: number
): number {
  const tendency = (h: number, a: number) => (h > a ? "H" : h < a ? "A" : "D");
  const correctTendency = tendency(predictedHome, predictedAway) === tendency(finalHome, finalAway);

  if (scoringMode === "dreiweg") {
    return correctTendency ? 3 : 0;
  }

  if (predictedHome === finalHome && predictedAway === finalAway) return 5;
  if (predictedHome - predictedAway === finalHome - finalAway) return 3;
  if (correctTendency) return 1;
  return 0;
}

// Wert für <input type="datetime-local"> in ORTSZEIT. toISOString() wäre
// UTC und würde beim Bearbeiten die Anpfiffzeit um 1–2 Stunden verschieben.
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function LeagueDetailPage() {
  const params = useParams<{ leagueId: string }>();
  const router = useRouter();
  const {
    leagues,
    leaguesLoaded,
    addMatch,
    updateMatch,
    removeMatch,
    setFinalScore,
    submitTip,
    updateLeague,
    removeMember,
    leaveLeague,
    deleteLeague,
  } = useTeams();
  const { displayName, authUserId } = useUser();
  const { matches, tips, members, reload } = useLeagueDetail(params.leagueId);

  const league = leagues.find((l) => l.id === params.leagueId);
  // Rechte-Prüfung über die echte Konto-ID statt über den frei änderbaren
  // Anzeigenamen. Die Datenbank prüft das zusätzlich noch einmal selbst.
  const isCreator = !!league && !!authUserId && league.creatorId === authUserId;

  const [tab, setTab] = useState<"spiele" | "rangliste" | "mitglieder">("spiele");
  const [editingLeague, setEditingLeague] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Führt eine Aktion aus, zeigt bei Fehler eine Meldung und lädt danach
  // Spiele/Tipps/Rangliste neu.
  async function run(action: Promise<TeamsResult>): Promise<boolean> {
    setActionError(null);
    const result = await action;
    if (!result.ok) setActionError(result.error ?? "Das hat nicht geklappt.");
    await reload();
    return result.ok;
  }

  async function handleLeave() {
    if (!league) return;
    if (!confirm(`"${league.name}" wirklich verlassen?`)) return;
    const result = await leaveLeague(league.id);
    if (!result.ok) {
      setActionError(result.error ?? "Das hat nicht geklappt.");
      return;
    }
    router.push("/teams");
  }

  async function handleDelete() {
    if (!league) return;
    if (!confirm(`"${league.name}" für alle Mitglieder unwiderruflich löschen?`)) return;
    const result = await deleteLeague(league.id);
    if (!result.ok) {
      setActionError(result.error ?? "Das hat nicht geklappt.");
      return;
    }
    router.push("/teams");
  }

  if (!league) {
    return (
      <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-16 text-center">
        <p className="text-sm text-muted">
          {leaguesLoaded ? "Tipprunde nicht gefunden – oder du bist (nicht mehr) Mitglied." : "Tipprunde wird geladen …"}
        </p>
      </main>
    );
  }

  const leagueMatches = matches.filter((m) => m.leagueId === league.id);
  const nameOf = new Map(members.map((m) => [m.userId, m.displayName]));
  const me = members.find((m) => m.userId === authUserId);
  // Für die Bild-Karte zum Teilen (erwartet Name + Punkte).
  const leaderboard: [string, number][] = members.map((m) => [m.displayName, m.points]);

  return (
    <main className="mx-auto max-w-3xl lg:max-w-6xl px-5 py-8">
      <div className="mb-6">
        {editingLeague ? (
          <EditLeagueForm
            initialName={league.name}
            initialDescription={league.description}
            onSave={async (name, description) => {
              if (await run(updateLeague(league.id, name, description))) setEditingLeague(false);
            }}
            onCancel={() => setEditingLeague(false)}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h1 className="font-display text-3xl font-bold text-ink">{league.name}</h1>
              {isCreator && (
                <button
                  onClick={() => setEditingLeague(true)}
                  className="rounded-full border border-edge px-3 py-1 text-xs font-semibold text-muted transition-colors hover:border-blue-400/50 hover:text-ink"
                >
                  Bearbeiten
                </button>
              )}
            </div>
            {league.description && <p className="mt-1 text-sm text-muted">{league.description}</p>}
          </>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
          <span>
            {league.scoringMode === "ergebnis" ? "Ergebnis-Modus" : "3-Wege-Modus"} ·{" "}
            {members.length || league.memberCount} Mitglieder
          </span>
          <span className="rounded-full border border-edge px-2 py-0.5 font-mono">
            Code: {league.code}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <ShareLeagueButton leagueName={league.name} code={league.code} />
          {isCreator ? (
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-red-400/50 hover:text-red-400"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Tipprunde löschen
            </button>
          ) : (
            <button
              onClick={handleLeave}
              className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-red-400/50 hover:text-red-400"
            >
              Tipprunde verlassen
            </button>
          )}
        </div>
        {actionError && (
          <p className="mt-3 rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
            {actionError}
          </p>
        )}
      </div>

      <div className="mb-5 flex gap-2 border-b border-edge">
        {(["spiele", "rangliste", "mitglieder"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`relative py-2.5 font-display text-sm font-semibold capitalize transition-colors ${
              tab === t ? "text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t}
            {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-400" />}
          </button>
        ))}
      </div>

      {tab === "spiele" && (
        <div className="flex flex-col gap-4">
          {isCreator && (
            <AddMatchForm leagueId={league.id} onAdd={(id, title, kickoff) => run(addMatch(id, title, kickoff))} />
          )}
          {leagueMatches.length === 0 && (
            <p className="text-sm text-muted">
              {isCreator
                ? "Noch keine Spiele in dieser Tipprunde. Leg oben das erste an."
                : "Noch keine Spiele in dieser Tipprunde. Der Gründer legt sie an."}
            </p>
          )}
          {leagueMatches.map((match) => (
            <LeagueMatchCard
              key={match.id}
              match={match}
              scoringMode={league.scoringMode}
              isCreator={isCreator}
              myTip={tips.find((t) => t.matchId === match.id && t.userId === authUserId)}
              otherTips={tips.filter((t) => t.matchId === match.id && t.userId !== authUserId)}
              nameOf={(userId) => nameOf.get(userId) ?? "Ehemaliges Mitglied"}
              onSubmitTip={(h, a) => run(submitTip(match.id, h, a))}
              onSetFinal={(h, a) => run(setFinalScore(match.id, h, a))}
              onUpdateMatch={(title, kickoff) => run(updateMatch(match.id, title, kickoff))}
              onRemoveMatch={() => run(removeMatch(match.id))}
            />
          ))}
        </div>
      )}

      {tab === "rangliste" && (
        <div className="flex flex-col gap-4">
          {/* Bewusst "Liga-Pkt" statt nur "Pkt": diese Punkte sind ein
              eigenes System nur innerhalb dieser Tipprunde und haben nichts
              mit den PoolScore-Rangpunkten der globalen Rangliste zu tun –
              sonst denken User, es sei dasselbe. */}
          {leaderboard.length > 0 && (
            <ShareResultCard
              leagueName={league.name}
              leaderboard={leaderboard}
              currentUser={me?.displayName ?? displayName}
            />
          )}
          <div className="overflow-hidden rounded-card border border-edge bg-surface">
            {members.map((member, i) => (
              <div
                key={member.userId}
                className={`flex items-center justify-between gap-3 px-4 py-3 sm:px-5 ${
                  i !== members.length - 1 ? "border-b border-edge" : ""
                } ${member.userId === authUserId ? "bg-surface-hover" : ""}`}
              >
                <span className="min-w-0 text-sm text-ink">
                  {i + 1}. {member.displayName}{" "}
                  {member.userId === authUserId && <span className="text-muted">(Du)</span>}
                  {member.exactTips > 0 && (
                    <span className="ml-2 text-xs text-muted">
                      {member.exactTips}× exakt
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap font-display font-semibold text-blue-400">
                  {member.points} Liga-Pkt
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "mitglieder" && (
        <div className="overflow-hidden rounded-card border border-edge bg-surface">
          {members.map((member, i) => (
            <div
              key={member.userId}
              className={`flex items-center justify-between px-5 py-3 ${
                i !== members.length - 1 ? "border-b border-edge" : ""
              }`}
            >
              <span className="text-sm text-ink">
                {member.displayName}{" "}
                {member.userId === authUserId && <span className="text-muted">(Du)</span>}
              </span>
              {member.isCreator ? (
                <span className="text-xs text-blue-400">Gründer</span>
              ) : (
                isCreator && (
                  <button
                    onClick={() => {
                      if (confirm(`${member.displayName} aus der Tipprunde entfernen?`)) {
                        run(removeMember(league.id, member.userId));
                      }
                    }}
                    className="flex items-center gap-1 text-xs text-muted transition-colors hover:text-red-400"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Entfernen
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function EditLeagueForm({
  initialName,
  initialDescription,
  onSave,
  onCancel,
}: {
  initialName: string;
  initialDescription: string;
  onSave: (name: string, description: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);

  return (
    <div className="flex flex-col gap-2 rounded-card border border-blue-400/30 bg-surface p-4">
      <div>
        <label className="mb-1 block text-xs text-muted">Name der Tipprunde</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Beschreibung</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            if (!name.trim()) return;
            onSave(name.trim(), description.trim());
          }}
          className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
        >
          Speichern
        </button>
        <button
          onClick={onCancel}
          className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function AddMatchForm({
  leagueId,
  onAdd,
}: {
  leagueId: string;
  onAdd: (leagueId: string, title: string, kickoff: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [kickoff, setKickoff] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !kickoff) return;
    onAdd(leagueId, title.trim(), new Date(kickoff).toISOString());
    setTitle("");
    setKickoff("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-card border border-blue-400/20 bg-surface p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="mb-1 block text-xs text-muted">Spiel (z. B. Team A vs Team B)</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Anpfiff</label>
        <input
          type="datetime-local"
          value={kickoff}
          onChange={(e) => setKickoff(e.target.value)}
          className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
        />
      </div>
      <button
        type="submit"
        className="rounded-full bg-action px-4 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        Spiel anlegen
      </button>
    </form>
  );
}

function LeagueMatchCard({
  match,
  scoringMode,
  isCreator,
  myTip,
  otherTips,
  nameOf,
  onSubmitTip,
  onSetFinal,
  onUpdateMatch,
  onRemoveMatch,
}: {
  match: LeagueMatch;
  scoringMode: ScoringMode;
  isCreator: boolean;
  myTip?: LeagueTip;
  // Fremde Tipps liefert die Datenbank erst ab Anpfiff (kein Abschreiben).
  otherTips: LeagueTip[];
  nameOf: (userId: string) => string;
  onSubmitTip: (home: number, away: number) => Promise<boolean>;
  onSetFinal: (home: number, away: number) => Promise<boolean>;
  onUpdateMatch: (title: string, kickoff: string) => Promise<boolean>;
  onRemoveMatch: () => Promise<boolean>;
}) {
  const [home, setHome] = useState(myTip?.predictedHomeScore ?? 0);
  const [away, setAway] = useState(myTip?.predictedAwayScore ?? 0);
  const [changingTip, setChangingTip] = useState(false);
  // Gleicher Doppel-Tipp-Schutz wie im Haupt-Spieltag (MatchCard.tsx).
  const submittedRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [finalHome, setFinalHome] = useState(match.finalHomeScore ?? 0);
  const [finalAway, setFinalAway] = useState(match.finalAwayScore ?? 0);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(match.title);
  const [editKickoff, setEditKickoff] = useState(toLocalInputValue(match.kickoff));

  const finished = match.status === "finished";
  const started = finished || new Date(match.kickoff).getTime() <= Date.now();
  const showTipForm = !started && (!myTip || changingTip);

  async function handleTip() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    const ok = await onSubmitTip(home, away);
    submittedRef.current = false;
    setSubmitting(false);
    if (ok) setChangingTip(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 rounded-card border border-blue-400/30 bg-surface p-4 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs text-muted">Spiel</label>
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            maxLength={80}
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted">Anpfiff</label>
          <input
            type="datetime-local"
            value={editKickoff}
            onChange={(e) => setEditKickoff(e.target.value)}
            className="w-full rounded-lg border border-edge bg-pitch px-3 py-2 text-sm text-ink outline-none focus:border-blue-400"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={async () => {
              if (!editTitle.trim() || !editKickoff) return;
              if (await onUpdateMatch(editTitle.trim(), new Date(editKickoff).toISOString())) setEditing(false);
            }}
            className="rounded-full bg-action px-4 py-2 text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Speichern
          </button>
          <button
            onClick={() => setEditing(false)}
            className="rounded-full border border-edge px-4 py-2 text-sm font-semibold text-muted transition-colors hover:text-ink"
          >
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  const tipPoints = (tip: LeagueTip) =>
    finished && match.finalHomeScore !== null && match.finalAwayScore !== null
      ? pointsFor(scoringMode, tip.predictedHomeScore, tip.predictedAwayScore, match.finalHomeScore, match.finalAwayScore)
      : null;
  const myPoints = myTip ? tipPoints(myTip) : null;

  return (
    <div className="rounded-card border border-edge bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="min-w-0 basis-full font-display text-sm font-semibold text-ink sm:basis-auto sm:flex-1">
          {match.title}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs text-muted">
            {new Date(match.kickoff).toLocaleString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          {isCreator && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditing(true)}
                className="text-xs text-muted transition-colors hover:text-ink"
              >
                Bearbeiten
              </button>
              <button
                onClick={() => {
                  if (confirm(`Spiel "${match.title}" wirklich löschen?`)) onRemoveMatch();
                }}
                aria-label="Spiel löschen"
                className="text-xs text-muted transition-colors hover:text-red-400"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {finished ? (
        <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-ink">
          <span>
            Endstand: <span className="font-semibold">{match.finalHomeScore} : {match.finalAwayScore}</span>
          </span>
          {myTip ? (
            <span className="text-muted">
              Dein Tipp: {myTip.predictedHomeScore}:{myTip.predictedAwayScore}
              {myPoints !== null && (
                <span className="ml-1 whitespace-nowrap font-semibold text-blue-400">+{myPoints} Liga-Pkt</span>
              )}
            </span>
          ) : (
            <span className="text-muted">Kein Tipp abgegeben</span>
          )}
        </p>
      ) : showTipForm ? (
        <div className="flex items-center gap-2">
          <ScoreInput
            value={home}
            onChange={setHome}
            max={99}
            label="Tore Heim"
            className="h-9 w-12 rounded-lg border border-edge bg-pitch text-center text-base text-ink outline-none focus:border-blue-400"
          />
          <span className="text-muted">:</span>
          <ScoreInput
            value={away}
            onChange={setAway}
            max={99}
            label="Tore Gast"
            className="h-9 w-12 rounded-lg border border-edge bg-pitch text-center text-base text-ink outline-none focus:border-blue-400"
          />
          <button
            onClick={handleTip}
            disabled={submitting}
            className="rounded-full bg-action px-4 py-1.5 text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "…" : myTip ? "Speichern" : "Tippen"}
          </button>
          {changingTip && (
            <button
              onClick={() => setChangingTip(false)}
              className="text-xs text-muted transition-colors hover:text-ink"
            >
              Abbrechen
            </button>
          )}
        </div>
      ) : myTip ? (
        <p className="text-sm text-muted">
          Dein Tipp:{" "}
          <span className="font-semibold text-ink">
            {myTip.predictedHomeScore}:{myTip.predictedAwayScore}
          </span>
          {started ? (
            <span className="ml-2 text-xs">· Tippschluss</span>
          ) : (
            <button
              onClick={() => {
                setHome(myTip.predictedHomeScore);
                setAway(myTip.predictedAwayScore);
                setChangingTip(true);
              }}
              className="ml-2 text-xs text-blue-400 transition-colors hover:text-blue-300"
            >
              Ändern
            </button>
          )}
        </p>
      ) : (
        <p className="text-sm text-muted">Tippschluss – du hast nicht getippt.</p>
      )}

      {started && otherTips.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>Tipps der Runde:</span>
          {otherTips.map((tip) => {
            const pts = tipPoints(tip);
            return (
              <span key={tip.id}>
                {nameOf(tip.userId)}{" "}
                <span className="text-ink">
                  {tip.predictedHomeScore}:{tip.predictedAwayScore}
                </span>
                {pts !== null && <span className="text-blue-400"> (+{pts})</span>}
              </span>
            );
          })}
        </div>
      )}

      {isCreator && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-edge pt-3">
          <span className="text-xs text-muted">{finished ? "Endstand korrigieren:" : "Endstand eintragen:"}</span>
          <ScoreInput
            value={finalHome}
            onChange={setFinalHome}
            max={99}
            label="Endstand Heim"
            className="h-8 w-11 rounded-lg border border-edge bg-pitch text-center text-base text-ink outline-none focus:border-blue-400"
          />
          <span className="text-xs text-muted">:</span>
          <ScoreInput
            value={finalAway}
            onChange={setFinalAway}
            max={99}
            label="Endstand Gast"
            className="h-8 w-11 rounded-lg border border-edge bg-pitch text-center text-base text-ink outline-none focus:border-blue-400"
          />
          <button
            onClick={() => {
              if (!finished && !started && !confirm("Das Spiel hat noch nicht begonnen. Endstand trotzdem eintragen? Danach kann niemand mehr tippen.")) return;
              onSetFinal(finalHome, finalAway);
            }}
            className="rounded-lg bg-action px-3 py-1 text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Übernehmen
          </button>
        </div>
      )}
    </div>
  );
}
