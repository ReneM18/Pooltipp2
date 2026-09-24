"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { League, LeagueMatch, LeagueTip, ScoringMode } from "./teamsTypes";
import { useUser } from "./UserContext";

function generateCode(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const demoLeagueId = "league-demo";

const initialLeagues: League[] = [
  {
    id: demoLeagueId,
    name: "Büro-Tipprunde",
    description: "Interne Tipprunde fürs Team",
    code: "BUERO1",
    scoringMode: "ergebnis",
    members: ["Alex", "Sabine K.", "Marco T."],
    creator: "Alex",
  },
];

const initialMatches: LeagueMatch[] = [
  {
    id: "lm-1",
    leagueId: demoLeagueId,
    title: "FC Bayern vs Borussia Dortmund",
    kickoff: "2026-09-20T15:30:00+02:00",
    status: "upcoming",
    finalHomeScore: null,
    finalAwayScore: null,
  },
];

interface TeamsContextValue {
  leagues: League[];
  matches: LeagueMatch[];
  tips: LeagueTip[];
  createLeague: (name: string, description: string, scoringMode: ScoringMode) => League;
  joinLeague: (code: string) => League | null;
  addMatch: (leagueId: string, title: string, kickoff: string) => void;
  setFinalScore: (matchId: string, homeScore: number, awayScore: number) => void;
  submitTip: (leagueId: string, matchId: string, homeScore: number, awayScore: number) => void;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { displayName } = useUser();
  const [leagues, setLeagues] = useState<League[]>(initialLeagues);
  const [matches, setMatches] = useState<LeagueMatch[]>(initialMatches);
  const [tips, setTips] = useState<LeagueTip[]>([]);

  function createLeague(name: string, description: string, scoringMode: ScoringMode) {
    const league: League = {
      id: `league-${Date.now()}`,
      name,
      description,
      code: generateCode(),
      scoringMode,
      members: [displayName],
      creator: displayName,
    };
    setLeagues((current) => [...current, league]);
    return league;
  }

  function joinLeague(code: string) {
    const league = leagues.find((l) => l.code.toUpperCase() === code.trim().toUpperCase());
    if (!league) return null;
    setLeagues((current) =>
      current.map((l) =>
        l.id === league.id && !l.members.includes(displayName)
          ? { ...l, members: [...l.members, displayName] }
          : l
      )
    );
    return league;
  }

  function addMatch(leagueId: string, title: string, kickoff: string) {
    setMatches((current) => [
      ...current,
      {
        id: `lm-${Date.now()}`,
        leagueId,
        title,
        kickoff,
        status: "upcoming",
        finalHomeScore: null,
        finalAwayScore: null,
      },
    ]);
  }

  function setFinalScore(matchId: string, homeScore: number, awayScore: number) {
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId
          ? { ...m, finalHomeScore: homeScore, finalAwayScore: awayScore, status: "finished" }
          : m
      )
    );
  }

  function submitTip(leagueId: string, matchId: string, homeScore: number, awayScore: number) {
    setTips((current) => [
      ...current,
      {
        id: `ltip-${Date.now()}`,
        leagueId,
        matchId,
        author: displayName,
        predictedHomeScore: homeScore,
        predictedAwayScore: awayScore,
      },
    ]);
  }

  return (
    <TeamsContext.Provider
      value={{ leagues, matches, tips, createLeague, joinLeague, addMatch, setFinalScore, submitTip }}
    >
      {children}
    </TeamsContext.Provider>
  );
}

export function useTeams() {
  const context = useContext(TeamsContext);
  if (!context) {
    throw new Error("useTeams muss innerhalb von <TeamsProvider> verwendet werden");
  }
  return context;
}
