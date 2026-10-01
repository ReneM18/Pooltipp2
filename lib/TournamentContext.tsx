"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { Tournament } from "./tournamentTypes";
import { useAppData } from "./AppDataContext";

// Demo-Turnier, das die aktuell angelegten Spiele bündelt, damit der
// Turnier-Bereich nach dem ersten Deploy nicht komplett leer ist. Admin kann
// es jederzeit bearbeiten oder löschen wie jedes andere Turnier auch. Läuft
// (wie Teams/Spiele/News) über Supabase: für alle User sichtbar, nur vom
// Admin-Account änderbar (siehe supabase/social-features.sql).
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
  const [loaded, setLoaded] = useState(false);

  // Beim ersten Laden aus Supabase übernehmen (ersetzt die lokalen
  // Demo-Daten durch den echten, von allen Usern geteilten Stand – auch wenn
  // er leer ist). Schlägt das fehl, bleiben die Demo-Daten nur zur Anzeige
  // stehen und werden nicht zurückgeschrieben (sonst würden sie beim Admin
  // die echten Turniere in der Datenbank überschreiben).
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
