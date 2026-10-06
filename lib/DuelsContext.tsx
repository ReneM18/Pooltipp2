"use client";

// Duelle mit 2 bis 5 ECHTEN Konten über 1 bis 10 Spiele (Coins-Einsatz).
// Ablauf: Einladen (eigener Einsatz ist sofort weg) -> Eingeladene nehmen an
// (ihr Einsatz ist weg) oder lehnen ab -> bis zum ersten Tippschluss kann
// der Ersteller zurückziehen (alle Einsätze zurück) -> sind alle Spiele
// vorbei, verteilt die Datenbank die Coins (supabase/duelle-gruppen.sql).
// Aus dem Browser heraus lässt sich kein Coins-Guthaben verändern.

import { createContext, useContext, useState, useEffect, useRef, ReactNode, useCallback } from "react";
import { useAppRefresh } from "./appRefresh";
import { supabase } from "./supabaseClient";
import { useAppData } from "./AppDataContext";
import { useUser } from "./UserContext";
import { useFeedback } from "./FeedbackContext";
import { Match } from "./types";
import {
  DEFAULT_DUEL_RULES,
  Duel,
  DuelGameResult,
  DuelPlayer,
  DuelPlayerStatus,
  DuelRules,
  DuelStatus,
} from "./duelTypes";

interface DuelActionResult {
  ok: boolean;
  error?: string;
}

export interface DuelInvitee {
  id: string;
  name: string;
}

interface DuelsContextValue {
  duels: Duel[];
  // Einladungen an DICH, auf die du noch antworten kannst.
  invitesForMe: Duel[];
  rules: DuelRules;
  acceptUntil: (duel: Duel) => number | null;
  findPlayer: (name: string) => Promise<{ player?: DuelInvitee; error?: string }>;
  createDuel: (invitees: DuelInvitee[], matchIds: string[], stake: number) => Promise<DuelActionResult & { stake?: number }>;
  acceptDuel: (duelId: string) => Promise<DuelActionResult>;
  declineDuel: (duelId: string) => Promise<DuelActionResult>;
  withdrawDuel: (duelId: string) => Promise<DuelActionResult>;
}

const DuelsContext = createContext<DuelsContextValue | null>(null);

// Meldungen der Datenbank, die schon ein verständlicher Satz sind.
const READABLE_ERRORS =
  /^(Einsatz|Höchstens|Du kannst|Lade|Mit .+ hast du|.+ kann noch keine Duelle|Tippschluss|Wähle|Gib|Gegner nicht|Nur |Duell ist nicht mehr|Spiel nicht gefunden|Nicht eingeloggt)/;

function duelErrorMessage(error: { message?: string }, fallback: string) {
  const message = (error.message ?? "").trim();
  if (/Nicht genug Sterne/.test(message)) return "Nicht genug Coins (oder Tageslimit für Duelle erreicht) für diesen Einsatz.";
  if (READABLE_ERRORS.test(message)) return /[.!?)]$/.test(message) ? message : `${message}.`;
  return fallback;
}

function mapGames(raw: unknown): DuelGameResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((g: Record<string, unknown>) => ({
    matchId: g.m as string,
    tier: (g.tier as DuelGameResult["tier"]) ?? undefined,
    points: (g.pts as number | undefined) ?? undefined,
    tip: (g.tip as string | null | undefined) ?? null,
    cancelled: g.abgesagt === true,
  }));
}

function mapPlayer(row: Record<string, unknown>): DuelPlayer {
  return {
    userId: row.user_id as string,
    name: row.display_name as string,
    isCreator: row.is_creator as boolean,
    status: row.status as DuelPlayerStatus,
    points: (row.points as number | null) ?? undefined,
    place: (row.place as number | null) ?? undefined,
    payout: (row.payout as number | null) ?? undefined,
    capped: (row.capped as number | null) ?? undefined,
    games: mapGames(row.game_results),
  };
}

