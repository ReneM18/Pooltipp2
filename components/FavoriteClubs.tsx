"use client";

import { useState } from "react";
import Link from "next/link";
import FitText from "@/components/FitText";
import SaveButton, { useDraft } from "@/components/SaveButton";
import TeamBadge, { teamColorProps } from "@/components/TeamBadge";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { useFeedback } from "@/lib/FeedbackContext";
import { SPORTS, Sport, Team, SPORT_ICONS, sportLabel } from "@/lib/types";
import { CLUB_MIN_ACTIVE_FANS, CLUB_MIN_TIPS, formatDay, MyClub, useMyClubs } from "@/lib/clubs";

const sportIcon: Record<string, string> = SPORT_ICONS;

// Profil-Bereich "Herzensvereine": pro Sportart freiwillig einen Verein
// wählen, plus Schalter, um die Vereinswertung komplett abzuschalten.
export default function FavoriteClubs() {
  const { authUserId, isRegistered } = useUser();
  const { teams } = useAppData();
  const { showToast } = useFeedback();
  const { clubs, playForClubs, loading, error, chooseClub, setPlayForClubs } = useMyClubs(authUserId);
  const [openSport, setOpenSport] = useState<Sport | null>(null);
  const [busy, setBusy] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // Schalter ändert erst den Entwurf, "Speichern" übernimmt ihn.
  const playDraft = useDraft(playForClubs);

  if (!isRegistered || !authUserId) {
    return (
      <section className="mb-8">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Herzensvereine</h2>
        <div className="rounded-card border border-edge bg-surface p-4 text-sm text-muted">
          <Link href="/registrieren" className="font-semibold text-gold hover:underline">
            Melde dich an
          </Link>
          , um pro Sportart einen Herzensverein zu wählen und für ihn mitzuspielen.
        </div>
      </section>
    );
  }

  async function handleSavePlay() {
    setBusy(true);
    await playDraft.save(async (next) => {
      const message = await setPlayForClubs(next);
      if (message) showToast(message, "info");
      else showToast(next ? "Du spielst wieder für deine Vereine." : "Vereinswertung ausgeschaltet.", "info");
      return message;
    });
    setBusy(false);
  }

  async function handleChoose(sport: Sport, team: Team | null, current: MyClub) {
    const question = team
      ? current.teamId
        ? `${team.name} als neuen Herzensverein wählen? Danach kannst du 30 Tage nicht wechseln, und es zählen nur Spiele ab jetzt.`
        : `${team.name} als Herzensverein wählen? Danach kannst du 30 Tage nicht wechseln.`
      : "Herzensverein entfernen? Einen neuen kannst du dann erst nach 30 Tagen wählen.";
    if (!window.confirm(question)) return;
    setBusy(true);
    const message = await chooseClub(sport, team?.id ?? null);
    setBusy(false);
    setOpenSport(null);
    if (message) showToast(message, "info");
    else showToast(team ? `${sportIcon[sport]} Du spielst jetzt für ${team.name}.` : "Herzensverein entfernt.", "gold");
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 font-display text-lg font-semibold text-ink">Herzensvereine</h2>
      <p className="mb-3 text-xs text-muted">
        Mit deinen Tipps sammelst du Punkte für deinen Verein in der Vereinstabelle. Freiwillig, Coins und
        Ranglistenpunkte bekommst du so oder so.{" "}
        <button onClick={() => setShowRules((v) => !v)} className="font-semibold text-gold hover:underline">
          {showRules ? "Regeln ausblenden" : "So funktioniert’s"}
        </button>
      </p>

      {showRules && (
        <ul className="mb-3 list-disc space-y-1 rounded-card border border-edge bg-surface py-3 pl-8 pr-4 text-xs text-muted">
          <li>Fußball-Tipps zählen nur für deinen Fußballverein, Basketball-Tipps nur für dein Basketball-Team usw.</li>
          <li>Pro Tipp: exaktes Ergebnis 3 Punkte, richtige Tendenz 1 Punkt. Bei Sieg/Unentschieden/Niederlage-Spielen gibt ein richtiger Tipp 2 Punkte.</li>
          <li>Aktiver Fan bist du ab {CLUB_MIN_TIPS} gewerteten Tipps in der Saison (ab 1. Juli).</li>
          <li>Vereinswert = Durchschnitt pro Tipp aller aktiven Fans mal 100.</li>
          <li>Gewertet wird ein Verein ab {CLUB_MIN_ACTIVE_FANS} aktiven Fans.</li>
          <li>Nach einem Wechsel 30 Tage Sperre, beim neuen Verein zählen nur Spiele ab dem Wechsel.</li>
        </ul>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 rounded-card border border-edge bg-surface p-4">
        <div className="min-w-0">
          <p className="font-display text-sm font-semibold text-ink">Für Vereine spielen</p>
          <p className="text-xs text-muted">
            {playDraft.value ? "An: deine Tipps zählen für deine Herzensvereine." : "Aus: du zählst für keinen Verein."}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
          <button
            role="switch"
            aria-checked={playDraft.value}
            aria-label="Für Vereine spielen"
            disabled={busy || loading}
            onClick={() => playDraft.set(!playDraft.value)}
            className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50 ${
              playDraft.value ? "border-gold bg-gold/80" : "border-edge bg-pitch"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-ink transition-all ${playDraft.value ? "left-6" : "left-0.5"}`}
            />
          </button>
          <SaveButton dirty={playDraft.dirty} saved={playDraft.saved} busy={busy} onClick={handleSavePlay} />
        </div>
      </div>

      {error && !clubs ? (
        <p className="rounded-card border border-edge bg-surface p-4 text-xs text-muted">
          Herzensvereine konnten nicht geladen werden. Technische Info: {error}
        </p>
      ) : (
        <div className={`grid gap-3 sm:grid-cols-2 ${playForClubs ? "" : "opacity-50"}`}>
          {SPORTS.map((sport) => {
            const current = clubs?.[sport];
            const team = current?.teamId ? teams.find((t) => t.id === current.teamId) ?? null : null;
            const options = teams
              .filter((t) => t.sport === sport && !t.isNationalTeam)
              .sort((a, b) => a.name.localeCompare(b.name, "de"));
            const locked = !!current?.nextChangeAt && new Date(current.nextChangeAt).getTime() > Date.now();
            const open = openSport === sport;
            return (
              <div key={sport} className="rounded-card border border-edge bg-surface p-4">
                <p className="mb-2 text-xs font-semibold text-muted">
                  {sportIcon[sport]} {sportLabel(sport)}
                </p>
                <div className="flex items-center gap-3">
                  {team ? (
                    <TeamBadge
                      sport={sport}
                      {...teamColorProps(team)}
                      jerseyStyle={team.jerseyStyle}
                      size={32}
                    />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed border-edge text-muted">
                      ?
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {loading && !clubs ? (
                      <span className="block h-4 w-28 animate-pulse rounded bg-surface-hover" />
                    ) : team ? (
                      <FitText text={team.name} className="font-display text-base font-semibold leading-tight text-ink" />
                    ) : (
                      <span className="text-sm text-muted">Kein Herzensverein</span>
                    )}
                  </div>
                  {playForClubs && !loading && (!locked || !team) && options.length > 0 && (
                    <button
                      disabled={busy || (locked && !team)}
                      onClick={() => setOpenSport(open ? null : sport)}
                      className="shrink-0 rounded-full border border-gold px-3 py-1.5 font-display text-xs font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch disabled:opacity-50"
                    >
                      {open ? "Schließen" : team ? "Wechseln" : "Wählen"}
                    </button>
                  )}
                </div>

                {current && <ClubStatus club={current} hasTeam={!!team} locked={locked} />}
                {options.length === 0 && (
                  <p className="mt-2 text-xs text-muted">In dieser Sportart gibt es noch keine Vereine.</p>
                )}

                {open && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-edge pt-3">
                    {options
                      .filter((t) => t.id !== team?.id)
                      .map((t) => (
                        <button
                          key={t.id}
                          disabled={busy}
                          onClick={() => current && handleChoose(sport, t, current)}
                          className="flex items-center gap-3 rounded-lg border border-edge bg-pitch px-3 py-2 text-left transition-colors hover:border-gold disabled:opacity-50"
                        >
                          <TeamBadge
                            sport={sport}
                            {...teamColorProps(t)}
                            jerseyStyle={t.jerseyStyle}
                            size={26}
                          />
                          <span className="min-w-0 flex-1 text-sm font-semibold text-ink [hyphens:manual] [overflow-wrap:normal]">
                            {t.name}
                          </span>
                        </button>
                      ))}
                    {team && (
                      <button
                        disabled={busy}
                        onClick={() => current && handleChoose(sport, null, current)}
                        className="self-start text-xs font-semibold text-muted hover:text-ink"
                      >
                        Herzensverein entfernen
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ClubStatus({ club, hasTeam, locked }: { club: MyClub; hasTeam: boolean; locked: boolean }) {
  if (!hasTeam) {
    return locked ? (
      <p className="mt-2 text-xs text-muted">Neuer Herzensverein ab {formatDay(club.nextChangeAt)} möglich.</p>
    ) : null;
  }
  const missing = Math.max(0, CLUB_MIN_TIPS - club.tips);
  return (
    <div className="mt-2 space-y-0.5 text-xs text-muted">
      {missing > 0 ? (
        <p>
          Noch {missing} {missing === 1 ? "gewerteter Tipp" : "gewertete Tipps"}, dann bist du aktiver Fan.
        </p>
      ) : (
        <p>
          <span className="font-semibold text-gold">Aktiver Fan</span> · dein Beitrag{" "}
          <span className="font-semibold text-ink">{Math.round(club.avgPoints * 100)}</span> ({club.tips} Tipps)
        </p>
      )}
      <p>
        Zählt ab {formatDay(club.since)}
        {locked ? ` · Wechsel ab ${formatDay(club.nextChangeAt)}` : ""}
      </p>
    </div>
  );
}
