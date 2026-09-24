"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Match, Sport, Team } from "./types";

export interface SubmittedTip {
  id: string;
  matchId: string;
  predictedHomeScore: number;
  predictedAwayScore: number;
  stake: number;
  submittedAt: string;
}

// Hinweis: Diese Daten leben nur im Browser-Speicher (React-State) und
// gehen beim Neuladen der Seite verloren. Das ist bewusst so für dieses
// MVP-Stadium — sobald Firestore angebunden ist, ersetzt das hier die
// initialTeams/initialMatches durch echte Datenbank-Abfragen.

const initialTeams: Team[] = [
  { id: "team-fcb", name: "Bayern München", sport: "Fußball", countryCode: "DE", primaryColor: "#DC052D", secondaryColor: "#FFFFFF", jerseyStyle: "solid" },
  { id: "team-bvb", name: "Borussia Dortmund", sport: "Fußball", countryCode: "DE", primaryColor: "#FDE100", secondaryColor: "#000000", jerseyStyle: "streifen" },
  { id: "team-rbl", name: "RB Leipzig", sport: "Fußball", countryCode: "DE", primaryColor: "#DD0741", secondaryColor: "#FFFFFF", jerseyStyle: "solid" },
  { id: "team-b04", name: "Bayer Leverkusen", sport: "Fußball", countryCode: "DE", primaryColor: "#E32221", secondaryColor: "#000000", jerseyStyle: "aermel" },
  { id: "team-sge", name: "Eintracht Frankfurt", sport: "Fußball", countryCode: "DE", primaryColor: "#E1000F", secondaryColor: "#000000", jerseyStyle: "solid" },
  { id: "team-vfb", name: "VfB Stuttgart", sport: "Fußball", countryCode: "DE", primaryColor: "#FFFFFF", secondaryColor: "#E32219", jerseyStyle: "aermel" },
  { id: "team-bills", name: "Buffalo Bills", sport: "NFL", countryCode: "US", primaryColor: "#00338D", secondaryColor: "#C60C30" },
  { id: "team-chiefs", name: "Kansas City Chiefs", sport: "NFL", countryCode: "US", primaryColor: "#E31837", secondaryColor: "#FFB81C" },
  { id: "team-bulls", name: "Chicago Bulls", sport: "NBA", countryCode: "US", primaryColor: "#CE1141", secondaryColor: "#000000", jerseyStyle: "solid" },
  { id: "team-knicks", name: "New York Knicks", sport: "NBA", countryCode: "US", primaryColor: "#006BB6", secondaryColor: "#F58426", jerseyStyle: "aermel" },
  { id: "team-bruins", name: "Boston Bruins", sport: "NHL", countryCode: "US", primaryColor: "#FFB81C", secondaryColor: "#000000" },
  { id: "team-rangers", name: "New York Rangers", sport: "NHL", countryCode: "US", primaryColor: "#0038A8", secondaryColor: "#CE1126" },
];

