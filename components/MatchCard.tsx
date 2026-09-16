"use client";

import { useEffect, useState } from "react";
import { Match, Team } from "@/lib/types";
import { flagEmoji } from "@/lib/flags";
import TeamBadge from "./TeamBadge";
import Countdown from "./Countdown";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
};

interface MatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  tipCount: number;
  onSubmitTip: (homeScore: number, awayScore: number) => void;
}

export default function MatchCard({
  match,
  homeTeam,
  awayTeam,
  tipCount,
  onSubmitTip,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [submitted, setSubmitted] = useState(false);
  const [tippingClosed, setTippingClosed] = useState(
    () => new Date(match.tipDeadline).getTime() <= Date.now()
  );

  useEffect(() => {
    const deadline = new Date(match.tipDeadline).getTime();
    const interval = setInterval(() => {
      setTippingClosed(deadline <= Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [match.tipDeadline]);

  const kickoffLabel = new Date(match.kickoff).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const disabled = submitted || tippingClosed;

  function handleSubmit() {
    onSubmitTip(homeScore, awayScore);
    setSubmitted(true);
  }

  return (
    <div className="overflow-hidden rounded-card border border-edge bg-surface">
      {/* Sport-Banner */}
      <div className="flex items-center justify-between bg-gradient-to-r from-surface-hover to-surface px-5 py-2.5">
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          <span className="text-lg">{sportIcon[match.sport] ?? ""}</span>
          <span>{flagEmoji(homeTeam.countryCode)}</span>
          <span>
            {match.competition}
            {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
          </span>
        </span>
        <span className="text-xs font-medium">
          <Countdown kickoff={match.tipDeadline} />
        </span>
      </div>

      <div className="p-5">
        <div className="mb-1 text-center text-xs text-muted">{kickoffLabel}</div>

        <div className="mb-5 flex items-center justify-center gap-4">
          <div className="flex flex-row-reverse items-center gap-2">
            <TeamBadge
              sport={match.sport}
              primaryColor={homeTeam.primaryColor}
              secondaryColor={homeTeam.secondaryColor}
              jerseyStyle={homeTeam.jerseyStyle}
              size={30}
            />
            <TeamLabel name={homeTeam.name} align="right" />
          </div>
          <span className="font-display text-sm text-muted">vs</span>
          <div className="flex items-center gap-2">
            <TeamBadge
              sport={match.sport}
              primaryColor={awayTeam.primaryColor}
              secondaryColor={awayTeam.secondaryColor}
              jerseyStyle={awayTeam.jerseyStyle}
              size={30}
            />
            <TeamLabel name={awayTeam.name} align="left" />
          </div>
        </div>

        <div className="mb-5 flex items-center justify-center gap-3">
          <ScoreInput
            value={homeScore}
            onChange={setHomeScore}
            disabled={disabled}
            label={`Tor-Ergebnis ${homeTeam.name}`}
          />
          <span className="font-display text-xl text-muted">:</span>
          <ScoreInput
            value={awayScore}
            onChange={setAwayScore}
            disabled={disabled}
            label={`Tor-Ergebnis ${awayTeam.name}`}
          />
        </div>

        <div className="mb-5 flex items-center justify-between rounded-lg border border-edge bg-pitch px-4 py-2.5">
          <span className="text-sm text-muted">Einsatz für dieses Spiel</span>
          <span className="font-display font-semibold text-gold">
            ⭐ {match.fixedStake.toLocaleString("de-DE")}
          </span>
        </div>

        <button
          onClick={handleSubmit}
          disabled={disabled}
          className="w-full rounded-full bg-action py-2.5 font-display font-semibold tracking-wide text-base text-pitch shadow-[0_0_20px_rgba(63,166,107,0.35)] transition-all enabled:hover:bg-action-hover enabled:hover:shadow-[0_0_28px_rgba(63,166,107,0.5)] disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted disabled:shadow-none"
        >
          {submitted ? "Tipp abgegeben" : tippingClosed ? "Tippannahme geschlossen" : "Tipp abgeben"}
        </button>

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span className="flex items-center gap-1">
            <PeopleIcon className="h-3.5 w-3.5" />
            {tipCount.toLocaleString("de-DE")} getippt
          </span>
          {submitted && <span className="font-semibold text-action">✓ Getippt</span>}
        </div>
      </div>
    </div>
  );
}

function TeamLabel({ name, align }: { name: string; align: "left" | "right" }) {
  return (
    <span
      className={`font-display text-lg font-semibold text-ink ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {name}
    </span>
  );
}

function ScoreInput({
  value,
  onChange,
  disabled,
  label,
}: {
  value: number;
  onChange: (value: number) => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      max={20}
      value={value}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
      className="h-12 w-14 rounded-lg border border-edge bg-pitch text-center font-display text-xl font-semibold text-ink outline-none focus:border-gold disabled:opacity-60"
    />
  );
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3,20 C3,16 5.5,14 9,14 C12.5,14 15,16 15,20" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15,20 C15,17 16.5,15.2 19,15.2 C21,15.2 21.5,16.5 21.5,18" />
    </svg>
  );
}
