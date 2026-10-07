"use client";

import { useState } from "react";
import Link from "next/link";
import FitText from "@/components/FitText";
import TeamBadge, { teamColorProps } from "@/components/TeamBadge";
import { useAppData } from "@/lib/AppDataContext";
import { useUser } from "@/lib/UserContext";
import { SPORTS, Sport, SPORT_ICONS, sportLabel } from "@/lib/types";
import { CLUB_MIN_ACTIVE_FANS, ClubTableRow, useClubTable, useMyClubs } from "@/lib/clubs";

const sportIcon: Record<string, string> = SPORT_ICONS;

// Vereinstabelle je Sportart (Reiter "Vereine" auf der Rangliste). Die Werte
// rechnet die Datenbank (supabase/vereinswertung.sql, club_table).
export default function ClubLeaderboard() {
  const [sport, setSport] = useState<Sport>("Fußball");
  const { getTeam } = useAppData();
  const { authUserId } = useUser();
  const { rows, loading, error, retry } = useClubTable(sport);
  const { clubs } = useMyClubs(authUserId);
  const myTeamId = clubs?.[sport]?.teamId ?? null;

  const ranked = rows.filter((r) => r.ranked);
  const pending = rows.filter((r) => !r.ranked);

  // Gleiche Werte bekommen den gleichen Platz (1, 2, 2, 4 …).
  const places: number[] = [];
  ranked.forEach((row, i) => {
    places.push(i > 0 && row.score === ranked[i - 1].score ? places[i - 1] : i + 1);
  });

  return (
    <div>
      <div className="mb-4 grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
        {SPORTS.map((s) => (
          <button
            key={s}
            onClick={() => setSport(s)}
            className={`flex items-center justify-center gap-1 rounded-full border px-1 py-1.5 text-xs font-semibold sm:gap-1.5 sm:px-3 transition-colors ${
              sport === s ? "border-gold bg-gold/15 text-gold" : "border-edge bg-surface text-muted hover:text-ink"
            }`}
          >
            <span aria-hidden>{sportIcon[s]}</span>
            {sportLabel(s)}
          </button>
        ))}
      </div>

      <p className="mb-4 text-xs text-muted">
        Durchschnitt pro aktivem Fan mal 100. Gewertet ab {CLUB_MIN_ACTIVE_FANS} aktiven Fans.{" "}
        <Link href="/profil#herzensvereine" className="font-semibold text-gold hover:underline">
          {myTeamId ? "Deine Herzensvereine" : "Herzensverein wählen"}
        </Link>
      </p>

      {loading ? (
        <div className="overflow-hidden rounded-card border border-edge bg-surface" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`flex items-center gap-3 px-5 py-4 ${i !== 2 ? "border-b border-edge" : ""}`}>
              <span className="h-7 w-7 animate-pulse rounded-full bg-surface-hover" />
              <span className="h-4 w-40 animate-pulse rounded bg-surface-hover" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="rounded-card border border-edge bg-surface px-6 py-10 text-center">
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">Vereinstabelle gerade nicht erreichbar</h2>
          <p className="mx-auto mb-5 max-w-sm text-sm text-muted">Bitte versuch es gleich noch einmal.</p>
          <button
            onClick={retry}
            className="rounded-full bg-action px-5 py-2 font-display text-sm font-semibold text-pitch transition-colors hover:bg-action-hover"
          >
            Nochmal versuchen
          </button>
          <p className="mx-auto mt-4 max-w-sm break-words text-[11px] text-muted/70">Technische Info: {error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-card border border-edge bg-surface px-6 py-10 text-center">
          <p className="mb-2 text-3xl" aria-hidden>
            {sportIcon[sport]}
          </p>
          <h2 className="mb-1 font-display text-lg font-semibold text-ink">Noch keine Fans in {sportLabel(sport)}</h2>
          <p className="mx-auto mb-5 max-w-sm text-sm text-muted">
            Wähle im Profil unter „Einstellungen“ deinen Herzensverein und sammle mit deinen Tipps Punkte für ihn.
          </p>
          <Link
            href="/profil#herzensvereine"
            className="inline-block rounded-full border border-gold px-5 py-2 font-display text-sm font-semibold text-gold transition-colors hover:bg-gold hover:text-pitch"
          >
            Herzensverein wählen
          </Link>
        </div>
      ) : (
        <>
          {ranked.length > 0 && (
            <div className="mb-5 overflow-hidden rounded-card border border-edge bg-surface">
              {ranked.map((row, i) => (
                <ClubRow
                  key={row.teamId}
                  row={row}
                  place={places[i]}
                  isMine={row.teamId === myTeamId}
                  last={i === ranked.length - 1}
                  sport={sport}
                  team={getTeam(row.teamId)}
                />
              ))}
            </div>
          )}
          {pending.length > 0 && (
            <>
              <h2 className="mb-2 font-display text-sm font-semibold text-muted">
                Noch nicht gewertet (unter {CLUB_MIN_ACTIVE_FANS} aktiven Fans)
              </h2>
              <div className="overflow-hidden rounded-card border border-edge bg-surface">
                {pending.map((row, i) => (
                  <ClubRow
                    key={row.teamId}
                    row={row}
                    place={null}
                    isMine={row.teamId === myTeamId}
                    last={i === pending.length - 1}
                    sport={sport}
                    team={getTeam(row.teamId)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function ClubRow({
  row,
  place,
  isMine,
  last,
  sport,
  team,
}: {
  row: ClubTableRow;
  place: number | null;
  isMine: boolean;
  last: boolean;
  sport: Sport;
  team: ReturnType<ReturnType<typeof useAppData>["getTeam"]>;
}) {
  const medal = place === 1 ? "🥇" : place === 2 ? "🥈" : place === 3 ? "🥉" : null;
  return (
    <div
      className={`flex items-center justify-between gap-2 px-3 py-4 sm:px-5 ${last ? "" : "border-b border-edge"} ${
        isMine ? "bg-surface-hover" : ""
      }`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center font-display text-sm text-muted">
          {place === null ? "–" : medal ?? place}
        </span>
        {team && (
          <TeamBadge
            sport={sport}
            {...teamColorProps(team)}
            jerseyStyle={team.jerseyStyle}
            size={30}
          />
        )}
        <div className="min-w-0 flex-1">
          <FitText
            text={team?.name ?? "Unbekannter Verein"}
            className={`font-display text-base font-semibold leading-tight ${isMine ? "text-gold" : "text-ink"}`}
          />
          <p className="text-xs text-muted">
            {place === null
              ? `${row.activeFans} von ${CLUB_MIN_ACTIVE_FANS} aktiven Fans`
              : `${row.activeFans} aktive Fans`}
            {isMine ? " · dein Verein" : ""}
          </p>
        </div>
      </div>
      <span className="shrink-0 font-display text-base font-semibold text-ink">
        {place === null ? "–" : row.score.toLocaleString("de-DE")}
      </span>
    </div>
  );
}
