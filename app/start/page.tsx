"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TeamPicker from "@/components/TeamPicker";
import TeamBadge, { teamColorProps } from "@/components/TeamBadge";
import { useUser } from "@/lib/UserContext";
import { useAppData } from "@/lib/AppDataContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { useMyClubs } from "@/lib/clubs";
import { Match, Sport, SPORTS, SPORT_ICONS, isSportActive, sportLabel } from "@/lib/types";
import { matchTitle } from "@/lib/teamOrder";

// Start-Erlebnis nach der Registrierung: 1) Sportarten antippen,
// 2) pro gewählter Sportart freiwillig einen Herzensverein, 3) erster Tipp.
// Wer schon getippt hat, kommt nie automatisch hierher (app/page.tsx).
// "Fertig" bzw. "Überspringen" gilt fürs Konto, also auf jedem Gerät
// (profile_extras.start_done, supabase/dranbleiben.sql).
// Vorschau (/start?vorschau=1, Knopf im Profil und im Admin-Bereich): sieht
// gleich aus, speichert aber nichts – keine Vereine, kein "fertig".

type Step = 1 | 2 | 3;

export default function StartPage() {
  const router = useRouter();
  const { isRegistered, sessionChecked, authUserId, displayName, markStartDone } = useUser();
  const { teams, matches, myTips, contentLoaded, getTeam } = useAppData();
  const { showToast } = useFeedback();
  const { clubs, playForClubs, chooseClub } = useMyClubs(authUserId);

  const [preview, setPreview] = useState(false);
  useEffect(() => {
    setPreview(new URLSearchParams(window.location.search).get("vorschau") === "1");
  }, []);

  const [step, setStep] = useState<Step>(1);
  const [sports, setSports] = useState<Sport[]>([]);
  const [picks, setPicks] = useState<Partial<Record<Sport, string>>>({});
  const [saving, setSaving] = useState(false);

  // Bei jedem Schritt nach oben (am Handy steht man sonst mitten im Text).
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  const chosenSports = sports.length > 0 ? sports : SPORTS;
  const suggestions = useMemo(() => {
    if (now === null) return [];
    const tipped = new Set(myTips.map((t) => t.matchId));
    const clubIds = new Set<string>();
    for (const s of chosenSports) {
      const id = picks[s] ?? clubs?.[s]?.teamId;
      if (id) clubIds.add(id);
    }
    const open = matches.filter(
      (m) =>
        m.status !== "finished" &&
        m.status !== "cancelled" &&
        isSportActive(m.sport) &&
        new Date(m.tipDeadline).getTime() > now &&
        !tipped.has(m.id) &&
        getTeam(m.homeTeamId) &&
        getTeam(m.awayTeamId)
    );
    const inSports = open.filter((m) => chosenSports.includes(m.sport));
    const pool = inSports.length > 0 ? inSports : open;
    const isClubMatch = (m: Match) => clubIds.has(m.homeTeamId) || clubIds.has(m.awayTeamId);
    return [...pool]
      .sort(
        (a, b) =>
          Number(isClubMatch(b)) - Number(isClubMatch(a)) ||
          new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime()
      )
      .slice(0, 3)
      .map((m) => ({ match: m, club: isClubMatch(m) }));
  }, [now, matches, myTips, chosenSports, picks, clubs, getTeam]);

  function toggleSport(sport: Sport) {
    setSports((current) => (current.includes(sport) ? current.filter((s) => s !== sport) : [...current, sport]));
  }

  function finish(target: string) {
    if (!preview) markStartDone();
    router.push(target);
  }

  async function saveClubsAndContinue() {
    const toSave = sports.filter((s) => picks[s] && !clubs?.[s]?.teamId);
    if (preview || toSave.length === 0 || !playForClubs) {
      setStep(3);
      return;
    }
    setSaving(true);
    const errors: string[] = [];
    for (const sport of toSave) {
      const message = await chooseClub(sport, picks[sport] ?? null);
      if (message) errors.push(`${sportLabel(sport)}: ${message}`);
    }
    setSaving(false);
    if (errors.length > 0) {
      showToast(`Nicht gespeichert – ${errors.join(" · ")}`, "info");
      return;
    }
    showToast(toSave.length === 1 ? "Herzensverein gespeichert." : "Herzensvereine gespeichert.", "gold");
    setStep(3);
  }

  if (!sessionChecked) {
    return <Frame><p className="py-8 text-center text-sm text-muted">Wird geladen …</p></Frame>;
  }
  if (!isRegistered) {
    return (
      <Frame>
        <div className="rounded-card border border-edge bg-surface p-5 text-sm text-muted">
          <Link href="/registrieren?modus=registrieren" className="font-semibold text-gold hover:underline">
            Registriere dich
          </Link>
          , dann richtest du hier in drei kurzen Schritten PoolTipp für dich ein.
        </div>
      </Frame>
    );
  }

  const skipButton = (
    <button
      type="button"
      onClick={() => finish(preview ? "/profil" : "/")}
      className="text-xs font-semibold text-muted transition-colors hover:text-ink"
    >
      {preview ? "Vorschau beenden" : "Überspringen"}
    </button>
  );

  return (
    <Frame>
      {preview && (
        <div className="mb-4 rounded-card border border-action/50 bg-action/10 px-4 py-3 text-xs text-ink">
          <span className="font-semibold">Vorschau:</span> So sieht ein neuer Spieler den Start. Es wird nichts
          gespeichert.
        </div>
      )}

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-1.5" aria-label={`Schritt ${step} von 3`}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${n === step ? "w-6 bg-gold" : n < step ? "w-3 bg-gold/50" : "w-3 bg-edge"}`}
            />
          ))}
        </div>
        {skipButton}
      </div>

      <div className="rounded-card border border-edge bg-gradient-to-br from-surface to-surface-hover p-5 sm:p-6">
        {step === 1 && (
          <>
            <h1 className="font-display text-xl font-bold text-ink [overflow-wrap:anywhere] sm:text-2xl">
              Willkommen, {displayName}! 👋
            </h1>
            <p className="mt-2 text-sm text-muted">
              Welche Sportarten schaust du? Tippe an, was dich interessiert. Du kannst trotzdem jederzeit alles
              tippen.
            </p>
            {/* Alle starten NICHT gewählt (grau). Gewählt = goldene Fläche mit
                Häkchen, damit man ohne Vergleich sieht, was an ist. Name in
                eigener Zeile, sonst ist am Handy (360 px) neben "Basketball"
                kein Platz fürs Häkchen. */}
            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {SPORTS.map((sport) => {
                const on = sports.includes(sport);
                return (
                  <button
                    key={sport}
                    type="button"
                    onClick={() => toggleSport(sport)}
                    aria-pressed={on}
                    className={`relative flex flex-col items-start gap-1 rounded-lg border-2 px-3 py-2.5 text-left transition-colors ${
                      on
                        ? "border-gold bg-gold text-pitch"
                        : "border-edge bg-pitch text-muted hover:border-muted hover:text-ink"
                    }`}
                  >
                    <span className={`text-xl ${on ? "" : "opacity-60 grayscale"}`} aria-hidden>
                      {SPORT_ICONS[sport]}
                    </span>
                    <span className="font-display text-sm font-semibold">{sportLabel(sport)}</span>
                    <span
                      aria-hidden
                      className={`absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[11px] font-bold leading-none ${
                        on ? "border-pitch bg-pitch text-gold" : "border-edge"
                      }`}
                    >
                      {on ? "✓" : ""}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted">
              {sports.length === 0
                ? "Noch nichts gewählt."
                : `${sports.length} von ${SPORTS.length} gewählt.`}
            </p>
            <button
              type="button"
              onClick={() => setStep(sports.length > 0 ? 2 : 3)}
              className={`mt-5 w-full rounded-full py-3 font-display text-sm font-semibold transition-colors ${
                sports.length > 0
                  ? "bg-action text-pitch hover:bg-action-hover"
                  : "border border-edge text-muted hover:text-ink"
              }`}
            >
              {sports.length > 0 ? "Weiter" : "Ohne Auswahl weiter"}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Dein Herzensverein</h1>
            <p className="mt-2 text-sm text-muted">
              Mit deinen Tipps sammelst du Punkte für deinen Verein in der Vereinstabelle. Freiwillig: jede
              Sportart kannst du auch später im Profil unter „Einstellungen“ wählen.
            </p>
            <div className="mt-5 flex flex-col gap-3">
              {sports.map((sport) => {
                const current = clubs?.[sport]?.teamId ?? null;
                const currentTeam = current ? getTeam(current) : undefined;
                const options = teams.filter((t) => t.sport === sport && !t.isNationalTeam);
                const pick = picks[sport];
                return (
                  <div key={sport} className="rounded-lg border border-edge bg-pitch/60 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-muted">
                        {SPORT_ICONS[sport]} {sportLabel(sport)}
                      </p>
                      {pick && !currentTeam && (
                        <button
                          type="button"
                          onClick={() => setPicks((p) => ({ ...p, [sport]: undefined }))}
                          className="text-xs font-semibold text-muted transition-colors hover:text-ink"
                        >
                          Später
                        </button>
                      )}
                    </div>
                    {currentTeam ? (
                      <div className="flex items-center gap-2.5">
                        <TeamBadge
                          sport={sport}
                          {...teamColorProps(currentTeam)}
                          jerseyStyle={currentTeam.jerseyStyle}
                          size={28}
                        />
                        <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{currentTeam.name}</span>
                        <span className="shrink-0 text-xs text-gold">✓ gewählt</span>
                      </div>
                    ) : options.length === 0 ? (
                      <p className="text-xs text-muted">In dieser Sportart gibt es noch keine Vereine.</p>
                    ) : (
                      <TeamPicker
                        teams={options}
                        value={pick ?? ""}
                        onChange={(id) => setPicks((p) => ({ ...p, [sport]: id }))}
                        compact
                        placeholder="Verein suchen (oder später)"
                        notFoundText="Kein Verein mit diesem Namen."
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {!playForClubs && (
              <p className="mt-3 text-xs text-muted">
                Die Vereinswertung ist bei dir ausgeschaltet, gewählte Vereine werden darum nicht gespeichert.
              </p>
            )}
            <p className="mt-3 text-xs text-muted">
              Gut zu wissen: Nach der Wahl kannst du den Verein 30 Tage nicht wechseln.
            </p>
            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-edge px-5 py-3 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={saveClubsAndContinue}
                disabled={saving}
                className="flex-1 rounded-full bg-action py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover disabled:opacity-60"
              >
                {saving ? "Wird gespeichert …" : "Weiter"}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="font-display text-xl font-bold text-ink sm:text-2xl">Dein erster Tipp</h1>
            <p className="mt-2 text-sm text-muted">Such dir ein Spiel aus. Tippen ist immer gratis.</p>
            <div className="mt-5 flex flex-col gap-2.5">
              {!contentLoaded ? (
                <p className="py-4 text-center text-sm text-muted">Spiele werden geladen …</p>
              ) : suggestions.length === 0 ? (
                <p className="rounded-lg border border-edge bg-pitch/60 p-4 text-sm text-muted">
                  Gerade ist kein Spiel zum Tippen offen. Neue Spiele kommen laufend dazu.
                </p>
              ) : (
                suggestions.map(({ match, club }) => (
                  <SuggestionRow
                    key={match.id}
                    match={match}
                    club={club}
                    onTip={() => finish(`/?spiel=${encodeURIComponent(match.id)}`)}
                  />
                ))
              )}
            </div>

            <div className="mt-5 rounded-lg border border-edge bg-pitch/60 p-4">
              <p className="font-display text-sm font-semibold text-ink">Gut zu wissen</p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted">
                <li>🎁 Jeden Tag gibt es einen Bonus für deinen Saison-Pass.</li>
                <li>🔥 Tippst du an mehreren Tagen hintereinander, wächst deine Tipp-Serie. Ein Tag Pause pro Woche ist erlaubt.</li>
                <li>📊 Jeden Dienstag siehst du deinen Wochenrückblick.</li>
              </ul>
            </div>

            <div className="mt-6 flex gap-2">
              <button
                type="button"
                onClick={() => setStep(sports.length > 0 ? 2 : 1)}
                className="rounded-full border border-edge px-5 py-3 font-display text-sm font-semibold text-muted transition-colors hover:text-ink"
              >
                Zurück
              </button>
              <button
                type="button"
                onClick={() => finish(preview ? "/profil" : "/")}
                className="flex-1 rounded-full bg-action py-3 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
              >
                {preview ? "Vorschau beenden" : "Zu allen Spielen"}
              </button>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="mx-auto max-w-xl px-5 py-5 sm:py-8">{children}</main>;
}

function SuggestionRow({ match, club, onTip }: { match: Match; club: boolean; onTip: () => void }) {
  const { getTeam } = useAppData();
  const home = getTeam(match.homeTeamId);
  const away = getTeam(match.awayTeamId);
  if (!home || !away) return null;
  const kickoff = new Date(match.kickoff).toLocaleString("de-DE", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-edge bg-pitch/60 p-3">
      <div className="min-w-[12rem] flex-1">
        <p className="text-xs text-muted">
          {SPORT_ICONS[match.sport]} {match.competition} · {kickoff}
          {club && <span className="font-semibold text-gold"> · dein Verein</span>}
        </p>
        <p className="mt-0.5 font-display text-sm font-semibold text-ink">
          {matchTitle(match.sport, home.name, away.name)}
        </p>
      </div>
      <button
        type="button"
        onClick={onTip}
        className="ml-auto shrink-0 rounded-full bg-action px-5 py-2 font-display text-xs font-semibold text-pitch transition-colors hover:bg-action-hover"
      >
        Tippen
      </button>
    </div>
  );
}
