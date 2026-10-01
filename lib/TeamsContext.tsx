"use client";

// Private Tipprunden – echt in Supabase gespeichert (siehe
// supabase/tipprunden.sql). Vorher lebten Tipprunden nur im Browser der
// Person, die sie angelegt hat; niemand sonst konnte mit dem Code beitreten.
//
// Alles Wichtige prüft die Datenbank selbst: Runden sehen nur Mitglieder,
// Spiele/Endstände ändert nur der Gründer, Tippen geht nur bis Anpfiff und
// die Liga-Punkte rechnet league_leaderboard() – die App zeigt nur an.

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useUser } from "./UserContext";
import { League, LeagueMatch, LeagueMember, LeagueTip, ScoringMode } from "./teamsTypes";

export interface TeamsResult {
  ok: boolean;
  error?: string;
}

interface TeamsContextValue {
  // Alle Tipprunden, in denen der eingeloggte Account Mitglied ist.
  leagues: League[];
  // false, solange die eigenen Tipprunden noch laden.
  leaguesLoaded: boolean;
  // Fehlermeldung beim Laden (z. B. SQL noch nicht ausgeführt), sonst null.
  loadError: string | null;
  refreshLeagues: () => Promise<void>;
  createLeague: (
    name: string,
    description: string,
    scoringMode: ScoringMode
  ) => Promise<TeamsResult & { leagueId?: string }>;
  joinLeague: (code: string) => Promise<TeamsResult & { leagueId?: string }>;
  updateLeague: (leagueId: string, name: string, description: string) => Promise<TeamsResult>;
  removeMember: (leagueId: string, userId: string) => Promise<TeamsResult>;
  leaveLeague: (leagueId: string) => Promise<TeamsResult>;
  deleteLeague: (leagueId: string) => Promise<TeamsResult>;
  addMatch: (leagueId: string, title: string, kickoff: string) => Promise<TeamsResult>;
  updateMatch: (matchId: string, title: string, kickoff: string) => Promise<TeamsResult>;
  removeMatch: (matchId: string) => Promise<TeamsResult>;
  setFinalScore: (matchId: string, homeScore: number, awayScore: number) => Promise<TeamsResult>;
  submitTip: (matchId: string, homeScore: number, awayScore: number) => Promise<TeamsResult>;
}

const TeamsContext = createContext<TeamsContextValue | null>(null);

// Übersetzt Datenbank-Fehler in Sätze, mit denen ein Spieler etwas anfangen
// kann. Fehlt die Tabelle/Funktion ganz, ist supabase/tipprunden.sql noch
// nicht ausgeführt.
export function friendlyTeamsError(error: { code?: string; message?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (error?.code === "42P01" || error?.code === "PGRST202" || error?.code === "PGRST205" || error?.code === "42883") {
    return "Tipprunden sind in der Datenbank noch nicht eingerichtet (supabase/tipprunden.sql ausführen).";
  }
  if (message.includes("Tippschluss")) return "Tippschluss ist vorbei – das Spiel hat schon begonnen.";
  if (message.includes("Nicht eingeloggt")) return "Bitte logge dich zuerst ein.";
  if (message.includes("Spiel nicht gefunden")) return "Dieses Spiel gibt es nicht mehr.";
  return "Das hat nicht geklappt. Bitte versuch es gleich noch einmal.";
}

function mapLeague(row: Record<string, unknown>): League {
  const members = row.league_members as { count: number }[] | undefined;
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    code: row.code as string,
    scoringMode: row.scoring_mode as ScoringMode,
    creatorId: row.creator_id as string,
    memberCount: members?.[0]?.count ?? 1,
  };
}

function mapMatch(row: Record<string, unknown>): LeagueMatch {
  const finalHome = row.final_home as number | null;
  const finalAway = row.final_away as number | null;
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    title: row.title as string,
    kickoff: row.kickoff as string,
    status: finalHome !== null && finalAway !== null ? "finished" : "upcoming",
    finalHomeScore: finalHome,
    finalAwayScore: finalAway,
  };
}

function mapTip(row: Record<string, unknown>): LeagueTip {
  return {
    id: row.id as string,
    leagueId: row.league_id as string,
    matchId: row.match_id as string,
    userId: row.user_id as string,
    predictedHomeScore: row.home as number,
    predictedAwayScore: row.away as number,
  };
}

function mapMember(row: Record<string, unknown>): LeagueMember {
  return {
    userId: row.user_id as string,
    displayName: (row.display_name as string) ?? "Spieler",
    points: (row.points as number) ?? 0,
    exactTips: (row.exact_tips as number) ?? 0,
    scoredTips: (row.scored_tips as number) ?? 0,
    isCreator: row.is_creator === true,
  };
}

