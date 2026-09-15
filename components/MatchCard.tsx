"use client";

import { useState } from "react";
import { Match, Team } from "@/lib/types";
import { flagEmoji } from "@/lib/flags";
import TeamBadge from "./TeamBadge";

const sportIcon: Record<string, string> = {
  "Fußball": "⚽",
  NFL: "🏈",
  NBA: "🏀",
};

interface MatchCardProps {
  match: Match;
  homeTeam: Team;
  awayTeam: Team;
  maxStake: number;
  onSubmitTip: (stake: number) => void;
}

export default function MatchCard({
  match,
  homeTeam,
  awayTeam,
  maxStake,
  onSubmitTip,
}: MatchCardProps) {
  const [homeScore, setHomeScore] = useState<number>(0);
  const [awayScore, setAwayScore] = useState<number>(0);
  const [stake, setStake] = useState<number>(Math.min(20, maxStake));
  const [submitted, setSubmitted] = useState(false);

  const kickoffLabel = new Date(match.kickoff).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  function handleSubmit() {
    onSubmitTip(stake);
    setSubmitted(true);
  }

  return (
    <div className="rounded-card border border-edge bg-surface p-5">
      <div className="mb-4 flex items-center justify-between text-sm text-muted">
        <span className="flex items-center gap-2">
          <span>{flagEmoji(homeTeam.countryCode)}</span>
          <span>
            {sportIcon[match.sport] ?? ""} {match.competition}
            {match.matchday ? ` · Spieltag ${match.matchday}` : ""}
          </span>
        </span>
        <span>{kickoffLabel}</span>
      </div>

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
          disabled={submitted}
          label={`Tor-Ergebnis ${homeTeam.name}`}
        />
        <span className="font-display text-xl text-muted">:</span>
        <ScoreInput
          value={awayScore}
          onChange={setAwayScore}
          disabled={submitted}
          label={`Tor-Ergebnis ${awayTeam.name}`}
        />
      </div>

      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="text-muted">Einsatz</span>
          <span className="font-display font-semibold text-gold">
            ⭐ {stake.toLocaleString("de-DE")}
          </span>
        </div>
        <input
          type="range"
          className="stake-slider w-full"
          min={1}
          max={maxStake}
          value={stake}
          disabled={submitted}
          onChange={(e) => setStake(Number(e.target.value))}
          aria-label="Einsatz in Sternen"
        />
        <div className="mt-1 flex justify-between text-xs text-muted">
          <span>1</span>
          <span>{maxStake.toLocaleString("de-DE")} max.</span>
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={submitted}
        className="w-full rounded-full bg-action py-2.5 font-display font-semibold tracking-wide text-base text-pitch transition-colors enabled:hover:bg-action-hover disabled:cursor-not-allowed disabled:bg-edge disabled:text-muted"
      >
        {submitted ? "Tipp abgegeben" : "Tipp abgeben"}
      </button>
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
