"use client";

import { JerseyVariant, MatchJersey, Team } from "@/lib/types";
import TeamBadge, { jerseyFor, teamColorProps } from "@/components/TeamBadge";

// Trikot-Auswahl beim Spiel anlegen/bearbeiten (nicht bei NFL): nur die zwei
// Trikots, die beim Team angelegt sind – Heimtrikot und Auswärtstrikot, je in
// dem Stil, der beim Team eingestellt ist (Rene, 09.10.2026: nicht alle
// Stil-Varianten zur Auswahl).
function teamJersey(team: Team, variant: JerseyVariant): MatchJersey {
  return jerseyFor(team, { variant, style: "solid" });
}

const OPTIONS: { variant: JerseyVariant; label: string }[] = [
  { variant: "heim", label: "Heimtrikot" },
  { variant: "auswaerts", label: "Auswärtstrikot" },
];

export default function JerseyPicker({
  team,
  value,
  onChange,
}: {
  team: Team;
  value: MatchJersey;
  onChange: (jersey: MatchJersey) => void;
}) {
  // Nationalteams zeigen die Flagge, Football immer den Helm: nichts zu wählen.
  if (team.isNationalTeam || team.sport === "NFL") return null;
  return (
    <div className="mt-2 rounded-lg border border-edge bg-pitch p-2.5">
      <p className="mb-2 text-xs text-muted">Trikot in diesem Spiel</p>
      <div className="grid grid-cols-2 gap-1.5">
        {OPTIONS.map((opt) => {
          const jersey = teamJersey(team, opt.variant);
          // Nur nach Heim/Auswärts markieren, damit auch ältere Spiele (mit
          // einem anderen Stil gespeichert) richtig angezeigt werden.
          const active = value.variant === opt.variant;
          return (
            <button
              key={opt.variant}
              type="button"
              onClick={() => onChange(jersey)}
              aria-pressed={active}
              className={`flex flex-col items-center gap-1 rounded-lg border px-1 py-2 transition-colors ${
                active ? "border-gold bg-gold/10" : "border-edge hover:border-muted"
              }`}
            >
              <TeamBadge
                sport={team.sport}
                {...teamColorProps(team)}
                jerseyStyle={jersey.style}
                variant={jersey.variant}
                size={44}
              />
              <span className={`text-center text-xs leading-tight ${active ? "font-semibold text-gold" : "text-muted"}`}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