export function TeamsProvider({ children }: { children: ReactNode }) {
  const { authUserId, adminChecked } = useUser();
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leaguesLoaded, setLeaguesLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshLeagues = useCallback(async () => {
    if (!authUserId) {
      setLeagues([]);
      setLoadError(null);
      setLeaguesLoaded(adminChecked);
      return;
    }
    const { data, error } = await supabase
      .from("leagues")
      .select("*, league_members(count)")
      .order("created_at", { ascending: true });
    if (error) {
      console.warn("Tipprunden konnten nicht geladen werden:", error.message);
      setLoadError(friendlyTeamsError(error));
    } else {
      setLeagues((data ?? []).map(mapLeague));
      setLoadError(null);
    }
    setLeaguesLoaded(true);
  }, [authUserId, adminChecked]);

  useEffect(() => {
    refreshLeagues();
  }, [refreshLeagues]);

  async function createLeague(name: string, description: string, scoringMode: ScoringMode) {
    if (!authUserId) return { ok: false, error: "Bitte logge dich zuerst ein." };
    const { data, error } = await supabase.rpc("create_league", {
      p_name: name,
      p_description: description,
      p_scoring_mode: scoringMode,
    });
    if (error || !data) return { ok: false, error: friendlyTeamsError(error) };
    await refreshLeagues();
    return { ok: true, leagueId: (data as { id: string }).id };
  }

  async function joinLeague(code: string) {
    if (!authUserId) return { ok: false, error: "Bitte logge dich zuerst ein." };
    const cleaned = code.replace(/\s/g, "").toUpperCase();
    if (!cleaned) return { ok: false, error: "Bitte gib einen Code ein." };
    const { data, error } = await supabase.rpc("join_league", { p_code: cleaned });
    if (error) return { ok: false, error: friendlyTeamsError(error) };
    if (!data) return { ok: false, error: "Keine Tipprunde mit diesem Code gefunden." };
    await refreshLeagues();
    return { ok: true, leagueId: data as string };
  }

  async function updateLeague(leagueId: string, name: string, description: string) {
    const { error } = await supabase.from("leagues").update({ name, description }).eq("id", leagueId);
    if (error) return { ok: false, error: friendlyTeamsError(error) };
    await refreshLeagues();
    return { ok: true };
  }

  async function removeMember(leagueId: string, userId: string) {
    const { error } = await supabase
      .from("league_members")
      .delete()
      .eq("league_id", leagueId)
      .eq("user_id", userId);
    if (error) return { ok: false, error: friendlyTeamsError(error) };
    await refreshLeagues();
    return { ok: true };
  }

  // Nicht-Gründer verlassen die Tipprunde einfach; der Gründer selbst löscht
  // sie stattdessen komplett (siehe deleteLeague), damit es immer klar ist,
  // wer eine Tipprunde verwalten darf.
  async function leaveLeague(leagueId: string) {
    if (!authUserId) return { ok: false, error: "Bitte logge dich zuerst ein." };
    return removeMember(leagueId, authUserId);
  }

  // Löscht die Runde für alle; Mitglieder, Spiele und Tipps verschwinden in
  // der Datenbank automatisch mit.
  async function deleteLeague(leagueId: string) {
    const { error } = await supabase.from("leagues").delete().eq("id", leagueId);
    if (error) return { ok: false, error: friendlyTeamsError(error) };
    setLeagues((current) => current.filter((l) => l.id !== leagueId));
    return { ok: true };
  }

  async function addMatch(leagueId: string, title: string, kickoff: string) {
    const { error } = await supabase.from("league_matches").insert({ league_id: leagueId, title, kickoff });
    return error ? { ok: false, error: friendlyTeamsError(error) } : { ok: true };
  }

  async function updateMatch(matchId: string, title: string, kickoff: string) {
    const { error } = await supabase.from("league_matches").update({ title, kickoff }).eq("id", matchId);
    return error ? { ok: false, error: friendlyTeamsError(error) } : { ok: true };
  }

  async function removeMatch(matchId: string) {
    const { error } = await supabase.from("league_matches").delete().eq("id", matchId);
    return error ? { ok: false, error: friendlyTeamsError(error) } : { ok: true };
  }

  async function setFinalScore(matchId: string, homeScore: number, awayScore: number) {
    const { error } = await supabase
      .from("league_matches")
      .update({ final_home: homeScore, final_away: awayScore })
      .eq("id", matchId);
    return error ? { ok: false, error: friendlyTeamsError(error) } : { ok: true };
  }

  async function submitTip(matchId: string, homeScore: number, awayScore: number) {
    const { error } = await supabase.rpc("submit_league_tip", {
      p_match_id: matchId,
      p_home: homeScore,
      p_away: awayScore,
    });
    return error ? { ok: false, error: friendlyTeamsError(error) } : { ok: true };
  }

  return (
    <TeamsContext.Provider
      value={{
        leagues,
        leaguesLoaded,
        loadError,
        refreshLeagues,
        createLeague,
        joinLeague,
        updateLeague,
        removeMember,
        leaveLeague,
        deleteLeague,
        addMatch,
        updateMatch,
        removeMatch,
        setFinalScore,
        submitTip,
      }}
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

// Spiele, Tipps und Rangliste EINER Tipprunde. Wird auf der Detailseite
// beim Öffnen geladen und nach jeder Aktion über reload() neu geholt.
export function useLeagueDetail(leagueId: string | undefined) {
  const { authUserId } = useUser();
  const [matches, setMatches] = useState<LeagueMatch[]>([]);
  const [tips, setTips] = useState<LeagueTip[]>([]);
  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(async () => {
    if (!leagueId || !authUserId) return;
    const [matchesRes, tipsRes, membersRes] = await Promise.all([
      supabase.from("league_matches").select("*").eq("league_id", leagueId).order("kickoff", { ascending: true }),
      supabase.from("league_tips").select("*").eq("league_id", leagueId),
      supabase.rpc("league_leaderboard", { p_league_id: leagueId }),
    ]);
    if (matchesRes.error) console.warn("Runden-Spiele:", matchesRes.error.message);
    else setMatches((matchesRes.data ?? []).map(mapMatch));
    if (tipsRes.error) console.warn("Runden-Tipps:", tipsRes.error.message);
    else setTips((tipsRes.data ?? []).map(mapTip));
    if (membersRes.error) console.warn("Runden-Rangliste:", membersRes.error.message);
    else setMembers(((membersRes.data as Record<string, unknown>[]) ?? []).map(mapMember));
    setLoaded(true);
  }, [leagueId, authUserId]);

  useEffect(() => {
    setLoaded(false);
    reload();
  }, [reload]);

  return { matches, tips, members, loaded, reload };
}