// Ohne supabase/duelle-gruppen.sql (alte Datenbank): Spieler aus dem Duell
// selbst ableiten, damit die Seite trotzdem etwas zeigt.
function legacyPlayers(row: Record<string, unknown>): DuelPlayer[] {
  const status = row.status as string;
  const result = row.result as string | null;
  const stake = row.stake as number;
  const credited = (row.stars_credited as number | null) ?? undefined;
  const players: DuelPlayer[] = [
    {
      userId: row.challenger_id as string,
      name: row.challenger_name as string,
      isCreator: true,
      status: "angenommen",
      place: status === "ausgewertet" ? (result === "opponent" ? 2 : 1) : undefined,
      payout: status === "ausgewertet" ? (result === "challenger" ? credited : result === "unentschieden" ? stake : 0) : undefined,
      games: [],
    },
  ];
  if (row.opponent_id) {
    players.push({
      userId: row.opponent_id as string,
      name: row.opponent_name as string,
      isCreator: false,
      status:
        status === "pending" ? "eingeladen" : status === "abgelehnt" ? "abgelehnt" : status === "verfallen" ? "verfallen" : "angenommen",
      place: status === "ausgewertet" ? (result === "challenger" ? 2 : 1) : undefined,
      payout: status === "ausgewertet" ? (result === "opponent" ? credited : result === "unentschieden" ? stake : 0) : undefined,
      games: [],
    });
  }
  return players;
}

function mapDuel(row: Record<string, unknown>, players: DuelPlayer[] | undefined): Duel {
  const matchIds = (row.match_ids as string[] | null) ?? [row.match_id as string];
  return {
    id: row.id as string,
    creatorId: row.challenger_id as string,
    creatorName: row.challenger_name as string,
    matchIds,
    stake: row.stake as number,
    status: row.status as DuelStatus,
    createdAt: row.created_at as string,
    resolvedAt: (row.resolved_at as string | null) ?? undefined,
    players: (players ?? legacyPlayers(row)).sort(
      (a, b) => Number(b.isCreator) - Number(a.isCreator) || a.name.localeCompare(b.name, "de")
    ),
  };
}

export function duelAcceptUntil(duel: Duel, matches: Match[]): number | null {
  const times = duel.matchIds
    .map((id) => matches.find((m) => m.id === id))
    .filter((m): m is Match => !!m)
    .map((m) => new Date(m.tipDeadline || m.kickoff).getTime())
    .filter((t) => !Number.isNaN(t));
  return times.length ? Math.min(...times) : null;
}

