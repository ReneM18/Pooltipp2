"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { Tournament } from "./tournamentTypes";
import { useAppData } from "./AppDataContext";

// Demo-Turnier, das die aktuell angelegten Spiele bündelt, damit der
// Turnier-Bereich nach dem ersten Deploy nicht komplett leer ist. Admin kann
// es jederzeit bearbeiten oder löschen wie jedes andere Turnier auch.
const demoTournamentId = "tournament-demo";
const initialTournaments: Tournament[] = [
  {
    id: demoTournamentId,
    name: "Spieltag-Spezial",
    description: "Alle aktuell angelegten Spiele in einem Turnier gebündelt – als Beispiel.",
    icon: "🏆",
    startDate: "2026-09-15T00:00:00+02:00",
    endDate: "2026-10-15T00:00:00+02:00",
    matchIds: ["match-1", "match-2", "match-3", "match-4", "match-5", "match-6", "match-7", "match-8"],
    createdAt: "2026-09-15T00:00:00+02:00",
  },
];

interface TournamentContextValue {
  tournaments: Tournament[];
  createTournament: (
    name: string,
    description: string,
    icon: string,
    startDate: string,
    endDate: string
  ) => Tournament;
  updateTournament: (
    id: string,
    name: string,
    description: string,
    icon: string,
    startDate: string,
    endDate: string
  ) => void;
  setTournamentMatches: (id: string, matchIds: string[]) => void;
  removeTournament: (id: string) => void;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: ReactNode }) {
  const { addActivity } = useAppData();
  const [tournaments, setTournaments] = useState<Tournament[]>(initialTournaments);

  function createTournament(
    name: string,
    description: string,
    icon: string,
    startDate: string,
    endDate: string
  ): Tournament {
    const tournament: Tournament = {
      id: `tournament-${Date.now()}`,
      name,
      description,
      icon,
      startDate,
      endDate,
      matchIds: [],
      createdAt: new Date().toISOString(),
    };
    setTournaments((current) => [...current, tournament]);
    addActivity(icon || "🏆", `Neues Turnier gestartet: ${name}.`);
    return tournament;
  }

  function updateTournament(
    id: string,
    name: string,
    description: string,
    icon: string,
    startDate: string,
    endDate: string
  ) {
    setTournaments((current) =>
      current.map((t) => (t.id === id ? { ...t, name, description, icon, startDate, endDate } : t))
    );
  }

  function setTournamentMatches(id: string, matchIds: string[]) {
    setTournaments((current) => current.map((t) => (t.id === id ? { ...t, matchIds } : t)));
  }

  function removeTournament(id: string) {
    setTournaments((current) => current.filter((t) => t.id !== id));
  }

  return (
    <TournamentContext.Provider
      value={{ tournaments, createTournament, updateTournament, setTournamentMatches, removeTournament }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournaments() {
  const context = useContext(TournamentContext);
  if (!context) {
    throw new Error("useTournaments muss innerhalb von <TournamentProvider> verwendet werden");
  }
  return context;
}