const initialMatches: Match[] = [
  {
    id: "match-1",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-09-20T15:30:00+02:00",
    tipDeadline: "2026-09-20T15:00:00+02:00",
    homeTeamId: "team-fcb",
    awayTeamId: "team-bvb",
    fixedStake: 20,
    status: "finished",
    liveHomeScore: 2,
    liveAwayScore: 1,
    summaryVideoUrl: "https://www.youtube.com/results?search_query=bayern+dortmund+highlights",
    tvChannel: "Sky Sport Bundesliga",
  },
  {
    id: "match-2",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-09-20T18:30:00+02:00",
    tipDeadline: "2026-09-20T18:00:00+02:00",
    homeTeamId: "team-rbl",
    awayTeamId: "team-b04",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-3",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 7,
    kickoff: "2026-09-21T17:30:00+02:00",
    tipDeadline: "2026-09-21T17:00:00+02:00",
    homeTeamId: "team-sge",
    awayTeamId: "team-vfb",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-4",
    sport: "NFL",
    competition: "NFL",
    kickoff: "2026-09-21T19:00:00-04:00",
    tipDeadline: "2026-09-21T18:45:00-04:00",
    homeTeamId: "team-bills",
    awayTeamId: "team-chiefs",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-5",
    sport: "NBA",
    competition: "NBA",
    kickoff: "2026-09-22T20:00:00-04:00",
    tipDeadline: "2026-09-22T19:45:00-04:00",
    homeTeamId: "team-bulls",
    awayTeamId: "team-knicks",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-6",
    sport: "Fußball",
    competition: "Bundesliga",
    matchday: 8,
    kickoff: "2026-09-27T15:30:00+02:00",
    tipDeadline: "2026-09-27T15:00:00+02:00",
    homeTeamId: "team-b04",
    awayTeamId: "team-sge",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-7",
    sport: "NFL",
    competition: "NFL",
    kickoff: "2026-09-28T19:00:00-04:00",
    tipDeadline: "2026-09-28T18:45:00-04:00",
    homeTeamId: "team-chiefs",
    awayTeamId: "team-bills",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
  {
    id: "match-8",
    sport: "NHL",
    competition: "NHL",
    kickoff: "2026-09-29T19:30:00-04:00",
    tipDeadline: "2026-09-29T19:15:00-04:00",
    homeTeamId: "team-bruins",
    awayTeamId: "team-rangers",
    fixedStake: 20,
    status: "upcoming",
    liveHomeScore: null,
    liveAwayScore: null,
    summaryVideoUrl: null,
    tvChannel: null,
  },
];

interface AppDataContextValue {
  teams: Team[];
  matches: Match[];
  addTeam: (team: Omit<Team, "id">) => void;
  removeTeam: (id: string) => void;
  addMatch: (match: Omit<Match, "id">) => void;
  removeMatch: (id: string) => void;
  getTeam: (id: string) => Team | undefined;
  tipCounts: Record<string, number>;
  registerTip: (matchId: string) => void;
  tipsBySport: Record<Sport, number>;
  myTips: SubmittedTip[];
  submitTip: (matchId: string, predictedHomeScore: number, predictedAwayScore: number, stake: number) => void;
  updateMatchScore: (matchId: string, homeScore: number | null, awayScore: number | null, status: Match["status"]) => void;
  setSummaryVideo: (matchId: string, url: string) => void;
  setTvChannel: (matchId: string, channel: string) => void;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [teams, setTeams] = useState<Team[]>(initialTeams);
  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [tipCounts, setTipCounts] = useState<Record<string, number>>({
    "match-1": 128,
    "match-2": 94,
    "match-3": 61,
  });
  const [tipsBySport, setTipsBySport] = useState<Record<Sport, number>>({
    "Fußball": 0,
    NFL: 0,
    NBA: 0,
    NHL: 0,
  });
  const [myTips, setMyTips] = useState<SubmittedTip[]>([]);

  function addTeam(team: Omit<Team, "id">) {
    const id = `team-${Date.now()}`;
    setTeams((current) => [...current, { ...team, id }]);
  }

  function removeTeam(id: string) {
    setTeams((current) => current.filter((t) => t.id !== id));
  }

  function addMatch(match: Omit<Match, "id">) {
    const id = `match-${Date.now()}`;
    setMatches((current) => [...current, { ...match, id }]);
  }

  function removeMatch(id: string) {
    setMatches((current) => current.filter((m) => m.id !== id));
  }

  function getTeam(id: string) {
    return teams.find((t) => t.id === id);
  }

  function registerTip(matchId: string) {
    setTipCounts((current) => ({ ...current, [matchId]: (current[matchId] ?? 0) + 1 }));
    const match = matches.find((m) => m.id === matchId);
    if (match) {
      setTipsBySport((current) => ({ ...current, [match.sport]: current[match.sport] + 1 }));
    }
  }

  function submitTip(
    matchId: string,
    predictedHomeScore: number,
    predictedAwayScore: number,
    stake: number
  ) {
    registerTip(matchId);
    setMyTips((current) => [
      ...current,
      {
        id: `tip-${Date.now()}`,
        matchId,
        predictedHomeScore,
        predictedAwayScore,
        stake,
        submittedAt: new Date().toISOString(),
      },
    ]);
  }

  function updateMatchScore(
    matchId: string,
    homeScore: number | null,
    awayScore: number | null,
    status: Match["status"]
  ) {
    setMatches((current) =>
      current.map((m) =>
        m.id === matchId ? { ...m, liveHomeScore: homeScore, liveAwayScore: awayScore, status } : m
      )
    );
  }

  function setSummaryVideo(matchId: string, url: string) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, summaryVideoUrl: url } : m))
    );
  }

  function setTvChannel(matchId: string, channel: string) {
    setMatches((current) =>
      current.map((m) => (m.id === matchId ? { ...m, tvChannel: channel } : m))
    );
  }

  return (
    <AppDataContext.Provider
      value={{
        teams,
        matches,
        addTeam,
        removeTeam,
        addMatch,
        removeMatch,
        getTeam,
        tipCounts,
        registerTip,
        tipsBySport,
        myTips,
        submitTip,
        updateMatchScore,
        setSummaryVideo,
        setTvChannel,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData muss innerhalb von <AppDataProvider> verwendet werden");
  }
  return context;
}