export function DuelsProvider({ children }: { children: ReactNode }) {
  const { matches, addActivity } = useAppData();
  const { displayName, authUserId, refreshStars } = useUser();
  const { showToast } = useFeedback();
  const [duels, setDuels] = useState<Duel[]>([]);
  const [rules, setRules] = useState<DuelRules>(DEFAULT_DUEL_RULES);
  const loadedRef = useRef(false);
  const previousRef = useRef<Map<string, Duel>>(new Map());
  // Eigene Aktionen nicht nochmal als Hinweis anzeigen.
  const ownActionRef = useRef<Set<string>>(new Set());
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hinweise, wenn sich etwas bei den anderen getan hat (neue Einladung,
  // Einladung zurückgezogen, Duell ausgewertet).
  function announceChanges(next: Duel[]) {
    const before = previousRef.current;
    let coinsChanged = false;
    for (const duel of next) {
      const old = before.get(duel.id);
      const me = duel.players.find((p) => p.userId === authUserId);
      if (!me) continue;
      const mine = ownActionRef.current.has(duel.id);
      if (!old) {
        if (loadedRef.current && !me.isCreator && me.status === "eingeladen" && duel.status === "pending") {
          showToast(`⚔️ ${duel.creatorName} lädt dich zu einem Duell ein (Einsatz ${duel.stake} Coins)`, "gold");
        }
        continue;
      }
      if (old.status !== duel.status) {
        coinsChanged = true;
        if (!mine && duel.status === "zurueckgezogen" && !me.isCreator) {
          showToast(
            me.status === "angenommen"
              ? `↩️ ${duel.creatorName} hat das Duell zurückgezogen – deine ${duel.stake} Coins sind zurück.`
              : `↩️ ${duel.creatorName} hat die Duell-Einladung zurückgezogen.`,
            "info"
          );
        }
      }
      if (me.isCreator && !mine) {
        for (const player of duel.players) {
          const was = old.players.find((p) => p.userId === player.userId);
          if (was?.status === "eingeladen" && player.status === "angenommen") showToast(`⚔️ ${player.name} hat dein Duell angenommen`, "gold");
          if (was?.status === "eingeladen" && player.status === "abgelehnt") showToast(`${player.name} hat dein Duell abgelehnt`, "info");
        }
      }
    }
    if (coinsChanged && loadedRef.current) refreshStars();
    previousRef.current = new Map(next.map((d) => [d.id, d]));
    ownActionRef.current.clear();
    loadedRef.current = true;
  }

  async function loadDuels(isCancelled: () => boolean = () => false) {
    if (!authUserId) return;
    // Abgelaufene Einladungen gleich abschließen (Einsatz zurück usw.).
    await supabase.rpc("expire_my_duels");
    const { data, error } = await supabase.from("duels").select("*").order("created_at", { ascending: false });
    if (isCancelled()) return;
    if (error || !data) {
      if (error) console.warn("Duelle konnten nicht geladen werden:", error.message);
      return;
    }
    const ids = data.map((row) => row.id as string);
    const byDuel = new Map<string, DuelPlayer[]>();
    let haveParticipants = false;
    if (ids.length) {
      const res = await supabase.from("duel_participants").select("*").in("duel_id", ids);
      if (isCancelled()) return;
      if (!res.error && res.data) {
        haveParticipants = true;
        for (const row of res.data) {
          const list = byDuel.get(row.duel_id as string) ?? [];
          list.push(mapPlayer(row));
          byDuel.set(row.duel_id as string, list);
        }
      }
    }
    const next = data.map((row) => mapDuel(row, haveParticipants ? byDuel.get(row.id as string) : undefined));
    announceChanges(next);
    setDuels(next);
  }

  function scheduleReload() {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => void loadDuels(), 250);
  }

  // Realtime kann im Hintergrund (Handy gesperrt) Meldungen verpassen.
  useAppRefresh(() => loadDuels());

  useEffect(() => {
    void supabase
      .from("duel_settings")
      .select("*")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setRules({
          maxPlayers: data.max_players,
          maxGames: data.max_games,
          maxStake: data.max_stake,
          dayWinCap: data.day_win_cap,
          weekWinCap: data.week_win_cap,
          pairPerWeek: data.pair_per_week,
          minTips: data.min_tips,
          minAccountDays: data.min_account_days,
        });
      });
  }, []);

  useEffect(() => {
    loadedRef.current = false;
    previousRef.current = new Map();
    if (!authUserId) {
      setDuels([]);
      return;
    }
    let cancelled = false;
    void loadDuels(() => cancelled);

    // Jede Änderung an einem Duell oder seiner Spielerliste (die Datenbank
    // schickt nur, was man sehen darf) -> neu laden. So kommt eine
    // Einladung, Annahme oder ein Zurückziehen sofort auf allen Geräten an.
    const channel = supabase
      .channel(`duels_live_${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, () => scheduleReload())
      .on("postgres_changes", { event: "*", schema: "public", table: "duel_participants" }, () => scheduleReload())
      .subscribe();

    return () => {
      cancelled = true;
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabase.removeChannel(channel);
    };
    // loadDuels liest bewusst den aktuellen Render-Stand.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUserId]);

  const acceptUntil = useCallback((duel: Duel) => duelAcceptUntil(duel, matches), [matches]);

  const invitesForMe = duels.filter((d) => {
    if (d.status !== "pending") return false;
    const me = d.players.find((p) => p.userId === authUserId);
    if (!me || me.isCreator || me.status !== "eingeladen") return false;
    const until = duelAcceptUntil(d, matches);
    return until === null || until > Date.now();
  });

  async function findPlayer(name: string): Promise<{ player?: DuelInvitee; error?: string }> {
    const trimmed = name.trim();
    if (!trimmed) return { error: "Gib den Namen eines Mitspielers ein." };
    if (trimmed.toLowerCase() === displayName.toLowerCase()) return { error: "Du kannst dich nicht selbst einladen." };
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", trimmed)
      .limit(1)
      .maybeSingle();
    if (error) return { error: "Suche fehlgeschlagen, versuch es nochmal." };
    if (!data) return { error: `Kein Spieler namens „${trimmed}“ gefunden.` };
    if (data.id === authUserId) return { error: "Du kannst dich nicht selbst einladen." };
    return { player: { id: data.id as string, name: data.display_name as string } };
  }

  async function createDuel(invitees: DuelInvitee[], matchIds: string[], stake: number) {
    if (!authUserId) return { ok: false, error: "Du musst eingeloggt sein, um jemanden herauszufordern." };
    if (invitees.length === 0) return { ok: false, error: "Lade mindestens einen Gegner ein." };
    if (matchIds.length === 0) return { ok: false, error: "Wähle mindestens ein Spiel aus." };
    if (!stake || stake < 1) return { ok: false, error: "Gib einen gültigen Einsatz ein." };
    if (stake > rules.maxStake) return { ok: false, error: `Einsatz höchstens ${rules.maxStake} Coins pro Duell.` };

    const { data, error } = await supabase.rpc("create_duel", {
      p_invitees: invitees.map((p) => p.id),
      p_match_ids: matchIds,
      p_stake: stake,
    });
    refreshStars();
    if (error || !data) {
      return { ok: false, error: duelErrorMessage(error ?? {}, "Duell konnte nicht gespeichert werden, versuch es nochmal.") };
    }
    const actualStake = (data as { stake: number }).stake ?? stake;
    ownActionRef.current.add((data as { id: string }).id);
    const names = invitees.map((p) => p.name).join(", ");
    addActivity("⚔️", `Du hast ${names} zum Duell herausgefordert (Einsatz ${actualStake} Coins).`, {
      author: displayName,
      text: `${displayName} hat ${names} zum Duell herausgefordert (Einsatz ${actualStake} Coins).`,
    });
    await loadDuels();
    return { ok: true, stake: actualStake };
  }

  async function acceptDuel(duelId: string): Promise<DuelActionResult> {
    const duel = duels.find((d) => d.id === duelId);
    if (!duel || !authUserId) return { ok: false, error: "Duell nicht gefunden." };
    ownActionRef.current.add(duelId);
    const { error } = await supabase.rpc("accept_duel", { p_duel_id: duelId });
    refreshStars();
    if (error) return { ok: false, error: duelErrorMessage(error, "Annahme konnte nicht gespeichert werden, versuch es nochmal.") };
    addActivity("⚔️", `Du hast das Duell von ${duel.creatorName} angenommen (Einsatz ${duel.stake} Coins).`, {
      author: displayName,
      text: `${displayName} hat das Duell von ${duel.creatorName} angenommen (Einsatz ${duel.stake} Coins).`,
    });
    await loadDuels();
    return { ok: true };
  }

  async function declineDuel(duelId: string): Promise<DuelActionResult> {
    const duel = duels.find((d) => d.id === duelId);
    if (!duel) return { ok: false, error: "Duell nicht gefunden." };
    ownActionRef.current.add(duelId);
    const { error } = await supabase.rpc("decline_duel", { p_duel_id: duelId });
    if (error) return { ok: false, error: duelErrorMessage(error, "Ablehnen fehlgeschlagen, versuch es nochmal.") };
    addActivity("🚫", `Du hast das Duell von ${duel.creatorName} abgelehnt.`);
    await loadDuels();
    return { ok: true };
  }

  async function withdrawDuel(duelId: string): Promise<DuelActionResult> {
    ownActionRef.current.add(duelId);
    const { error } = await supabase.rpc("withdraw_duel", { p_duel_id: duelId });
    refreshStars();
    if (error) return { ok: false, error: duelErrorMessage(error, "Zurückziehen fehlgeschlagen, versuch es nochmal.") };
    await loadDuels();
    return { ok: true };
  }

  return (
    <DuelsContext.Provider
      value={{ duels, invitesForMe, rules, acceptUntil, findPlayer, createDuel, acceptDuel, declineDuel, withdrawDuel }}
    >
      {children}
    </DuelsContext.Provider>
  );
}

export function useDuels() {
  const context = useContext(DuelsContext);
  if (!context) {
    throw new Error("useDuels muss innerhalb von <DuelsProvider> verwendet werden");
  }
  return context;
}
