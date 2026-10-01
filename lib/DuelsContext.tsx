"use client";

// Kopf-an-Kopf-Duelle: 1-gegen-1 mit Sterne-Einsatz gegen einen ECHTEN,
// registrierten User (vorher war der Gegner nur simuliert, weil es kein
// Backend gab). Ablauf: Herausfordern (Einsatz ist sofort weg) -> Gegner
// nimmt an (eigener Einsatz ist jetzt auch weg) oder lehnt ab (Einsatz kommt
// zurück) -> sobald der Admin das Spiel beendet, wertet eine SQL-Funktion in
// Supabase (resolve_duels_for_match, siehe supabase/social-features.sql)
// alle offenen Duelle dieses Spiels anhand der echten, normal abgegebenen
// Tipps beider Seiten aus und schreibt Sterne auf BEIDEN Konten gut. Das
// muss serverseitig passieren, weil aus dem Browser der einen Person heraus
// nie das Sterne-Guthaben der anderen Person verändert werden darf.

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabaseClient";
import { useAppData } from "./AppDataContext";
import { useUser } from "./UserContext";
import { Duel, DuelStatus } from "./duelTypes";

interface CreateDuelResult {
  ok: boolean;
  error?: string;
}

interface DuelsContextValue {
  duels: Duel[];
  // Herausforderungen, auf die DU antworten musst (an dich gerichtet, noch
  // offen) – getrennt von "duels" herausgefiltert, damit die Seite sie
  // prominent als Einladungen anzeigen kann.
  pendingForMe: Duel[];
  createDuel: (opponentName: string, matchId: string, stake: number) => Promise<CreateDuelResult>;
  acceptDuel: (duelId: string) => Promise<CreateDuelResult>;
  declineDuel: (duelId: string) => Promise<CreateDuelResult>;
  resolveDuelsForMatch: (matchId: string, actualHome: number, actualAway: number) => void;
}

const DuelsContext = createContext<DuelsContextValue | null>(null);

// Supabase meldet so, dass eine SQL-Funktion (noch) nicht existiert.
function isMissingFunction(error: { code?: string; message?: string }) {
  return error.code === "PGRST202" || error.code === "42883";
}

function mapRow(row: Record<string, unknown>): Duel {
  return {
    id: row.id as string,
    challengerId: row.challenger_id as string,
    challengerName: row.challenger_name as string,
    opponentId: row.opponent_id as string,
    opponentName: row.opponent_name as string,
    matchId: row.match_id as string,
    stake: row.stake as number,
    status: row.status as DuelStatus,
    createdAt: row.created_at as string,
    myTier: (row.my_tier as Duel["myTier"]) ?? undefined,
    opponentTier: (row.opponent_tier as Duel["opponentTier"]) ?? undefined,
    result: (row.result as Duel["result"]) ?? undefined,
    starsCredited: (row.stars_credited as number | null) ?? undefined,
    resolvedAt: (row.resolved_at as string | null) ?? undefined,
  };
}

