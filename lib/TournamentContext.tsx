"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { Tournament } from "./tournamentTypes";
import { useAppData } from "./AppDataContext";

// Turniere kommen nur aus der Datenbank (für alle User sichtbar, nur vom
// Admin-Account änderbar, siehe supabase/social-features.sql). Das frühere
// Demo-Turnier "Spieltag-Spezial … als Beispiel" gibt es nicht mehr.

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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Beim ersten Laden aus Supabase übernehmen. Schlägt das fehl, wird
  // nichts zurückgeschrieben (sonst würde beim Admin der leere Stand die
  // echten Turniere in der Datenbank überschreiben).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.from("tournaments").select("data");
      if (cancelled) return;
      if (error || !data) {
        console.warn("Turniere konnten nicht geladen werden:", error?.message);
        return;
      }
      setTournaments(data.map((row) => row.data as Tournament));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Schreibt den kompletten Turnier-Stand zurück, sobald sich etwas ändert
  // (nur der Admin-Account darf laut Datenbank-Regel wirklich schreiben).
  useEffect(() => {
    if (!loaded || tournaments.length === 0) return;
    supabase
      .from("tournaments")
      .upsert(
        tournaments.map((t) => ({ id: t.id, data: t, updated_at: new Date().toISOString() })),
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) console.warn("Turniere konnten nicht gespeichert werden:", error.message);
      });
  }, [tournaments, loaded]);

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
    const startText = `Neues Turnier gestartet: ${name}.`;
    addActivity(icon || "🏆", startText, { author: "PoolTipp", text: startText });
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
    supabase
      .from("tournaments")
      .delete()
      .eq("id", id)
      .then(({ error }) => {
        if (error) console.warn("Turnier konnte nicht gelöscht werden:", error.message);
      });
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
