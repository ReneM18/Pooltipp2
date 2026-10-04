"use client";

import { JERSEY_STYLES, JerseyVariant, MatchJersey, Team } from "@/lib/types";
import TeamBadge from "@/components/TeamBadge";

const ROWS: { variant: JerseyVariant; label: string }[] = [
  { variant: "heim", label: "Heimtrikot" },
  { variant: "auswaerts", label: "Auswärtstrikot" },
];

// Trikot-Auswahl beim Spiel anlegen/bearbeiten: alle 6 Trikots des Teams
// (Heim/Auswärts in den 3 Stilen) als Bild zum Antippen.
export default function JerseyPicker({
  team,
  value,
  onChange,
}: {
  team: Team;
  value: MatchJersey;
  onChange: (jersey: MatchJersey) => void;
}) {
  if (team.isNationalTeam) return null;
  return (
    <div className="mt-2 rounded-lg border border-edge bg-pitch p-2.5">
      <p className="mb-2 text-xs text-muted">Trikot in diesem Spiel</p>
      {ROWS.map((row) => (
        <div key={row.variant} className="mb-2 last:mb-0">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{row.label}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {JERSEY_STYLES.map((st) => {
              const active = value.variant === row.variant && value.style === st.value;
              return (
                <button
                  key={st.value}
                  type="button"
                  onClick={() => onChange({ variant: row.variant, style: st.value })}
                  aria-pressed={active}
                  className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-1.5 transition-colors ${
                    active ? "border-gold bg-gold/10" : "border-edge hover:border-muted"
                  }`}
                >
                  <TeamBadge
                    sport={team.sport}
                    primaryColor={team.primaryColor}
                    secondaryColor={team.secondaryColor}
                    jerseyStyle={st.value}
                    variant={row.variant}
                    size={36}
                  />
                  <span className={`text-center text-[11px] leading-tight ${active ? "font-semibold text-gold" : "text-muted"}`}>
                    {st.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