export function DuelsProvider({ children }: { children: ReactNode }) {
  const { matches, addActivity } = useAppData();
  const { displayName, authUserId, spendStars, creditStars, refreshStars } = useUser();
  const [duels, setDuels] = useState<Duel[]>([]);

  // Läd alle Duelle, an denen der aktuelle Account beteiligt ist (egal ob
  // als Herausforderer oder Gegner), und hält sie per Realtime aktuell –
  // wichtig, damit z. B. eine Annahme/Ablehnung sofort im Browser der
  // GEGENSEITE auftaucht, ohne dass die Seite neu geladen werden muss.
  useEffect(() => {
    if (!authUserId) {
      setDuels([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("duels")
        .select("*")
        .or(`challenger_id.eq.${authUserId},opponent_id.eq.${authUserId}`)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (error) {
        console.warn("Duelle konnten nicht geladen werden:", error.message);
        return;
      }
      if (data) setDuels(data.map(mapRow));
    })();

    const channel = supabase
      .channel(`duels_live_${authUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "duels" }, (payload) => {
        const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
        if (!row) return;
        if (row.challenger_id !== authUserId && row.opponent_id !== authUserId) return;

        if (payload.eventType === "DELETE") {
          setDuels((current) => current.filter((d) => d.id !== row.id));
          return;
        }
        const mapped = mapRow(row);
        // Abgelehnt, verfallen oder ausgewertet: Die Datenbank hat dabei
        // Sterne gutgeschrieben (Rückzahlung bzw. Gewinn) – den echten Stand
        // holen, damit er sofort sichtbar ist.
        if (mapped.status === "abgelehnt" || mapped.status === "verfallen" || mapped.status === "ausgewertet") {
          refreshStars();
        }
        setDuels((current) => {
          const exists = current.some((d) => d.id === mapped.id);
          return exists ? current.map((d) => (d.id === mapped.id ? mapped : d)) : [mapped, ...current];
        });
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [authUserId]);

  const pendingForMe = duels.filter((d) => d.status === "pending" && d.opponentId === authUserId);

  async function createDuel(opponentName: string, matchId: string, stake: number): Promise<CreateDuelResult> {
    if (!authUserId) return { ok: false, error: "Du musst eingeloggt sein, um jemanden herauszufordern." };
    const match = matches.find((m) => m.id === matchId);
    if (!match) return { ok: false, error: "Spiel nicht gefunden." };
    if (new Date(match.tipDeadline).getTime() <= Date.now()) {
      return { ok: false, error: "Tippschluss für dieses Spiel ist schon vorbei." };
    }
    const trimmedName = opponentName.trim();
    if (!trimmedName || trimmedName.toLowerCase() === displayName.toLowerCase()) {
      return { ok: false, error: "Gib den Anzeigenamen eines anderen registrierten Users ein." };
    }
    if (stake < 1) return { ok: false, error: "Gib einen gültigen Einsatz ein." };

    const { data: opponentProfile, error: lookupError } = await supabase
      .from("profiles")
      .select("id, display_name")
      .ilike("display_name", trimmedName)
      .limit(1)
      .maybeSingle();
    if (lookupError) return { ok: false, error: "Suche fehlgeschlagen, versuch es nochmal." };
    if (!opponentProfile) {
      return { ok: false, error: `Kein registrierter User namens „${trimmedName}“ gefunden.` };
    }
    if (opponentProfile.id === authUserId) {
      return { ok: false, error: "Du kannst dich nicht selbst herausfordern." };
    }

    const actualStake = spendStars(stake);
    if (actualStake <= 0) return { ok: false, error: "Nicht genug Sterne für diesen Einsatz." };

    const id = `duel-${Date.now()}`;
    const { error: insertError } = await supabase.from("duels").insert({
      id,
      challenger_id: authUserId,
      challenger_name: displayName,
      opponent_id: opponentProfile.id,
      opponent_name: opponentProfile.display_name,
      match_id: matchId,
      stake: actualStake,
      status: "pending",
    });
    if (insertError) {
      // Einsatz war schon weg, aber das Duell kam nie an -> zurückbuchen.
      creditStars(actualStake);
      return { ok: false, error: "Duell konnte nicht gespeichert werden, versuch es nochmal." };
    }

    setDuels((current) => [
      {
        id,
        challengerId: authUserId,
        challengerName: displayName,
        opponentId: opponentProfile.id,
        opponentName: opponentProfile.display_name,
        matchId,
        stake: actualStake,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);

    addActivity("⚔️", `Du hast ${opponentProfile.display_name} zum Duell herausgefordert (${actualStake} Sterne).`, {
      author: displayName,
      text: `${displayName} hat ${opponentProfile.display_name} zum Duell herausgefordert (${actualStake} Sterne).`,
    });
    return { ok: true };
  }

  async function acceptDuel(duelId: string): Promise<CreateDuelResult> {
    const duel = duels.find((d) => d.id === duelId);
    if (!duel || !authUserId) return { ok: false, error: "Duell nicht gefunden." };
    if (duel.opponentId !== authUserId) return { ok: false, error: "Nur der Herausgeforderte kann annehmen." };
    if (duel.status !== "pending") return { ok: false, error: "Duell ist nicht mehr offen." };

    const actualStake = spendStars(duel.stake);
    if (actualStake < duel.stake) {
      if (actualStake > 0) creditStars(actualStake);
      return { ok: false, error: "Nicht genug Sterne, um diesen Einsatz anzunehmen." };
    }

    // Annehmen über die SQL-Funktion accept_duel (supabase/fixes-features40.sql),
    // weil die Duell-Zeile seitdem nicht mehr direkt geändert werden darf.
    // Fällt auf das alte direkte Update zurück, solange das Skript noch nicht
    // ausgeführt wurde.
    let { error } = await supabase.rpc("accept_duel", { p_duel_id: duelId });
    if (error && isMissingFunction(error)) {
      ({ error } = await supabase.from("duels").update({ status: "offen" }).eq("id", duelId));
    }
    if (error) {
      creditStars(actualStake);
      return { ok: false, error: "Annahme konnte nicht gespeichert werden, versuch es nochmal." };
    }

    setDuels((current) => current.map((d) => (d.id === duelId ? { ...d, status: "offen" } : d)));
    addActivity("⚔️", `Du hast die Herausforderung von ${duel.challengerName} angenommen (${duel.stake} Sterne).`, {
      author: displayName,
      text: `${displayName} hat die Herausforderung von ${duel.challengerName} angenommen (${duel.stake} Sterne).`,
    });
    return { ok: true };
  }

  async function declineDuel(duelId: string): Promise<CreateDuelResult> {
    const duel = duels.find((d) => d.id === duelId);
    if (!duel) return { ok: false, error: "Duell nicht gefunden." };
    const { error } = await supabase.rpc("decline_duel", { p_duel_id: duelId });
    if (error) return { ok: false, error: "Ablehnen fehlgeschlagen, versuch es nochmal." };
    setDuels((current) => current.map((d) => (d.id === duelId ? { ...d, status: "abgelehnt" } : d)));
    addActivity("🚫", `Du hast die Herausforderung von ${duel.challengerName} abgelehnt.`);
    return { ok: true };
  }

  // Wird beim Beenden eines Spiels aufgerufen (siehe app/admin/page.tsx).
  // Läuft serverseitig über eine SQL-Funktion statt lokal zu rechnen, weil
  // dabei ggf. Sterne auf dem Konto der GEGENSEITE gutgeschrieben werden
  // müssen – das darf aus diesem Browser heraus nicht direkt passieren.
  function resolveDuelsForMatch(matchId: string, actualHome: number, actualAway: number) {
    supabase
      .rpc("resolve_duels_for_match", { p_match_id: matchId, p_actual_home: actualHome, p_actual_away: actualAway })
      .then(({ error }) => {
        if (error) console.warn("Duelle konnten nicht ausgewertet werden:", error.message);
      });
  }

  return (
    <DuelsContext.Provider
      value={{ duels, pendingForMe, createDuel, acceptDuel, declineDuel, resolveDuelsForMatch }}
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
